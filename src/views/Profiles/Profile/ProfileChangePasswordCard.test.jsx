import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ApiRequestError, apiPost } from "../../../utils/apiClient";
import ProfileChangePasswordCard from "./ProfileChangePasswordCard";

vi.mock("../../../utils/apiClient", async () => {
  const actual = await vi.importActual("../../../utils/apiClient");
  return {
    ...actual,
    apiPost: vi.fn(),
  };
});

const compila = (currentPassword, newPassword, confirmPassword) => {
  fireEvent.change(screen.getByLabelText("Password attuale"), { target: { value: currentPassword } });
  fireEvent.change(screen.getByLabelText("Nuova password"), { target: { value: newPassword } });
  fireEvent.change(screen.getByLabelText("Conferma nuova password"), { target: { value: confirmPassword } });
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ProfileChangePasswordCard — validazione lato client", () => {
  it("rifiuta una nuova password sotto gli 8 caratteri, senza chiamare il server", async () => {
    render(<ProfileChangePasswordCard />);
    compila("vecchia123", "corta", "corta");

    fireEvent.click(screen.getByRole("button", { name: "Cambia password" }));

    expect(await screen.findByText("La nuova password deve avere almeno 8 caratteri.")).toBeInTheDocument();
    expect(apiPost).not.toHaveBeenCalled();
  });

  it("rifiuta se la conferma non coincide, senza chiamare il server", async () => {
    render(<ProfileChangePasswordCard />);
    compila("vecchia123", "nuovaPassword1", "nuovaPassword2");

    fireEvent.click(screen.getByRole("button", { name: "Cambia password" }));

    expect(await screen.findByText("La conferma non coincide con la nuova password.")).toBeInTheDocument();
    expect(apiPost).not.toHaveBeenCalled();
  });
});

describe("ProfileChangePasswordCard — chiamata al server", () => {
  it("invia solo currentPassword e newPassword (mai la conferma)", async () => {
    apiPost.mockResolvedValue({ changed: true, otherSessionsRevoked: false });
    render(<ProfileChangePasswordCard />);
    compila("vecchia123", "nuovaPassword1", "nuovaPassword1");

    fireEvent.click(screen.getByRole("button", { name: "Cambia password" }));

    await waitFor(() =>
      expect(apiPost).toHaveBeenCalledWith("/auth/password/change", {
        currentPassword: "vecchia123",
        newPassword: "nuovaPassword1",
      }),
    );
  });

  it("dopo il successo mostra l'avviso sulle altre sessioni e svuota il form", async () => {
    apiPost.mockResolvedValue({ changed: true, otherSessionsRevoked: false });
    render(<ProfileChangePasswordCard />);
    compila("vecchia123", "nuovaPassword1", "nuovaPassword1");

    fireEvent.click(screen.getByRole("button", { name: "Cambia password" }));

    expect(await screen.findByText("Password aggiornata. Le sessioni già aperte restano attive.")).toBeInTheDocument();
    expect(screen.getByLabelText("Password attuale")).toHaveValue("");
    expect(screen.getByLabelText("Nuova password")).toHaveValue("");
  });

  it("mostra il messaggio del server quando la password attuale è sbagliata", async () => {
    apiPost.mockRejectedValue(new ApiRequestError("La password attuale non è corretta.", {
      status: 400,
      code: "INVALID_CURRENT_PASSWORD",
    }));
    render(<ProfileChangePasswordCard />);
    compila("sbagliata", "nuovaPassword1", "nuovaPassword1");

    fireEvent.click(screen.getByRole("button", { name: "Cambia password" }));

    expect(await screen.findByText("La password attuale non è corretta.")).toBeInTheDocument();
  });

  it("mostra il messaggio del server per un account Google senza password locale", async () => {
    apiPost.mockRejectedValue(new ApiRequestError(
      "Questo account accede con Google e non ha una password del CRM: non c'è niente da cambiare.",
      { status: 409, code: "PASSWORD_NOT_SET" },
    ));
    render(<ProfileChangePasswordCard />);
    compila("qualsiasi", "nuovaPassword1", "nuovaPassword1");

    fireEvent.click(screen.getByRole("button", { name: "Cambia password" }));

    expect(
      await screen.findByText("Questo account accede con Google e non ha una password del CRM: non c'è niente da cambiare."),
    ).toBeInTheDocument();
  });
});
