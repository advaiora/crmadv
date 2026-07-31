import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import ClientTags from "./ClientTags";

const clientWithTags = { id: "c1", tags: ["Web", "Marketing", "Social", "Extra"] };

describe("ClientTags", () => {
  it("mostra 'Nessun tag' quando il cliente non ha tag", () => {
    render(<ClientTags client={{ id: "c1", tags: [] }} />);
    expect(screen.getByText("Nessun tag")).toBeInTheDocument();
  });

  it("mostra al massimo maxVisible tag e il contatore dei rimanenti", () => {
    render(<ClientTags client={clientWithTags} maxVisible={3} />);
    expect(screen.getByText("Web")).toBeInTheDocument();
    expect(screen.getByText("Marketing")).toBeInTheDocument();
    expect(screen.getByText("Social")).toBeInTheDocument();
    expect(screen.queryByText("Extra")).not.toBeInTheDocument();
    expect(screen.getByText("+1")).toBeInTheDocument();
  });

  it("mostra 'Modifica tag' solo con canEdit e chiama onEditTags col cliente", () => {
    const onEditTags = vi.fn();
    const { rerender } = render(<ClientTags client={clientWithTags} onEditTags={onEditTags} />);
    expect(screen.queryByRole("button", { name: "Modifica tag" })).not.toBeInTheDocument();

    rerender(<ClientTags client={clientWithTags} canEdit onEditTags={onEditTags} />);
    screen.getByRole("button", { name: "Modifica tag" }).click();
    expect(onEditTags).toHaveBeenCalledWith(clientWithTags);
  });
});
