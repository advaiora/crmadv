import React from "react";
import { createPortal } from "react-dom";
import { Badge, Button, Form, Spinner } from "react-bootstrap";
import { useHistory } from "react-router-dom";
import { ChevronLeft, Edit2, ExternalLink, MessageCircle, Paperclip, Plus, RotateCcw, Search, X } from "react-feather";
import { useSession } from "../../../hooks/useSession";
import {
  fetchAgencyChatProjects,
  fetchAgencyProjectChat,
  sendAgencyProjectChatMessage,
  fetchAgencyClientChat,
  sendAgencyClientChatMessage,
  fetchAgencyGeneralChat,
  sendAgencyGeneralChatMessage,
  fetchAgencyChatAttachments,
  uploadAgencyChatFileAttachment,
  addAgencyChatEntityAttachment,
  removeAgencyChatAttachment,
  fetchAgencyChatSessions,
  createAgencyChatSession,
  renameAgencyChatSession,
  resumeAgencyChatSession,
} from "../../../modules/agency-os/api/agency.api";
import ChatBubble from "./chatBubble";
import { AttachEntityPanel, AttachmentChips } from "./chatAttachments";
import { ATTACHMENT_FILE_ACCEPT, mentionsAi } from "./chatShared";
import { AI_CHAT_ASK_EVENT } from "./askAi";
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
// `opts.conversationId` dice su quale SESSIONE dell'ambito si lavora. Omesso solo
// alla prima apertura: il server allora riporta l'utente sull'ultima che usava.
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

// Data compatta per l'elenco sessioni: l'ora se e' di oggi, altrimenti il giorno.
// L'elenco e' denso (§3.2 del design): serve a distinguere le voci, non a datarle.
const formatSessionDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const today = new Date();
  const sameDay =
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear();
  return sameDay
    ? date.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })
    : date.toLocaleDateString("it-IT", { day: "numeric", month: "short" });
};

// Elenco delle sessioni dell'ambito. Le archiviate (isFrozen) sono quelle da cui si
// e' usciti o si e' stati rimossi: restano consultabili in sola lettura.
const SessionList = ({ sessions, activeId, loading, onOpen, onRename, onNew }) => (
  <div className="ai-chat-sessions">
    <div className="ai-chat-sessions-head">
      <span>Conversazioni</span>
      <button type="button" className="ai-chat-session-new" onClick={onNew}>
        <Plus size={14} />
        Nuova chat
      </button>
    </div>
    {loading ? (
      <div className="ai-chat-centered">
        <Spinner animation="border" size="sm" role="status" />
      </div>
    ) : sessions.length === 0 ? (
      <div className="ai-chat-empty">Nessuna conversazione. Premi &ldquo;Nuova chat&rdquo; per iniziare.</div>
    ) : (
      <ul className="ai-chat-session-list">
        {sessions.map((session) => (
          <li key={session.id}>
            <button
              type="button"
              className={`ai-chat-session ${session.id === activeId ? "is-active" : ""}`}
              onClick={() => onOpen(session.id)}
              aria-current={session.id === activeId ? "true" : undefined}
            >
              <span className="ai-chat-session-title">{session.title || "Senza titolo"}</span>
              <span className="ai-chat-session-meta">
                {session.isFrozen && <Badge bg="secondary">Archiviata</Badge>}
                {!session.isFrozen && session.isGroup && <Badge bg="light" text="dark">{session.participantCount}</Badge>}
                <span className="ai-chat-session-date">{formatSessionDate(session.lastMessageAt)}</span>
              </span>
            </button>
            {!session.isFrozen && (
              <button
                type="button"
                className="ai-chat-session-rename"
                aria-label={`Rinomina ${session.title || "conversazione"}`}
                title="Rinomina"
                onClick={() => onRename(session)}
              >
                <Edit2 size={13} />
              </button>
            )}
          </li>
        ))}
      </ul>
    )}
  </div>
);

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

  // Sessione aperta e elenco delle sessioni dell'ambito. `isFrozen` = ci sei uscito
  // (o ti hanno rimosso, o il gruppo si e' sciolto): la vedi ma non ci scrivi piu'.
  const [conversationId, setConversationId] = React.useState(null);
  const [isFrozen, setIsFrozen] = React.useState(false);
  const [sessions, setSessions] = React.useState([]);
  const [sessionsLoading, setSessionsLoading] = React.useState(false);
  const [showSessions, setShowSessions] = React.useState(false);

  const [messages, setMessages] = React.useState([]);
  const [aiConfigured, setAiConfigured] = React.useState(true);
  const [isParticipant, setIsParticipant] = React.useState(true);
  const [chatLoading, setChatLoading] = React.useState(false);
  const [sending, setSending] = React.useState(false);
  const [aiThinking, setAiThinking] = React.useState(false);
  const [input, setInput] = React.useState("");
  const [error, setError] = React.useState("");
  const [budgetNotice, setBudgetNotice] = React.useState("");

  // Allegati in composizione (bozze lato server) e stato del selettore elementi.
  const [attachments, setAttachments] = React.useState([]);
  const [attachBusy, setAttachBusy] = React.useState(false);
  const [showAttachPanel, setShowAttachPanel] = React.useState(false);

  const bottomRef = React.useRef(null);
  const fileInputRef = React.useRef(null);

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

  // Elenco delle sessioni dell'ambito. Silenzioso di proposito: se non arriva, la
  // conversazione aperta resta usabile lo stesso.
  const loadSessions = React.useCallback(async (target) => {
    setSessionsLoading(true);
    try {
      setSessions(await fetchAgencyChatSessions(target));
    } catch (_err) {
      setSessions([]);
    } finally {
      setSessionsLoading(false);
    }
  }, []);

  // `wantedConversationId` omesso = "portami dove ero": il server sceglie l'ultima
  // sessione dell'utente su quell'ambito, o ne crea una sua se non ne ha.
  const loadChat = React.useCallback(
    async (target, wantedConversationId) => {
      setChatLoading(true);
      setError("");
      setBudgetNotice("");
      setAttachments([]);
      setShowAttachPanel(false);
      try {
        const chat = await fetchScopedChat(target, { conversationId: wantedConversationId });
        const openId = chat?.conversationId || null;
        setConversationId(openId);
        setIsFrozen(chat?.isFrozen === true);
        setAiConfigured(chat?.aiConfigured !== false);
        setIsParticipant(chat?.isParticipant !== false);
        setMessages(Array.isArray(chat?.messages) ? chat.messages : []);
        // Bozze rimaste nel composer: appartengono a QUESTA sessione, quindi l'id va
        // passato — senza, tornerebbero quelle dell'ultima sessione usata.
        if (chat?.isParticipant !== false) {
          try {
            setAttachments(await fetchAgencyChatAttachments(target, { conversationId: openId }));
          } catch (_err) {
            // Gli allegati pendenti sono un di piu': se non arrivano, la chat resta usabile.
            setAttachments([]);
          }
        }
      } catch (err) {
        setError(err?.message || "Impossibile caricare la conversazione.");
      } finally {
        setChatLoading(false);
      }
    },
    [],
  );

  // --- Sessioni: apri, nuova, rinomina, riprendi ---

  const openSession = React.useCallback(
    async (id) => {
      if (!selectedTarget) return;
      setShowSessions(false);
      await loadChat(selectedTarget, id);
    },
    [selectedTarget, loadChat],
  );

  const newSession = React.useCallback(async () => {
    if (!selectedTarget) return;
    setError("");
    try {
      const id = await createAgencyChatSession(selectedTarget);
      setShowSessions(false);
      await loadChat(selectedTarget, id);
      await loadSessions(selectedTarget);
    } catch (err) {
      setError(err?.message || "Non sono riuscito ad aprire una nuova conversazione.");
    }
  }, [selectedTarget, loadChat, loadSessions]);

  const renameSession = React.useCallback(
    async (session) => {
      if (!selectedTarget) return;
      // eslint-disable-next-line no-alert
      const next = window.prompt("Nome della conversazione", session.title || "");
      if (next === null || !next.trim()) return;
      try {
        await renameAgencyChatSession(selectedTarget, session.id, next.trim());
        await loadSessions(selectedTarget);
      } catch (err) {
        setError(err?.message || "Non sono riuscito a rinominare la conversazione.");
      }
    },
    [selectedTarget, loadSessions],
  );

  // Copia la sessione archiviata in una tutta propria, con lo storico fino al momento
  // in cui se ne era usciti. E' qui che si paga la copia: chi non riprende non duplica.
  const resumeSession = React.useCallback(async () => {
    if (!selectedTarget || !conversationId) return;
    setError("");
    try {
      const id = await resumeAgencyChatSession(selectedTarget, conversationId);
      await loadChat(selectedTarget, id);
      await loadSessions(selectedTarget);
    } catch (err) {
      setError(err?.message || "Non sono riuscito a riprendere la conversazione.");
    }
  }, [selectedTarget, conversationId, loadChat, loadSessions]);

  // --- Allegati (Fase 3a) ---

  const attachFile = React.useCallback(
    async (file) => {
      if (!file || !selectedTarget) {
        return;
      }
      setAttachBusy(true);
      setError("");
      try {
        const attachment = await uploadAgencyChatFileAttachment(selectedTarget, file, { conversationId });
        if (attachment) {
          setAttachments((current) => [...current, attachment]);
        }
      } catch (err) {
        setError(err?.message || "Non sono riuscito ad allegare il documento.");
      } finally {
        setAttachBusy(false);
      }
    },
    [selectedTarget, conversationId],
  );

  const attachEntity = React.useCallback(
    async ({ entityType, entityId }) => {
      if (!selectedTarget) {
        return;
      }
      setAttachBusy(true);
      setError("");
      try {
        const attachment = await addAgencyChatEntityAttachment(
          selectedTarget,
          { entityType, entityId },
          { conversationId },
        );
        if (attachment) {
          setAttachments((current) => [...current, attachment]);
          setShowAttachPanel(false);
        }
      } catch (err) {
        setError(err?.message || "Non sono riuscito ad allegare l'elemento.");
      } finally {
        setAttachBusy(false);
      }
    },
    [selectedTarget, conversationId],
  );

  const detachAttachment = React.useCallback(async (attachment) => {
    setAttachBusy(true);
    try {
      await removeAgencyChatAttachment(attachment.id);
      setAttachments((current) => current.filter((row) => row.id !== attachment.id));
    } catch (err) {
      setError(err?.message || "Non sono riuscito a togliere l'allegato.");
    } finally {
      setAttachBusy(false);
    }
  }, []);

  // Apre la chat DELL'elemento: un progetto porta all'ambito Progetto, un cliente
  // all'ambito Cliente.
  const openChatOnEntity = React.useCallback(
    (entityType, entityId, name) => {
      const nextScope = entityType === "client" ? "client" : "project";
      const target = { scope: nextScope, id: entityId, name: name || "" };
      setScope(nextScope);
      setQuery("");
      setSelectedTarget(target);
      setInput("");
      void loadChat(target);
      void loadSessions(target);
    },
    [loadChat, loadSessions],
  );

  // "Chiedi all'AI" da una lista (menu ⋯ o tasto destro). Con una conversazione
  // gia' aperta l'elemento diventa un allegato di quella; altrimenti si apre la
  // chat dell'elemento (che e' gia' il suo contesto: allegarlo sarebbe inutile).
  const handleAsk = React.useCallback(
    async (detail) => {
      const { mode, entityType, entityId, name } = detail || {};
      if (!entityType || !entityId) {
        return;
      }
      setOpen(true);
      const isCurrentTarget = selectedTarget?.scope === entityType && selectedTarget?.id === entityId;
      if (mode === "open" || !selectedTarget || isCurrentTarget) {
        openChatOnEntity(entityType, entityId, name);
        return;
      }
      await attachEntity({ entityType, entityId });
    },
    [selectedTarget, openChatOnEntity, attachEntity],
  );

  React.useEffect(() => {
    const onAsk = (event) => void handleAsk(event.detail);
    window.addEventListener(AI_CHAT_ASK_EVENT, onAsk);
    return () => window.removeEventListener(AI_CHAT_ASK_EVENT, onAsk);
  }, [handleAsk]);

  // Cambio ambito: azzero selezione, conversazione ed elenco sessioni (che e' per
  // ambito). L'ambito Generale non ha un elenco di bersagli da scegliere, quindi
  // apre subito le proprie sessioni.
  const changeScope = (nextScope) => {
    setScope(nextScope);
    setQuery("");
    setError("");
    setBudgetNotice("");
    setMessages([]);
    setSessions([]);
    setConversationId(null);
    setShowSessions(false);
    if (nextScope === "general") {
      const target = { scope: "general", name: "Chat generale" };
      setSelectedTarget(target);
      void loadChat(target);
      void loadSessions(target);
    } else {
      setSelectedTarget(null);
    }
  };

  const selectEntity = (item) => {
    const target = { scope, id: item.id, name: item.name };
    setSelectedTarget(target);
    setMessages([]);
    setInput("");
    setSessions([]);
    setConversationId(null);
    void loadChat(target);
    void loadSessions(target);
  };

  const backToPicker = () => {
    setSelectedTarget(null);
    setMessages([]);
    setError("");
    setBudgetNotice("");
    setAttachments([]);
    setShowAttachPanel(false);
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
    const sentAttachments = attachments;
    const optimistic = {
      id: `optimistic-${messages.length}`,
      role: "user",
      content: question,
      citations: [],
      attachments: sentAttachments,
      createdAt: new Date().toISOString(),
      author: { id: currentUserId, name: null, email: session?.userEmail || null },
    };
    setMessages((current) => [...current, optimistic]);
    setInput("");
    setAttachments([]);
    setShowAttachPanel(false);
    try {
      const chat = await sendScopedChatMessage(selectedTarget, question, {
        askAi,
        attachmentIds: sentAttachments.map((attachment) => attachment.id),
        conversationId,
      });
      setMessages(Array.isArray(chat?.messages) ? chat.messages : []);
      // Il primo messaggio battezza la sessione (titolo automatico) e la porta in
      // cima all'elenco: si rilegge, cosi' la lista non resta indietro.
      void loadSessions(selectedTarget);
      if (chat?.aiConfigured === false) {
        setAiConfigured(false);
      }
      if (chat?.budgetExceeded) {
        setBudgetNotice(chat.budgetMessage || "Budget AI giornaliero esaurito.");
      }
    } catch (err) {
      setError(err?.message || "Invio del messaggio non riuscito.");
      setInput(question);
      // Gli allegati non sono stati legati: restano bozze, quindi tornano nel composer.
      setAttachments(sentAttachments);
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
              <button
                type="button"
                className="ai-chat-openfull"
                onClick={() => setShowSessions((current) => !current)}
                aria-expanded={showSessions}
                title="Le tue conversazioni su questo ambito"
              >
                <MessageCircle size={15} />
              </button>
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

            {showSessions && (
              <SessionList
                sessions={sessions}
                activeId={conversationId}
                loading={sessionsLoading}
                onOpen={openSession}
                onRename={renameSession}
                onNew={newSession}
              />
            )}

            {isFrozen && (
              <div className="ai-chat-notice">
                <strong>Conversazione archiviata.</strong> Non ne fai più parte: la vedi com&rsquo;era quando ne sei
                uscito, e non puoi scrivere.
                <button type="button" className="ai-chat-resume" onClick={resumeSession}>
                  <RotateCcw size={13} />
                  Riprendi in una nuova chat
                </button>
              </div>
            )}

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
              ) : /* Il congelato ha isParticipant=false ma DEVE vedere lo storico che
                    ha vissuto: il "non fai parte" vale solo per chi non c'e' mai stato. */
              !isParticipant && !isFrozen ? (
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
                {showAttachPanel && (
                  <AttachEntityPanel
                    projects={projects}
                    clients={clients}
                    busy={attachBusy}
                    onPick={attachEntity}
                    onClose={() => setShowAttachPanel(false)}
                  />
                )}

                <AttachmentChips attachments={attachments} onRemove={detachAttachment} busy={attachBusy} />

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
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={ATTACHMENT_FILE_ACCEPT}
                    className="d-none"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      // Azzero il campo: cosi' si puo' ricaricare lo stesso file due volte.
                      event.target.value = "";
                      void attachFile(file);
                    }}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline-secondary"
                    className="ai-chat-attach-btn"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={sending || attachBusy}
                    title="Allega un documento (TXT, CSV, MD, DOCX, PDF)"
                  >
                    {attachBusy ? <Spinner animation="border" size="sm" /> : <Paperclip size={15} />}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline-secondary"
                    onClick={() => setShowAttachPanel((current) => !current)}
                    disabled={sending || attachBusy}
                    title="Allega un elemento del CRM (progetto o cliente)"
                  >
                    Elemento
                  </Button>
                  <span className="ai-chat-composer-spacer" />
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
