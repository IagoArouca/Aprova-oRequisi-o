namespace coruja.procurement;

using { cuid, managed } from '@sap/cds/common';

type StatusPurchaseRequests : String enum {
    Draft;
    Submitted;
    InApproval;
    Approved;
    Rejected;
    Cancelled;
} default 'Draft';

type statusApprovalSteps : String enum {
    Pending;
    Approved;
    Rejected;
    Skipped;
} default 'Pending';

type PurchaseOrderSyncStatus : String enum {
    Pending;
    Processing;
    Created;
    Failed;
} default 'Pending';


entity ApprovalPolicy : cuid, managed {
    controllingArea   : String(4) @mandatory;
    costCenterCode    : String(10) @mandatory;
    stepNumber        : Integer @mandatory;
    minAmount         : Decimal(15,2) @mandatory;
    maxAmount         : Decimal(15,2) @mandatory;
    currency_code     : String(3) @mandatory;
    approverUserId    : String(255) @mandatory;
    approverRole      : String(80) @mandatory;
    active            : Boolean default true;
    description       : String(200);
}

entity PurchaseRequests   : cuid, managed {
    requestNumber         : String(20);
    requesterId           : String(255) @mandatory;
    supplierNumber         : String(10) @mandatory;
    supplierNameSnapshot   : String(220);
    controllingArea       : String(4) @mandatory;
    costCenterCode        : String(10) @mandatory;
    costCenterNameSnapshot : String(120);
    businessJustification  : LargeString @mandatory;
    status                : StatusPurchaseRequests;
    submittedAt           : Timestamp;
    approvedAt            : Timestamp;
    rejectedAt            : Timestamp;
    currency_code         : String(3) @mandatory;
    items                 : Composition of many PurchaseRequestItems
                                on items.request = $self;
    approvalSteps         : Composition of many ApprovalSteps
                                on approvalSteps.request = $self;
    events                : Composition of many RequestEvents
                                on events.request = $self;

    purchaseOrderSyncs    : Composition of many PurchaseOrderSyncs 
                                on purchaseOrderSyncs.request = $self;
}

entity PurchaseRequestItems : cuid, managed {
    request         : Association to one PurchaseRequests;
    productNumber   : String(40);
    description     : String(240) @mandatory;
    quantity        : Decimal(13,3) @mandatory;
    unitOfMeasure   : String(3) @mandatory;
    @Semantics.amount.currencyCode: 'currency_code'
    unitPrice       : Decimal(15,2) @mandatory;
    currency_code   : String(3) @mandatory;
}

entity ApprovalSteps : cuid, managed {
    request           : Association to one PurchaseRequests;
    policy            : Association to one ApprovalPolicy;
    stepNumber        : Integer @mandatory;
    approverUserId    : String(255) @mandatory;
    approverRole    : String(80) @mandatory;
    status            : statusApprovalSteps;
    decidedAt         : Timestamp;
    decisionComment   : LargeString;
}

entity RequestEvents : cuid {
  request       : Association to one PurchaseRequests;
  eventType     : String(40) @mandatory;
  actorUserId   : String(255) @mandatory;
  occurredAt    : Timestamp @mandatory;
  fromStatus    : String(20);
  toStatus      : String(20);
  comment       : LargeString;
}

entity PurchaseOrderSyncs : cuid, managed {
  request             : Association to one PurchaseRequests;
  status              : PurchaseOrderSyncStatus default 'Pending';
  s4PurchaseOrderNumber : String(10);
  idempotencyKey      : String(80) @mandatory;
  attemptCount        : Integer default 0;
  lastAttemptAt       : Timestamp;
  lastError           : LargeString;
}
