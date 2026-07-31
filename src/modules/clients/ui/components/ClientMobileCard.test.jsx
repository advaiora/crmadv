import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import ClientMobileCard from "./ClientMobileCard";

const client = {
  id: "c2",
  name: "ACME Srl",
  type: "company",
  email: "",
  phone: "",
  tags: [],
};

const renderCard = (overrides = {}) =>
  render(
    <ClientMobileCard
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

describe("ClientMobileCard", () => {
  it("mostra il nome e i testi di ripiego per email e telefono mancanti (smoke)", () => {
    renderCard();
    expect(screen.getByText("ACME Srl")).toBeInTheDocument();
    expect(screen.getByText("Email non impostata")).toBeInTheDocument();
    expect(screen.getByText("Telefono non impostato")).toBeInTheDocument();
  });

  it("il click sulla linguetta chiama onToggle con l'id del cliente", () => {
    const onToggle = vi.fn();
    renderCard({ onToggle });
    screen.getByRole("button", { name: "Mostra dettagli di ACME Srl" }).click();
    expect(onToggle).toHaveBeenCalledWith("c2");
  });
});
