import React from "react";
import { Badge, Button, Form, Spinner } from "react-bootstrap";
import {
  listMessagingConversation,
  listMessagingUsers,
  markMessagingConversationRead,
  sendMessagingMessage,
} from "../../../modules/messaging/api/messagingApi";
import { formatListDate, newestUnreadIncomingAt } from "./chatShared";
import { IconBack, IconSearch } from "./chatIcons";
import { subscribeMessaging, subscribeStatus } from "../../../realtime/realtimeClient";
import MessageBubble from "./MessageBubble";

// Il mondo MESSAGGISTICA dentro il popup delle chat (spec 4-ter §1).
//
// Entra "sul suo modello 1-a-1 attuale, senza riscritture": nessuna entita'
// conversazione, nessun gruppo, nessun allegato. Nel modello (WorkspaceMessage) la
// conversazione e' implicita nella coppia mittente/destinatario — il modello a
// conversazioni con gruppi di reparto e' esplicitamente rimandato a V8.
//
// Riusa il layer API gia' in casa (src/modules/messaging/api/messagingApi.js), lo
// stesso della pagina Messaggi: qui non si duplica logica di server, si cambia solo
// dove la si guarda.

// Stessi ritmi della pagina Messaggi: i contatti cambiano piano, la conversazione
// aperta e' quella che si guarda mentre l'altro scrive. Questi valori sono la RETE DI
// SICUREZZA: quando il tempo reale (websocket) e' connesso il polling rallenta ai
// valori "SLOW" (l'aggiornamento istantaneo arriva dal websocket); se il websocket
// cade, si torna ai ritmi rapidi.
const CONTACTS_POLL_INTERVAL_MS = 2500;
const CONVERSATION_POLL_INTERVAL_MS = 1500;
const CONTACTS_POLL_SLOW_MS = 20000;
const CONVERSATION_POLL_SLOW_MS = 12000;

const getErrorMessage = (error, fallback) => {
  const status = Number(error?.status);
  if (status === 403) {
    return "Non hai i permessi necessari.";
  }
  if (status === 404) {
    return "Utente non trovato nel workspace.";
  }
  return error?.message || fallback;
};

const contactLabel = (contact) => contact?.name || contact?.email || "Utente";

// Elenco delle conversazioni con le persone. Sorgente: i membri del workspace, non
// solo chi ha gia' scritto — quindi compaiono anche i colleghi a zero messaggi, ed
// e' voluto: e' da qui che si comincia a parlare con qualcuno.
const ContactList = ({ contacts, loading, error, activePeerId, draft, onDraft, onSubmitSearch, onSelect }) => (
  <div className="ai-chat-msg-list">
    <Form className="ai-chat-search" onSubmit={onSubmitSearch}>
      <IconSearch size={16} className="ai-chat-search-icon" />
      <input
        type="text"
        className="ai-chat-search-input"
        placeholder="Cerca una persona…"
        value={draft}
        onChange={(event) => onDraft(event.target.value)}
        aria-label="Cerca una persona"
      />
    </Form>

    {error && <div className="ai-chat-notice is-error">{error}</div>}

    {loading && contacts.length === 0 ? (
      <div className="ai-chat-centered">
        <Spinner animation="border" size="sm" role="status" />
      </div>
    ) : contacts.length === 0 ? (
      <div className="ai-chat-empty">Nessuna persona corrisponde alla ricerca.</div>
    ) : (
      <div className="ai-chat-msg-rows">
        {contacts.map((contact) => (
          <button
            key={contact.userId}
            type="button"
            className={`ai-chat-msg-row ${contact.userId === activePeerId ? "is-active" : ""}`}
            onClick={() => onSelect(contact)}
            aria-current={contact.userId === activePeerId ? "true" : undefined}
          >
            <span className="ai-chat-msg-row-main">
              <span className="ai-chat-msg-row-name">{contactLabel(contact)}</span>
              <span className="ai-chat-msg-row-preview">{contact.lastMessagePreview || "Nessun messaggio"}</span>
            </span>
            <span className="ai-chat-msg-row-meta">
              <span className="ai-chat-msg-row-date">{formatListDate(contact.lastMessageAt)}</span>
              {contact.unreadCount > 0 && (
                <Badge bg="primary" pill className="ai-chat-dot">
                  {contact.unreadCount}
                </Badge>
              )}
            </span>
          </button>
        ))}
      </div>
    )}
  </div>
);

// `peer` e `onPeerChange` arrivano dal padre (AiChatWidget): la persona selezionata
// vive un livello piu' su, come gia' la sessione della Chat AI. Serve perche' il
// pannello si SMONTA cambiando mondo ({isMessaging ? <MessagingPanel/> : …}); se il
// peer stesse qui dentro, tornando ai Messaggi la conversazione aperta sarebbe persa
// (QoL segnalato il 16/7, spec 4-ter §5). Tenendolo nel padre la casella la ricorda.
const MessagingPanel = ({ expanded, canSend, canAttach, peer, onPeerChange }) => {
  const [contacts, setContacts] = React.useState([]);
  const [contactsLoading, setContactsLoading] = React.useState(true);
  const [contactsError, setContactsError] = React.useState("");
  const [draftSearch, setDraftSearch] = React.useState("");
  const [searchQuery, setSearchQuery] = React.useState("");

  // Il contatto INTERO (non solo l'id) sta nel padre: la ricerca filtra l'elenco e con
  // il solo id il nome dell'intestazione sparirebbe appena il peer esce dai risultati.
  const setPeer = onPeerChange;
  const [messages, setMessages] = React.useState([]);
  const [messagesLoading, setMessagesLoading] = React.useState(false);
  const [messagesError, setMessagesError] = React.useState("");
  const [composerText, setComposerText] = React.useState("");
  const [sending, setSending] = React.useState(false);

  const bottomRef = React.useRef(null);
  const peerId = peer?.userId || "";

  // Fin dove e' gia' stato chiesto "segna come letto" sulla conversazione aperta
  // (istante del messaggio in arrivo piu' recente per cui la richiesta e' partita).
  // Senza questo segnaposto la richiesta partiva a OGNI caricamento, compresi i
  // controlli automatici silenziosi ogni 1,5 secondi: il server registra un evento
  // `messages.read` per ogni chiamata, anche quando non ha aggiornato niente, e il
  // Registro attivita' si riempiva di righe "ha guardato" a conversazione ferma.
  // Vive in un ref, non nello stato: cambiarlo non deve far ridisegnare niente.
  const readMarkerRef = React.useRef(0);
  const [realtimeConnected, setRealtimeConnected] = React.useState(false);

  // A tutto schermo le due colonne stanno insieme; nel popup si mostra una cosa
  // alla volta, come su un telefono.
  const showList = expanded || !peerId;
  const showConversation = expanded || Boolean(peerId);

  const loadContacts = React.useCallback(
    async ({ silent = false } = {}) => {
      if (!silent) {
        setContactsLoading(true);
        setContactsError("");
      }
      try {
        const result = await listMessagingUsers({ q: searchQuery || undefined, limit: 80 });
        setContacts(Array.isArray(result?.items) ? result.items : []);
      } catch (error) {
        if (!silent) {
          setContacts([]);
          setContactsError(getErrorMessage(error, "Impossibile caricare le persone del workspace."));
        }
      } finally {
        if (!silent) {
          setContactsLoading(false);
        }
      }
    },
    [searchQuery],
  );

  const loadConversation = React.useCallback(async (userId, { silent = false } = {}) => {
    if (!userId) {
      return;
    }
    if (!silent) {
      setMessagesLoading(true);
      setMessagesError("");
    }
    try {
      const result = await listMessagingConversation(userId, { limit: 120 });
      const items = Array.isArray(result?.items) ? result.items : [];
      setMessages(items);

      // Si segna come letto solo quando e' arrivato qualcosa di nuovo da leggere:
      // aprire la conversazione con messaggi non letti passa di qui, e cosi' un
      // messaggio che arriva mentre e' aperta; il controllo automatico a vuoto no.
      // La marcatura resta (serve ai non letti), sparisce il rumore nel registro.
      const unreadAt = newestUnreadIncomingAt(items);
      if (unreadAt > readMarkerRef.current) {
        const previousMarker = readMarkerRef.current;
        // Spostato PRIMA della chiamata: due caricamenti sovrapposti (poller +
        // segnale del tempo reale) vedrebbero gli stessi non letti e la ripeterebbero.
        readMarkerRef.current = unreadAt;
        try {
          await markMessagingConversationRead(userId);
        } catch (_error) {
          // Segnare "letto" e' un di piu': se fallisce, la conversazione resta
          // leggibile e il segnaposto torna indietro, cosi' il giro dopo riprova.
          if (readMarkerRef.current === unreadAt) {
            readMarkerRef.current = previousMarker;
          }
        }
      }
    } catch (error) {
      if (!silent) {
        setMessages([]);
        setMessagesError(getErrorMessage(error, "Impossibile caricare la conversazione."));
      }
    } finally {
      if (!silent) {
        setMessagesLoading(false);
      }
    }
  }, []);

  React.useEffect(() => {
    void loadContacts();
  }, [loadContacts]);

  React.useEffect(() => {
    // Il segnaposto dei "gia' segnati come letti" e' della conversazione aperta:
    // cambiando persona riparte da zero, altrimenti i non letti dell'altra
    // resterebbero non segnati perche' piu' vecchi del segnaposto precedente.
    readMarkerRef.current = 0;
    if (!peerId) {
      setMessages([]);
      return;
    }
    void loadConversation(peerId);
  }, [loadConversation, peerId]);

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Tempo reale (Fase 4): sappiamo se il websocket e' connesso (per rallentare il
  // polling) e ascoltiamo il segnale "nuovo messaggio". Ricevuto il segnale, si
  // ricarica dall'endpoint autorizzato: l'elenco contatti sempre (badge non letti,
  // anteprime) e la conversazione aperta solo se e' quella toccata.
  React.useEffect(() => subscribeStatus(setRealtimeConnected), []);

  React.useEffect(() => {
    const onMessagingEvent = (event) => {
      void loadContacts({ silent: true });
      if (event?.withUserId && event.withUserId === peerId) {
        void loadConversation(peerId, { silent: true });
      }
    };
    return subscribeMessaging(onMessagingEvent);
  }, [loadContacts, loadConversation, peerId]);

  // Due poller separati, ognuno acceso solo quando la sua colonna e' a video: nel
  // popup stretto ne gira sempre uno solo. Il componente esiste solo a popup aperto,
  // quindi a popup chiuso non resta niente acceso.
  React.useEffect(() => {
    if (!showList) {
      return undefined;
    }
    let timeoutId;
    let cancelled = false;
    const delay = realtimeConnected ? CONTACTS_POLL_SLOW_MS : CONTACTS_POLL_INTERVAL_MS;

    const run = async () => {
      if (cancelled) return;
      if (typeof document === "undefined" || document.visibilityState === "visible") {
        await loadContacts({ silent: true });
      }
      if (cancelled) return;
      timeoutId = window.setTimeout(run, delay);
    };

    timeoutId = window.setTimeout(run, delay);
    return () => {
      cancelled = true;
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [loadContacts, showList, realtimeConnected]);

  React.useEffect(() => {
    if (!peerId) {
      return undefined;
    }
    let timeoutId;
    let cancelled = false;
    const delay = realtimeConnected ? CONVERSATION_POLL_SLOW_MS : CONVERSATION_POLL_INTERVAL_MS;

    const run = async () => {
      if (cancelled) return;
      if (typeof document === "undefined" || document.visibilityState === "visible") {
        await loadConversation(peerId, { silent: true });
      }
      if (cancelled) return;
      timeoutId = window.setTimeout(run, delay);
    };

    timeoutId = window.setTimeout(run, delay);
    return () => {
      cancelled = true;
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [loadConversation, peerId, realtimeConnected]);

  const submitSearch = (event) => {
    event.preventDefault();
    setSearchQuery(draftSearch.trim());
  };

  const sendMessage = async () => {
    const body = composerText.trim();
    if (!body || !peerId || sending) {
      return;
    }
    setSending(true);
    setMessagesError("");
    try {
      await sendMessagingMessage(peerId, { body });
      setComposerText("");
      await Promise.all([loadConversation(peerId, { silent: true }), loadContacts({ silent: true })]);
    } catch (error) {
      setMessagesError(getErrorMessage(error, "Invio del messaggio non riuscito."));
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendMessage();
    }
  };

  return (
    <div className="ai-chat-conversation ai-chat-messaging">
      {showList && (
        <ContactList
          contacts={contacts}
          loading={contactsLoading}
          error={contactsError}
          activePeerId={peerId}
          draft={draftSearch}
          onDraft={setDraftSearch}
          onSubmitSearch={submitSearch}
          onSelect={(contact) => {
            setPeer(contact);
            setMessages([]);
            setComposerText("");
          }}
        />
      )}

      {showConversation && (
        <div className="ai-chat-conv-main">
          {!expanded && (
            <div className="ai-chat-conv-head">
              <button type="button" className="ai-chat-back" onClick={() => setPeer(null)}>
                <IconBack size={16} />
                Persone
              </button>
              <span className="ai-chat-conv-name" title={peer?.email || ""}>
                {contactLabel(peer)}
              </span>
            </div>
          )}

          {messagesError && <div className="ai-chat-notice is-error">{messagesError}</div>}

          <div className="ai-chat-messages">
            <div className="ai-chat-messages-inner">
              {!peerId ? (
                <div className="ai-chat-empty">Scegli una persona per aprire la conversazione.</div>
              ) : messagesLoading && messages.length === 0 ? (
                <div className="ai-chat-centered">
                  <Spinner animation="border" size="sm" role="status" />
                </div>
              ) : messages.length === 0 ? (
                <div className="ai-chat-empty">Nessun messaggio. Inizia tu la conversazione.</div>
              ) : (
                <>
                  {messages.map((message) => (
                    <MessageBubble
                      key={message.id}
                      message={message}
                      canAttach={canAttach}
                      onAttachmentsChanged={() => loadConversation(peerId, { silent: true })}
                    />
                  ))}
                  <div ref={bottomRef} />
                </>
              )}
            </div>
          </div>

          {peerId && (
            <Form
              className="ai-chat-composer"
              onSubmit={(event) => {
                event.preventDefault();
                void sendMessage();
              }}
            >
              <Form.Control
                as="textarea"
                rows={2}
                placeholder={canSend ? `Scrivi a ${contactLabel(peer)}…` : "Non puoi inviare messaggi con i permessi attuali."}
                value={composerText}
                onChange={(event) => setComposerText(event.target.value)}
                onKeyDown={handleKeyDown}
                disabled={sending || !canSend}
              />
              <div className="ai-chat-composer-actions">
                <span className="ai-chat-composer-spacer" />
                <Button type="submit" size="sm" variant="primary" disabled={sending || !canSend || !composerText.trim()}>
                  {sending ? <Spinner animation="border" size="sm" /> : "Invia"}
                </Button>
              </div>
            </Form>
          )}
        </div>
      )}
    </div>
  );
};

export default MessagingPanel;
