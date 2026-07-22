import React from "react";
import { createPortal } from "react-dom";
import { useHistory } from "react-router-dom";
import { Badge, Button, Form, Spinner } from "react-bootstrap";
import { useSession } from "../../../hooks/useSession";
import {
  fetchAgencyChatProjects,
  fetchAgencyChatModels,
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
import { fetchWorkspaceAccess, hasModuleEnabled, hasPermission } from "../../../utils/workspaceAccess";
import { subscribeConversation } from "../../../realtime/realtimeClient";
import { MESSAGING_MODULE_KEY, MESSAGING_PERMISSIONS } from "../../../modules/messaging/ui/constants";
import ChatBubble from "./chatBubble";
import MessagingPanel from "./MessagingPanel";
import ChatParticipantsPanel from "./ChatParticipantsPanel";
import ChatOnboarding from "./ChatOnboarding";
import { AttachEntityPanel, AttachmentChips } from "./chatAttachments";
import { ATTACHMENT_FILE_ACCEPT, ENTITY_LABELS, formatListDate, mentionsAi } from "./chatShared";
import {
  IconAi,
  IconAttach,
  IconBack,
  IconChatEntry,
  IconClose,
  IconCollapse,
  IconExpand,
  IconMessaging,
  IconModel,
  IconNewChat,
  IconParticipants,
  IconRename,
  IconResume,
  IconSearch,
  IconSessionList,
} from "./chatIcons";
import { AI_CHAT_ASK_EVENT } from "./askAi";
import HkBadge from "../../../components/@hk-badge/@hk-badge";
import "./ai-chat-widget.css";

export const AI_CHAT_TOGGLE_EVENT = "ai-chat:toggle";
export const AI_CHAT_OPEN_EVENT = "ai-chat:open";

// Trigger da mettere nella topbar: apre/chiude il popup via evento globale, così
// come CommandPaletteTrigger. Il widget possiede lo stato, il trigger lo commuta.
// L'icona e' quella dell'INGRESSO (spec 4-ter §6): apre l'aggregato delle chat,
// non uno dei due mondi — per questo non e' ne' quella dei Messaggi ne' dell'AI.
// `unreadCount` (i messaggi NON letti della messaggistica, calcolati in TopNav)
// mostra un badge numerico sull'ingresso: e' qui che si va a leggerli. La campana
// non li conta piu', cosi' lo stesso numero non compare due volte (design §4.1).
export const AiChatTrigger = ({ unreadCount = 0 }) => (
  <Button
    variant="flush-dark"
    className="btn-icon btn-rounded flush-soft-hover topnav-action-btn"
    aria-label={unreadCount > 0 ? `Apri le chat — ${unreadCount} messaggi non letti` : "Apri le chat"}
    title="Chat"
    onClick={() => window.dispatchEvent(new CustomEvent(AI_CHAT_TOGGLE_EVENT))}
  >
    <span className="icon">
      <span className="position-relative">
        <span className="feather-icon">
          <IconChatEntry />
        </span>
        {unreadCount > 0 && (
          <HkBadge
            bg="danger"
            soft
            pill
            size="sm"
            className="position-top-end-overflow-1 ai-chat-trigger-badge"
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </HkBadge>
        )}
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

// --- Selettore del modello AI (deciso 20/7/2026: provider + modello, per sessione) ---
// La scelta e' PER SESSIONE (conversationId). In attesa dell'eventuale colonna su
// AiConversation, si tiene lato client: sopravvive al reload nel browser, ma non e'
// ancora condivisa tra i partecipanti (upgrade previsto, vedi spec). Se manca la
// scelta, o non e' piu' usabile, si ricade sul modello di default del workspace.
const MODEL_STORAGE_KEY = "ai-chat:model-by-conversation";
const PROVIDER_LABELS = { anthropic: "Anthropic", openai: "OpenAI" };
const PROVIDER_ORDER = ["anthropic", "openai"];
const readStoredModelMap = () => {
  try {
    const raw = window.localStorage.getItem(MODEL_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (_err) {
    return {};
  }
};

// I due mondi sotto lo stesso ingresso (spec 4-ter). Non si mescolano MAI: stesso
// selettore, due elenchi. Servono a cose diverse — parlare fra persone vs svolgere
// lavoro con l'AI — e l'icona lo dice prima dell'etichetta.
const MODES = [
  { key: "ai", label: "Chat AI", Icon: IconAi },
  { key: "messaging", label: "Messaggi", Icon: IconMessaging },
];

const ModeTabs = ({ mode, onMode }) => (
  <div className="ai-chat-modes" role="tablist" aria-label="Tipo di chat">
    {MODES.map(({ key, label, Icon }) => (
      <button
        key={key}
        type="button"
        role="tab"
        aria-selected={mode === key}
        className={`ai-chat-mode ${mode === key ? "is-active" : ""}`}
        onClick={() => onMode(key)}
      >
        <Icon size={15} />
        {label}
      </button>
    ))}
  </div>
);

// Elenco delle sessioni dell'ambito. Le archiviate (isFrozen) sono quelle da cui si
// e' usciti o si e' stati rimossi: restano consultabili in sola lettura.
const SessionList = ({ sessions, activeId, loading, onOpen, onRename, onNew }) => (
  <div className="ai-chat-sessions">
    <div className="ai-chat-sessions-head">
      <span>Conversazioni</span>
      <button type="button" className="ai-chat-session-new" onClick={onNew}>
        <IconNewChat size={14} />
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
                <span className="ai-chat-session-date">{formatListDate(session.lastMessageAt)}</span>
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
                <IconRename size={13} />
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
        <IconSearch size={16} className="ai-chat-search-icon" />
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

// `inline` monta la chat DENTRO una pagina (la casella, spec 4-ter §4) invece che in
// overlay: sempre a tutto schermo, senza pulsanti apri/chiudi/espandi, e sordo agli
// eventi globali del popup. `initialMode` sceglie il mondo di partenza (la casella
// parte dai Messaggi, il popup dalla Chat AI). Stesso identico componente nei due
// casi: "una sola implementazione, non una copia".
const AiChatWidget = ({ inline = false, initialMode = "ai" }) => {
  const { session } = useSession();
  const history = useHistory();
  const currentUserId = session?.userId || null;

  const [open, setOpen] = React.useState(false);

  // Quale dei due mondi si sta guardando, e se il popup e' a tutto schermo. Sono
  // dello SHELL, non dei due mondi: cambiare mondo non deve rimpicciolire la finestra.
  const [mode, setMode] = React.useState(initialMode);
  const [expanded, setExpanded] = React.useState(false);

  // Persona selezionata nel mondo Messaggi. Vive QUI, nel padre, e non dentro
  // MessagingPanel: quel pannello si smonta cambiando mondo, e con lo stato interno
  // la conversazione aperta andrebbe persa. Tenendolo qui la casella la ricorda,
  // esattamente come gia' fa la Chat AI con la sua sessione (spec 4-ter §5, QoL).
  const [messagingPeer, setMessagingPeer] = React.useState(null);
  const [access, setAccess] = React.useState(null);
  const [accessLoaded, setAccessLoaded] = React.useState(false);

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
  // Sei l'unico partecipante attivo: l'AI risponde a ogni messaggio, senza @AI
  // (spec sez. 2). La UI lo usa per un solo tasto "Invia" e l'indicatore di attesa.
  const [isSolo, setIsSolo] = React.useState(false);
  const [sessions, setSessions] = React.useState([]);
  const [sessionsLoading, setSessionsLoading] = React.useState(false);
  const [showSessions, setShowSessions] = React.useState(false);
  const [showParticipants, setShowParticipants] = React.useState(false);

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
  // Elemento (fonte/preventivo/progetto/cliente) in attesa di essere allegato a una
  // chat SCELTA dall'utente (voce "Allega a una chat…"). Resta finché non si preme
  // "Allega qui" su una sessione aperta, o non si annulla.
  const [pendingAttachment, setPendingAttachment] = React.useState(null);

  // Selettore del modello AI (deciso 20/7/2026): `modelOptions` = catalogo + provider
  // con chiave + default di workspace (caricato alla prima apertura); `modelByConv` = la
  // scelta per sessione, persistita lato client. `modelSelectId` evita id duplicati se
  // convivono due istanze del widget (overlay dello shell + casella inline).
  const [modelOptions, setModelOptions] = React.useState(null);
  const [modelByConv, setModelByConv] = React.useState(readStoredModelMap);
  const modelSelectId = React.useId();

  const bottomRef = React.useRef(null);
  const fileInputRef = React.useRef(null);

  // "Aperto" = l'overlay e' stato aperto, oppure e' la casella inline (che vive
  // sempre sulla pagina). I caricamenti alla prima apertura si agganciano a questo.
  const panelOpen = inline || open;

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

  // Gli eventi globali (apri/commuta il popup) sono roba dell'overlay: la casella
  // inline non deve reagirci, altrimenti il pulsante in topbar aprirebbe DUE chat.
  React.useEffect(() => {
    if (inline) {
      return undefined;
    }
    const onToggle = () => setOpen((current) => !current);
    const onOpen = () => setOpen(true);
    window.addEventListener(AI_CHAT_TOGGLE_EVENT, onToggle);
    window.addEventListener(AI_CHAT_OPEN_EVENT, onOpen);
    return () => {
      window.removeEventListener(AI_CHAT_TOGGLE_EVENT, onToggle);
      window.removeEventListener(AI_CHAT_OPEN_EVENT, onOpen);
    };
  }, [inline]);

  // Progetti (base anche per la lista clienti) caricati alla prima apertura.
  React.useEffect(() => {
    if (panelOpen && !projectsLoaded && !projectsLoading) {
      void loadProjects();
    }
  }, [panelOpen, projectsLoaded, projectsLoading, loadProjects]);

  // Il modulo Messaggi puo' essere spento nel workspace o mancare all'utente: in quel
  // caso il selettore non deve nemmeno comparire. Si legge alla prima apertura, non
  // all'avvio dell'app: chi non apre mai le chat non paga la chiamata.
  React.useEffect(() => {
    if (!panelOpen || accessLoaded) {
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const result = await fetchWorkspaceAccess();
        if (!cancelled) {
          setAccess(result);
        }
      } catch (_err) {
        // Senza risposta si resta sulla sola Chat AI: meglio un mondo in meno che un
        // tab che porta a una schermata di errore.
      } finally {
        if (!cancelled) {
          setAccessLoaded(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [panelOpen, accessLoaded]);

  // Modelli selezionabili in Chat AI (deciso 20/7/2026): alla prima apertura, come
  // projects/access. Silenzioso: se non arriva, il selettore non compare e si usa il
  // modello di default lato server.
  React.useEffect(() => {
    if (!panelOpen || modelOptions) {
      return undefined;
    }
    let cancelled = false;
    void (async () => {
      try {
        const result = await fetchAgencyChatModels();
        if (!cancelled && result) {
          setModelOptions(result);
        }
      } catch (_err) {
        // Nessun selettore: si resta sul modello di default del workspace.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [panelOpen, modelOptions]);

  const canUseMessaging =
    hasModuleEnabled(access, MESSAGING_MODULE_KEY) && hasPermission(access, MESSAGING_PERMISSIONS.view);
  const canSendMessages = hasPermission(access, MESSAGING_PERMISSIONS.send);

  // Modelli del selettore: disponibili (provider con chiave) e raggruppati per provider.
  // `availableModelIds` serve sia a preselezionare sia a non inviare una scelta non piu'
  // usabile (chiave tolta): in quel caso si ricade sul default lato server.
  const availableModelIds = React.useMemo(
    () => new Set((modelOptions?.models || []).filter((model) => model.available).map((model) => model.id)),
    [modelOptions],
  );
  const modelGroups = React.useMemo(() => {
    const list = modelOptions?.models || [];
    const byProvider = new Map();
    for (const model of list) {
      const bucket = byProvider.get(model.provider) || [];
      bucket.push(model);
      byProvider.set(model.provider, bucket);
    }
    return PROVIDER_ORDER.filter((provider) => byProvider.has(provider)).map((provider) => ({
      provider,
      label: PROVIDER_LABELS[provider] || provider,
      models: byProvider.get(provider),
    }));
  }, [modelOptions]);
  const hasSelectableModel = availableModelIds.size > 0;
  // Scelta esplicita per QUESTA sessione, se ancora usabile; altrimenti il default di
  // workspace. `currentModelId` e' cio' che il selettore mostra; `outgoingModel` e' cio'
  // che si invia (undefined = usa il default lato server, nessun override).
  const chosenModelId = conversationId ? modelByConv[conversationId] : undefined;
  const outgoingModel = chosenModelId && availableModelIds.has(chosenModelId) ? chosenModelId : undefined;
  const currentModelId = outgoingModel || modelOptions?.defaultModel || "";

  const chooseModel = React.useCallback(
    (modelId) => {
      if (!conversationId) {
        return;
      }
      setModelByConv((current) => {
        const next = { ...current, [conversationId]: modelId };
        try {
          window.localStorage.setItem(MODEL_STORAGE_KEY, JSON.stringify(next));
        } catch (_err) {
          // localStorage negato/pieno: la scelta vale comunque per la sessione corrente.
        }
        return next;
      });
    },
    [conversationId],
  );

  // Se i Messaggi non sono disponibili (modulo spento, permesso tolto) si torna alla
  // Chat AI: senza, si resterebbe su un mondo vuoto e senza tab per uscirne.
  React.useEffect(() => {
    if (accessLoaded && !canUseMessaging && mode === "messaging") {
      setMode("ai");
    }
  }, [accessLoaded, canUseMessaging, mode]);

  // Esc per chiudere e blocco dello scroll del corpo sono cose dell'overlay: la
  // casella e' una pagina come le altre, non deve rubare Esc ne' bloccare lo scroll.
  React.useEffect(() => {
    if (inline || !open) {
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
  }, [inline, open]);

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
      // I partecipanti sono di UNA sessione: cambiando conversazione il pannello
      // aperto mostrerebbe il gruppo di quella di prima. Si chiude qui, che e' il
      // punto da cui passa ogni cambio, invece che nei singoli chiamanti.
      setShowParticipants(false);
      try {
        const chat = await fetchScopedChat(target, { conversationId: wantedConversationId });
        const openId = chat?.conversationId || null;
        setConversationId(openId);
        setIsFrozen(chat?.isFrozen === true);
        setIsSolo(chat?.isSolo === true);
        setAiConfigured(chat?.aiConfigured !== false);
        setIsParticipant(chat?.isParticipant !== false);
        setMessages(Array.isArray(chat?.messages) ? chat.messages : []);
        // Modello della sessione (server = verita' condivisa tra i partecipanti): se la
        // sessione ne ha uno salvato, semina la scelta del selettore; altrimenti si
        // mantiene l'eventuale scelta locale ancora non inviata.
        if (openId && chat?.model) {
          setModelByConv((current) =>
            current[openId] === chat.model ? current : { ...current, [openId]: chat.model },
          );
        }
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

  // Refresh SILENZIOSO dei soli messaggi (tempo reale, Fase 4): niente spinner, non
  // tocca le bozze del composer ne' i pannelli aperti. Preserva i bottoni di
  // navigazione (Fase 6): non sono persistiti (listMessages non li ha), vivono solo
  // in memoria agganciati al loro messaggio — quindi al refetch si ri-agganciano per
  // id, cosi' un aggiornamento arrivato dal websocket non li cancella dalla vista di
  // chi li aveva appena ricevuti.
  const refreshMessages = React.useCallback(async (target, id) => {
    if (!target || !id) return;
    try {
      const chat = await fetchScopedChat(target, { conversationId: id });
      if (!chat || chat.conversationId !== id) return; // la sessione e' cambiata nel frattempo
      setIsFrozen(chat.isFrozen === true);
      setIsSolo(chat.isSolo === true);
      setIsParticipant(chat.isParticipant !== false);
      setMessages((prev) => {
        const keptSuggestions = new Map(
          prev.filter((m) => Array.isArray(m.suggestions) && m.suggestions.length > 0).map((m) => [m.id, m.suggestions]),
        );
        const incoming = Array.isArray(chat.messages) ? chat.messages : [];
        return incoming.map((m) => (keptSuggestions.has(m.id) ? { ...m, suggestions: keptSuggestions.get(m.id) } : m));
      });
    } catch {
      // silenzioso: se il refresh non riesce, resta a video quello che c'e' gia'.
    }
  }, []);

  // Tempo reale (Fase 4): si ascolta la conversazione APERTA. Quando un altro
  // partecipante scrive (o l'AI risponde per lui), il server manda il segnale e qui si
  // ricarica in silenzio. L'iscrizione segue la sessione aperta: cambiando sessione ci
  // si sposta sul canale giusto.
  React.useEffect(() => {
    if (!selectedTarget || !conversationId) return undefined;
    return subscribeConversation(conversationId, () => {
      void refreshMessages(selectedTarget, conversationId);
    });
  }, [selectedTarget, conversationId, refreshMessages]);

  // Apre un ambito: prima la chat, POI l'elenco. L'ordine non e' cosmetico — alla
  // prima apertura di un ambito e' `loadChat` a creare la sessione dell'utente, e
  // leggendo l'elenco in parallelo si arriva prima che esista: l'elenco risponde
  // "nessuna conversazione" mentre la chat aperta accanto c'e' eccome. Il difetto
  // stava li' da quando esiste l'elenco (15/7), ma si vedeva solo se si apriva la
  // tendina nel primo istante giusto; con la colonna sempre a video (popup espanso)
  // si vedrebbe ogni volta.
  const openTarget = React.useCallback(
    async (target, wantedConversationId) => {
      await loadChat(target, wantedConversationId);
      await loadSessions(target);
    },
    [loadChat, loadSessions],
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
      await openTarget(selectedTarget, id);
    } catch (err) {
      setError(err?.message || "Non sono riuscito ad aprire una nuova conversazione.");
    }
  }, [selectedTarget, openTarget]);

  const renameSession = React.useCallback(
    async (session) => {
      if (!selectedTarget) return;
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
      await openTarget(selectedTarget, id);
    } catch (err) {
      setError(err?.message || "Non sono riuscito a riprendere la conversazione.");
    }
  }, [selectedTarget, conversationId, openTarget]);

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

  // "Allega qui" dal banner: allega l'elemento in sospeso alla sessione APERTA (quella
  // che l'utente ha scelto navigando), come bozza del composer, poi svuota il sospeso.
  // Il "selettore della chat di destinazione" È la navigazione stessa del popup: si
  // atterra dove si vuole e si conferma qui — e a quel punto la sessione esiste già
  // (nota operativa #24: mai allegare a una sessione non ancora creata).
  const attachPendingHere = React.useCallback(async () => {
    if (!pendingAttachment || !selectedTarget || !conversationId) {
      return;
    }
    setAttachBusy(true);
    setError("");
    try {
      const attachment = await addAgencyChatEntityAttachment(
        selectedTarget,
        { entityType: pendingAttachment.entityType, entityId: pendingAttachment.entityId },
        { conversationId },
      );
      if (attachment) {
        setAttachments((current) => [...current, attachment]);
      }
      setPendingAttachment(null);
    } catch (err) {
      setError(err?.message || "Non sono riuscito ad allegare l'elemento.");
    } finally {
      setAttachBusy(false);
    }
  }, [pendingAttachment, selectedTarget, conversationId]);

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
      void openTarget(target);
    },
    [openTarget],
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
      // "Chiedi all'AI" arriva da una lista qualsiasi del CRM: se il popup era aperto
      // sui Messaggi va riportato sul mondo giusto, altrimenti l'azione non farebbe
      // niente di visibile.
      setMode("ai");
      // "Allega a una chat…": non apre né allega subito. Mette l'elemento IN SOSPESO;
      // l'utente sceglie ambito+sessione (navigando il popup) e poi preme "Allega qui".
      // Unica via per fonte/preventivo, che non sono ambiti-chat.
      if (mode === "pick") {
        setPendingAttachment({ entityType, entityId, name });
        return;
      }
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
    // "Chiedi all'AI" dalle liste apre l'OVERLAY: la casella inline lo ignora, se
    // no un click aprirebbe insieme la casella e il popup sopra.
    if (inline) {
      return undefined;
    }
    const onAsk = (event) => void handleAsk(event.detail);
    window.addEventListener(AI_CHAT_ASK_EVENT, onAsk);
    return () => window.removeEventListener(AI_CHAT_ASK_EVENT, onAsk);
  }, [inline, handleAsk]);

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
      void openTarget(target);
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
    void openTarget(target);
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
    // Da solo l'AI risponde comunque (isSolo): lo rispecchio qui cosi' l'indicatore
    // "sta pensando" compare anche premendo il semplice "Invia", non solo "Chiedi all'AI".
    const willInvokeAi = askAi || isSolo || mentionsAi(question);
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
        // Solo la scelta esplicita e ancora usabile: altrimenti si omette e il server
        // usa il modello di default del workspace (nessun override).
        model: outgoingModel,
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

  // Navigazione suggerita (Fase 6): l'AI propone, l'utente decide. Si naviga SOLO al
  // clic — mai in automatico. Nel popup si chiude prima l'overlay, cosi' la
  // destinazione e' visibile; la casella inline cambia rotta e si smonta da se'.
  const navigateToSuggestion = React.useCallback(
    (route) => {
      if (!route) return;
      if (!inline) {
        setOpen(false);
      }
      history.push(route);
    },
    [history, inline],
  );

  if (!inline && !open) {
    return null;
  }

  const showPicker = scope !== "general" && !selectedTarget;
  const isMessaging = mode === "messaging";
  // La casella e' a tutto schermo per definizione (non ha il pulsante riduci).
  const expandedView = inline || expanded;
  // A tutto schermo l'elenco delle sessioni e' una colonna fissa, non piu' una
  // tendina: e' questo che rende la vista ampia utile ovunque (spec 4-ter §2).
  const sessionsVisible = expandedView || showSessions;

  // Il CORPO condiviso: selettore dei due mondi + contenuto. Identico nel popup
  // (overlay) e nella casella (montata su rotta). "Una sola implementazione" (spec
  // 4-ter §4): la casella non e' una copia della chat, e' questo stesso componente.
  const surface = (
    <>
      {accessLoaded && canUseMessaging && <ModeTabs mode={mode} onMode={setMode} />}

      {isMessaging ? (
        <MessagingPanel
          expanded={expandedView}
          canSend={canSendMessages}
          peer={messagingPeer}
          onPeerChange={setMessagingPeer}
        />
      ) : (
        <>
        {/* Elemento in sospeso (voce "Allega a una chat…"): l'utente sceglie dove
            allegarlo navigando il popup, poi conferma con "Allega qui". Il banner resta
            visibile sia sul selettore sia dentro la conversazione. */}
        {pendingAttachment && (
          <div className="ai-chat-pending">
            <span className="ai-chat-pending-icon feather-icon" aria-hidden="true">
              <IconAttach size={14} />
            </span>
            <span className="ai-chat-pending-text">
              Allega <strong>{ENTITY_LABELS[pendingAttachment.entityType] || "elemento"}</strong>
              {pendingAttachment.name ? ` "${pendingAttachment.name}"` : ""}: scegli o apri una chat, poi premi &quot;Allega qui&quot;.
            </span>
            {conversationId && isParticipant && !isFrozen && (
              <Button
                size="sm"
                variant="primary"
                className="ai-chat-pending-attach"
                onClick={() => void attachPendingHere()}
                disabled={attachBusy}
              >
                Allega qui
              </Button>
            )}
            <button
              type="button"
              className="ai-chat-pending-cancel"
              onClick={() => setPendingAttachment(null)}
              aria-label="Annulla"
              title="Annulla"
            >
              <IconClose size={14} />
            </button>
          </div>
        )}
        <ChatOnboarding canUseMessaging={canUseMessaging} />
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
            {sessionsVisible && (
              <SessionList
                sessions={sessions}
                activeId={conversationId}
                loading={sessionsLoading}
                onOpen={openSession}
                onRename={renameSession}
                onNew={newSession}
              />
            )}

            <div className="ai-chat-conv-main">
            <div className="ai-chat-conv-head">
              {scope !== "general" && (
                <button type="button" className="ai-chat-back" onClick={backToPicker}>
                  <IconBack size={16} />
                  Cambia
                </button>
              )}
              <span className="ai-chat-conv-name" title={selectedTarget?.name}>
                {selectedTarget?.name}
              </span>
              {/* A tutto schermo l'elenco e' gia' una colonna: il tasto che lo apre
                  sarebbe un doppione senza bersaglio. */}
              {!expandedView && (
                <button
                  type="button"
                  className="ai-chat-openfull"
                  onClick={() => setShowSessions((current) => !current)}
                  aria-expanded={showSessions}
                  title="Le tue conversazioni su questo ambito"
                >
                  <IconSessionList size={15} />
                </button>
              )}
              {/* Gestione del gruppo: prima viveva solo nella scheda Chat del
                  progetto (quindi su Cliente e Generale non esisteva), e al suo
                  posto qui c'era un rimando a quella pagina. Ora e' qui, per tutti
                  e tre gli ambiti — ed e' cio' che ha permesso di cancellarla. */}
              {!isFrozen && conversationId && (
                <button
                  type="button"
                  className="ai-chat-openfull"
                  onClick={() => setShowParticipants((current) => !current)}
                  aria-expanded={showParticipants}
                  title="Partecipanti, azzera, sciogli il gruppo"
                >
                  <IconParticipants size={15} />
                </button>
              )}
            </div>

            {/* Selettore del modello AI, per sessione (deciso 20/7/2026). Solo con una
                sessione aperta, scrivibile (non archiviata) e AI configurata: in sola
                lettura o senza provider con chiave non c'e' nulla da scegliere. */}
            {conversationId && !isFrozen && isParticipant && aiConfigured && hasSelectableModel && (
              <div className="ai-chat-model-bar">
                <span className="ai-chat-model-icon feather-icon" aria-hidden="true">
                  <IconModel size={14} />
                </span>
                <label className="ai-chat-model-label" htmlFor={modelSelectId}>
                  Modello
                </label>
                <Form.Select
                  id={modelSelectId}
                  size="sm"
                  className="ai-chat-model-select"
                  value={currentModelId}
                  onChange={(event) => chooseModel(event.target.value)}
                  aria-label="Modello AI per questa conversazione"
                >
                  {modelGroups.map((group) => (
                    <optgroup key={group.provider} label={group.label}>
                      {group.models.map((model) => (
                        <option key={model.id} value={model.id} disabled={!model.available}>
                          {model.label}
                          {model.hint ? ` — ${model.hint}` : ""}
                          {model.available ? "" : " (chiave non configurata)"}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </Form.Select>
              </div>
            )}

            {showParticipants && conversationId && (
              <ChatParticipantsPanel
                target={selectedTarget}
                conversationId={conversationId}
                currentUserId={currentUserId}
                onSoloChange={setIsSolo}
                onClose={() => setShowParticipants(false)}
                onFrozen={() => {
                  // Uscito o sciolto: da qui in poi la sessione e' in sola lettura.
                  // Va riletta (il server decide cosa mostrarmi) e l'elenco pure,
                  // perche' ora e' contrassegnata "Archiviata".
                  setShowParticipants(false);
                  void openTarget(selectedTarget, conversationId);
                }}
                onCleared={() => {
                  setShowParticipants(false);
                  void openTarget(selectedTarget, conversationId);
                }}
              />
            )}

            {isFrozen && (
              <div className="ai-chat-notice">
                <strong>Conversazione archiviata.</strong> Non ne fai più parte: la vedi com&rsquo;era quando ne sei
                uscito, e non puoi scrivere.
                <button type="button" className="ai-chat-resume" onClick={resumeSession}>
                  <IconResume size={13} />
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
              <div className="ai-chat-messages-inner">
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
                  {/* Il testo va dentro UN elemento: .ai-chat-empty e' flex column, quindi
                      ogni <strong> sciolto diventerebbe una riga a se' e la frase si
                      spezzerebbe in cinque. */}
                  <p className="mb-0">
                    {isSolo ? (
                      <>
                        Nessun messaggio. Sei da solo qui: l&rsquo;assistente risponde a <strong>ogni</strong> messaggio
                        che scrivi. Invita qualcuno e servirà di nuovo <strong>@AI</strong>.
                      </>
                    ) : (
                      <>
                        Nessun messaggio. Scrivi e usa <strong>@AI</strong> (o <strong>Chiedi all&rsquo;AI</strong>) per
                        una risposta dell&rsquo;assistente.
                      </>
                    )}
                  </p>
                </div>
              ) : (
                <>
                  {messages.map((message) => (
                    <ChatBubble
                      key={message.id}
                      message={message}
                      currentUserId={currentUserId}
                      onNavigate={navigateToSuggestion}
                    />
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
                    {attachBusy ? <Spinner animation="border" size="sm" /> : <IconAttach size={15} />}
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
                  {/* Da solo i due tasti direbbero la stessa cosa (l'AI risponde
                      comunque): se ne mostra uno solo. In gruppo tornano distinti —
                      "Invia" parla alle persone, "Chiedi all'AI" interpella l'assistente. */}
                  {isSolo ? (
                    <Button
                      type="submit"
                      size="sm"
                      variant="primary"
                      disabled={sending || input.trim().length === 0}
                      title={
                        aiConfigured
                          ? "Sei da solo: l'assistente risponde a ogni messaggio"
                          : "AI non configurata"
                      }
                    >
                      {sending ? <Spinner animation="border" size="sm" /> : "Invia"}
                    </Button>
                  ) : (
                    <>
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
                    </>
                  )}
                </div>
              </Form>
            )}
            </div>
          </div>
        )}
          </>
        )}
    </>
  );

  // La casella (spec 4-ter §4): stessa superficie, dentro il flusso della pagina
  // invece che in overlay. Sempre a tutto schermo, senza pulsanti apri/chiudi.
  if (inline) {
    return (
      <section className="ai-chat-inline" aria-label={isMessaging ? "Messaggi" : "Chat AI"}>
        {surface}
      </section>
    );
  }

  return createPortal(
    <div
      className={`ai-chat-overlay ${expandedView ? "is-expanded" : ""}`}
      role="presentation"
      onMouseDown={() => !expandedView && setOpen(false)}
    >
      <aside
        className={`ai-chat-panel ${expandedView ? "is-expanded" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={isMessaging ? "Messaggi" : "Chat AI"}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="ai-chat-header">
          <div className="ai-chat-title">
            {isMessaging ? <IconMessaging size={18} /> : <IconAi size={18} />}
            <span>{isMessaging ? "Messaggi" : "Chat AI"}</span>
          </div>
          <div className="ai-chat-header-actions">
            <button
              type="button"
              className="ai-chat-close"
              aria-label={expandedView ? "Riduci a finestra" : "Espandi a tutto schermo"}
              title={expandedView ? "Riduci" : "Espandi"}
              onClick={() => setExpanded((current) => !current)}
            >
              {expandedView ? <IconCollapse size={17} /> : <IconExpand size={17} />}
            </button>
            <button type="button" className="ai-chat-close" aria-label="Chiudi" onClick={() => setOpen(false)}>
              <IconClose size={18} />
            </button>
          </div>
        </header>
        {surface}
      </aside>
    </div>,
    document.body,
  );
};

export default AiChatWidget;
