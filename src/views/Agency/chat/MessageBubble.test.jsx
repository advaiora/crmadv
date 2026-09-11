import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import {
  deleteMessagingAttachment,
  downloadMessagingAttachment,
  uploadMessagingAttachment,
} from "../../../modules/messaging/api/messagingApi";
import MessageBubble from "./MessageBubble";

// CRMA-138 — il bottone "allega" e il tasto di rimozione sul chip sono una
// cortesia (il server rifiuta comunque un messaggio altrui): qui si controlla che
// compaiano SOLO sui propri messaggi e SOLO con il permesso, non che il server
// li faccia rispettare (quello e' gia' testato lato backend, CRMA-30).
vi.mock("../../../modules/messaging/api/messagingApi", () => ({
  uploadMessagingAttachment: vi.fn(),
  deleteMessagingAttachment: vi.fn(),
  downloadMessagingAttachment: vi.fn(),
}));

const allegato = (overrides = {}) => ({
  id: "a1",
  messageId: "m1",
  label: "preventivo.pdf",
  mimeType: "application/pdf",
  fileSize: 2048,
  createdAt: "2026-09-10T10:00:00.000Z",
  ...overrides,
});

const messaggio = (overrides = {}) => ({
  id: "m1",
  body: "Ecco il documento",
  isMine: true,
  createdAt: "2026-09-10T10:00:00.000Z",
  attachments: [],
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("MessageBubble — chi vede il bottone allega", () => {
  it("compare sul proprio messaggio con il permesso", () => {
    render(<MessageBubble message={messaggio()} canAttach onAttachmentsChanged={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Allega un file a questo messaggio" })).toBeInTheDocument();
  });

  it("non compare su un messaggio altrui, anche con il permesso", () => {
    render(<MessageBubble message={messaggio({ isMine: false })} canAttach onAttachmentsChanged={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Allega un file a questo messaggio" })).not.toBeInTheDocument();
  });

  it("non compare sul proprio messaggio senza il permesso", () => {
    render(<MessageBubble message={messaggio()} canAttach={false} onAttachmentsChanged={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Allega un file a questo messaggio" })).not.toBeInTheDocument();
  });
});

describe("MessageBubble — caricamento", () => {
  it("carica il file scelto e ricarica la conversazione", async () => {
    uploadMessagingAttachment.mockResolvedValue({ attachment: allegato() });
    const onAttachmentsChanged = vi.fn().mockResolvedValue();

    const { container } = render(
      <MessageBubble message={messaggio()} canAttach onAttachmentsChanged={onAttachmentsChanged} />,
    );

    const file = new File(["contenuto"], "preventivo.pdf", { type: "application/pdf" });
    const input = container.querySelector('input[type="file"]');
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => expect(uploadMessagingAttachment).toHaveBeenCalledWith("m1", file));
    await waitFor(() => expect(onAttachmentsChanged).toHaveBeenCalledTimes(1));
  });

  it("mostra il messaggio del server quando il caricamento fallisce", async () => {
    uploadMessagingAttachment.mockRejectedValue({
      message: "Un messaggio puo' avere al massimo 5 allegati.",
    });

    const { container } = render(
      <MessageBubble message={messaggio()} canAttach onAttachmentsChanged={vi.fn()} />,
    );

    const file = new File(["x"], "altro.pdf", { type: "application/pdf" });
    const input = container.querySelector('input[type="file"]');
    fireEvent.change(input, { target: { files: [file] } });

    await screen.findByText("Un messaggio puo' avere al massimo 5 allegati.");
  });
});

describe("MessageBubble — elenco allegati", () => {
  it("mostra nome e peso, e il tasto rimuovi solo se si puo' gestire l'allegato", () => {
    render(
      <MessageBubble
        message={messaggio({ attachments: [allegato()] })}
        canAttach
        onAttachmentsChanged={vi.fn()}
      />,
    );

    expect(screen.getByText("preventivo.pdf")).toBeInTheDocument();
    expect(screen.getByText("2 KB")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Togli allegato preventivo.pdf" })).toBeInTheDocument();
  });

  it("su un messaggio altrui si puo' scaricare ma non rimuovere", () => {
    render(
      <MessageBubble
        message={messaggio({ isMine: false, attachments: [allegato()] })}
        canAttach
        onAttachmentsChanged={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Scarica l'originale di preventivo.pdf" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Togli allegato preventivo.pdf" })).not.toBeInTheDocument();
  });

  it("scaricare chiama il client, rimuovere ricarica la conversazione", async () => {
    downloadMessagingAttachment.mockResolvedValue();
    deleteMessagingAttachment.mockResolvedValue({ id: "a1", messageId: "m1" });
    const onAttachmentsChanged = vi.fn().mockResolvedValue();

    render(
      <MessageBubble
        message={messaggio({ attachments: [allegato()] })}
        canAttach
        onAttachmentsChanged={onAttachmentsChanged}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Scarica l'originale di preventivo.pdf" }));
    await waitFor(() => expect(downloadMessagingAttachment).toHaveBeenCalledWith(allegato()));

    fireEvent.click(screen.getByRole("button", { name: "Togli allegato preventivo.pdf" }));
    await waitFor(() => expect(deleteMessagingAttachment).toHaveBeenCalledWith("a1"));
    await waitFor(() => expect(onAttachmentsChanged).toHaveBeenCalledTimes(1));
  });
});
