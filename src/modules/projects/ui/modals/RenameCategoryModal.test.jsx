import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import RenameCategoryModal from "./RenameCategoryModal";

const renderModal = (overrides = {}) =>
  render(
    <RenameCategoryModal
      category={{ id: "cat1", name: "Web" }}
      onChange={vi.fn()}
      onCancel={vi.fn()}
      onSave={vi.fn()}
      saving={false}
      {...overrides}
    />,
  );

describe("RenameCategoryModal", () => {
  it("chiuso senza categoria, aperto col nome nel campo (smoke)", () => {
    const { rerender } = renderModal({ category: null });
    expect(screen.queryByText("Rinomina categoria")).not.toBeInTheDocument();
    rerender(<RenameCategoryModal category={{ id: "cat1", name: "Web" }} onChange={vi.fn()} onCancel={vi.fn()} onSave={vi.fn()} saving={false} />);
    expect(screen.getByText("Rinomina categoria")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Nome categoria")).toHaveValue("Web");
  });

  it("digitare chiama onChange col nuovo nome; Salva chiama onSave", () => {
    const onChange = vi.fn();
    const onSave = vi.fn();
    renderModal({ onChange, onSave });
    fireEvent.change(screen.getByPlaceholderText("Nome categoria"), { target: { value: "Web nuovo" } });
    expect(onChange).toHaveBeenCalledWith("Web nuovo");
    screen.getByRole("button", { name: "Salva" }).click();
    expect(onSave).toHaveBeenCalled();
  });

  it("durante il salvataggio il bottone cambia etichetta ed e' disabilitato", () => {
    renderModal({ saving: true });
    expect(screen.getByRole("button", { name: "Salvataggio..." })).toBeDisabled();
  });
});
