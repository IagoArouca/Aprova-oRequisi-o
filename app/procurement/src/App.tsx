import { useDeferredValue, useEffect, useState, type FormEvent } from "react";
import {
  ArrowDownUp,
  ArrowUpRight,
  Bell,
  Check,
  CheckSquare,
  ChevronDown,
  ChevronLeft,
  CircleDollarSign,
  Clock3,
  FileText,
  LayoutDashboard,
  Plus,
  Search,
  X,
} from "lucide-react";
import {
  approvePurchaseRequest,
  createPurchaseRequest,
  getCostCenters,
  getMyApprovals,
  getProducts,
  getPurchaseRequests,
  getSuppliers,
  rejectPurchaseRequest,
  submitPurchaseRequest,
  type CostCenter,
  type CreatePurchaseRequestPayload,
  type Product,
  type PurchaseRequestDto,
  type RequestItem,
  type Supplier,
} from "./api";
import "./App.css";

type Screen = "overview" | "requests" | "approvals";
type RequestStatus = "Draft" | "InApproval" | "Approved" | "Rejected" | "Cancelled";

type RequestView = {
  id: string;
  displayNumber: string;
  title: string;
  requester: string;
  costCenter: string;
  amount: number;
  currency: string;
  status: RequestStatus;
  updatedAt: string;
  items: RequestItem[];
};

type FirstStepValues = {
  title: string;
  costCenterKey: string;
  amount: string;
};

const statusLabels: Record<RequestStatus, string> = {
  Draft: "Rascunho",
  InApproval: "Em aprovação",
  Approved: "Aprovada",
  Rejected: "Rejeitada",
  Cancelled: "Cancelada",
};

const formatCurrency = (amount: number, currency = "BRL") => {
  try {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency,
    }).format(amount);
  } catch {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(amount);
  }
};

function mapRequest(dto: PurchaseRequestDto): RequestView {
  const items = dto.items ?? [];
  const amount = items.reduce(
    (total, item) =>
      total + Number(item.quantity ?? 0) * Number(item.unitPrice ?? 0),
    0,
  );

  return {
    id: dto.ID,
    displayNumber: dto.requestNumber || dto.ID.slice(0, 8).toUpperCase(),
    title: items[0]?.description || dto.businessJustification,
    requester: dto.requesterId || "Usuário autenticado",
    costCenter: `${dto.controllingArea} / ${dto.costCenterCode}`,
    amount,
    currency: dto.currency_code || "BRL",
    status: dto.status === "Submitted" ? "InApproval" : dto.status,
    updatedAt: dto.modifiedAt
      ? new Date(dto.modifiedAt).toLocaleString("pt-BR")
      : "Agora",
    items,
  };
}

function getCostCenterKey(costCenter: CostCenter) {
  return [
    costCenter.ControllingArea,
    costCenter.CostCenter,
    costCenter.ValidityEndDate,
  ].join("|");
}

function App() {
  const [screen, setScreen] = useState<Screen>("overview");
  const [requests, setRequests] = useState<RequestView[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [wizardStep, setWizardStep] = useState<1 | 2>(1);
  const [firstStepValues, setFirstStepValues] = useState<FirstStepValues>({
    title: "",
    costCenterKey: "",
    amount: "",
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMasters, setIsLoadingMasters] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const deferredSearch = useDeferredValue(search);

  const selectedRequest = requests.find((request) => request.id === selectedId);
  const approvalCount = requests.filter(
    (request) => request.status === "InApproval",
  ).length;
  const draftCount = requests.filter(
    (request) => request.status === "Draft",
  ).length;
  const approvedTotal = requests
    .filter((request) => request.status === "Approved")
    .reduce((total, request) => total + request.amount, 0);

  const visibleRequests = requests.filter((request) => {
    const matchesStatus =
      statusFilter === "All" || request.status === statusFilter;
    const searchText =
      `${request.displayNumber} ${request.title} ${request.requester} ${request.costCenter}`.toLowerCase();

    return (
      matchesStatus &&
      searchText.includes(deferredSearch.toLowerCase())
    );
  });

  const pageTitle =
    screen === "approvals"
      ? "Aprovações"
      : screen === "requests"
        ? "Requisições"
        : "Visão geral";

  useEffect(() => {
    let active = true;

    async function loadRequests() {
      setIsLoading(true);
      setError(null);

      try {
        const result =
          screen === "approvals"
            ? await getMyApprovals()
            : await getPurchaseRequests();

        if (active) {
          setRequests(result.map(mapRequest));
        }
      } catch (loadError) {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Não foi possível carregar as requisições.",
          );
        }
      } finally {
        if (active) setIsLoading(false);
      }
    }

    void loadRequests();

    return () => {
      active = false;
    };
  }, [screen]);

  useEffect(() => {
    if (!isCreating) return;

    let active = true;
    setIsLoadingMasters(true);
    setError(null);

    Promise.all([getSuppliers(), getCostCenters(), getProducts()])
      .then(([supplierData, costCenterData, productData]) => {
        if (!active) return;
        setSuppliers(supplierData);
        setCostCenters(costCenterData);
        setProducts(productData);
      })
      .catch((loadError) => {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Não foi possível carregar os cadastros do S/4HANA.",
          );
        }
      })
      .finally(() => {
        if (active) setIsLoadingMasters(false);
      });

    return () => {
      active = false;
    };
  }, [isCreating]);

  async function refreshRequests(targetScreen = screen) {
    setError(null);

    try {
      const result =
        targetScreen === "approvals"
          ? await getMyApprovals()
          : await getPurchaseRequests();

      setRequests(result.map(mapRequest));
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Não foi possível atualizar as requisições.",
      );
    }
  }

  function startCreateRequest() {
    setFirstStepValues({
      title: "",
      costCenterKey: "",
      amount: "",
    });
    setWizardStep(1);
    setError(null);
    setIsCreating(true);
  }

  function goToDetails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const title = String(formData.get("title") ?? "").trim();
    const costCenterKey = String(formData.get("costCenter") ?? "");
    const amount = Number(formData.get("amount"));

    if (!title || !costCenterKey || !Number.isFinite(amount) || amount <= 0) {
      setError("Preencha título, centro de custo e valor estimado.");
      return;
    }

    setFirstStepValues({
      title,
      costCenterKey,
      amount: String(amount),
    });
    setError(null);
    setWizardStep(2);
  }

  async function createDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const supplierNumber = String(formData.get("supplier") ?? "");
    const productNumber = String(formData.get("product") ?? "");
    const businessJustification = String(
      formData.get("justification") ?? "",
    ).trim();

    const selectedCenter = costCenters.find(
      (center) => getCostCenterKey(center) === firstStepValues.costCenterKey,
    );
    const selectedSupplier = suppliers.find(
      (supplier) => supplier.Supplier === supplierNumber,
    );
    const selectedProduct = products.find(
      (product) => product.Product === productNumber,
    );

    if (!selectedCenter || !selectedSupplier || !selectedProduct) {
      setError("Selecione centro de custo, fornecedor e produto válidos.");
      return;
    }

    if (!businessJustification) {
      setError("Informe a justificativa de negócio.");
      return;
    }

    const currency =
      selectedCenter.CostCenterCurrency?.slice(0, 3) || "BRL";
    const price = Number(firstStepValues.amount);

    const payload: CreatePurchaseRequestPayload = {
      supplierNumber: selectedSupplier.Supplier,
      supplierNameSnapshot:
        selectedSupplier.SupplierFullName ||
        selectedSupplier.SupplierName ||
        selectedSupplier.Supplier,
      controllingArea: selectedCenter.ControllingArea,
      costCenterCode: selectedCenter.CostCenter,
      costCenterNameSnapshot: selectedCenter.CostCenter,
      businessJustification,
      currency_code: currency,
      items: [
        {
          productNumber: selectedProduct.Product,
          description: firstStepValues.title,
          quantity: 1,
          unitOfMeasure: selectedProduct.BaseUnit || "EA",
          unitPrice: price,
          currency_code: currency,
        },
      ],
    };

    setIsSaving(true);
    setError(null);

    try {
      await createPurchaseRequest(payload);
      setIsCreating(false);
      setScreen("requests");
      setStatusFilter("All");
      await refreshRequests("requests");
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Não foi possível criar o rascunho.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function submitRequest(requestId: string) {
    setIsSaving(true);
    setError(null);

    try {
      await submitPurchaseRequest(requestId);
      setSelectedId(null);
      await refreshRequests();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Não foi possível submeter a requisição.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function approveRequest(requestId: string) {
    setIsSaving(true);
    setError(null);

    try {
      await approvePurchaseRequest(requestId, "");
      setSelectedId(null);
      await refreshRequests("approvals");
    } catch (approvalError) {
      setError(
        approvalError instanceof Error
          ? approvalError.message
          : "Não foi possível aprovar a requisição.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function rejectRequest(requestId: string) {
    const comment = window.prompt("Informe o motivo da rejeição:");

    if (!comment?.trim()) return;

    setIsSaving(true);
    setError(null);

    try {
      await rejectPurchaseRequest(requestId, comment.trim());
      setSelectedId(null);
      await refreshRequests("approvals");
    } catch (rejectionError) {
      setError(
        rejectionError instanceof Error
          ? rejectionError.message
          : "Não foi possível rejeitar a requisição.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  function selectedCenterCurrency() {
    const center = costCenters.find(
      (item) => getCostCenterKey(item) === firstStepValues.costCenterKey,
    );

    return center?.CostCenterCurrency?.slice(0, 3) || "BRL";
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          onClick={(event) => {
            event.preventDefault();
            setScreen("overview");
          }}
        >
          <span className="brand-mark">c.</span>
          <span>
            <strong>coruja</strong>
            <small>PROCUREMENT</small>
          </span>
        </a>

        <p className="nav-label">ESPAÇO DE TRABALHO</p>
        <nav className="primary-nav" aria-label="Navegação principal">
          <button
            className={screen === "overview" ? "nav-item active" : "nav-item"}
            onClick={() => setScreen("overview")}
          >
            <LayoutDashboard size={18} />
            Visão geral
          </button>
          <button
            className={screen === "requests" ? "nav-item active" : "nav-item"}
            onClick={() => setScreen("requests")}
          >
            <FileText size={18} />
            Requisições
          </button>
          <button
            className={screen === "approvals" ? "nav-item active" : "nav-item"}
            onClick={() => setScreen("approvals")}
          >
            <CheckSquare size={18} />
            Aprovações
            {approvalCount > 0 && (
              <span className="nav-count">{approvalCount}</span>
            )}
          </button>
        </nav>

        <div className="sidebar-bottom">
          <div className="environment-tag">
            <span />
            Dados carregados pelo CAP
          </div>
          <button className="profile-button" type="button">
            <span className="avatar">CAP</span>
            <span className="profile-copy">
              <strong>Usuário autenticado</strong>
              <small>Sessão CAP</small>
            </span>
            <ChevronDown size={16} />
          </button>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumb">
            Compras <span>/</span> {pageTitle}
          </div>
          <div className="topbar-actions">
            <label className="global-search">
              <Search size={17} />
              <input
                aria-label="Buscar requisições"
                placeholder="Buscar requisições"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <kbd>⌘ K</kbd>
            </label>
            <button className="icon-button" aria-label="Notificações">
              <Bell size={18} />
              <span className="notification-dot" />
            </button>
            <span className="avatar top-avatar">CAP</span>
          </div>
        </header>

        <div className="page-content">
          <section className="page-heading">
            <div>
              <p className="eyebrow">
                {new Date().toLocaleDateString("pt-BR", {
                  weekday: "long",
                  day: "2-digit",
                  month: "long",
                }).toUpperCase()}
              </p>
              <h1>{pageTitle}</h1>
              <p className="page-description">
                Acompanhe solicitações, decisões e gastos em um só lugar.
              </p>
            </div>
            <button className="primary-button" onClick={startCreateRequest}>
              <Plus size={17} />
              Nova requisição
            </button>
          </section>

          {error && (
            <p className="page-description" role="alert">
              {error}
            </p>
          )}

          <section className="metrics" aria-label="Resumo">
            <article className="metric">
              <div className="metric-top">
                <span>Em aprovação</span>
                <Clock3 size={17} />
              </div>
              <strong>{approvalCount}</strong>
              <small>aguardando decisão</small>
            </article>
            <article className="metric">
              <div className="metric-top">
                <span>Rascunhos</span>
                <FileText size={17} />
              </div>
              <strong>{draftCount}</strong>
              <small>não submetidos</small>
            </article>
            <article className="metric metric-highlight">
              <div className="metric-top">
                <span>Total aprovado</span>
                <CircleDollarSign size={17} />
              </div>
              <strong>{formatCurrency(approvedTotal)}</strong>
              <small>requisições carregadas do CAP</small>
            </article>
          </section>

          <section className="list-section">
            <div className="list-heading">
              <div>
                <h2>
                  {screen === "approvals"
                    ? "Aguardando sua decisão"
                    : "Requisições recentes"}
                </h2>
                <p>{visibleRequests.length} registros nesta visualização</p>
              </div>
              <div className="list-controls">
                <label className="filter-select">
                  <ArrowDownUp size={15} />
                  <select
                    aria-label="Filtrar por status"
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value)}
                  >
                    <option value="All">Todos os status</option>
                    <option value="Draft">Rascunho</option>
                    <option value="InApproval">Em aprovação</option>
                    <option value="Approved">Aprovada</option>
                    <option value="Rejected">Rejeitada</option>
                    <option value="Cancelled">Cancelada</option>
                  </select>
                  <ChevronDown size={15} />
                </label>
              </div>
            </div>

            <div className="request-table">
              <div className="table-header">
                <span>REQUISIÇÃO</span>
                <span>SOLICITANTE</span>
                <span>CENTRO DE CUSTO</span>
                <span>VALOR</span>
                <span>ATUALIZADA</span>
                <span>STATUS</span>
                <span />
              </div>

              {isLoading ? (
                <div className="empty-state" aria-live="polite">
                  <Clock3 size={22} />
                  <strong>Carregando requisições</strong>
                  <span>Consultando o backend CAP.</span>
                </div>
              ) : visibleRequests.length > 0 ? (
                visibleRequests.map((request) => (
                  <button
                    className="request-row"
                    key={request.id}
                    onClick={() => setSelectedId(request.id)}
                  >
                    <span className="request-name">
                      <span className="request-icon">
                        <FileText size={17} />
                      </span>
                      <span>
                        <strong>{request.title}</strong>
                        <small>{request.displayNumber}</small>
                      </span>
                    </span>
                    <span className="cell-text">{request.requester}</span>
                    <span className="cell-text">{request.costCenter}</span>
                    <strong className="amount">
                      {formatCurrency(request.amount, request.currency)}
                    </strong>
                    <span className="cell-text">{request.updatedAt}</span>
                    <span className={`status status-${request.status}`}>
                      <span />
                      {statusLabels[request.status]}
                    </span>
                    <ArrowUpRight className="row-arrow" size={17} />
                  </button>
                ))
              ) : (
                <div className="empty-state">
                  <Search size={22} />
                  <strong>Nenhuma requisição encontrada</strong>
                  <span>
                    Ajuste a busca ou o filtro de status.
                  </span>
                </div>
              )}
            </div>
            <p className="demo-note">
              Dados obtidos pelo CAP · cadastros mestres vêm do S/4HANA
            </p>
          </section>
        </div>
      </main>

      {selectedRequest && (
        <div className="overlay" onMouseDown={() => setSelectedId(null)}>
          <aside
            className="detail-panel"
            role="dialog"
            aria-modal="true"
            aria-label={`Detalhes de ${selectedRequest.displayNumber}`}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="detail-header">
              <span className="eyebrow">DETALHE DA REQUISIÇÃO</span>
              <button
                className="icon-button"
                aria-label="Fechar detalhes"
                onClick={() => setSelectedId(null)}
              >
                <X size={18} />
              </button>
            </div>
            <span className={`status status-${selectedRequest.status}`}>
              <span />
              {statusLabels[selectedRequest.status]}
            </span>
            <h2 className="detail-title">{selectedRequest.title}</h2>
            <p className="detail-id">{selectedRequest.displayNumber}</p>

            <div className="detail-amount">
              <span>Valor solicitado</span>
              <strong>
                {formatCurrency(selectedRequest.amount, selectedRequest.currency)}
              </strong>
            </div>

            <dl className="detail-list">
              <div>
                <dt>Solicitante</dt>
                <dd>{selectedRequest.requester}</dd>
              </div>
              <div>
                <dt>Centro de custo</dt>
                <dd>{selectedRequest.costCenter}</dd>
              </div>
              <div>
                <dt>Última atualização</dt>
                <dd>{selectedRequest.updatedAt}</dd>
              </div>
              {selectedRequest.items.map((item) => (
                <div key={item.ID}>
                  <dt>{item.description}</dt>
                  <dd>
                    {item.quantity} ×{" "}
                    {formatCurrency(item.unitPrice, item.currency_code)}
                  </dd>
                </div>
              ))}
            </dl>

            {screen !== "approvals" &&
              selectedRequest.status === "Draft" && (
                <div className="decision-actions">
                  <button
                    className="approve-button"
                    disabled={isSaving}
                    onClick={() => void submitRequest(selectedRequest.id)}
                  >
                    <Check size={17} />
                    {isSaving ? "Enviando..." : "Submeter requisição"}
                  </button>
                </div>
              )}

            {screen === "approvals" &&
              selectedRequest.status === "InApproval" && (
                <div className="decision-actions">
                  <p>A decisão será validada pelo backend e registrada.</p>
                  <button
                    className="approve-button"
                    disabled={isSaving}
                    onClick={() => void approveRequest(selectedRequest.id)}
                  >
                    <Check size={17} />
                    {isSaving ? "Processando..." : "Aprovar"}
                  </button>
                  <button
                    className="reject-button"
                    disabled={isSaving}
                    onClick={() => void rejectRequest(selectedRequest.id)}
                  >
                    <X size={17} />
                    Rejeitar
                  </button>
                </div>
              )}
          </aside>
        </div>
      )}

      {isCreating && (
        <div className="overlay" onMouseDown={() => setIsCreating(false)}>
          <section
            className="create-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="detail-header">
              <div>
                <span className="eyebrow">
                  {wizardStep === 1 ? "ETAPA 1 DE 2" : "ETAPA 2 DE 2"}
                </span>
                <h2 id="create-title">Criar requisição</h2>
              </div>
              <button
                className="icon-button"
                aria-label="Fechar formulário"
                onClick={() => setIsCreating(false)}
              >
                <X size={18} />
              </button>
            </div>

            {error && (
              <p className="page-description" role="alert">
                {error}
              </p>
            )}

            {wizardStep === 1 ? (
              <form className="create-form" onSubmit={goToDetails}>
                <label>
                  O que você precisa comprar?
                  <input
                    name="title"
                    required
                    maxLength={120}
                    value={firstStepValues.title}
                    onChange={(event) =>
                      setFirstStepValues((current) => ({
                        ...current,
                        title: event.target.value,
                      }))
                    }
                  />
                </label>
                <label>
                  Centro de custo
                  <select
                    name="costCenter"
                    required
                    value={firstStepValues.costCenterKey}
                    onChange={(event) =>
                      setFirstStepValues((current) => ({
                        ...current,
                        costCenterKey: event.target.value,
                      }))
                    }
                    disabled={isLoadingMasters}
                  >
                    <option value="">
                      {isLoadingMasters
                        ? "Carregando centros de custo..."
                        : "Selecione um centro de custo"}
                    </option>
                    {costCenters.map((center) => (
                      <option
                        key={getCostCenterKey(center)}
                        value={getCostCenterKey(center)}
                      >
                        {center.CostCenter} · {center.ControllingArea}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Valor estimado (BRL)
                  <input
                    name="amount"
                    type="number"
                    min="0.01"
                    step="0.01"
                    required
                    value={firstStepValues.amount}
                    onChange={(event) =>
                      setFirstStepValues((current) => ({
                        ...current,
                        amount: event.target.value,
                      }))
                    }
                  />
                </label>
                <div className="form-footer">
                  <span>Os demais dados serão preenchidos na próxima etapa.</span>
                  <button
                    className="primary-button"
                    type="submit"
                    disabled={isLoadingMasters}
                  >
                    Próximo
                    <ArrowUpRight size={17} />
                  </button>
                </div>
              </form>
            ) : (
              <form className="create-form" onSubmit={createDraft}>
                <label>
                  Fornecedor
                  <select name="supplier" required defaultValue="">
                    <option value="" disabled>
                      Selecione um fornecedor
                    </option>
                    {suppliers.map((supplier) => (
                      <option
                        key={supplier.Supplier}
                        value={supplier.Supplier}
                      >
                        {supplier.SupplierFullName ||
                          supplier.SupplierName ||
                          supplier.Supplier}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Produto ou material
                  <select name="product" required defaultValue="">
                    <option value="" disabled>
                      Selecione um produto
                    </option>
                    {products.map((product) => (
                      <option key={product.Product} value={product.Product}>
                        {product.Product}
                        {product.ProductGroup
                          ? ` · ${product.ProductGroup}`
                          : ""}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Justificativa de negócio
                  <input
                    name="justification"
                    required
                    maxLength={500}
                    placeholder="Explique a necessidade da compra"
                  />
                </label>
                <div className="form-footer">
                  <button
                    className="icon-button"
                    type="button"
                    aria-label="Voltar para a primeira etapa"
                    onClick={() => {
                      setError(null);
                      setWizardStep(1);
                    }}
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <span>
                    Total:{" "}
                    {formatCurrency(
                      Number(firstStepValues.amount || 0),
                      selectedCenterCurrency(),
                    )}
                  </span>
                  <button
                    className="primary-button"
                    type="submit"
                    disabled={isSaving || isLoadingMasters}
                  >
                    <Plus size={17} />
                    {isSaving ? "Salvando..." : "Criar rascunho"}
                  </button>
                </div>
              </form>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

export default App;