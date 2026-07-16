import React from "react";
import { Badge, Button, Form, Spinner } from "react-bootstrap";
import {
  fetchScopedChatParticipants,
  addScopedChatParticipant,
  removeScopedChatParticipant,
  clearScopedChat,
  disbandAgencyChatSession,
} from "../../../modules/agency-os/api/agency.api";
import { IconClose } from "./chatIcons";

// Gestione del gruppo di UNA sessione, dentro il popup (spec 4-ter §3).
//
// Prima viveva solo nella scheda Chat estesa del progetto — che significa: sugli
// ambiti Cliente e Generale i gruppi non si potevano gestire affatto. Portandola
// qui vale per tutti e tre gli ambiti, ed e' il passo che permette di cancellare
// quella pagina.
//
// Modello (spec 4-bis): niente "proprietario dell'ambito", solo un **creatore
// della sessione**. Tutti i partecipanti sono pari su scrivere, allegare e
// **invitare**; rimuovere e sciogliere li fa il creatore. Il creatore puo' uscire
// come chiunque: la sessione passa a chi resta.
//
// Uscire, essere rimossi e sciogliere sono la STESSA cosa per chi la subisce: la
// riga non si cancella mai, si **congela**. La sessione resta nel proprio elenco
// come "Archiviata", in sola lettura e ferma al momento dell'uscita.

const participantLabel = (entry) => entry?.name || entry?.email || "Utente";

const ChatParticipantsPanel = ({
  target,
  conversationId,
  currentUserId,
  onClose,
  onFrozen,
  onCleared,
  onSoloChange,
}) => {
  const [participants, setParticipants] = React.useState([]);
  const [invitable, setInvitable] = React.useState([]);
  const [selected, setSelected] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");

  const me = participants.find((entry) => entry.userId === currentUserId);
  const isCreator = me?.role === "owner";
  const isGroup = participants.length > 1;

  // Invitare o rimuovere qualcuno cambia il numero di partecipanti attivi, e con esso la
  // regola dei turni: da solo l'AI risponde a ogni messaggio, in gruppo serve @AI
  // (spec sez. 2). Il padre tiene `isSolo` per la UI del composer; glielo aggiorniamo
  // da qui — senza ricaricare la chat (che chiuderebbe questo pannello). Gated su
  // !loading per non spingere lo stato transitorio a lista vuota.
  React.useEffect(() => {
    if (!loading) {
      onSoloChange?.(participants.length <= 1);
    }
  }, [participants.length, loading, onSoloChange]);

  const apply = (result) => {
    if (!result) return;
    setParticipants(Array.isArray(result.participants) ? result.participants : []);
    setInvitable(Array.isArray(result.invitable) ? result.invitable : []);
  };

  const load = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await fetchScopedChatParticipants(target, { conversationId });
      apply(result);
    } catch (err) {
      setError(err?.message || "Impossibile caricare i partecipanti.");
    } finally {
      setLoading(false);
    }
  }, [target, conversationId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const invite = async () => {
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      apply(await addScopedChatParticipant(target, selected, { conversationId }));
      setSelected("");
    } catch (err) {
      setError(err?.message || "Invito non riuscito.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (memberId) => {
    const isMe = memberId === currentUserId;
    if (isMe) {
      // eslint-disable-next-line no-alert
      const ok = window.confirm(
        "Uscire dalla conversazione? Resterà nel tuo elenco come archiviata, in sola lettura: vedrai i messaggi fino a questo momento, non quelli successivi.",
      );
      if (!ok) return;
    }
    setBusy(true);
    setError("");
    try {
      apply(await removeScopedChatParticipant(target, memberId, { conversationId }));
      if (isMe) {
        // Da qui in poi sono congelato: la chat va riletta, non e' piu' scrivibile.
        onFrozen?.();
      }
    } catch (err) {
      setError(err?.message || "Rimozione non riuscita.");
    } finally {
      setBusy(false);
    }
  };

  const clear = async () => {
    // eslint-disable-next-line no-alert
    const ok = window.confirm("Azzerare la conversazione? L'operazione non è reversibile e vale per tutti i partecipanti.");
    if (!ok) return;
    setBusy(true);
    setError("");
    try {
      await clearScopedChat(target, { conversationId });
      onCleared?.();
    } catch (err) {
      setError(err?.message || "Azzeramento non riuscito.");
    } finally {
      setBusy(false);
    }
  };

  const disband = async () => {
    // eslint-disable-next-line no-alert
    const ok = window.confirm(
      "Sciogliere il gruppo? La conversazione resta tua e torna solitaria. Gli altri la ritroveranno archiviata, in sola lettura fino a questo momento: chi vuole proseguire potrà riprenderla in una nuova chat.",
    );
    if (!ok) return;
    setBusy(true);
    setError("");
    try {
      apply(await disbandAgencyChatSession(target, conversationId));
      onFrozen?.();
    } catch (err) {
      setError(err?.message || "Scioglimento non riuscito.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ai-chat-participants">
      <div className="ai-chat-participants-head">
        <span>Partecipanti {!loading && `(${participants.length})`}</span>
        <button type="button" className="ai-chat-close" aria-label="Chiudi i partecipanti" onClick={onClose}>
          <IconClose size={15} />
        </button>
      </div>

      {error && <div className="ai-chat-notice is-error">{error}</div>}

      {loading ? (
        <div className="ai-chat-centered">
          <Spinner animation="border" size="sm" role="status" />
        </div>
      ) : (
        <>
          <ul className="ai-chat-participant-list">
            {participants.map((entry) => {
              const isMe = entry.userId === currentUserId;
              // Il creatore non si rimuove dagli altri: puo' solo uscire da solo
              // (allora la sessione passa a chi resta).
              const canRemove = isMe || (isCreator && entry.role !== "owner");
              return (
                <li key={entry.userId}>
                  <span className="ai-chat-participant-name" title={entry.email || ""}>
                    {participantLabel(entry)}
                    {isMe && " (tu)"}
                  </span>
                  <span className="ai-chat-participant-meta">
                    {entry.role === "owner" && (
                      <Badge bg="secondary" title="Ha aperto questa conversazione">
                        Creatore
                      </Badge>
                    )}
                    {canRemove && (
                      <button
                        type="button"
                        className="ai-chat-participant-action"
                        disabled={busy}
                        onClick={() => void remove(entry.userId)}
                      >
                        {isMe ? "Esci" : "Rimuovi"}
                      </button>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>

          {/* Invitare lo puo' fare chiunque partecipi: sono tutti pari (spec 4-bis §2). */}
          {invitable.length > 0 ? (
            <div className="ai-chat-invite">
              <Form.Select
                size="sm"
                value={selected}
                onChange={(event) => setSelected(event.target.value)}
                disabled={busy}
                aria-label="Invita una persona"
              >
                <option value="">Invita una persona…</option>
                {invitable.map((member) => (
                  <option key={member.userId} value={member.userId}>
                    {member.name || member.email}
                  </option>
                ))}
              </Form.Select>
              <Button size="sm" variant="primary" disabled={busy || !selected} onClick={() => void invite()}>
                Invita
              </Button>
            </div>
          ) : (
            <div className="ai-chat-participants-note">Tutti sono già nella conversazione.</div>
          )}

          {isCreator && (
            <div className="ai-chat-participants-danger">
              <button type="button" className="ai-chat-danger-action" disabled={busy} onClick={() => void clear()}>
                Azzera i messaggi
              </button>
              {isGroup && (
                <button type="button" className="ai-chat-danger-action" disabled={busy} onClick={() => void disband()}>
                  Sciogli il gruppo
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ChatParticipantsPanel;
