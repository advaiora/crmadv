import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import EditStageModal from "./EditStageModal";

// Niente hex reali nelle fixture: terrebbero sporco il guard colori
// (lint:colors su src/modules). I valori non sono asseriti da nessun test.
const stageBase = {
  id: "s1",
  name: "In lavorazione",
  color: "colore-di-prova",
  isClosed: false,
  isGated: true,
  gateChecklistTemplateId: "t1",
  autoCreateInstance: false,
};

const templates = [
  { id: "t1", name: "Onboarding" },
  { id: "t2", name: "Chiusura" },
];

const renderModal = (overrides = {}) =>
  render(
    <EditStageModal
      stage={stageBase}
      checklistTemplates={templates}
      defaultColor="colore-default-finto"
      onChange={vi.fn()}
      onCancel={vi.fn()}
      onSave={vi.fn()}
      saving={false}
      {...overrides}
    />,
  );

describe("EditStageModal", () => {
  it("chiuso senza stage; aperto mostra campi e template (smoke)", () => {
    const { rerender } = renderModal({ stage: null });
    expect(screen.queryByText("Modifica stage")).not.toBeInTheDocument();
    rerender(
      <EditStageModal stage={stageBase} checklistTemplates={templates} defaultColor="colore-default-finto" onChange={vi.fn()} onCancel={vi.fn()} onSave={vi.fn()} saving={false} />,
    );
    expect(screen.getByText("Modifica stage")).toBeInTheDocument();
    expect(screen.getByLabelText("Nome stage")).toHaveValue("In lavorazione");
    expect(screen.getByLabelText("Template gate")).toHaveValue("t1");
    expect(screen.getByRole("option", { name: "Chiusura" })).toBeInTheDocument();
  });

  it("spegnere il gate manda la patch che azzera anche il template", () => {
    const onChange = vi.fn();
    renderModal({ onChange });
    fireEvent.click(screen.getByLabelText("Checklist gate"));
    expect(onChange).toHaveBeenCalledWith({ isGated: false, gateChecklistTemplateId: "" });
  });

  it("con gate spento select e auto-create sono disabilitati", () => {
    renderModal({ stage: { ...stageBase, isGated: false } });
    expect(screen.getByLabelText("Template gate")).toBeDisabled();
    expect(screen.getByLabelText("Auto-create checklist instance")).toBeDisabled();
  });

  it("il cambio nome manda la patch giusta e Salva chiama onSave", () => {
    const onChange = vi.fn();
    const onSave = vi.fn();
    renderModal({ onChange, onSave });
    fireEvent.change(screen.getByLabelText("Nome stage"), { target: { value: "Consegna" } });
    expect(onChange).toHaveBeenCalledWith({ name: "Consegna" });
    screen.getByRole("button", { name: "Salva" }).click();
    expect(onSave).toHaveBeenCalled();
  });
});
