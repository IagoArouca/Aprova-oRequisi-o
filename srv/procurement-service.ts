import cds from "@sap/cds";
import {
  PurchaseRequests as PurchaseRequestsEntity,
  PurchaseRequestItems as PurchaseRequestItemsEntity,
  RequestEvents as RequestEventsEntity,
  ApprovalSteps as ApprovalStepsEntity,
  ApprovalPolicy as ApprovalPolicyEntity,
} from "#cds-models/coruja/procurement";

const { SELECT, UPDATE, INSERT } = cds.ql;

export default class ProcurementService extends cds.ApplicationService {
  async init() {
    const { PurchaseRequests } = this.entities;

    this.before('CREATE', PurchaseRequests, this.setRequester);
    this.on('submitRequest', this.submitRequest);
    this.on('approveRequest', this.approveRequest);
    this.on('rejectRequest', this.rejectRequest);
    this.on("myApprovals", this.myApprovals);

    return super.init();
  }

  private setRequester(req: cds.Request) {
    const userId = req.user?.id;
    if(!userId) {
        return req.reject(401, "Authentication required");
    }

    req.data.requesterId = userId;
    req.data.status = "Draft";
  }

  private async submitRequest(req: cds.Request) {
    const { requestID } = req.data;
    const userId = req.user?.id;

    if (!userId) {
      return req.reject(401, "Authentication required");
    }

    if (typeof requestID !== "string" || requestID.length === 0) {
      return req.reject(400, "requestID is required");
    }

    const tx = cds.tx(req);

    const request = await tx.run(
      SELECT.one
        .from(PurchaseRequestsEntity)
        .where({ ID: requestID }),
    );

    if (!request) {
      return req.reject(404, `Purchase request with ID ${requestID} not found`);
    }

    if (request.requesterId !== userId) {
      return req.reject(403, "You can only submit your own requests");
    }

    if (request.status !== "Draft") {
      return req.reject(409, "Only draft requests can be submitted");
    }

    if(!request.controllingArea || !request.costCenterCode ) {
      return req.reject(
        400,
        "The request must be associated with a cost center"
      );
    }


   const items = await tx.run(
      SELECT.from(PurchaseRequestItemsEntity)
        .columns("quantity", "unitPrice", "currency_code")
        .where({ request_ID: requestID })
    );

    if (!items || items.length === 0) {
      return req.reject(400, "A request must contain at least one item");
    }

    if(items.some((item) => item.currency_code !== request.currency_code)) {
      return req.reject(
        400,
        "All request items must use the request currency",
      )
    }

    const totalAmount = items.reduce((sum: number, item: any) => {
      return sum + Number(item.quantity) * Number(item.unitPrice);
    }, 0);

    const matchingPolicies = await tx.run(
      SELECT.from(ApprovalPolicyEntity)
        .where({
          controllingArea: request.controllingArea,
          costCenterCode: request.costCenterCode,
          currency_code: request.currency_code,
          active: true,
        })
        .orderBy("stepNumber: asc" )
    );

    const applicablePolicies = matchingPolicies.filter((policy: any) => {
      const minAmount = Number(policy.minAmount);
      const maxAmount = Number(policy.maxAmount);
      return totalAmount >= minAmount && totalAmount <= maxAmount;
    });

    if (!applicablePolicies || applicablePolicies.length === 0) {
      return req.reject(
        400,
        "No approval policy was found for this cost center and amount"
      );
    }

    for (const policy of applicablePolicies) {
      if(!policy.approverUserId) {
        return req.reject(
          500,
          `Approval policy step ${policy.stepNumber} has no approver`,
        );
      }

      await tx.run(
        INSERT.into(ApprovalStepsEntity).entries({
          request_ID: requestID,
          policy_ID: policy.ID,
          stepNumber: policy.stepNumber,
          approverUserId: policy.approverUserId,
          approverRole: policy.approverRole,
          status: "Pending",
        })
      );
    }

    const submittedAt = new Date().toISOString();

    const updatedRows = await tx.run<any>(
      UPDATE.entity(PurchaseRequestsEntity)
        .set({
          status: "InApproval",
          submittedAt,
        })
        .where({
          ID: requestID,
          status: "Draft",
        }),
    );

    if(updatedRows !== 1){
      return req.reject(409, "The request was already submitted or is not in draft status");
    }


    await tx.run(
      INSERT.into(RequestEventsEntity).entries({
        request_ID: requestID,
        eventType: "Submitted",
        actorUserId: userId,
        occurredAt: submittedAt,
        fromStatus: "Draft",
        toStatus: "InApproval",
      }),
    );

    return tx.run(
        SELECT.one
            .from(PurchaseRequestsEntity)
            .where({ ID: requestID }),
    );
  }

  private async approveRequest(req: cds.Request) {
    const { requestID, comment } = req.data;
    const userId = req.user?.id;

    if(!userId) {
      return req.reject(401, "Authentication required");
    }

    if(typeof requestID !== "string" || requestID.length === 0) {
      return req.reject(400, "requestID is required");
    }

    const tx = cds.tx(req);

    const request = await tx.run(
      SELECT.one
        .from(PurchaseRequestsEntity)
        .where({ ID: requestID }),
    );

    if(!request) {
      return req.reject(404, `Purchase request with ID ${requestID} not found`);
    }

    if (request.status !== "InApproval") {
      return req.reject(409, "Only requests in approval can be approved");
    }


    const pendingStep = await tx.run(
      SELECT.one
        .from(ApprovalStepsEntity)
        .where({
          request_ID: requestID,
          status: "Pending",
        })
        .orderBy( "stepNumber asc")
    );


    if (!pendingStep) {
      return req.reject(409, "There is no pending approval step for this request");
    }

    
    if (
      pendingStep.approverUserId !== userId ||
      !pendingStep.approverRole ||
      !req.user.is(pendingStep.approverRole)
    ) {
        return req.reject(403, "You are not the approver for this step");
      }

    const decidedAt = new Date().toISOString();

    await tx.run(
      UPDATE.entity(ApprovalStepsEntity)
        .set({
          status: "Approved",
          decidedAt,
          decisionComment: comment ?? null,
        })
        .where({ ID: pendingStep.ID, status: "Pending" })
    );

    const remainingPending = await tx.run(
      SELECT.from(ApprovalStepsEntity)
        .columns("ID")
        .where({
          request_ID: requestID,
          status: "Pending",
        })
    );

    
    if (remainingPending.length === 0) {
      await tx.run(
        UPDATE.entity(PurchaseRequestsEntity)
          .set({
            status: "Approved",
            approvedAt: decidedAt,
          })
          .where({ ID: requestID })
      );

      await tx.run(
        INSERT.into(RequestEventsEntity).entries({
          request_ID: requestID,
          eventType: "Approved",
          actorUserId: userId,
          occurredAt: decidedAt,
          fromStatus: "InApproval",
          toStatus: "Approved",
          comment: comment ?? null,
        }),
      );
    }

    return tx.run(
      SELECT.one
        .from(PurchaseRequestsEntity)
        .where({ ID: requestID })
    );
  }

  private async rejectRequest(req: cds.Request) {
      const { requestID, comment } = req.data;
      const userId = req.user?.id;

      if(!userId) {
        return req.reject(401, "Authentication required");
      }

      if(typeof requestID !== "string" || requestID.length === 0) {
        return req.reject(400, "requestID is required");
      }

      const tx = cds.tx(req);

     const request = await tx.run(
        SELECT.one
          .from(PurchaseRequestsEntity)
          .where({ ID: requestID })
     );

     if(!request) {
      return req.reject(404, "Purchase request not found");
     }

     if(request.status !== "InApproval") {
      return req.reject(409, "Only requests in approval can be rejected");
     }

     const pendingStep = await tx.run(
      SELECT.one
        .from(ApprovalStepsEntity)
        .where({
          request_ID: requestID,
          status: "Pending",
        })
        .orderBy( "stepNumber asc" )
     );

     if(!pendingStep) {
      return req.reject(409, "There is no pending approval step for this request");
     }

     if(pendingStep.approverUserId !== userId) {
      return req.reject(403, "You are not the approver for this step");
     }

     const decidedAt = new Date().toISOString();

     await tx.run(
      UPDATE.entity(ApprovalStepsEntity)
        .set({
          status: "Rejected",
          decidedAt,
          decisionComment: comment ?? null,
        })
        .where({ ID: pendingStep.ID, status: "Pending" })
     );

     await tx.run(
      INSERT.into(RequestEventsEntity).entries({
        request_ID: requestID,
        eventType: "Rejected",
        actorUserId: userId,
        occurredAt: decidedAt,
        fromStatus: "InApproval",
        toStatus: "Rejected",
        comment: comment ?? null,
      })
     );

     return tx.run(
      SELECT.one
        .from(PurchaseRequestsEntity)
        .where({ ID: requestID })
     );
  }

  private async myApprovals(req: cds.Request) {
  const userId = req.user?.id;

  if (!userId) {
    return req.reject(401, "Authentication required");
  }

  if (!req.user.is("ProcurementApprover")) {
    return req.reject(403, "Procurement approver role required");
  }

  const tx = cds.tx(req);

  const assignedSteps = await tx.run(
    SELECT.from(ApprovalStepsEntity)
      .columns("request_ID")
      .where({
        approverUserId: userId,
        status: "Pending",
      }),
  );

  const candidateRequestIds = [
    ...new Set(
      assignedSteps
        .map((step) => step.request_ID)
        .filter((requestId): requestId is string => Boolean(requestId)),
    ),
  ];

  if (candidateRequestIds.length === 0) {
    return [];
  }

  const pendingSteps = await tx.run(
    SELECT.from(ApprovalStepsEntity)
      .columns("request_ID", "stepNumber", "approverUserId", "approverRole")
      .where({
        request_ID: { in: candidateRequestIds },
        status: "Pending",
      })
      .orderBy("request_ID asc", "stepNumber asc"),
  );

  const firstPendingStepByRequest = new Map<
    string,
    (typeof pendingSteps)[number]
  >();

  for (const step of pendingSteps) {
    if (step.request_ID && !firstPendingStepByRequest.has(step.request_ID)) {
      firstPendingStepByRequest.set(step.request_ID, step);
    }
  }

  const authorizedRequestIds = [
    ...firstPendingStepByRequest.values()
      .filter(
        (step) =>
          step.approverUserId === userId &&
          Boolean(step.approverRole) &&
          req.user.is(step.approverRole!),
      )
      .map((step) => step.request_ID!)
  ];

  if (authorizedRequestIds.length === 0) {
    return [];
  }

  return tx.run(
    SELECT.from(PurchaseRequestsEntity)
      .where({
        ID: { in: authorizedRequestIds },
        status: "InApproval",
      })
      .orderBy("modifiedAt desc"),
  );
}
}


