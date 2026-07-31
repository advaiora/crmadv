import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import ClientsListPagination from "./ClientsListPagination";

const pageInfo = { totalItems: 42, page: 2, hasNextPage: true, hasPrevPage: true };

const renderPagination = (overrides = {}) =>
  render(
    <ClientsListPagination
      pageInfo={pageInfo}
      totalPages={3}
      activePage={2}
      visibleCount={null}
      loading={false}
      onGoToPage={vi.fn()}
      {...overrides}
    />,
  );

describe("ClientsListPagination", () => {
  it("mostra totale e stato pagina; il conteggio visibili solo quando fornito (smoke)", () => {
    const { rerender } = renderPagination();
    expect(screen.getByText(/Totale clienti: 42/)).toBeInTheDocument();
    expect(screen.getByText("Pagina 2 di 3")).toBeInTheDocument();
    expect(screen.queryByText(/visibili in pagina/)).not.toBeInTheDocument();

    rerender(
      <ClientsListPagination pageInfo={pageInfo} totalPages={3} activePage={2} visibleCount={7} loading={false} onGoToPage={vi.fn()} />,
    );
    expect(screen.getByText(/visibili in pagina: 7/)).toBeInTheDocument();
  });

  it("le frecce chiamano onGoToPage con la pagina giusta", () => {
    const onGoToPage = vi.fn();
    renderPagination({ onGoToPage });
    screen.getByRole("button", { name: "Pagina precedente" }).click();
    expect(onGoToPage).toHaveBeenCalledWith(1);
    screen.getByRole("button", { name: "Pagina successiva" }).click();
    expect(onGoToPage).toHaveBeenCalledWith(3);
  });

  it("all'ultima pagina i bottoni avanti sono disabilitati", () => {
    renderPagination({ pageInfo: { ...pageInfo, hasNextPage: false } });
    expect(screen.getByRole("button", { name: "Pagina successiva" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Mostra altri" })).toBeDisabled();
  });
});
