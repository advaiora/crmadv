import React from "react";
import { Alert, Badge, Button, Form, Spinner } from "react-bootstrap";
import { useParams } from "react-router-dom";
import {
  getAgencyProjectChat,
  sendAgencyProjectChatMessage,
  clearAgencyProjectChat,
} from "../../../modules/agency-os/data/agencyDataAdapter";
import { readAgencyDataMeta } from "../../../modules/agency-os/data/agencyDataSource";
import AgencyProjectPageTemplate from "./AgencyProjectPageTemplate";

const formatTime = (value) => {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString("it-IT");
};

// Una bolla di conversazione. L'utente a destra, l'assistente a sinistra. Le fonti
// citate (RAG) dell'assistente sono in un dettaglio richiudibile sotto la risposta.
const ChatBubble = ({ message }) => {
  const isUser = message.role === "user";
  const citations = Array.isArray(message.citations) ? message.citations : [];
  return (
    <div className={`d-flex mb-3 ${isUser ? "justify-content-end" : "justify-content-start"}`}>
      <div style={{ maxWidth: "80%" }}>
        <div
          className={`rounded-3 px-3 py-2 ${isUser ? "bg-primary text-white" : "bg-body-secondary border"}`}
          style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}
        >
          {message.content}
        </div>
        <div className={`small text-muted mt-1 ${isUser ? "text-end" : ""}`}>
          {formatTime(message.createdAt)}
        </div>
        {!isUser && citations.length > 0 && (
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

const AgencyProjectChatPage = () => {
  const { projectId } = useParams();
  const [loading, setLoading] = React.useState(true);
  const [sending, setSending] = React.useState(false);
  const [aiConfigured, setAiConfigured] = React.useState(true);
  const [messages, setMessages] = React.useState([]);
  const [input, setInput] = React.useState("");
  const [error, setError] = React.useState("");
  const [budgetNotice, setBudgetNotice] = React.useState("");
  const [dataMeta, setDataMeta] = React.useState(null);
  const bottomRef = React.useRef(null);

  const applyChat = React.useCallback((chat) => {
    setAiConfigured(chat?.aiConfigured !== false);
    setMessages(Array.isArray(chat?.messages) ? chat.messages : []);
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

  const handleSend = async () => {
    const question = input.trim();
    if (!question || sending) {
      return;
    }
    setSending(true);
    setError("");
    setBudgetNotice("");
    // Bolla utente ottimistica: si vede subito, poi la lista viene rimpiazzata
    // dallo storico reale restituito dal server.
    const optimistic = {
      id: `optimistic-${messages.length}`,
      role: "user",
      content: question,
      citations: [],
      createdAt: new Date().toISOString(),
    };
    setMessages((current) => [...current, optimistic]);
    setInput("");
    try {
      const chat = await sendAgencyProjectChatMessage(projectId, question);
      applyChat(chat);
      if (chat?.budgetExceeded) {
        setBudgetNotice(chat.budgetMessage || "Budget AI giornaliero esaurito.");
      }
    } catch (err) {
      setError(err?.message || "Invio del messaggio non riuscito.");
      // Ripristina il testo e togli la bolla ottimistica in caso di errore.
      setInput(question);
      setMessages((current) => current.filter((message) => message.id !== optimistic.id));
    } finally {
      setSending(false);
    }
  };

  const handleClear = async () => {
    if (sending || messages.length === 0) {
      return;
    }
    if (!window.confirm("Azzerare la conversazione? L'operazione non è reversibile.")) {
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
      void handleSend();
    }
  };

  return (
    <AgencyProjectPageTemplate
      title="Chat AI di progetto"
      subtitle="Interroga le Fonti del progetto: le risposte usano il contesto indicizzato (RAG)."
      dataMeta={dataMeta}
    >
      {error && (
        <Alert variant="danger" className="py-2" dismissible onClose={() => setError("")}>
          {error}
        </Alert>
      )}

      {!aiConfigured && (
        <Alert variant="warning" className="py-2">
          <strong>AI non configurata.</strong> Per usare la chat serve un provider AI con
          chiave configurata in <em>Impostazioni Agency</em>. Senza, le risposte non
          possono essere generate.
        </Alert>
      )}

      {budgetNotice && (
        <Alert variant="warning" className="py-2" dismissible onClose={() => setBudgetNotice("")}>
          {budgetNotice}
        </Alert>
      )}

      <div className="d-flex justify-content-between align-items-center mb-2">
        <div className="small text-muted">
          La conversazione è personale e resta legata a questo progetto.
        </div>
        <Button
          size="sm"
          variant="outline-secondary"
          onClick={() => void handleClear()}
          disabled={sending || messages.length === 0}
        >
          Azzera conversazione
        </Button>
      </div>

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
            Nessun messaggio. Fai una domanda sul progetto per iniziare — ad esempio
            sugli obiettivi, il target o i contenuti delle Fonti.
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <ChatBubble key={message.id} message={message} />
            ))}
            {sending && (
              <div className="d-flex justify-content-start mb-3">
                <div className="rounded-3 px-3 py-2 bg-body-secondary border text-muted small">
                  <Spinner animation="grow" size="sm" className="me-2" />
                  Sto pensando…
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
          void handleSend();
        }}
      >
        <div className="d-flex gap-2 align-items-end">
          <Form.Control
            as="textarea"
            rows={2}
            placeholder="Scrivi una domanda sul progetto…"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleKeyDown}
            disabled={sending || !aiConfigured}
          />
          <Button
            type="submit"
            variant="primary"
            disabled={sending || !aiConfigured || input.trim().length === 0}
          >
            {sending ? <Spinner animation="border" size="sm" /> : "Invia"}
          </Button>
        </div>
        <Form.Text className="text-muted">
          Invio per inviare, Shift+Invio per andare a capo.
        </Form.Text>
      </Form>
    </AgencyProjectPageTemplate>
  );
};

export default AgencyProjectChatPage;
