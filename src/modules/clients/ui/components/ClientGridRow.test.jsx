import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import ClientGridRow from "./ClientGridRow";

const client = {
  id: "c1",
  name: "Mario Rossi",
  type: "person",
  email: "mario@example.com",
  phone: "3331234567",
  tags: ["Web"],
};

const renderRow = (overrides = {}) =>
  render(
    <ClientGridRow
      client={client}
      isExpanded={false}
      canEdit={false}
      canDelete={false}
      onToggle={vi.fn()}
      onOpen={vi.fn()}
      onEdit={vi.fn()}
      onDelete={vi.fn()}
      onEditTags={vi.fn()}
      {...overrides}
    />,
  );

describe("ClientGridRow", () => {
  it("mostra i dati principali del cliente (smoke)", () => {
    renderRow();
    expect(screen.getByText("Mario Rossi")).toBeInTheDocument();
    expect(screen.getByText("mario@example.com")).toBeInTheDocument();
    expect(screen.getByText("3331234567")).toBeInTheDocument();
  });

  it("espone gli attributi 'Chiedi all'AI' sulla riga", () => {
    renderRow();
    const row = screen.getByRole("row", { name: "Apri scheda di Mario Rossi" });
    expect(row).toHaveAttribute("data-ask-ai-type", "client");
    expect(row).toHaveAttribute("data-ask-ai-id", "c1");
  });

  it("la linguetta riflette isExpanded e il click chiama onToggle con l'id", () => {
    const onToggle = vi.fn();
    renderRow({ onToggle });
    const disclosure = screen.getByRole("button", { name: "Mostra dettagli di Mario Rossi" });
    expect(disclosure).toHaveAttribute("aria-expanded", "false");
    disclosure.click();
    expect(onToggle).toHaveBeenCalledWith("c1");
  });
});
