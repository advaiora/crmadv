import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import {
  listMessagingConversation,
  listMessagingUsers,
  markMessagingConversationRead,
} from "../../../modules/messaging/api/messagingApi";
import { subscribeMessaging, subscribeStatus } from "../../../realtime/realtimeClient";
import MessagingPanel from "./MessagingPanel";

// Il punto sotto esame e' UNO: quando parte la richiesta "segna come letto".
// Ogni sua partenza scrive una riga nel Registro attivita', e prima partiva a ogni
// ricarica — anche nei controlli automatici silenziosi, ogni 1,5 secondi.
vi.mock("../../../modules/messaging/api/messagingApi", () => ({
  listMessagingUsers: vi.fn(),
  listMessagingConversation: vi.fn(),
  markMessagingConversationRead: vi.fn(),
  sendMessagingMessage: vi.fn(),
}));

// Il tempo reale si finge per due motivi: non aprire websocket nei test, e avere in
// mano il segnale che provoca la ricarica SILENZIOSA (la stessa del poller), senza
// dover aspettare davvero il timer da 1,5 secondi.
//
// Il pannello ha DUE iscritti a `subscribeMessaging` (i contatti nel componente,
// la conversazione dentro useMessagingConversation): il mock tiene un elenco, non
// un singolo segnaposto, altrimenti il secondo iscritto sovrascriverebbe il primo
// e meta' degli eventi finti non arriverebbe mai a destinazione.
let messagingHandlers = [];
const emitMessagingEvent = (event) => {
  messagingHandlers.forEach((handler) => handler(event));
};
vi.mock("../../../realtime/realtimeClient", () => ({
  subscribeStatus: vi.fn(),
  subscribeMessaging: vi.fn(),
}));

const persona = { userId: "u2", name: "Rita Neri", email: "rita@example.com" };

const messaggio = (overrides = {}) => ({
  id: "m1",
  body: "Ciao",
  isMine: false,
  readAt: null,
  createdAt: "2026-09-09T10:00:00.000Z",
  ...overrides,
});

const rendiPannello = () =>
  render(<MessagingPanel expanded canSend peer={persona} onPeerChange={() => {}} />);

beforeEach(() => {
  vi.clearAllMocks();
  messagingHandlers = [];
  // jsdom non implementa scrollIntoView, e il pannello lo chiama a ogni messaggio.
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
  subscribeStatus.mockImplementation((cb) => {
    cb(false);
    return () => {};
  });
  subscribeMessaging.mockImplementation((handler) => {
    messagingHandlers.push(handler);
    return () => {
      messagingHandlers = messagingHandlers.filter((existing) => existing !== handler);
    };
  });
  listMessagingUsers.mockResolvedValue({ items: [] });
  markMessagingConversationRead.mockResolvedValue({ updatedCount: 1 });
});

describe("MessagingPanel — quando segna come letto", () => {
  it("segna come letto all'apertura se c'e' un messaggio in arrivo non letto", async () => {
    listMessagingConversation.mockResolvedValue({ items: [messaggio()] });

    rendiPannello();

    await waitFor(() => expect(markMessagingConversationRead).toHaveBeenCalledWith("u2"));
    expect(markMessagingConversationRead).toHaveBeenCalledTimes(1);
  });

  it("NON segna come letto se la conversazione e' gia' tutta letta", async () => {
    listMessagingConversation.mockResolvedValue({
      items: [
        messaggio({ readAt: "2026-09-09T10:05:00.000Z" }),
        messaggio({ id: "m2", isMine: true, body: "Rispondo io" }),
      ],
    });

    rendiPannello();

    await screen.findByText("Rispondo io");
    expect(markMessagingConversationRead).not.toHaveBeenCalled();
  });

  it("una ricarica silenziosa senza niente di nuovo non segna una seconda volta", async () => {
    // Primo giro: un non letto. Dal secondo in poi il server lo restituisce letto,
    // esattamente come dopo una marcatura riuscita.
    listMessagingConversation
      .mockResolvedValueOnce({ items: [messaggio()] })
      .mockResolvedValue({ items: [messaggio({ readAt: "2026-09-09T10:00:30.000Z" })] });

    rendiPannello();

    await waitFor(() => expect(markMessagingConversationRead).toHaveBeenCalledTimes(1));

    emitMessagingEvent({ withUserId: "u2" });
    emitMessagingEvent({ withUserId: "u2" });

    await waitFor(() => expect(listMessagingConversation).toHaveBeenCalledTimes(3));
    expect(markMessagingConversationRead).toHaveBeenCalledTimes(1);
  });

  it("segna di nuovo quando arriva davvero un messaggio nuovo", async () => {
    listMessagingConversation
      .mockResolvedValueOnce({ items: [messaggio()] })
      .mockResolvedValue({
        items: [
          messaggio({ readAt: "2026-09-09T10:00:30.000Z" }),
          messaggio({ id: "m2", body: "Ci sei?", createdAt: "2026-09-09T11:00:00.000Z" }),
        ],
      });

    rendiPannello();

    await waitFor(() => expect(markMessagingConversationRead).toHaveBeenCalledTimes(1));

    emitMessagingEvent({ withUserId: "u2" });

    await waitFor(() => expect(markMessagingConversationRead).toHaveBeenCalledTimes(2));
  });
});

describe("MessagingPanel — storico oltre 120 messaggi", () => {
  it("mostra 'Carica messaggi precedenti' solo se il server segnala altro storico", async () => {
    listMessagingConversation.mockResolvedValue({
      items: [messaggio()],
      pageInfo: { limit: 120, hasMore: false, nextBefore: "2026-09-09T10:00:00.000Z" },
    });

    rendiPannello();

    await screen.findByText("Ciao");
    expect(screen.queryByText("Carica messaggi precedenti")).not.toBeInTheDocument();
  });

  it("il click su 'Carica messaggi precedenti' chiede la pagina prima del messaggio piu' vecchio e la antepone", async () => {
    listMessagingConversation.mockResolvedValueOnce({
      items: [messaggio({ id: "m2", createdAt: "2026-09-09T10:00:00.000Z" })],
      pageInfo: { limit: 120, hasMore: true, nextBefore: "2026-09-09T10:00:00.000Z" },
    });

    rendiPannello();

    const bottone = await screen.findByText("Carica messaggi precedenti");

    listMessagingConversation.mockResolvedValueOnce({
      items: [messaggio({ id: "m1", body: "Messaggio vecchio", createdAt: "2026-09-08T09:00:00.000Z" })],
      pageInfo: { limit: 120, hasMore: false, nextBefore: "2026-09-08T09:00:00.000Z" },
    });

    fireEvent.click(bottone);

    await screen.findByText("Messaggio vecchio");
    expect(listMessagingConversation).toHaveBeenLastCalledWith("u2", {
      limit: 120,
      before: "2026-09-09T10:00:00.000Z",
    });
    // Esaurito lo storico: il pulsante sparisce, non resta li' a chiedere il vuoto.
    expect(screen.queryByText("Carica messaggi precedenti")).not.toBeInTheDocument();
  });

  it("una ricarica silenziosa dopo 'carica precedenti' non cancella i messaggi vecchi gia' portati in memoria", async () => {
    listMessagingConversation.mockResolvedValueOnce({
      items: [messaggio({ id: "m2", createdAt: "2026-09-09T10:00:00.000Z" })],
      pageInfo: { limit: 120, hasMore: true, nextBefore: "2026-09-09T10:00:00.000Z" },
    });

    rendiPannello();

    const bottone = await screen.findByText("Carica messaggi precedenti");

    listMessagingConversation.mockResolvedValueOnce({
      items: [messaggio({ id: "m1", body: "Messaggio vecchio", createdAt: "2026-09-08T09:00:00.000Z" })],
      pageInfo: { limit: 120, hasMore: false, nextBefore: "2026-09-08T09:00:00.000Z" },
    });
    fireEvent.click(bottone);
    await screen.findByText("Messaggio vecchio");

    // Il giro successivo (poller/tempo reale) torna a chiedere solo la coda, senza
    // `before`: non deve far sparire "Messaggio vecchio" appena caricato a mano.
    listMessagingConversation.mockResolvedValue({
      items: [messaggio({ id: "m2", createdAt: "2026-09-09T10:00:00.000Z" })],
      pageInfo: { limit: 120, hasMore: true, nextBefore: "2026-09-09T10:00:00.000Z" },
    });
    emitMessagingEvent({ withUserId: "u2" });

    await waitFor(() => expect(listMessagingConversation).toHaveBeenCalledTimes(3));
    expect(screen.getByText("Messaggio vecchio")).toBeInTheDocument();
    // Il pulsante non deve ricomparire per effetto del solo giro di coda: il vero
    // confine resta quello stabilito dal click, non quello (diverso) della coda.
    expect(screen.queryByText("Carica messaggi precedenti")).not.toBeInTheDocument();
  });

  it("con una pagina vuota il pulsante non lampeggia: il confine resta chiuso anche se la coda continua a dire hasMore", async () => {
    // Limite esatto di 120 messaggi totali: il server dichiara hasMore:true sulla
    // coda (messages.length === limit) pur non esistendo nient'altro prima.
    listMessagingConversation.mockResolvedValueOnce({
      items: [messaggio()],
      pageInfo: { limit: 120, hasMore: true, nextBefore: "2026-09-09T10:00:00.000Z" },
    });

    rendiPannello();

    const bottone = await screen.findByText("Carica messaggi precedenti");

    listMessagingConversation.mockResolvedValueOnce({
      items: [],
      pageInfo: { limit: 120, hasMore: false, nextBefore: null },
    });
    fireEvent.click(bottone);

    await waitFor(() => expect(screen.queryByText("Carica messaggi precedenti")).not.toBeInTheDocument());

    // Il giro successivo (poller/tempo reale) torna a dire hasMore:true sulla coda:
    // non deve far ricomparire il pulsante, altrimenti ogni click chiederebbe il vuoto.
    listMessagingConversation.mockResolvedValue({
      items: [messaggio()],
      pageInfo: { limit: 120, hasMore: true, nextBefore: "2026-09-09T10:00:00.000Z" },
    });
    emitMessagingEvent({ withUserId: "u2" });

    await waitFor(() => expect(listMessagingConversation).toHaveBeenCalledTimes(3));
    expect(screen.queryByText("Carica messaggi precedenti")).not.toBeInTheDocument();
  });

  it("una risposta tardiva di 'carica precedenti' non si aggancia se nel frattempo la persona e' cambiata", async () => {
    const primaPersona = persona;
    const secondaPersona = { userId: "u3", name: "Book Bianchi", email: "book@example.com" };
    let resolveOlder;

    listMessagingConversation.mockResolvedValueOnce({
      items: [messaggio({ id: "m2", createdAt: "2026-09-09T10:00:00.000Z" })],
      pageInfo: { limit: 120, hasMore: true, nextBefore: "2026-09-09T10:00:00.000Z" },
    });

    const { rerender } = render(<MessagingPanel expanded canSend peer={primaPersona} onPeerChange={() => {}} />);

    const bottone = await screen.findByText("Carica messaggi precedenti");

    listMessagingConversation.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveOlder = resolve;
        }),
    );
    fireEvent.click(bottone);
    await waitFor(() => expect(listMessagingConversation).toHaveBeenCalledTimes(2));

    // La persona cambia PRIMA che la risposta di "carica precedenti" arrivi.
    listMessagingConversation.mockResolvedValueOnce({
      items: [messaggio({ id: "n1", body: "Ciao da Book", createdAt: "2026-09-09T09:00:00.000Z" })],
      pageInfo: { limit: 120, hasMore: false, nextBefore: null },
    });
    rerender(<MessagingPanel expanded canSend peer={secondaPersona} onPeerChange={() => {}} />);
    await screen.findByText("Ciao da Book");

    // Ora arriva la risposta tardiva della conversazione precedente: va scartata.
    resolveOlder({
      items: [messaggio({ id: "m1", body: "Messaggio vecchio di Rita", createdAt: "2026-09-08T09:00:00.000Z" })],
      pageInfo: { limit: 120, hasMore: false, nextBefore: "2026-09-08T09:00:00.000Z" },
    });
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });

    expect(screen.queryByText("Messaggio vecchio di Rita")).not.toBeInTheDocument();
    expect(screen.getByText("Ciao da Book")).toBeInTheDocument();
  });
});
