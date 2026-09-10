import React from "react";
import {
  listMessagingConversation,
  markMessagingConversationRead,
} from "../../../modules/messaging/api/messagingApi";
import { subscribeMessaging } from "../../../realtime/realtimeClient";
import { newestUnreadIncomingAt } from "./chatShared";

// Estratto da MessagingPanel.jsx (che sforava le 500 righe): qui vive tutto il
// ciclo di vita della conversazione APERTA — caricamento, marcatura "letto",
// storico oltre i 120 messaggi piu' recenti, poller e tempo reale, scroll.
// I contatti (elenco persone) restano nel pannello: sono un mondo diverso,
// con un proprio poller e senza paginazione.

const CONVERSATION_MESSAGES_LIMIT = 120;
const CONVERSATION_POLL_INTERVAL_MS = 1500;
const CONVERSATION_POLL_SLOW_MS = 12000;
// Sotto questa distanza (px) dal fondo, un nuovo messaggio in coda scrolla giu'
// come prima; oltre, vuol dire che si sta leggendo lo storico e non si strappa
// la vista da sotto le dita di chi legge.
const NEAR_BOTTOM_THRESHOLD_PX = 120;

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

// Confronto per identita' di contenuto, non di riferimento: il poller silenzioso
// chiede la stessa coda ogni giro, e se non e' cambiato niente `setMessages` deve
// restituire lo STESSO array di prima — altrimenti ogni giro fa scattare lo scroll
// automatico, anche a conversazione ferma (vedi lo scroll-effect piu' sotto).
const sameMessageList = (a, b) => {
  if (a.length !== b.length) {
    return false;
  }
  for (let index = 0; index < a.length; index += 1) {
    if (a[index].id !== b[index].id || a[index].readAt !== b[index].readAt) {
      return false;
    }
  }
  return true;
};

export function useMessagingConversation(peerId, realtimeConnected) {
  const [messages, setMessages] = React.useState([]);
  const [messagesLoading, setMessagesLoading] = React.useState(false);
  const [messagesError, setMessagesError] = React.useState("");
  const [hasMoreOlder, setHasMoreOlder] = React.useState(false);
  const [loadingOlder, setLoadingOlder] = React.useState(false);

  const bottomRef = React.useRef(null);
  const messagesContainerRef = React.useRef(null);

  // Fin dove e' gia' stato chiesto "segna come letto" sulla conversazione aperta
  // (istante del messaggio in arrivo piu' recente per cui la richiesta e' partita).
  // Senza questo segnaposto la richiesta partiva a OGNI caricamento, compresi i
  // controlli automatici silenziosi: il server registra un evento `messages.read`
  // per ogni chiamata, anche quando non ha aggiornato niente, e il Registro
  // attivita' si riempiva di righe "ha guardato" a conversazione ferma.
  const readMarkerRef = React.useRef(0);

  // Una volta che "carica precedenti" ha spostato il limite oltre la coda, i giri
  // di coda (poller, tempo reale) non devono piu' riscrivere `hasMoreOlder` dal
  // loro `pageInfo.hasMore`: quello parla della coda, non del vero confine gia'
  // spostato da un click.
  const hasLoadedOlderRef = React.useRef(false);
  const scrollAdjustRef = React.useRef(null);
  const previousMessagesLengthRef = React.useRef(0);

  // Il peer "vero" al momento in cui una risposta arriva: se nel frattempo si e'
  // cambiata persona, la risposta tardiva di "carica precedenti" va scartata,
  // altrimenti anteporrebbe messaggi della conversazione sbagliata.
  const peerIdRef = React.useRef(peerId);
  peerIdRef.current = peerId;

  const loadConversation = React.useCallback(async (userId, { silent = false } = {}) => {
    if (!userId) {
      return;
    }
    if (!silent) {
      setMessagesLoading(true);
      setMessagesError("");
    }
    try {
      const result = await listMessagingConversation(userId, { limit: CONVERSATION_MESSAGES_LIMIT });
      const freshTail = Array.isArray(result?.items) ? result.items : [];

      setMessages((previous) => {
        if (freshTail.length === 0) {
          return previous;
        }
        const oldestFreshCreatedAt = freshTail[0].createdAt;
        const olderKept = previous.filter((message) => message.createdAt < oldestFreshCreatedAt);
        const merged = [...olderKept, ...freshTail];
        return sameMessageList(merged, previous) ? previous : merged;
      });
      if (!hasLoadedOlderRef.current) {
        setHasMoreOlder(Boolean(result?.pageInfo?.hasMore));
      }

      // Si segna come letto solo quando e' arrivato qualcosa di nuovo da leggere:
      // aprire la conversazione con messaggi non letti passa di qui, e cosi' un
      // messaggio che arriva mentre e' aperta; il controllo automatico a vuoto no.
      const unreadAt = newestUnreadIncomingAt(freshTail);
      if (unreadAt > readMarkerRef.current) {
        const previousMarker = readMarkerRef.current;
        readMarkerRef.current = unreadAt;
        try {
          await markMessagingConversationRead(userId);
        } catch (_error) {
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

  // Cambio di persona (o chiusura): si riparte da zero, sempre — anche il
  // segnaposto dei non letti e il confine dello storico appartengono alla
  // conversazione precedente e non hanno senso su quella nuova.
  React.useEffect(() => {
    readMarkerRef.current = 0;
    hasLoadedOlderRef.current = false;
    setHasMoreOlder(false);
    setLoadingOlder(false);
    setMessages([]);
    if (!peerId) {
      return;
    }
    void loadConversation(peerId);
  }, [loadConversation, peerId]);

  const loadOlderMessages = React.useCallback(async () => {
    if (!peerId || loadingOlder || !hasMoreOlder) {
      return;
    }
    const requestedPeerId = peerId;
    const oldestLoaded = messages[0]?.createdAt;
    if (!oldestLoaded) {
      return;
    }
    setLoadingOlder(true);
    try {
      const result = await listMessagingConversation(requestedPeerId, {
        limit: CONVERSATION_MESSAGES_LIMIT,
        before: oldestLoaded,
      });
      if (peerIdRef.current !== requestedPeerId) {
        // La persona e' cambiata mentre la richiesta era in volo: questa
        // risposta appartiene a una conversazione che non e' piu' aperta.
        return;
      }
      const items = Array.isArray(result?.items) ? result.items : [];
      // Si segna comunque, anche a pagina vuota: e' la risposta che stabilisce
      // il vero confine, i giri di coda non devono piu' riscriverlo da qui in poi.
      hasLoadedOlderRef.current = true;
      if (items.length > 0) {
        const container = messagesContainerRef.current;
        if (container) {
          scrollAdjustRef.current = { scrollHeight: container.scrollHeight, scrollTop: container.scrollTop };
        }
        setMessages((previous) => [...items, ...previous]);
      }
      setHasMoreOlder(Boolean(result?.pageInfo?.hasMore));
    } catch (error) {
      if (peerIdRef.current === requestedPeerId) {
        setMessagesError(getErrorMessage(error, "Impossibile caricare i messaggi precedenti."));
      }
    } finally {
      if (peerIdRef.current === requestedPeerId) {
        setLoadingOlder(false);
      }
    }
  }, [peerId, loadingOlder, hasMoreOlder, messages]);

  // Tempo reale: un nuovo messaggio nella conversazione aperta ricarica subito,
  // invece di aspettare il prossimo giro di poller.
  React.useEffect(() => {
    const onMessagingEvent = (event) => {
      if (event?.withUserId && event.withUserId === peerId) {
        void loadConversation(peerId, { silent: true });
      }
    };
    return subscribeMessaging(onMessagingEvent);
  }, [loadConversation, peerId]);

  // Rete di sicurezza se il tempo reale non arriva: rallenta quando il websocket
  // e' connesso (l'aggiornamento istantaneo arriva da li'), torna rapido se cade.
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

  // Scroll: quando si antepongono messaggi vecchi, la porzione gia' visibile
  // resta ferma (si compensa lo spostamento). Altrimenti si scende in fondo solo
  // all'apertura della conversazione o quando si era gia' vicini al fondo — un
  // messaggio nuovo non deve strappare la vista a chi sta leggendo lo storico.
  React.useLayoutEffect(() => {
    const container = messagesContainerRef.current;
    if (scrollAdjustRef.current && container) {
      const { scrollHeight, scrollTop } = scrollAdjustRef.current;
      container.scrollTop = container.scrollHeight - scrollHeight + scrollTop;
      scrollAdjustRef.current = null;
      previousMessagesLengthRef.current = messages.length;
      return;
    }
    const wasEmpty = previousMessagesLengthRef.current === 0;
    previousMessagesLengthRef.current = messages.length;
    if (!container || wasEmpty) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      return;
    }
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    if (distanceFromBottom < NEAR_BOTTOM_THRESHOLD_PX) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  return {
    messages,
    messagesLoading,
    messagesError,
    setMessagesError,
    hasMoreOlder,
    loadingOlder,
    loadConversation,
    loadOlderMessages,
    bottomRef,
    messagesContainerRef,
  };
}
