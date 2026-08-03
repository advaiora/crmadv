import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import CategoriesPanel, { CategoryNameForm } from "./CategoriesPanel";

const categories = [
  { id: "c1", name: "Consulenza" },
  { id: "c2", name: "Sviluppo" },
];

const renderPanel = (overrides = {}) => {
  const props = {
    categories,
    selectedCategoryId: "c1",
    onSelectCategory: vi.fn(),
    newCategoryName: "",
    onNewCategoryNameChange: vi.fn(),
    onCreateCategory: vi.fn((event) => event.preventDefault()),
    onEditCategory: vi.fn(),
    onDeleteCategory: vi.fn(),
    creating: false,
    ...overrides,
  };

  render(<CategoriesPanel {...props} />);
  return props;
};

describe("CategoriesPanel", () => {
  it("elenca le categorie e il modulo di creazione (smoke)", () => {
    renderPanel();
    expect(screen.getByText("Consulenza")).toBeInTheDocument();
    expect(screen.getByText("Sviluppo")).toBeInTheDocument();
    expect(screen.getByLabelText("Nuova categoria")).toBeInTheDocument();
  });

  it("cliccare la riga seleziona la categoria", () => {
    const props = renderPanel();
    fireEvent.click(screen.getByText("Sviluppo"));
    expect(props.onSelectCategory).toHaveBeenCalledWith("c2");
  });

  it("la riga si apre anche da tastiera, con Invio e con la barra spaziatrice", () => {
    const props = renderPanel();
    const riga = screen.getByText("Sviluppo").closest(".list-group-item");
    fireEvent.keyDown(riga, { key: "Enter" });
    fireEvent.keyDown(riga, { key: " " });
    expect(props.onSelectCategory).toHaveBeenCalledTimes(2);
    fireEvent.keyDown(riga, { key: "a" });
    expect(props.onSelectCategory).toHaveBeenCalledTimes(2);
  });

  it("i pulsanti riga non fanno anche selezionare la categoria", () => {
    const props = renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Rinomina Sviluppo" }));
    expect(props.onEditCategory).toHaveBeenCalledWith({ id: "c2", name: "Sviluppo" });
    fireEvent.click(screen.getByRole("button", { name: "Elimina Sviluppo" }));
    expect(props.onDeleteCategory).toHaveBeenCalledWith(categories[1]);
    expect(props.onSelectCategory).not.toHaveBeenCalled();
  });

  it("durante la creazione campo e pulsante sono spenti", () => {
    renderPanel({ creating: true });
    expect(screen.getByLabelText("Nuova categoria")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Categoria" })).toBeDisabled();
  });
});

describe("CategoryNameForm", () => {
  it("senza etichetta visibile il campo resta raggiungibile col suo nome", () => {
    render(<CategoryNameForm wide value="" onChange={vi.fn()} onSubmit={vi.fn()} creating={false} />);
    expect(screen.getByLabelText("Nome categoria")).toBeInTheDocument();
  });

  it("scrivere manda solo il testo, non l'evento", () => {
    const onChange = vi.fn();
    render(<CategoryNameForm wide value="" onChange={onChange} onSubmit={vi.fn()} creating={false} />);
    fireEvent.change(screen.getByLabelText("Nome categoria"), { target: { value: "Nuova" } });
    expect(onChange).toHaveBeenCalledWith("Nuova");
  });
});
