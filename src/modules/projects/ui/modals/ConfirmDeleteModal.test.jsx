import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import ConfirmDeleteModal from "./ConfirmDeleteModal";

const renderModal = (overrides = {}) =>
  render(
    <ConfirmDeleteModal
      show
      title="Eliminare categoria?"
      message="Questa azione puo fallire se la categoria e in uso."
      onCancel={vi.fn()}
      onConfirm={vi.fn()}
      confirming={false}
      {...overrides}
    />,
  );

describe("ConfirmDeleteModal", () => {
  it("nascosto con show=false; mostra titolo e messaggio parametrici (smoke)", () => {
    const { rerender } = renderModal({ show: false });
    expect(screen.queryByText("Eliminare categoria?")).not.toBeInTheDocument();
    rerender(
      <ConfirmDeleteModal show title="Eliminare stage?" message="Vuoi eliminare questo stage?" onCancel={vi.fn()} onConfirm={vi.fn()} confirming={false} />,
    );
    expect(screen.getByText("Eliminare stage?")).toBeInTheDocument();
    expect(screen.getByText("Vuoi eliminare questo stage?")).toBeInTheDocument();
  });

  it("Elimina chiama onConfirm, Annulla chiama onCancel", () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    renderModal({ onConfirm, onCancel });
    screen.getByRole("button", { name: "Elimina" }).click();
    expect(onConfirm).toHaveBeenCalled();
    screen.getByRole("button", { name: "Annulla" }).click();
    expect(onCancel).toHaveBeenCalled();
  });

  it("durante l'eliminazione il bottone e' disabilitato con etichetta dedicata", () => {
    renderModal({ confirming: true });
    expect(screen.getByRole("button", { name: "Eliminazione..." })).toBeDisabled();
  });
});
