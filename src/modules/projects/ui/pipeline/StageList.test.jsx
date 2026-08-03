import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import StageList from "./StageList";

// Niente hex reali nelle fixture: terrebbero sporco il guard colori
// (lint:colors su src/modules). I valori non sono asseriti da nessun test.
const stages = [
  { id: "s1", name: "Bozza", sortOrder: 0, color: "colore-di-prova" },
  { id: "s2", name: "In corso", sortOrder: 1, isGated: true, gateChecklistTemplateId: "t1", autoCreateInstance: false },
  { id: "s3", name: "Chiuso", sortOrder: 2, isClosed: true },
];

const renderList = (overrides = {}) => {
  const props = {
    stages,
    defaultStageColor: "colore-default-finto",
    checklistTemplateNameById: new Map([["t1", "Onboarding"]]),
    checklistTemplates: [{ id: "t1", name: "Onboarding" }],
    canManageChecklistRules: false,
    stageRulesByStageId: {},
    reordering: false,
    onMoveStage: vi.fn(),
    onEditStage: vi.fn(),
    onDeleteStage: vi.fn(),
    onToggleRuleTemplate: vi.fn(),
    onToggleRuleGate: vi.fn(),
    onSaveRules: vi.fn(),
    ...overrides,
  };

  render(<StageList {...props} />);
  return props;
};

describe("StageList", () => {
  it("elenca gli stage coi loro contrassegni, col nome del template al posto dell'id", () => {
    renderList();
    expect(screen.getByText("Bozza")).toBeInTheDocument();
    expect(screen.getByText("Chiuso", { selector: ".badge" })).toBeInTheDocument();
    expect(screen.getByText("Gated")).toBeInTheDocument();
    expect(screen.getByText("Template: Onboarding")).toBeInTheDocument();
  });

  it("con un id di template sconosciuto ripiega sull'id, invece di mostrare il vuoto", () => {
    renderList({ checklistTemplateNameById: new Map() });
    expect(screen.getByText("Template: t1")).toBeInTheDocument();
  });

  it("il primo stage non puo' salire e l'ultimo non puo' scendere", () => {
    renderList();
    expect(screen.getByRole("button", { name: "Sposta su Bozza" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Sposta giu Bozza" })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: "Sposta su Chiuso" })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: "Sposta giu Chiuso" })).toBeDisabled();
  });

  it("mentre l'ordine si salva le frecce sono tutte spente", () => {
    renderList({ reordering: true });
    expect(screen.getByRole("button", { name: "Sposta giu Bozza" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Sposta su Chiuso" })).toBeDisabled();
  });

  it("le frecce mandano la posizione e la direzione", () => {
    const props = renderList();
    fireEvent.click(screen.getByRole("button", { name: "Sposta giu Bozza" }));
    expect(props.onMoveStage).toHaveBeenCalledWith(0, 1);
    fireEvent.click(screen.getByRole("button", { name: "Sposta su Chiuso" }));
    expect(props.onMoveStage).toHaveBeenCalledWith(2, -1);
  });

  it("Modifica manda la bozza completa, coi ripieghi su colore e auto-create", () => {
    const props = renderList();
    fireEvent.click(screen.getByRole("button", { name: "Modifica In corso" }));
    expect(props.onEditStage).toHaveBeenCalledWith({
      id: "s2",
      name: "In corso",
      isClosed: false,
      color: "colore-default-finto",
      isGated: true,
      gateChecklistTemplateId: "t1",
      autoCreateInstance: false,
    });
  });

  it("uno stage senza auto-create dichiarato parte con l'auto-create acceso", () => {
    const props = renderList();
    fireEvent.click(screen.getByRole("button", { name: "Modifica Bozza" }));
    expect(props.onEditStage.mock.calls[0][0].autoCreateInstance).toBe(true);
  });

  it("Elimina manda lo stage intero", () => {
    const props = renderList();
    fireEvent.click(screen.getByRole("button", { name: "Elimina Bozza" }));
    expect(props.onDeleteStage).toHaveBeenCalledWith(stages[0]);
  });

  it("uno stage senza regole caricate non va in errore: parte da una bozza vuota", () => {
    renderList({ canManageChecklistRules: true });
    expect(screen.getAllByLabelText("Onboarding")).toHaveLength(3);
    expect(screen.getAllByLabelText("Onboarding")[0]).not.toBeChecked();
  });
});
