import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
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
let onMessagingEvent = null;
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
  onMessagingEvent = null;
  // jsdom non implementa scrollIntoView, e il pannello lo chiama a ogni messaggio.
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
  subscribeStatus.mockImplementation((cb) => {
    cb(false);
    return () => {};
  });
  subscribeMessaging.mockImplementation((handler) => {
    onMessagingEvent = handler;
    return () => {};
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

    onMessagingEvent({ withUserId: "u2" });
    onMessagingEvent({ withUserId: "u2" });

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

    onMessagingEvent({ withUserId: "u2" });

    await waitFor(() => expect(markMessagingConversationRead).toHaveBeenCalledTimes(2));
  });
});
