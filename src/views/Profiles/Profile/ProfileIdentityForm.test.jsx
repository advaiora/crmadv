import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ApiRequestError, apiPatch } from "../../../utils/apiClient";
import ProfileIdentityForm from "./ProfileIdentityForm";

vi.mock("../../../utils/apiClient", async () => {
  const actual = await vi.importActual("../../../utils/apiClient");
  return {
    ...actual,
    apiPatch: vi.fn(),
  };
});

vi.mock("../../../lib/session", () => ({
  readSession: vi.fn(() => null),
  writeSession: vi.fn(),
}));

const utente = { id: "u1", name: "Rita Neri", email: "rita@example.com" };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ProfileIdentityForm — salvataggio", () => {
  it("mostra la conferma dopo un salvataggio riuscito", async () => {
    apiPatch.mockResolvedValue({ user: { name: "Rita Bianchi", email: "rita@example.com" } });
    const reload = vi.fn().mockResolvedValue(undefined);

    render(<ProfileIdentityForm user={utente} reload={reload} />);
    fireEvent.change(screen.getByLabelText("Nome completo"), { target: { value: "Rita Bianchi" } });
    fireEvent.click(screen.getByRole("button", { name: "Salva modifiche" }));

    expect(await screen.findByText("Profilo aggiornato con successo.")).toBeInTheDocument();
    // La conferma non e' un lampeggio: resta anche dopo che reload() e' tornato,
    // il regresso che questo test copre (CRMA-31, spezzatura di Profile/index.jsx).
    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
    expect(screen.getByText("Profilo aggiornato con successo.")).toBeInTheDocument();
  });

  it("mostra il messaggio del server quando il salvataggio fallisce", async () => {
    apiPatch.mockRejectedValue(new ApiRequestError("Email già in uso.", { status: 409 }));
    const reload = vi.fn().mockResolvedValue(undefined);

    render(<ProfileIdentityForm user={utente} reload={reload} />);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "altra@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Salva modifiche" }));

    expect(await screen.findByText("Email già in uso.")).toBeInTheDocument();
    expect(reload).not.toHaveBeenCalled();
  });

  it("senza modifiche non chiama il server", async () => {
    const reload = vi.fn();
    render(<ProfileIdentityForm user={utente} reload={reload} />);

    fireEvent.click(screen.getByRole("button", { name: "Salva modifiche" }));

    expect(await screen.findByText("Nessuna modifica da salvare.")).toBeInTheDocument();
    expect(apiPatch).not.toHaveBeenCalled();
  });
});
