using { coruja.procurement as db } from '../db/schema';
using { OP_API_BUSINESS_PARTNER_SRV as S4BusinessPartner }
  from './external/OP_API_BUSINESS_PARTNER_SRV';
using { OP_API_COSTCENTER_SRV_0001 as S4CostCenter }
  from './external/OP_API_COSTCENTER_SRV_0001';
using { OP_API_PRODUCT_SRV_0001 as S4Product }
  from './external/OP_API_PRODUCT_SRV_0001';

@path: '/procurement'
@requires: 'authenticated-user'
service ProcurementService {


    @restrict: [
      { grant: 'READ', to: 'authenticated-user', where: (requesterId = $user) },
      { grant: 'CREATE', to: 'authenticated-user' },
      {
            grant: 'UPDATE',
            to: 'authenticated-user',
            where: (requesterId = $user and status = 'Draft')
      }
    ]
    entity PurchaseRequests as projection on db.PurchaseRequests {
        ID,
        createdAt,
        createdBy,
        modifiedAt,
        modifiedBy,
        requestNumber @Core.Computed,
        requesterId @Core.Computed,
        supplierNumber,
        supplierNameSnapshot,
        controllingArea,
        costCenterCode,
        currency_code,
        costCenterNameSnapshot,
        businessJustification,
        status @Core.Computed,
        submittedAt @Core.Computed,
        approvedAt @Core.Computed,
        rejectedAt @Core.Computed,
        items,
        approvalSteps,
        events
    };

  @readonly
  entity S4Suppliers as projection on S4BusinessPartner.A_Supplier {
    Supplier,
    SupplierName,
    SupplierFullName,
    PurchasingIsBlocked
  };

  @readonly
  entity S4CostCenters as projection on S4CostCenter.A_CostCenter {
    ControllingArea,
    CostCenter,
    ValidityEndDate,
    ValidityStartDate,
    CompanyCode,
    CostCtrResponsibleUser,
    CostCtrResponsiblePersonName,
    CostCenterCurrency
  };

  @readonly
  entity S4Products as projection on S4Product.A_Product {
    Product,
    ProductType,
    ProductGroup,
    BaseUnit,
    to_Description
  };

 @readonly
  entity S4ProductDescriptions as projection on S4Product.A_ProductDescription {
    Product,
    Language,
    ProductDescription
  }; 

  @readonly
  entity ApprovalPolicy as projection on db.ApprovalPolicy;

  @readonly
  entity ApprovalSteps as projection on db.ApprovalSteps;

  @readonly
  entity RequestEvents as projection on db.RequestEvents;

  @readonly
  entity PurchaseOrderSyncs as projection on db.PurchaseOrderSyncs;

  @requires: 'ProcurementApprover'
  action approveRequest(
    requestID : UUID,
    comment: LargeString
  ) returns PurchaseRequests;

  @requires: 'ProcurementApprover'
  action rejectRequest(
    requestID: UUID,
    comment: LargeString
  ) returns PurchaseRequests;

  action submitRequest(
    requestID: UUID
  ) returns PurchaseRequests;

  action cancelRequest(
    requestID: UUID,
    comment: LargeString
  ) returns PurchaseRequests;

  @requires: 'ProcurementApprover'
  function myApprovals() returns many PurchaseRequests;
}