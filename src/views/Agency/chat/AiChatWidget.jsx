import React from "react";
import { createPortal } from "react-dom";
import { Badge, Button, Form, Spinner } from "react-bootstrap";
import { useHistory } from "react-router-dom";
import { ChevronLeft, ExternalLink, MessageCircle, Search, X } from "react-feather";
import { useSession } from "../../../hooks/useSession";
import {
  fetchAgencyChatProjects,
  fetchAgencyProjectChat,
  sendAgencyProjectChatMessage,
  fetchAgencyClientChat,
  sendAgencyClientChatMessage,
  fetchAgencyGeneralChat,
  sendAgencyGeneralChatMessage,
} from "../../../modules/agency-os/api/agency.api";
import ChatBubble from "./chatBubble";
import { mentionsAi } from "./chatShared";
import "./ai-chat-widget.css";

export const AI_CHAT_TOGGLE_EVENT = "ai-chat:toggle";
export const AI_CHAT_OPEN_EVENT = "ai-chat:open";

// Trigger da mettere nella topbar: apre/chiude il popup via evento globale, così
// come CommandPaletteTrigger. Il widget possiede lo stato, il trigger lo commuta.
export const AiChatTrigger = () => (
  <Button
    variant="flush-dark"
    className="btn-icon btn-rounded flush-soft-hover topnav-action-btn"
    aria-label="Apri chat AI"
    title="Chat AI"
    onClick={() => window.dispatchEvent(new CustomEvent(AI_CHAT_TOGGLE_EVENT))}
  >
    <span className="icon">
      <span className="feather-icon">
        <MessageCircle />
      </span>
    </span>
  </Button>
);

// Instrada la chiamata all'endpoint giusto in base all'ambito del bersaglio.
const fetchScopedChat = (target, opts) => {
  if (target.scope === "general") return fetchAgencyGeneralChat(opts);
  if (target.scope === "client") return fetchAgencyClientChat(target.id, opts);
  return fetchAgencyProjectChat(target.id, opts);
};

const sendScopedChatMessage = (target, message, opts) => {
  if (target.scope === "general") return sendAgencyGeneralChatMessage(message, opts);
  if (target.scope === "client") return sendAgencyClientChatMessage(target.id, message, opts);
  return sendAgencyProjectChatMessage(target.id, message, opts);
};

// Normalizza per la ricerca: minuscolo, senza accenti.
const normalize = (value) =>
  String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");

const SCOPES = [
  { key: "project", label: "Progetto" },
  { key: "client", label: "Cliente" },
  { key: "general", label: "Generale" },
];

// Selettore d'ambito cliccabile in cima al popup (Progetto / Cliente / Generale).
const ScopeTabs = ({ activeScope, onScope }) => (
  <div className="ai-chat-scopes" role="tablist" aria-label="Ambito della chat">
    {SCOPES.map((scope) => (
      <button
        key={scope.key}
        type="button"
        role="tab"
        aria-selected={activeScope === scope.key}
        className={`ai-chat-scope ${activeScope === scope.key ? "is-active" : ""}`}
        onClick={() => onScope(scope.key)}
      >
        {scope.label}
      </button>
    ))}
  </div>
);

// Lista selezionabile (progetti o clienti) con gli "assegnati a me" in cima e un
// badge per chi ha Fonti indicizzate (chat RAG utile).
const EntityPicker = ({ items, loading, error, query, onQuery, onSelect, onRetry, kind }) => {
  const filtered = items.filter((item) => normalize(item.name).includes(normalize(query)));
  const assigned = filtered.filter((item) => item.assignedToMe);
  const others = filtered.filter((item) => !item.assignedToMe);
  const noun = kind === "client" ? "cliente" : "progetto";

  const renderRow = (item) => (
    <button key={item.id} type="button" className="ai-chat-project-row" onClick={() => onSelect(item)}>
      <span className="ai-chat-project-name">{item.name}</span>
      <span className="ai-chat-project-meta">
        {kind === "client" && item.projectCount > 0 && (
          <span className="ai-chat-project-client">
            {item.projectCount} {item.projectCount === 1 ? "progetto" : "progetti"}
          </span>
        )}
        {kind === "project" && item.clientName && (
          <span className="ai-chat-project-client">{item.clientName}</span>
        )}
        {item.hasIndexedSources && (
          <Badge bg="primary" className="ai-chat-project-badge">
            Fonti
          </Badge>
        )}
      </span>
    </button>
  );

  return (
    <div className="ai-chat-picker">
      <div className="ai-chat-onboarding">
        {kind === "client" ? (
          <>
            Scegli un <strong>cliente</strong> per chattare con l&rsquo;AI su tutti i suoi progetti insieme. Scrivi
            <strong> @AI</strong> o usa <strong>Chiedi all&rsquo;AI</strong> per una risposta dell&rsquo;assistente.
          </>
        ) : (
          <>
            Scegli un <strong>progetto</strong> per chattare con il team e interpellare l&rsquo;AI sulle sue Fonti.
            Scrivi <strong>@AI</strong> o usa <strong>Chiedi all&rsquo;AI</strong>.
          </>
        )}
      </div>
      <div className="ai-chat-search">
        <Search size={16} className="ai-chat-search-icon" />
        <input
          type="text"
          className="ai-chat-search-input"
          placeholder={`Cerca un ${noun}…`}
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          aria-label={`Cerca un ${noun}`}
        />
      </div>

      {loading ? (
        <div className="ai-chat-centered">
          <Spinner animation="border" size="sm" role="status" />
        </div>
      ) : error ? (
        <div className="ai-chat-empty">
          {error}
          <Button size="sm" variant="outline-secondary" className="mt-2" onClick={onRetry}>
            Riprova
          </Button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="ai-chat-empty">
          {items.length === 0
            ? `Nessun ${noun} disponibile per la chat.`
            : `Nessun ${noun} corrisponde alla ricerca.`}
        </div>
      ) : (
        <div className="ai-chat-project-list">
          {assigned.length > 0 && (
            <>
              <div className="ai-chat-group-label">Assegnati a me</div>
              {assigned.map(renderRow)}
            </>
          )}
          {others.length > 0 && (
            <>
              <div className="ai-chat-group-label">
                {assigned.length > 0 ? (kind === "client" ? "Altri clienti" : "Altri progetti") : kind === "client" ? "Clienti" : "Progetti"}
              </div>
              {others.map(renderRow)}
            </>
          )}
        </div>
      )}
    </div>
  );
};

const AiChatWidget = () => {
  const history = useHistory();
  const { session } = useSession();
  const currentUserId = session?.userId || null;

  const [open, setOpen] = React.useState(false);
  const [projects, setProjects] = React.useState([]);
  const [projectsLoaded, setProjectsLoaded] = React.useState(false);
  const [projectsLoading, setProjectsLoading] = React.useState(false);
  const [projectsError, setProjectsError] = React.useState("");
  const [query, setQuery] = React.useState("");
  const [scope, setScope] = React.useState("project");
  const [selectedTarget, setSelectedTarget] = React.useState(null);

  const [messages, setMessages] = React.useState([]);
  const [aiConfigured, setAiConfigured] = React.useState(true);
  const [isParticipant, setIsParticipant] = React.useState(true);
  const [chatLoading, setChatLoading] = React.useState(false);
  const [sending, setSending] = React.useState(false);
  const [aiThinking, setAiThinking] = React.useState(false);
  const [input, setInput] = React.useState("");
  const [error, setError] = React.useState("");
  const [budgetNotice, setBudgetNotice] = React.useState("");

  const bottomRef = React.useRef(null);

  // I clienti selezionabili derivano dai progetti visibili all'utente (il modello
  // V2 non ha un'assegnazione diretta utente<->cliente): un cliente e' "assegnato a
  // me" se ho almeno un suo progetto assegnato, e "ha Fonti" se ne ha almeno uno.
  const clients = React.useMemo(() => {
    const byClient = new Map();
    for (const project of projects) {
      if (!project.clientId) continue;
      const entry = byClient.get(project.clientId) || {
        id: project.clientId,
        name: project.clientName || "Cliente",
        assignedToMe: false,
        hasIndexedSources: false,
        projectCount: 0,
      };
      entry.assignedToMe = entry.assignedToMe || project.assignedToMe;
      entry.hasIndexedSources = entry.hasIndexedSources || project.hasIndexedSources;
      entry.projectCount += 1;
      byClient.set(project.clientId, entry);
    }
    return [...byClient.values()];
  }, [projects]);

  const loadProjects = React.useCallback(async () => {
    setProjectsLoading(true);
    setProjectsError("");
    try {
      const list = await fetchAgencyChatProjects();
      setProjects(Array.isArray(list) ? list : []);
      setProjectsLoaded(true);
    } catch (err) {
      setProjectsError(err?.message || "Impossibile caricare i progetti.");
    } finally {
      setProjectsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    const onToggle = () => setOpen((current) => !current);
    const onOpen = () => setOpen(true);
    window.addEventListener(AI_CHAT_TOGGLE_EVENT, onToggle);
    window.addEventListener(AI_CHAT_OPEN_EVENT, onOpen);
    return () => {
      window.removeEventListener(AI_CHAT_TOGGLE_EVENT, onToggle);
      window.removeEventListener(AI_CHAT_OPEN_EVENT, onOpen);
    };
  }, []);

  // Progetti (base anche per la lista clienti) caricati alla prima apertura.
  React.useEffect(() => {
    if (open && !projectsLoaded && !projectsLoading) {
      void loadProjects();
    }
  }, [open, projectsLoaded, projectsLoading, loadProjects]);

  React.useEffect(() => {
    if (!open) {
      return undefined;
    }
    const onKey = (event) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadChat = React.useCallback(async (target) => {
    setChatLoading(true);
    setError("");
    setBudgetNotice("");
    try {
      const chat = await fetchScopedChat(target);
      setAiConfigured(chat?.aiConfigured !== false);
      setIsParticipant(chat?.isParticipant !== false);
      setMessages(Array.isArray(chat?.messages) ? chat.messages : []);
    } catch (err) {
      setError(err?.message || "Impossibile caricare la conversazione.");
    } finally {
      setChatLoading(false);
    }
  }, []);

  // Cambio ambito: azzero selezione e conversazione. L'ambito Generale non ha un
  // elenco da scegliere, quindi apre subito la sua conversazione condivisa.
  const changeScope = (nextScope) => {
    setScope(nextScope);
    setQuery("");
    setError("");
    setBudgetNotice("");
    setMessages([]);
    if (nextScope === "general") {
      const target = { scope: "general", name: "Chat generale" };
      setSelectedTarget(target);
      void loadChat(target);
    } else {
      setSelectedTarget(null);
    }
  };

  const selectEntity = (item) => {
    const target = { scope, id: item.id, name: item.name };
    setSelectedTarget(target);
    setMessages([]);
    setInput("");
    void loadChat(target);
  };

  const backToPicker = () => {
    setSelectedTarget(null);
    setMessages([]);
    setError("");
    setBudgetNotice("");
  };

  const submit = async (askAi) => {
    const question = input.trim();
    if (!question || sending || !selectedTarget) {
      return;
    }
    const willInvokeAi = askAi || mentionsAi(question);
    setSending(true);
    setAiThinking(willInvokeAi);
    setError("");
    setBudgetNotice("");
    const optimistic = {
      id: `optimistic-${messages.length}`,
      role: "user",
      content: question,
      citations: [],
      createdAt: new Date().toISOString(),
      author: { id: currentUserId, name: null, email: session?.userEmail || null },
    };
    setMessages((current) => [...current, optimistic]);
    setInput("");
    try {
      const chat = await sendScopedChatMessage(selectedTarget, question, { askAi });
      setMessages(Array.isArray(chat?.messages) ? chat.messages : []);
      if (chat?.aiConfigured === false) {
        setAiConfigured(false);
      }
      if (chat?.budgetExceeded) {
        setBudgetNotice(chat.budgetMessage || "Budget AI giornaliero esaurito.");
      }
    } catch (err) {
      setError(err?.message || "Invio del messaggio non riuscito.");
      setInput(question);
      setMessages((current) => current.filter((message) => message.id !== optimistic.id));
    } finally {
      setSending(false);
      setAiThinking(false);
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submit(false);
    }
  };

  const openFullPage = () => {
    if (selectedTarget?.scope !== "project") {
      return;
    }
    setOpen(false);
    history.push(`/agency/projects/${selectedTarget.id}/chat`);
  };

  if (!open) {
    return null;
  }

  const showPicker = scope !== "general" && !selectedTarget;

  return createPortal(
    <div className="ai-chat-overlay" role="presentation" onMouseDown={() => setOpen(false)}>
      <aside
        className="ai-chat-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Chat AI"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="ai-chat-header">
          <div className="ai-chat-title">
            <MessageCircle size={18} />
            <span>Chat AI</span>
          </div>
          <button type="button" className="ai-chat-close" aria-label="Chiudi" onClick={() => setOpen(false)}>
            <X size={18} />
          </button>
        </header>

        <ScopeTabs activeScope={scope} onScope={changeScope} />

        {showPicker ? (
          <EntityPicker
            kind={scope}
            items={scope === "client" ? clients : projects}
            loading={projectsLoading}
            error={projectsError}
            query={query}
            onQuery={setQuery}
            onSelect={selectEntity}
            onRetry={loadProjects}
          />
        ) : (
          <div className="ai-chat-conversation">
            <div className="ai-chat-conv-head">
              {scope !== "general" && (
                <button type="button" className="ai-chat-back" onClick={backToPicker}>
                  <ChevronLeft size={16} />
                  Cambia
                </button>
              )}
              <span className="ai-chat-conv-name" title={selectedTarget?.name}>
                {selectedTarget?.name}
              </span>
              {selectedTarget?.scope === "project" && (
                <button
                  type="button"
                  className="ai-chat-openfull"
                  onClick={openFullPage}
                  title="Apri la scheda Chat del progetto (partecipanti, azzera…)"
                >
                  <ExternalLink size={15} />
                </button>
              )}
            </div>

            {!aiConfigured && (
              <div className="ai-chat-notice">
                <strong>AI non configurata.</strong> Puoi scrivere nella chat; per le risposte dell&rsquo;assistente
                serve una chiave in Impostazioni Agency.
              </div>
            )}
            {budgetNotice && <div className="ai-chat-notice">{budgetNotice}</div>}
            {error && <div className="ai-chat-notice is-error">{error}</div>}

            <div className="ai-chat-messages">
              {chatLoading ? (
                <div className="ai-chat-centered">
                  <Spinner animation="border" size="sm" role="status" />
                </div>
              ) : !isParticipant ? (
                <div className="ai-chat-empty">
                  Non fai parte di questa conversazione. Chiedi a un partecipante di invitarti.
                </div>
              ) : messages.length === 0 ? (
                <div className="ai-chat-empty">
                  Nessun messaggio. Scrivi e usa <strong>@AI</strong> (o <strong>Chiedi all&rsquo;AI</strong>) per una
                  risposta dell&rsquo;assistente.
                </div>
              ) : (
                <>
                  {messages.map((message) => (
                    <ChatBubble key={message.id} message={message} currentUserId={currentUserId} />
                  ))}
                  {aiThinking && (
                    <div className="d-flex justify-content-start mb-3">
                      <div className="rounded-3 px-3 py-2 bg-body-secondary border text-muted small">
                        <Spinner animation="grow" size="sm" className="me-2" />
                        L&rsquo;assistente sta pensando…
                      </div>
                    </div>
                  )}
                  <div ref={bottomRef} />
                </>
              )}
            </div>

            {isParticipant && (
              <Form
                className="ai-chat-composer"
                onSubmit={(event) => {
                  event.preventDefault();
                  void submit(false);
                }}
              >
                <Form.Control
                  as="textarea"
                  rows={2}
                  placeholder="Scrivi un messaggio… (@AI per l'assistente)"
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={sending}
                />
                <div className="ai-chat-composer-actions">
                  <Button
                    type="submit"
                    size="sm"
                    variant="outline-primary"
                    disabled={sending || input.trim().length === 0}
                  >
                    {sending && !aiThinking ? <Spinner animation="border" size="sm" /> : "Invia"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="primary"
                    onClick={() => void submit(true)}
                    disabled={sending || !aiConfigured || input.trim().length === 0}
                    title={aiConfigured ? "Invia e chiedi una risposta all'AI" : "AI non configurata"}
                  >
                    {aiThinking ? <Spinner animation="border" size="sm" /> : "Chiedi all'AI"}
                  </Button>
                </div>
              </Form>
            )}
          </div>
        )}
      </aside>
    </div>,
    document.body,
  );
};

export default AiChatWidget;
