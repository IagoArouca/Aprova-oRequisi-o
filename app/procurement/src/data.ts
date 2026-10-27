export type RequestStatus =
  | "Draft"
  | "InApproval"
  | "Approved"
  | "Rejected";

export type PurchaseRequest = {
    id: string;
    title: string;
    requester: string;
    costCenter: string;
    amount: number;
    status: RequestStatus;
    updatedAt: string;
    nextApprover?: string;
};

export const DEMO_REQUESTS: PurchaseRequest[] = [
    {
      id: "PR-2026-0104",
      title: "Scanners para equipe de operações",
      requester: "Ana Martins",
      costCenter: "CC-OPS",
      amount: 6400,
      status: "InApproval",
      updatedAt: "Hoje, 09:42",
      nextApprover: "Financeiro",
    },
    {
      id: "PR-2026-0103",
      title: "Licenças de análise de dados",
      requester: "Rafael Costa",
      costCenter: "CC-DATA",
      amount: 18400,
      status: "InApproval",
      updatedAt: "Hoje, 08:15",
      nextApprover: "Diretoria",
   },
   {
    id: "PR-2026-0102",
    title: "Materiais para escritório",
    requester: "Ana Martins",
    costCenter: "CC-OPS",
    amount: 1280.5,
    status: "Draft",
    updatedAt: "Ontem, 16:28",
  },
  {
    id: "PR-2026-0101",
    title: "Atualização de notebooks",
    requester: "Marina Souza",
    costCenter: "CC-TECH",
    amount: 42800,
    status: "Approved",
    updatedAt: "21 out, 14:06",
  },
  {
    id: "PR-2026-0100",
    title: "Consultoria de segurança",
    requester: "Lucas Almeida",
    costCenter: "CC-TECH",
    amount: 9600,
    status: "Rejected",
    updatedAt: "20 out, 11:31",
  },
]