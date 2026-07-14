import React from "react";
import { Alert, Badge, Button, Form, Spinner } from "react-bootstrap";
import { useParams } from "react-router-dom";
import {
  getAgencyProjectChat,
  sendAgencyProjectChatMessage,
  clearAgencyProjectChat,
  getAgencyProjectChatParticipants,
  addAgencyProjectChatParticipant,
  removeAgencyProjectChatParticipant,
} from "../../../modules/agency-os/data/agencyDataAdapter";
import { readAgencyDataMeta } from "../../../modules/agency-os/data/agencyDataSource";
import { useSession } from "../../../hooks/useSession";
import AgencyProjectPageTemplate from "./AgencyProjectPageTemplate";

const formatTime = (value) => {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString("it-IT");
};

// Etichetta autore da mostrare sopra la bolla: nome, email o fallback.
const authorLabel = (message) => {
  if (message.role === "assistant") {
    return "Assistente AI";
  }
  const author = message.author;
  return author?.name || author?.email || "Utente";
};

// Rileva se l'AI e' interpellata via menzione @AI (stessa regola del server).
const mentionsAi = (text) => /(^|\s)@ai\b/i.test(text || "");

// Una bolla di conversazione. I messaggi propri a destra; quelli degli altri
// (utenti o AI) a sinistra, con l'autore mostrato sopra. Le fonti citate (RAG)
// dell'assistente sono in un dettaglio richiudibile sotto la risposta.
const ChatBubble = ({ message, currentUserId }) => {
  const isAssistant = message.role === "assistant";
  const isMine = !isAssistant && Boolean(message.author?.id) && message.author.id === currentUserId;
  const citations = Array.isArray(message.citations) ? message.citations : [];
  const label = isMine ? "Tu" : authorLabel(message);

  return (
    <div className={`d-flex mb-3 ${isMine ? "justify-content-end" : "justify-content-start"}`}>
      <div style={{ maxWidth: "80%" }}>
        <div className={`small text-muted mb-1 ${isMine ? "text-end" : ""}`}>
          {isAssistant ? "🤖 " : ""}
          {label}
        </div>
        <div
          className={`rounded-3 px-3 py-2 ${isMine ? "bg-primary text-white" : "bg-body-secondary border"}`}
          style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}
        >
          {message.content}
        </div>
        <div className={`small text-muted mt-1 ${isMine ? "text-end" : ""}`}>{formatTime(message.createdAt)}</div>
        {isAssistant && citations.length > 0 && (
          <details className="small mt-1">
            <summary className="text-muted" style={{ cursor: "pointer" }}>
              Fonti citate ({citations.length})
            </summary>
            <div className="mt-2 d-flex flex-column gap-2">
              {citations.map((citation, index) => (
                <div key={`${citation.sourceId}-${index}`} className="border rounded-2 p-2 bg-body">
                  <div className="d-flex align-items-center gap-2 mb-1">
                    <Badge bg="light" text="dark" className="border">
                      [{index + 1}] {citation.sourceTitle}
                    </Badge>
                    {typeof citation.score === "number" && (
                      <span className="text-muted">rilevanza {Math.round(citation.score * 100)}%</span>
                    )}
                  </div>
                  <div className="text-muted">{citation.excerpt}</div>
                </div>
              ))}
            </div>
          </details>
        )}
      </div>
    </div>
  );
};

// Pannello di gestione dei partecipanti: elenco con ruolo, invito di un membro
// del workspace, uscita/rimozione. Condivisione su invito esplicito (Fase 1).
const ParticipantsPanel = ({ participants, invitable, currentUserId, busy, onInvite, onRemove }) => {
  const [selected, setSelected] = React.useState("");
  const me = participants.find((entry) => entry.userId === currentUserId);
  const isOwner = me?.role === "owner";

  return (
    <div className="agency-section-card mb-3">
      <div className="fw-semibold mb-2">Partecipanti ({participants.length})</div>
      <div className="d-flex flex-column gap-2 mb-3">
        {participants.map((entry) => {
          const label = entry.name || entry.email || "Utente";
          const isMe = entry.userId === currentUserId;
          const canRemove = entry.role !== "owner" && (isOwner || isMe);
          return (
            <div key={entry.userId} className="d-flex align-items-center justify-content-between gap-2">
              <div className="d-flex align-items-center gap-2">
                <span>
                  {label}
                  {isMe ? " (tu)" : ""}
                </span>
                <Badge bg={entry.role === "owner" ? "primary" : "secondary"}>
                  {entry.role === "owner" ? "Proprietario" : "Membro"}
                </Badge>
              </div>
              {canRemove && (
                <Button size="sm" variant="outline-secondary" disabled={busy} onClick={() => onRemove(entry.userId)}>
                  {isMe ? "Esci" : "Rimuovi"}
                </Button>
              )}
            </div>
          );
        })}
      </div>
      {Array.isArray(invitable) && invitable.length > 0 ? (
        <div className="d-flex gap-2 align-items-end">
          <Form.Select
            size="sm"
            value={selected}
            onChange={(event) => setSelected(event.target.value)}
            disabled={busy}
            aria-label="Invita un membro"
          >
            <option value="">Invita un membro…</option>
            {invitable.map((member) => (
              <option key={member.userId} value={member.userId}>
                {member.name || member.email}
              </option>
            ))}
          </Form.Select>
          <Button
            size="sm"
            variant="primary"
            disabled={busy || !selected}
            onClick={() => {
              onInvite(selected);
              setSelected("");
            }}
          >
            Invita
          </Button>
        </div>
      ) : (
        <div className="small text-muted">Tutti i membri del workspace sono già nella conversazione.</div>
      )}
    </div>
  );
};

const AgencyProjectChatPage = () => {
  const { projectId } = useParams();
  const { session } = useSession();
  const currentUserId = session?.userId || null;

  const [loading, setLoading] = React.useState(true);
  const [sending, setSending] = React.useState(false);
  const [aiThinking, setAiThinking] = React.useState(false);
  const [aiConfigured, setAiConfigured] = React.useState(true);
  const [isParticipant, setIsParticipant] = React.useState(true);
  const [messages, setMessages] = React.useState([]);
  const [participants, setParticipants] = React.useState([]);
  const [invitable, setInvitable] = React.useState([]);
  const [showParticipants, setShowParticipants] = React.useState(false);
  const [participantsBusy, setParticipantsBusy] = React.useState(false);
  const [input, setInput] = React.useState("");
  const [error, setError] = React.useState("");
  const [budgetNotice, setBudgetNotice] = React.useState("");
  const [dataMeta, setDataMeta] = React.useState(null);
  const bottomRef = React.useRef(null);

  const isOwner = participants.find((entry) => entry.userId === currentUserId)?.role === "owner";

  const applyChat = React.useCallback((chat) => {
    setAiConfigured(chat?.aiConfigured !== false);
    setMessages(Array.isArray(chat?.messages) ? chat.messages : []);
    setIsParticipant(chat?.isParticipant !== false);
    if (Array.isArray(chat?.participants)) {
      setParticipants(chat.participants);
    }
    setDataMeta(readAgencyDataMeta(chat));
  }, []);

  const load = React.useCallback(async () => {
    if (!projectId) {
      return;
    }
    setLoading(true);
    setError("");
    try {
      const chat = await getAgencyProjectChat(projectId);
      applyChat(chat);
    } catch (err) {
      setError(err?.message || "Impossibile caricare la chat del progetto.");
    } finally {
      setLoading(false);
    }
  }, [projectId, applyChat]);

  React.useEffect(() => {
    void load();
  }, [load]);

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const refreshParticipants = React.useCallback(async () => {
    const result = await getAgencyProjectChatParticipants(projectId);
    if (result) {
      setParticipants(Array.isArray(result.participants) ? result.participants : []);
      setInvitable(Array.isArray(result.invitable) ? result.invitable : []);
    }
  }, [projectId]);

  const toggleParticipants = async () => {
    const next = !showParticipants;
    setShowParticipants(next);
    if (next) {
      try {
        await refreshParticipants();
      } catch (err) {
        setError(err?.message || "Impossibile caricare i partecipanti.");
      }
    }
  };

  const handleInvite = async (userId) => {
    if (!userId) {
      return;
    }
    setParticipantsBusy(true);
    setError("");
    try {
      const result = await addAgencyProjectChatParticipant(projectId, userId);
      if (result) {
        setParticipants(Array.isArray(result.participants) ? result.participants : []);
        setInvitable(Array.isArray(result.invitable) ? result.invitable : []);
      }
    } catch (err) {
      setError(err?.message || "Invito non riuscito.");
    } finally {
      setParticipantsBusy(false);
    }
  };

  const handleRemoveParticipant = async (memberId) => {
    setParticipantsBusy(true);
    setError("");
    try {
      const result = await removeAgencyProjectChatParticipant(projectId, memberId);
      if (result) {
        setParticipants(Array.isArray(result.participants) ? result.participants : []);
        setInvitable(Array.isArray(result.invitable) ? result.invitable : []);
      }
      if (memberId === currentUserId) {
        // Sono uscito dalla conversazione: ricarico lo stato (niente piu' messaggi).
        await load();
        setShowParticipants(false);
      }
    } catch (err) {
      setError(err?.message || "Rimozione non riuscita.");
    } finally {
      setParticipantsBusy(false);
    }
  };

  const submit = async (askAi) => {
    const question = input.trim();
    if (!question || sending) {
      return;
    }
    const willInvokeAi = askAi || mentionsAi(question);
    setSending(true);
    setAiThinking(willInvokeAi);
    setError("");
    setBudgetNotice("");
    // Bolla utente ottimistica (autore = io), poi rimpiazzata dallo storico reale.
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
      const chat = await sendAgencyProjectChatMessage(projectId, question, { askAi });
      applyChat(chat);
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

  const handleClear = async () => {
    if (sending || messages.length === 0) {
      return;
    }
    if (!window.confirm("Azzerare la conversazione? L'operazione non è reversibile e vale per tutti i partecipanti.")) {
      return;
    }
    setError("");
    setBudgetNotice("");
    try {
      const chat = await clearAgencyProjectChat(projectId);
      setMessages(Array.isArray(chat?.messages) ? chat.messages : []);
    } catch (err) {
      setError(err?.message || "Azzeramento della chat non riuscito.");
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submit(false);
    }
  };

  return (
    <AgencyProjectPageTemplate
      title="Chat AI di progetto"
      subtitle="Chat condivisa del progetto: scrivi con il team e interpella l'AI sulle Fonti (RAG) con @AI o «Chiedi all'AI»."
      dataMeta={dataMeta}
    >
      {error && (
        <Alert variant="danger" className="py-2" dismissible onClose={() => setError("")}>
          {error}
        </Alert>
      )}

      {!aiConfigured && (
        <Alert variant="warning" className="py-2">
          <strong>AI non configurata.</strong> Puoi comunque scrivere messaggi nella chat condivisa, ma per le
          risposte dell&rsquo;assistente serve un provider AI con chiave in <em>Impostazioni Agency</em>.
        </Alert>
      )}

      {budgetNotice && (
        <Alert variant="warning" className="py-2" dismissible onClose={() => setBudgetNotice("")}>
          {budgetNotice}
        </Alert>
      )}

      <div className="d-flex justify-content-between align-items-center mb-2 gap-2 flex-wrap">
        <div className="small text-muted">Conversazione condivisa tra i partecipanti invitati.</div>
        <div className="d-flex gap-2">
          <Button size="sm" variant="outline-secondary" onClick={() => void toggleParticipants()}>
            Partecipanti ({participants.length})
          </Button>
          {isOwner && (
            <Button
              size="sm"
              variant="outline-secondary"
              onClick={() => void handleClear()}
              disabled={sending || messages.length === 0}
            >
              Azzera
            </Button>
          )}
        </div>
      </div>

      {showParticipants && (
        <ParticipantsPanel
          participants={participants}
          invitable={invitable}
          currentUserId={currentUserId}
          busy={participantsBusy}
          onInvite={handleInvite}
          onRemove={handleRemoveParticipant}
        />
      )}

      {!isParticipant ? (
        <div className="agency-empty-state">
          Non fai ancora parte di questa conversazione. Chiedi a un partecipante di invitarti per vedere i messaggi
          e scrivere.
        </div>
      ) : (
        <>
          <div
            className="border rounded-3 p-3 mb-3 bg-body"
            style={{ minHeight: "40vh", maxHeight: "60vh", overflowY: "auto" }}
          >
            {loading ? (
              <div className="d-flex justify-content-center py-4">
                <Spinner animation="border" size="sm" role="status" />
              </div>
            ) : messages.length === 0 ? (
              <div className="text-muted small text-center py-4">
                Nessun messaggio. Scrivi al team di progetto e usa <strong>@AI</strong> (o il pulsante
                <strong> Chiedi all&rsquo;AI</strong>) per interrogare le Fonti — ad esempio su obiettivi, target o
                contenuti indicizzati.
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

          <Form
            onSubmit={(event) => {
              event.preventDefault();
              void submit(false);
            }}
          >
            <div className="d-flex gap-2 align-items-end">
              <Form.Control
                as="textarea"
                rows={2}
                placeholder="Scrivi un messaggio… (usa @AI per interpellare l'assistente)"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={handleKeyDown}
                disabled={sending}
              />
              <div className="d-flex flex-column gap-2">
                <Button type="submit" variant="outline-primary" disabled={sending || input.trim().length === 0}>
                  {sending && !aiThinking ? <Spinner animation="border" size="sm" /> : "Invia"}
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => void submit(true)}
                  disabled={sending || !aiConfigured || input.trim().length === 0}
                  title={aiConfigured ? "Invia e chiedi una risposta all'assistente AI" : "AI non configurata"}
                >
                  {aiThinking ? <Spinner animation="border" size="sm" /> : "Chiedi all'AI"}
                </Button>
              </div>
            </div>
            <Form.Text className="text-muted">
              Invio per mandare il messaggio, Shift+Invio per andare a capo. L&rsquo;AI risponde solo se interpellata.
            </Form.Text>
          </Form>
        </>
      )}
    </AgencyProjectPageTemplate>
  );
};

export default AgencyProjectChatPage;
