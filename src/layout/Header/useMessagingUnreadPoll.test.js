import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { toast } from "react-toastify";
import { listMessagingUsers } from "../../modules/messaging/api/messagingApi";
import { subscribeMessaging, subscribeStatus } from "../../realtime/realtimeClient";
import { useMessagingUnreadPoll } from "./useMessagingUnreadPoll";

vi.mock("../../modules/messaging/api/messagingApi", () => ({
  listMessagingUsers: vi.fn(),
  MESSAGING_CONTACTS_LIMIT: 100,
}));

vi.mock("react-toastify", () => ({
  toast: { info: vi.fn() },
}));

// Un solo iscritto per test basta qui (a differenza di MessagingPanel, questo
// hook e' l'unico che ascolta `subscribeMessaging` nel suo contesto).
let messagingHandler = null;
vi.mock("../../realtime/realtimeClient", () => ({
  subscribeStatus: vi.fn(),
  subscribeMessaging: vi.fn(),
}));

const contatto = (overrides = {}) => ({
  userId: "u2",
  name: "Rita Neri",
  email: "rita@example.com",
  unreadCount: 0,
  lastMessagePreview: "",
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ shouldAdvanceTime: true });
  messagingHandler = null;
  subscribeStatus.mockImplementation((handler) => {
    handler(false);
    return () => {};
  });
  subscribeMessaging.mockImplementation((handler) => {
    messagingHandler = handler;
    return () => {};
  });
  listMessagingUsers.mockResolvedValue({ items: [] });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useMessagingUnreadPoll — quando e' disabilitato", () => {
  it("non interroga il server se `enabled` e' false", async () => {
    renderHook(() => useMessagingUnreadPoll({ enabled: false, onMessagingPage: false }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    expect(listMessagingUsers).not.toHaveBeenCalled();
  });
});

describe("useMessagingUnreadPoll — conteggio e rallentamento", () => {
  it("somma i non letti di tutti i contatti al primo giro", async () => {
    listMessagingUsers.mockResolvedValue({
      items: [contatto({ unreadCount: 2 }), contatto({ userId: "u3", unreadCount: 3 })],
    });

    const { result } = renderHook(() => useMessagingUnreadPoll({ enabled: true, onMessagingPage: false }));

    await waitFor(() => expect(result.current.unreadCount).toBe(5));
  });

  it("a tempo reale scollegato continua a interrogare al ritmo rapido", async () => {
    renderHook(() => useMessagingUnreadPoll({ enabled: true, onMessagingPage: false }));

    await waitFor(() => expect(listMessagingUsers).toHaveBeenCalledTimes(1));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(6000);
    });

    // In 6 secondi al ritmo rapido (2s) dovrebbero essere partiti almeno altri due giri.
    expect(listMessagingUsers.mock.calls.length).toBeGreaterThanOrEqual(3);
  });

  it("quando il tempo reale e' connesso rallenta: nella stessa finestra non riparte", async () => {
    subscribeStatus.mockImplementation((handler) => {
      handler(true);
      return () => {};
    });

    renderHook(() => useMessagingUnreadPoll({ enabled: true, onMessagingPage: false }));

    await waitFor(() => expect(listMessagingUsers).toHaveBeenCalled());
    const chiamateAssestamento = listMessagingUsers.mock.calls.length;

    await act(async () => {
      await vi.advanceTimersByTimeAsync(6000);
    });

    // 6 secondi sono sotto il ritmo lento (15s): non devono essere partiti altri giri
    // oltre a quelli gia' contati all'assestamento iniziale, a differenza del test
    // gemello (tempo reale scollegato) dove nella stessa finestra ne partono almeno due.
    expect(listMessagingUsers.mock.calls.length).toBe(chiamateAssestamento);
  });

  it("un nuovo messaggio dal tempo reale interroga subito, senza aspettare il poller", async () => {
    renderHook(() => useMessagingUnreadPoll({ enabled: true, onMessagingPage: false }));

    await waitFor(() => expect(listMessagingUsers).toHaveBeenCalledTimes(1));

    await act(async () => {
      messagingHandler({ type: "message.new" });
      await Promise.resolve();
    });

    expect(listMessagingUsers).toHaveBeenCalledTimes(2);
  });

  it("se il tempo reale cade durante l'uso torna al ritmo rapido", async () => {
    let ultimoStatusHandler = null;
    subscribeStatus.mockImplementation((handler) => {
      ultimoStatusHandler = handler;
      handler(true);
      return () => {};
    });

    renderHook(() => useMessagingUnreadPoll({ enabled: true, onMessagingPage: false }));

    await waitFor(() => expect(listMessagingUsers).toHaveBeenCalled());
    const chiamateConnesso = listMessagingUsers.mock.calls.length;

    // Nessun altro giro nella finestra rapida, finche' resta connesso.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(listMessagingUsers.mock.calls.length).toBe(chiamateConnesso);

    // Il websocket cade: lo stesso avanzamento di 2 secondi, che prima non
    // bastava, ora deve far ripartire il poller al ritmo rapido.
    await act(async () => {
      ultimoStatusHandler(false);
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(listMessagingUsers.mock.calls.length).toBeGreaterThan(chiamateConnesso);
  });
});

describe("useMessagingUnreadPoll — notifiche e blocco permessi", () => {
  it("non avvisa al primo caricamento (nessun prima/dopo da confrontare)", async () => {
    listMessagingUsers.mockResolvedValue({ items: [contatto({ unreadCount: 1 })] });

    renderHook(() => useMessagingUnreadPoll({ enabled: true, onMessagingPage: false }));

    await waitFor(() => expect(listMessagingUsers).toHaveBeenCalledTimes(1));
    expect(toast.info).not.toHaveBeenCalled();
  });

  it("avvisa quando i non letti crescono rispetto al giro precedente", async () => {
    listMessagingUsers
      .mockResolvedValueOnce({ items: [contatto({ unreadCount: 1 })] })
      .mockResolvedValue({ items: [contatto({ unreadCount: 2 })] });

    renderHook(() => useMessagingUnreadPoll({ enabled: true, onMessagingPage: false }));

    await waitFor(() => expect(listMessagingUsers).toHaveBeenCalledTimes(1));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    expect(toast.info).toHaveBeenCalledTimes(1);
  });

  it("NON avvisa se si e' gia' sulla pagina Messaggi", async () => {
    listMessagingUsers
      .mockResolvedValueOnce({ items: [contatto({ unreadCount: 1 })] })
      .mockResolvedValue({ items: [contatto({ unreadCount: 2 })] });

    renderHook(() => useMessagingUnreadPoll({ enabled: true, onMessagingPage: true }));

    await waitFor(() => expect(listMessagingUsers).toHaveBeenCalledTimes(1));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    await waitFor(() => expect(listMessagingUsers).toHaveBeenCalledTimes(2));
    expect(toast.info).not.toHaveBeenCalled();
  });

  it("un 403 blocca il poller e azzera il conteggio, senza piu' richieste", async () => {
    listMessagingUsers
      .mockResolvedValueOnce({ items: [contatto({ unreadCount: 4 })] })
      .mockRejectedValue({ status: 403 });

    const { result } = renderHook(() => useMessagingUnreadPoll({ enabled: true, onMessagingPage: false }));

    await waitFor(() => expect(result.current.unreadCount).toBe(4));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    await waitFor(() => expect(result.current.unreadCount).toBe(0));
    const chiamateDopoBlocco = listMessagingUsers.mock.calls.length;

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000);
    });
    expect(listMessagingUsers).toHaveBeenCalledTimes(chiamateDopoBlocco);
  });

  it("resetAll toglie il blocco: il poller puo' ripartire", async () => {
    listMessagingUsers.mockRejectedValueOnce({ status: 403 });

    const { result, rerender } = renderHook(
      ({ enabled }) => useMessagingUnreadPoll({ enabled, onMessagingPage: false }),
      { initialProps: { enabled: true } },
    );

    await waitFor(() => expect(listMessagingUsers).toHaveBeenCalledTimes(1));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    const chiamateBloccato = listMessagingUsers.mock.calls.length;

    listMessagingUsers.mockResolvedValue({ items: [contatto({ unreadCount: 1 })] });
    act(() => {
      result.current.resetAll();
    });
    rerender({ enabled: true });

    await waitFor(() => expect(listMessagingUsers.mock.calls.length).toBeGreaterThan(chiamateBloccato));
    await waitFor(() => expect(result.current.unreadCount).toBe(1));
  });

  it("una risposta in ritardo non sovrascrive quella piu' recente (niente avviso doppio)", async () => {
    listMessagingUsers.mockResolvedValueOnce({ items: [contatto({ unreadCount: 1 })] });

    const { result } = renderHook(() => useMessagingUnreadPoll({ enabled: true, onMessagingPage: false }));
    await waitFor(() => expect(result.current.unreadCount).toBe(1));

    // Prima richiesta (la "vecchia"): resta in sospeso, la si risolve dopo.
    let risolviVecchia;
    listMessagingUsers.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          risolviVecchia = resolve;
        }),
    );
    await act(async () => {
      messagingHandler({ type: "message.new" });
      await Promise.resolve();
    });

    // Seconda richiesta (la "nuova"): parte mentre la prima e' ancora in volo,
    // e torna subito con un valore piu' alto.
    listMessagingUsers.mockResolvedValueOnce({ items: [contatto({ unreadCount: 3 })] });
    await act(async () => {
      messagingHandler({ type: "message.new" });
    });
    await waitFor(() => expect(result.current.unreadCount).toBe(3));

    // Ora arriva, in ritardo, la risposta della richiesta vecchia: non deve
    // riportare indietro il conteggio ne' generare un secondo avviso.
    await act(async () => {
      risolviVecchia({ items: [contatto({ unreadCount: 1 })] });
      await Promise.resolve();
    });

    expect(result.current.unreadCount).toBe(3);
    expect(toast.info).toHaveBeenCalledTimes(1);
  });
});
