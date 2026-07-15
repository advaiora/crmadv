import React from "react";
import { Alert, Badge, Button, Form, Spinner } from "react-bootstrap";
import { useParams } from "react-router-dom";
import { Paperclip } from "react-feather";
import {
  getAgencyProjectChat,
  sendAgencyProjectChatMessage,
  clearAgencyProjectChat,
  getAgencyProjectChatParticipants,
  addAgencyProjectChatParticipant,
  removeAgencyProjectChatParticipant,
  getAgencyChatAttachments,
  uploadAgencyChatFileAttachment,
  addAgencyChatEntityAttachment,
  removeAgencyChatAttachment,
  getAgencyChatProjects,
} from "../../../modules/agency-os/data/agencyDataAdapter";
import { readAgencyDataMeta } from "../../../modules/agency-os/data/agencyDataSource";
import { useSession } from "../../../hooks/useSession";
import AgencyProjectPageTemplate from "./AgencyProjectPageTemplate";
import ChatBubble from "../chat/chatBubble";
import { AttachEntityPanel, AttachmentChips } from "../chat/chatAttachments";
import { ATTACHMENT_FILE_ACCEPT, mentionsAi } from "../chat/chatShared";
import "../chat/ai-chat-widget.css";

// ChatBubble, gli allegati (Fase 3a) e la utility mentionsAi sono condivisi con il
// popup di Chat globale (Fase 2): vedi ../chat/. Questa scheda e il popup aprono la
// STESSA conversazione del progetto, quindi devono saper fare le stesse cose.

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

  // Allegati in composizione (Fase 3a) + liste per il selettore di elementi CRM.
  const [attachments, setAttachments] = React.useState([]);
  const [attachBusy, setAttachBusy] = React.useState(false);
  const [showAttachPanel, setShowAttachPanel] = React.useState(false);
  const [attachProjects, setAttachProjects] = React.useState([]);

  const bottomRef = React.useRef(null);
  const fileInputRef = React.useRef(null);

  const isOwner = participants.find((entry) => entry.userId === currentUserId)?.role === "owner";
  const chatTarget = React.useMemo(() => ({ scope: "project", id: projectId }), [projectId]);

  // Clienti derivati dai progetti visibili, come nel popup (in V2 non c'e'
  // un'assegnazione diretta utente<->cliente).
  const attachClients = React.useMemo(() => {
    const byClient = new Map();
    for (const project of attachProjects) {
      if (!project.clientId) continue;
      if (!byClient.has(project.clientId)) {
        byClient.set(project.clientId, { id: project.clientId, name: project.clientName || "Cliente" });
      }
    }
    return [...byClient.values()];
  }, [attachProjects]);

  // Bozze di allegato gia' caricate ma non ancora inviate (Fase 3a): il composer
  // le ritrova alla riapertura della scheda.
  const loadAttachments = React.useCallback(async () => {
    try {
      setAttachments(await getAgencyChatAttachments(chatTarget));
    } catch (_err) {
      // Le bozze sono un di piu': se non arrivano, la chat resta usabile.
      setAttachments([]);
    }
  }, [chatTarget]);

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
      if (chat?.isParticipant !== false) {
        await loadAttachments();
      }
    } catch (err) {
      setError(err?.message || "Impossibile caricare la chat del progetto.");
    } finally {
      setLoading(false);
    }
  }, [projectId, applyChat, loadAttachments]);

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

  // --- Allegati (Fase 3a): stessa logica del popup, stessi componenti. ---

  const attachFile = async (file) => {
    if (!file) {
      return;
    }
    setAttachBusy(true);
    setError("");
    try {
      const attachment = await uploadAgencyChatFileAttachment(chatTarget, file);
      if (attachment) {
        setAttachments((current) => [...current, attachment]);
      }
    } catch (err) {
      setError(err?.message || "Non sono riuscito ad allegare il documento.");
    } finally {
      setAttachBusy(false);
    }
  };

  const attachEntity = async ({ entityType, entityId }) => {
    setAttachBusy(true);
    setError("");
    try {
      const attachment = await addAgencyChatEntityAttachment(chatTarget, { entityType, entityId });
      if (attachment) {
        setAttachments((current) => [...current, attachment]);
        setShowAttachPanel(false);
      }
    } catch (err) {
      setError(err?.message || "Non sono riuscito ad allegare l'elemento.");
    } finally {
      setAttachBusy(false);
    }
  };

  const detachAttachment = async (attachment) => {
    setAttachBusy(true);
    try {
      await removeAgencyChatAttachment(attachment.id);
      setAttachments((current) => current.filter((row) => row.id !== attachment.id));
    } catch (err) {
      setError(err?.message || "Non sono riuscito a togliere l'allegato.");
    } finally {
      setAttachBusy(false);
    }
  };

  // La lista di progetti/clienti serve solo al selettore: si carica alla prima apertura.
  const toggleAttachPanel = async () => {
    const next = !showAttachPanel;
    setShowAttachPanel(next);
    if (next && attachProjects.length === 0) {
      setAttachBusy(true);
      try {
        const list = await getAgencyChatProjects();
        setAttachProjects(Array.isArray(list) ? list : []);
      } catch (err) {
        setError(err?.message || "Impossibile caricare gli elementi da allegare.");
      } finally {
        setAttachBusy(false);
      }
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
      const chat = await sendAgencyProjectChatMessage(projectId, question, {
        askAi,
        attachmentIds: sentAttachments.map((attachment) => attachment.id),
      });
      applyChat(chat);
      if (chat?.budgetExceeded) {
        setBudgetNotice(chat.budgetMessage || "Budget AI giornaliero esaurito.");
      }
    } catch (err) {
      setError(err?.message || "Invio del messaggio non riuscito.");
      setInput(question);
      // Non legati: restano bozze lato server, quindi tornano nel composer.
      setAttachments(sentAttachments);
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
            {showAttachPanel && (
              <div className="mb-2">
                <AttachEntityPanel
                  projects={attachProjects}
                  clients={attachClients}
                  busy={attachBusy}
                  onPick={attachEntity}
                  onClose={() => setShowAttachPanel(false)}
                />
              </div>
            )}

            <AttachmentChips
              attachments={attachments}
              onRemove={detachAttachment}
              busy={attachBusy}
              className="mb-2"
            />

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
                <div className="d-flex gap-2">
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
                    variant="outline-secondary"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={sending || attachBusy}
                    title="Allega un documento (TXT, CSV, MD, DOCX, PDF)"
                  >
                    {attachBusy ? <Spinner animation="border" size="sm" /> : <Paperclip size={16} />}
                  </Button>
                  <Button
                    type="button"
                    variant="outline-secondary"
                    onClick={() => void toggleAttachPanel()}
                    disabled={sending || attachBusy}
                    title="Allega un elemento del CRM (progetto o cliente)"
                  >
                    Elemento
                  </Button>
                </div>
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
              Con <strong>Allega</strong> porti un documento o un elemento del CRM nel contesto.
            </Form.Text>
          </Form>
        </>
      )}
    </AgencyProjectPageTemplate>
  );
};

export default AgencyProjectChatPage;
