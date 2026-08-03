import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import StageChecklistRules from "./StageChecklistRules";

const templates = [
  { id: "t1", name: "Onboarding" },
  { id: "t2", name: "Chiusura" },
];

const emptyState = { loading: false, saving: false, error: "", rules: [] };

const renderRules = (overrides = {}) => {
  const props = {
    stageId: "s1",
    templates,
    state: emptyState,
    canManage: true,
    onToggleTemplate: vi.fn(),
    onToggleGate: vi.fn(),
    onSave: vi.fn(),
    ...overrides,
  };

  render(<StageChecklistRules {...props} />);
  return props;
};

describe("StageChecklistRules", () => {
  it("senza permesso mostra solo l'avviso, non l'elenco", () => {
    renderRules({ canManage: false });
    expect(screen.getByText(/Servono permessi/)).toBeInTheDocument();
    expect(screen.queryByLabelText("Onboarding")).not.toBeInTheDocument();
  });

  it("in caricamento non mostra ancora l'elenco", () => {
    renderRules({ state: { ...emptyState, loading: true } });
    expect(screen.getByText("Caricamento regole...")).toBeInTheDocument();
    expect(screen.queryByLabelText("Onboarding")).not.toBeInTheDocument();
  });

  it("senza template attivi lo dice invece di mostrare un elenco vuoto", () => {
    renderRules({ templates: [] });
    expect(screen.getByText("Nessun template checklist attivo disponibile.")).toBeInTheDocument();
  });

  it("il gate segue la regola: acceso se manca il campo, spento se e' false", () => {
    renderRules({
      state: {
        ...emptyState,
        rules: [
          { checklistTemplateId: "t1", gateEnabled: false },
          { checklistTemplateId: "t2" },
        ],
      },
    });
    expect(screen.getByLabelText("Onboarding")).toBeChecked();
    const [gateT1, gateT2] = screen.getAllByLabelText("Gate");
    expect(gateT1).not.toBeChecked();
    expect(gateT2).toBeChecked();
  });

  it("il gate di un template non spuntato e' spento e non toccabile", () => {
    renderRules();
    expect(screen.getByLabelText("Onboarding")).not.toBeChecked();
    expect(screen.getAllByLabelText("Gate")[0]).toBeDisabled();
  });

  it("spuntare un template e cambiare il suo gate avvisano il genitore con lo stage giusto", () => {
    const props = renderRules({ state: { ...emptyState, rules: [{ checklistTemplateId: "t1", gateEnabled: true }] } });
    fireEvent.click(screen.getByLabelText("Chiusura"));
    expect(props.onToggleTemplate).toHaveBeenCalledWith("s1", "t2", true);

    fireEvent.click(screen.getAllByLabelText("Gate")[0]);
    expect(props.onToggleGate).toHaveBeenCalledWith("s1", "t1", false);
  });

  it("durante il salvataggio spegne i comandi e lo dichiara", () => {
    renderRules({ state: { ...emptyState, saving: true } });
    expect(screen.getByText("Salvataggio...")).toBeInTheDocument();
    expect(screen.getByLabelText("Onboarding")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Salva regole" })).toBeDisabled();
  });

  it("l'errore compare in pagina e Salva chiama onSave con lo stage", () => {
    const props = renderRules({ state: { ...emptyState, error: "Errore salvataggio regole checklist" } });
    expect(screen.getByText("Errore salvataggio regole checklist")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Salva regole" }));
    expect(props.onSave).toHaveBeenCalledWith("s1");
  });
});
