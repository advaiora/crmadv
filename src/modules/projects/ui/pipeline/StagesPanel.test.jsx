import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import StagesPanel from "./StagesPanel";

// Niente hex reali nelle fixture colore (guard lint:colors su src/modules).
const baseProps = () => ({
  selectedCategoryName: "Consulenza",
  canCreateStage: true,
  showCreateForm: false,
  onToggleCreateForm: vi.fn(),
  onOpenCreateForm: vi.fn(),
  newStage: {
    name: "",
    color: "colore-di-prova",
    isClosed: false,
    isGated: false,
    gateChecklistTemplateId: "",
    autoCreateInstance: true,
  },
  onNewStageChange: vi.fn(),
  onSubmitCreateStage: vi.fn((event) => event.preventDefault()),
  onCancelCreateStage: vi.fn(),
  creatingStage: false,
  loading: false,
  errorMessage: "",
  onRetry: vi.fn(),
  stages: [{ id: "s1", name: "Kickoff" }],
  defaultStageColor: "colore-di-prova",
  checklistTemplates: [],
  checklistTemplateNameById: new Map(),
  canManageChecklistRules: false,
  stageRulesByStageId: {},
  reordering: false,
  onMoveStage: vi.fn(),
  onEditStage: vi.fn(),
  onDeleteStage: vi.fn(),
  onToggleRuleTemplate: vi.fn(),
  onToggleRuleGate: vi.fn(),
  onSaveRules: vi.fn(),
});

const renderPanel = (overrides = {}) => {
  const props = { ...baseProps(), ...overrides };
  render(<StagesPanel {...props} />);
  return props;
};

describe("StagesPanel", () => {
  it("mostra intestazione con la categoria e l'elenco stage (smoke)", () => {
    renderPanel();
    expect(screen.getByRole("heading", { name: "Stage - Consulenza" })).toBeInTheDocument();
    expect(screen.getByText("Kickoff")).toBeInTheDocument();
  });

  it("senza categoria selezionata il pulsante Stage e' spento e il titolo resta nudo", () => {
    renderPanel({ selectedCategoryName: "", canCreateStage: false });
    expect(screen.getByRole("button", { name: "Stage" })).toBeDisabled();
    expect(screen.getByRole("heading", { name: "Stage" })).toBeInTheDocument();
  });

  it("il pulsante in intestazione commuta il modulo di creazione", () => {
    const props = renderPanel();
    expect(screen.queryByLabelText("Nome stage")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Stage" }));
    expect(props.onToggleCreateForm).toHaveBeenCalled();
  });

  it("con il modulo aperto compare il form di creazione", () => {
    renderPanel({ showCreateForm: true });
    expect(screen.getByLabelText("Nome stage")).toBeInTheDocument();
  });

  it("durante il caricamento mostra l'attesa e non l'elenco", () => {
    renderPanel({ loading: true });
    expect(screen.getByText("Caricamento stage...")).toBeInTheDocument();
    expect(screen.queryByText("Kickoff")).not.toBeInTheDocument();
  });

  it("con un errore mostra lo stato d'errore col messaggio", () => {
    renderPanel({ errorMessage: "stage rotti" });
    expect(screen.getByText("Errore stage")).toBeInTheDocument();
    expect(screen.getByText("stage rotti")).toBeInTheDocument();
    expect(screen.queryByText("Kickoff")).not.toBeInTheDocument();
  });

  it("categoria senza stage: avviso, e il pulsante Aggiungi stage APRE il modulo (non commuta)", () => {
    const props = renderPanel({ stages: [] });
    expect(screen.getByText("Questa categoria non ha stage, aggiungine uno.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Aggiungi stage" }));
    expect(props.onOpenCreateForm).toHaveBeenCalled();
    expect(props.onToggleCreateForm).not.toHaveBeenCalled();
  });
});
