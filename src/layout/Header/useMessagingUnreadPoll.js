import React from "react";
import { toast } from "react-toastify";
import { listMessagingUsers } from "../../modules/messaging/api/messagingApi";
import { subscribeMessaging, subscribeStatus } from "../../realtime/realtimeClient";

// Estratto da TopNav.jsx (che sforava le 500 righe): qui vive il conteggio dei
// Messaggi non letti che alimenta il badge sulla barra in alto — caricamento,
// poller e la comparsa dei toast di notifica.
//
// Rete di sicurezza (CRMA-31, A1 punto 8b): prima interrogava il server ogni 2
// secondi FISSI, sempre, anche a conversazioni ferme da ore. Ora rallenta quando
// il tempo reale (websocket) e' connesso — l'aggiornamento istantaneo arriva da
// li' — e torna rapido se il websocket cade. Stesso schema gia' in uso per i
// contatti dei Messaggi (MessagingPanel.jsx).
const MESSAGING_POLL_INTERVAL_MS = 2000;
const MESSAGING_POLL_SLOW_MS = 15000;
export const MESSAGING_NOTIFICATIONS_CONTAINER_ID = "workspace-messaging-notifications";

const normalizeUnreadCount = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
};

const truncateText = (value, maxLength = 80) => {
  if (!value || typeof value !== "string") {
    return "";
  }

  const normalized = value.trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, Math.max(0, maxLength - 3))}...`;
};

export function useMessagingUnreadPoll({ enabled, onMessagingPage, onNavigateToMessaging }) {
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [pollingBlocked, setPollingBlocked] = React.useState(false);
  const [realtimeConnected, setRealtimeConnected] = React.useState(false);
  const unreadByUserRef = React.useRef(new Map());
  const hasBaselineRef = React.useRef(false);
  // In un ref, non nelle dipendenze di `poll`: cambia ogni volta che si entra o si
  // esce dalla pagina Messaggi, e se `poll` cambiasse identita' con lui l'iscritto
  // al tempo reale (sotto) si ri-creerebbe a ogni navigazione — chiudendo e
  // riaprendo il websocket condiviso quando MessagingPanel si smonta nello stesso
  // istante, il che rimette il poller al ritmo rapido: esattamente il traffico che
  // questo hook dovrebbe togliere.
  const onMessagingPageRef = React.useRef(onMessagingPage);
  onMessagingPageRef.current = onMessagingPage;
  // Scarta le risposte "vecchie": se un `poll()` piu' recente e' gia' partito
  // (tempo reale e poller possono sovrapporsi) quando questa richiesta torna, non
  // deve piu' scrivere stato — altrimenti una risposta in ritardo puo' far
  // ricomparire un delta gia' notificato e mostrare due volte lo stesso avviso.
  const pollSequenceRef = React.useRef(0);

  const clearCounts = React.useCallback(() => {
    setUnreadCount(0);
    unreadByUserRef.current = new Map();
    hasBaselineRef.current = false;
  }, []);

  // Reset completo (logout): anche lo sblocco, non solo i conteggi.
  const resetAll = React.useCallback(() => {
    clearCounts();
    setPollingBlocked(false);
  }, [clearCounts]);

  const canPoll = enabled && !pollingBlocked;

  const poll = React.useCallback(async () => {
    if (!canPoll) {
      return;
    }

    const sequence = ++pollSequenceRef.current;

    try {
      const result = await listMessagingUsers({ limit: 80 });
      if (sequence !== pollSequenceRef.current) {
        // Una richiesta piu' recente e' gia' partita mentre questa era in volo:
        // questa risposta e' superata, non si scrive stato con dati vecchi.
        return;
      }
      const contacts = Array.isArray(result?.items) ? result.items : [];

      const nextUnreadByUser = new Map();
      let nextUnreadCount = 0;

      contacts.forEach((contact) => {
        const unreadCountForContact = normalizeUnreadCount(contact?.unreadCount);
        nextUnreadCount += unreadCountForContact;
        nextUnreadByUser.set(contact.userId, {
          ...contact,
          unreadCount: unreadCountForContact,
        });
      });

      if (hasBaselineRef.current && !onMessagingPageRef.current) {
        contacts.forEach((contact) => {
          const previousUnreadCount = normalizeUnreadCount(
            unreadByUserRef.current.get(contact.userId)?.unreadCount,
          );
          const currentUnreadCount = normalizeUnreadCount(contact?.unreadCount);
          const unreadDelta = currentUnreadCount - previousUnreadCount;

          if (unreadDelta <= 0) {
            return;
          }

          const senderName = contact?.name || contact?.email || "utente";
          const preview = truncateText(contact?.lastMessagePreview, 72);
          const toastMessage = unreadDelta > 1
            ? `${senderName} ti ha inviato ${unreadDelta} nuovi messaggi.`
            : `Nuovo messaggio da ${senderName}${preview ? `: ${preview}` : ""}`;

          toast.info(toastMessage, {
            containerId: MESSAGING_NOTIFICATIONS_CONTAINER_ID,
            autoClose: 5000,
            onClick: onNavigateToMessaging,
          });
        });
      }

      unreadByUserRef.current = nextUnreadByUser;
      hasBaselineRef.current = true;
      setUnreadCount(nextUnreadCount);
    } catch (error) {
      if (sequence !== pollSequenceRef.current) {
        return;
      }

      if (Number(error?.status) === 401) {
        return;
      }

      if (Number(error?.status) === 403 || Number(error?.status) === 404) {
        setPollingBlocked(true);
        clearCounts();
      }
    }
  }, [canPoll, clearCounts, onNavigateToMessaging]);

  React.useEffect(() => subscribeStatus(setRealtimeConnected), []);

  React.useEffect(() => {
    if (!canPoll) {
      clearCounts();
      return undefined;
    }

    let timeoutId;
    let cancelled = false;
    const delay = realtimeConnected ? MESSAGING_POLL_SLOW_MS : MESSAGING_POLL_INTERVAL_MS;

    const runPollingCycle = async () => {
      if (cancelled) {
        return;
      }

      if (typeof document === "undefined" || document.visibilityState === "visible") {
        await poll();
      }

      if (cancelled) {
        return;
      }

      timeoutId = window.setTimeout(runPollingCycle, delay);
    };

    void runPollingCycle();

    return () => {
      cancelled = true;
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [canPoll, clearCounts, poll, realtimeConnected]);

  // Tempo reale: un nuovo messaggio aggiorna subito il badge, senza aspettare il
  // prossimo giro di poller.
  React.useEffect(() => {
    if (!canPoll) {
      return undefined;
    }
    return subscribeMessaging(() => {
      void poll();
    });
  }, [canPoll, poll]);

  React.useEffect(() => {
    if (typeof document === "undefined") {
      return undefined;
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void poll();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [poll]);

  return { unreadCount, resetAll };
}
