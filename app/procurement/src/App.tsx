import { useDeferredValue, useState, type FormEvent } from "react";
import {
  ArrowDownUp,
  ArrowUpRight,
  Bell,
  Check,
  CheckSquare,
  ChevronDown,
  CircleDollarSign,
  Clock3,
  FileText,
  LayoutDashboard,
  Plus,
  Search,
  X,
} from "lucide-react";
import { DEMO_REQUESTS, type PurchaseRequest, type RequestStatus } from "./data";
import "./App.css";

type Screen = "overview" | "requests" | "approvals";

const statusLabels: Record<RequestStatus, string> = {
  Draft: "Rascunho",
  InApproval: "Em aprovação",
  Approved: "Aprovada",
  Rejected: "Rejeitada",
};

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(amount);

function App() {
  const [screen, setScreen] = useState<Screen>("overview");
  const [requests, setRequests] = useState(DEMO_REQUESTS);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
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
    const matchesScreen =
      screen !== "approvals" || request.status === "InApproval";
    const matchesStatus =
      statusFilter === "All" || request.status === statusFilter;
    const searchText =
      `${request.id} ${request.title} ${request.requester} ${request.costCenter}`.toLowerCase();
    return (
      matchesScreen &&
      matchesStatus &&
      searchText.includes(deferredSearch.toLowerCase())
    );
  });

  function changeStatus(id: string, status: RequestStatus) {
    setRequests((current) =>
      current.map((request) =>
        request.id === id
          ? { ...request, status, updatedAt: "Agora" }
          : request,
      ),
    );
    setSelectedId(null);
  }

  function createRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const amount = Number(formData.get("amount"));

    if (!Number.isFinite(amount) || amount <= 0) return;

    const request: PurchaseRequest = {
      id: `PR-2026-${String(Date.now()).slice(-4)}`,
      title: String(formData.get("title")),
      requester: "Ana Martins",
      costCenter: String(formData.get("costCenter")),
      amount,
      status: "Draft",
      updatedAt: "Agora",
    };

    setRequests((current) => [request, ...current]);
    setIsCreating(false);
    setScreen("requests");
    setStatusFilter("All");
  }

  const pageTitle =
    screen === "approvals"
      ? "Aprovações"
      : screen === "requests"
        ? "Requisições"
        : "Visão geral";

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#" onClick={() => setScreen("overview")}>
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
            Ambiente de demonstração
          </div>
          <button className="profile-button">
            <span className="avatar">AM</span>
            <span className="profile-copy">
              <strong>Ana Martins</strong>
              <small>Solicitante</small>
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
            <span className="avatar top-avatar">AM</span>
          </div>
        </header>

        <div className="page-content">
          <section className="page-heading">
            <div>
              <p className="eyebrow">QUINTA-FEIRA, 22 DE OUTUBRO</p>
              <h1>{pageTitle}</h1>
              <p className="page-description">
                Acompanhe solicitações, decisões e gastos em um só lugar.
              </p>
            </div>
            <button
              className="primary-button"
              onClick={() => setIsCreating(true)}
            >
              <Plus size={17} />
              Nova requisição
            </button>
          </section>

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
              <small>neste conjunto de demonstração</small>
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
                <p>
                  {visibleRequests.length} registros nesta visualização
                </p>
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
              {visibleRequests.map((request) => (
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
                      <small>{request.id}</small>
                    </span>
                  </span>
                  <span className="cell-text">{request.requester}</span>
                  <span className="cell-text">{request.costCenter}</span>
                  <strong className="amount">
                    {formatCurrency(request.amount)}
                  </strong>
                  <span className="cell-text">{request.updatedAt}</span>
                  <span className={`status status-${request.status}`}>
                    <span />
                    {statusLabels[request.status]}
                  </span>
                  <ArrowUpRight className="row-arrow" size={17} />
                </button>
              ))}
              {visibleRequests.length === 0 && (
                <div className="empty-state">
                  <Search size={22} />
                  <strong>Nenhuma requisição encontrada</strong>
                  <span>Ajuste a busca ou o filtro de status.</span>
                </div>
              )}
            </div>
            <p className="demo-note">
              Dados de demonstração · ainda não conectados ao backend CAP
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
            aria-label={`Detalhes de ${selectedRequest.id}`}
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
            <p className="detail-id">{selectedRequest.id}</p>

            <div className="detail-amount">
              <span>Valor solicitado</span>
              <strong>{formatCurrency(selectedRequest.amount)}</strong>
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
              {selectedRequest.nextApprover && (
                <div>
                  <dt>Próxima etapa</dt>
                  <dd>{selectedRequest.nextApprover}</dd>
                </div>
              )}
            </dl>

            {screen === "approvals" &&
              selectedRequest.status === "InApproval" && (
                <div className="decision-actions">
                  <p>Esta decisão é simulada e atualiza apenas a tela.</p>
                  <button
                    className="approve-button"
                    onClick={() =>
                      changeStatus(selectedRequest.id, "Approved")
                    }
                  >
                    <Check size={17} />
                    Aprovar
                  </button>
                  <button
                    className="reject-button"
                    onClick={() =>
                      changeStatus(selectedRequest.id, "Rejected")
                    }
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
                <span className="eyebrow">NOVA SOLICITAÇÃO</span>
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
            <form className="create-form" onSubmit={createRequest}>
              <label>
                O que você precisa comprar?
                <input name="title" required maxLength={120} />
              </label>
              <label>
                Centro de custo
                <select name="costCenter" required defaultValue="CC-OPS">
                  <option value="CC-OPS">CC-OPS · Operações</option>
                  <option value="CC-DATA">CC-DATA · Dados</option>
                  <option value="CC-TECH">CC-TECH · Tecnologia</option>
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
                />
              </label>
              <div className="form-footer">
                <span>Será salvo como rascunho.</span>
                <button className="primary-button" type="submit">
                  <Plus size={17} />
                  Criar rascunho
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}

export default App;