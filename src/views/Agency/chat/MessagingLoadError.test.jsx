import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import MessagingLoadError from "./MessagingLoadError";

describe("MessagingLoadError", () => {
  it("dice che i messaggi non si sono caricati e non nomina altre aree", () => {
    render(<MessagingLoadError onRetry={() => {}} />);

    expect(screen.getByText("Non è stato possibile caricare i Messaggi.")).toBeInTheDocument();
    expect(screen.queryByText(/Chat AI/i)).not.toBeInTheDocument();
  });

  it("il pulsante Riprova richiama chi lo ha montato", () => {
    const onRetry = vi.fn();
    render(<MessagingLoadError onRetry={onRetry} />);

    fireEvent.click(screen.getByRole("button", { name: "Riprova" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
