import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import ClientTagsEditorModal from "./ClientTagsEditorModal";

const editorBase = {
  client: { id: "c1", name: "Trattoria Da Beppe" },
  tags: ["Web"],
  draft: "",
  saving: false,
  error: "",
  open: vi.fn(),
  close: vi.fn(),
  togglePreset: vi.fn(),
  removeTag: vi.fn(),
  addCustomTag: vi.fn(),
  setDraft: vi.fn(),
  save: vi.fn(),
};

describe("ClientTagsEditorModal", () => {
  it("non renderizza nulla senza cliente aperto", () => {
    render(<ClientTagsEditorModal editor={{ ...editorBase, client: null }} />);
    expect(screen.queryByText("Modifica tag cliente")).not.toBeInTheDocument();
  });

  it("mostra titolo, cliente e tag correnti (smoke)", () => {
    render(<ClientTagsEditorModal editor={editorBase} />);
    expect(screen.getByText("Modifica tag cliente")).toBeInTheDocument();
    expect(screen.getByText("Cliente: Trattoria Da Beppe")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Rimuovi tag Web" })).toBeInTheDocument();
  });

  it("il preset gia' presente e' evidenziato e il click chiama togglePreset", () => {
    const togglePreset = vi.fn();
    render(<ClientTagsEditorModal editor={{ ...editorBase, togglePreset }} />);
    const presetAttivo = screen.getByRole("button", { name: "Web" });
    expect(presetAttivo.className).toContain("btn-primary");
    const presetSpento = screen.getByRole("button", { name: "Social" });
    expect(presetSpento.className).toContain("btn-outline-secondary");
    presetSpento.click();
    expect(togglePreset).toHaveBeenCalledWith("Social");
  });

  it("durante il salvataggio i controlli sono disabilitati e il bottone cambia etichetta", () => {
    render(<ClientTagsEditorModal editor={{ ...editorBase, saving: true }} />);
    expect(screen.getByRole("button", { name: "Salvataggio..." })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Annulla" })).toBeDisabled();
  });
});
