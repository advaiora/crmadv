import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import CreateStageForm from "./CreateStageForm";

// Niente hex reali nelle fixture: terrebbero sporco il guard colori
// (lint:colors su src/modules). I valori non sono asseriti da nessun test.
const baseValues = {
  name: "",
  color: "colore-di-prova",
  isClosed: false,
  isGated: false,
  gateChecklistTemplateId: "",
  autoCreateInstance: true,
};

const templates = [
  { id: "t1", name: "Onboarding" },
  { id: "t2", name: "Chiusura" },
];

const renderForm = (overrides = {}) => {
  const props = {
    values: baseValues,
    onChange: vi.fn(),
    checklistTemplates: templates,
    onSubmit: vi.fn((event) => event.preventDefault()),
    onCancel: vi.fn(),
    saving: false,
    ...overrides,
  };

  const { rerender } = render(<CreateStageForm {...props} />);
  return {
    props,
    // Un solo modulo per volta in pagina: gli id dei campi sono fissi, due
    // copie insieme spezzerebbero il legame etichetta-campo.
    riprova: (next = {}) => rerender(<CreateStageForm {...props} {...next} />),
  };
};

describe("CreateStageForm", () => {
  it("ogni etichetta e' collegata al suo campo (smoke)", () => {
    renderForm();
    expect(screen.getByLabelText("Nome stage")).toBeInTheDocument();
    expect(screen.getByLabelText("Colore")).toBeInTheDocument();
    expect(screen.getByLabelText("Template Gate")).toBeInTheDocument();
    expect(screen.getByLabelText("Chiuso")).toBeInTheDocument();
    expect(screen.getByLabelText("Checklist gate")).toBeInTheDocument();
    expect(screen.getByLabelText("Auto-create instance")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Chiusura" })).toBeInTheDocument();
  });

  it("scrivere il nome manda la patch giusta", () => {
    const { props } = renderForm();
    fireEvent.change(screen.getByLabelText("Nome stage"), { target: { value: "Bozza" } });
    expect(props.onChange).toHaveBeenCalledWith({ name: "Bozza" });
  });

  it("accendere il gate manda solo isGated; spegnerlo azzera anche il template", () => {
    const { props, riprova } = renderForm();
    fireEvent.click(screen.getByLabelText("Checklist gate"));
    expect(props.onChange).toHaveBeenCalledWith({ isGated: true });

    riprova({ values: { ...baseValues, isGated: true, gateChecklistTemplateId: "t1" } });
    fireEvent.click(screen.getByLabelText("Checklist gate"));
    expect(props.onChange).toHaveBeenCalledWith({ isGated: false, gateChecklistTemplateId: "" });
  });

  it("col gate spento template e auto-create sono disabilitati; accendendolo si aprono", () => {
    const { riprova } = renderForm();
    expect(screen.getByLabelText("Template Gate")).toBeDisabled();
    expect(screen.getByLabelText("Auto-create instance")).toBeDisabled();

    riprova({ values: { ...baseValues, isGated: true } });
    expect(screen.getByLabelText("Template Gate")).not.toBeDisabled();
    expect(screen.getByLabelText("Auto-create instance")).not.toBeDisabled();
  });

  it("col gate acceso avvisa: che e' attivo, o che mancano i template", () => {
    const { riprova } = renderForm({ values: { ...baseValues, isGated: true } });
    expect(screen.getByText(/Gate attivo/)).toBeInTheDocument();

    riprova({ values: { ...baseValues, isGated: true }, checklistTemplates: [] });
    expect(screen.getByText(/crea prima almeno un template checklist attivo/)).toBeInTheDocument();
  });

  it("durante il salvataggio i campi sono spenti e il pulsante cambia testo", () => {
    renderForm({ saving: true });
    expect(screen.getByLabelText("Nome stage")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Creazione..." })).toBeDisabled();
  });

  it("Annulla chiama onCancel", () => {
    const { props } = renderForm();
    fireEvent.click(screen.getByRole("button", { name: "Annulla" }));
    expect(props.onCancel).toHaveBeenCalled();
  });
});
