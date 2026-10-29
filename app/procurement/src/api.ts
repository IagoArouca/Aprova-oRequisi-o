const serviceRoot = "/odata/v4/procurement";

export type Supplier = {
  Supplier: string;
  SupplierName?: string;
  SupplierFullName?: string;
  PurchasingIsBlocked: boolean;
};

export type CostCenter = {
  ControllingArea: string;
  CostCenter: string;
  ValidityEndDate: string;
  ValidityStartDate?: string;
  CompanyCode?: string;
  CostCtrResponsibleUser?: string;
  CostCtrResponsiblePersonName?: string;
  CostCenterCurrency?: string;
};

export type Product = {
  Product: string;
  ProductType?: string;
  ProductGroup?: string;
  BaseUnit?: string;
};

export type RequestItem = {
  ID: string;
  productNumber?: string;
  description: string;
  quantity: number;
  unitOfMeasure: string;
  unitPrice: number;
  currency_code: string;
};

export type PurchaseRequestDto = {
  ID: string;
  requestNumber?: string;
  requesterId?: string;
  supplierNumber: string;
  supplierNameSnapshot?: string;
  controllingArea: string;
  costCenterCode: string;
  costCenterNameSnapshot?: string;
  businessJustification: string;
  currency_code: string;
  status: "Draft" |  "Submitted" | "InApproval" | "Approved" | "Rejected" | "Cancelled";
  createdAt?: string;
  modifiedAt?: string;
  items?: RequestItem[];
};

export type CreatePurchaseRequestPayload = {
  supplierNumber: string;
  supplierNameSnapshot: string;
  controllingArea: string;
  costCenterCode: string;
  costCenterNameSnapshot: string;
  businessJustification: string;
  currency_code: string;
  items: Array<{
    productNumber?: string;
    description: string;
    quantity: number;
    unitOfMeasure: string;
    unitPrice: number;
    currency_code: string;
  }>;
};

type ODataCollection<T> = {
  value: T[];
};
let csrfToken: string | null = null;

async function readCsrfToken() {
    const response = await fetch(`${serviceRoot}/$metadata`, {
        credentials: "include",
        headers: {"x-csrf-token": "fetch"}
    });

    if(!response.ok) {
        throw new Error(`Não foi possível iniciar sessão no CAP (${response.status})`);
    }

    csrfToken = response.headers.get("x-csrf-token");

    if (!csrfToken) {
        throw new Error("CAP não retornou o token CSRF");
    }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const method = (init.method ?? "GET").toUpperCase();

    if(method !== "GET" && !csrfToken) {
        await readCsrfToken();
    }
    
    const headers = new Headers(init.headers);
    headers.set("Accept", "application/json");

    if(init.body) {
        headers.set("Content-Type", "application/json");
    }

    if(method !== "GET" && csrfToken) {
        headers.set("x-csrf-token", csrfToken);
    }

    const response = await fetch(`${serviceRoot}/${path}`, {
        ...init,
        method,
        headers,
        credentials: "include"
    });

    if(!response.ok){
        const body = await response.json().catch(() => null);
        const message = 
            body?.error?.message ?? `Erro na chamada CAP (${response.status})`;
        throw new Error(message);
    }

    if(response.status === 204) {
        return undefined as T;
    }

    return response.json() as Promise<T>;
}

export async function getSuppliers(){
    const query = new URLSearchParams({
    "$select": "Supplier,SupplierName,SupplierFullName,PurchasingIsBlocked",
    "$top": "100",
  });

  const result = await request<ODataCollection<Supplier>>(
    `S4Suppliers?${query}`,
  );

  return result.value.filter((supplier) => !supplier.PurchasingIsBlocked);
}

export async function getCostCenters() {
  const query = new URLSearchParams({
    "$select":
      "ControllingArea,CostCenter,ValidityStartDate,ValidityEndDate,CompanyCode,CostCtrResponsibleUser,CostCtrResponsiblePersonName,CostCenterCurrency",
    "$top": "200",
  });

  const result = await request<ODataCollection<CostCenter>>(
    `S4CostCenters?${query}`,
  );

  return result.value;
}

export async function getProducts() {
  const query = new URLSearchParams({
    "$select": "Product,ProductType,ProductGroup,BaseUnit",
    "$top": "100",
  });

  const result = await request<ODataCollection<Product>>(
    `S4Products?${query}`,
  );

  return result.value;
}

export async function getPurchaseRequests() {
  const query = new URLSearchParams({
    "$select":
      "ID,requestNumber,requesterId,supplierNumber,supplierNameSnapshot,controllingArea,costCenterCode,costCenterNameSnapshot,businessJustification,currency_code,status,createdAt,modifiedAt",
    "$expand": "items($select=ID,productNumber,description,quantity,unitOfMeasure,unitPrice,currency_code)",
    "$orderby": "modifiedAt desc",
  });

  const result = await request<ODataCollection<PurchaseRequestDto>>(
    `PurchaseRequests?${query}`,
  );

  return result.value;
}

export function createPurchaseRequest(payload: CreatePurchaseRequestPayload) {
  return request<PurchaseRequestDto>("PurchaseRequests", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function submitPurchaseRequest(requestID: string) {
  return request<PurchaseRequestDto>("submitRequest", {
    method: "POST",
    body: JSON.stringify({ requestID }),
  });
}


export function approvePurchaseRequest(requestID: string, comment: string) {
  return request<PurchaseRequestDto>("approveRequest", {
    method: "POST",
    body: JSON.stringify({ requestID, comment }),
  });
}

export function rejectPurchaseRequest(requestID: string, comment: string) {
  return request<PurchaseRequestDto>("rejectRequest", {
    method: "POST",
    body: JSON.stringify({ requestID, comment }),
  });
}

export async function getMyApprovals(): Promise<PurchaseRequestDto[]> {
  const result = await request<ODataCollection<PurchaseRequestDto>>(
    "myApprovals()",
  );

  return result.value;
}

