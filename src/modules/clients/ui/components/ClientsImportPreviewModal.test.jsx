import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import ClientsImportPreviewModal from "./ClientsImportPreviewModal";
import { buildImportPreview } from "../importSummary";

const anteprima = (summary) => buildImportPreview(summary);

const anteprimaBase = anteprima({
  totalRows: 3,
  validRows: 2,
  failedRows: 1,
  previewRows: [
    { row: 2, type: "person", name: "Mario Rossi", email: "mario@rossi.it", phone: null },
    { row: 3, type: "company", name: "Acme Srl", email: null, phone: "0212345" },
  ],
  errors: [{ row: 4, message: "email non valida" }],
});

const renderModal = (props = {}) =>
  render(
    <ClientsImportPreviewModal
      preview={anteprimaBase}
      importing={false}
      onCancel={vi.fn()}
      onConfirm={vi.fn()}
      {...props}
    />,
  );

describe("ClientsImportPreviewModal", () => {
  it("senza anteprima non disegna niente", () => {
    const { container } = render(
      <ClientsImportPreviewModal preview={null} importing={false} onCancel={vi.fn()} onConfirm={vi.fn()} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("dice quante righe entrano e mette in chiaro che ancora non ha salvato niente", () => {
    renderModal();

    expect(screen.getByText("Entrano 2 righe su 3. 1 riga viene scartata.")).toBeInTheDocument();
    expect(screen.getByText(/Niente è ancora stato salvato/)).toBeInTheDocument();
  });

  it("elenca le righe scartate con il loro motivo", () => {
    renderModal();

    expect(screen.getByText("Riga 4")).toBeInTheDocument();
    expect(screen.getByText("email non valida")).toBeInTheDocument();
  });

  it("elenca le righe che entrerebbero, con nome, tipo e recapiti", () => {
    renderModal();

    expect(screen.getByText("Mario Rossi")).toBeInTheDocument();
    expect(screen.getByText("mario@rossi.it")).toBeInTheDocument();
    expect(screen.getByText("Acme Srl")).toBeInTheDocument();
    expect(screen.getByText("Azienda")).toBeInTheDocument();
    expect(screen.getByText("0212345")).toBeInTheDocument();
  });

  // Il backend taglia i due elenchi a 100: tacere la differenza sarebbe una
  // bugia per omissione, perche' l'utente conterebbe le righe elencate.
  it("dice quante righe restano fuori dai due elenchi", () => {
    renderModal({
      preview: anteprima({
        totalRows: 4200,
        validRows: 4000,
        failedRows: 200,
        previewRows: Array.from({ length: 100 }, (_, i) => ({ row: i + 2, type: "person", name: `Cliente ${i}` })),
        errors: Array.from({ length: 100 }, (_, i) => ({ row: i + 2, message: `errore ${i}` })),
      }),
    });

    expect(screen.getByText("e altre 3900 righe, non elencate.")).toBeInTheDocument();
    expect(screen.getByText("e altre 100 righe con errori, non elencate.")).toBeInTheDocument();
  });

  it("il pulsante di conferma dice quante righe importerebbe, e chiama onConfirm", () => {
    const onConfirm = vi.fn();
    renderModal({ onConfirm });

    const conferma = screen.getByRole("button", { name: "Conferma e importa 2 righe" });
    fireEvent.click(conferma);

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("«Annulla» torna indietro senza confermare niente", () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    renderModal({ onCancel, onConfirm });

    fireEvent.click(screen.getByRole("button", { name: "Annulla" }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("se non entra nessuna riga la conferma e' disattivata", () => {
    renderModal({
      preview: anteprima({
        totalRows: 2,
        validRows: 0,
        failedRows: 2,
        errors: [
          { row: 2, message: "nome mancante" },
          { row: 3, message: "nome mancante" },
        ],
      }),
    });

    expect(screen.getByRole("button", { name: /Conferma e importa/ })).toBeDisabled();
    expect(screen.getByText(/Nessuna riga di questo file può entrare/)).toBeInTheDocument();
  });

  it("durante l'importazione i due pulsanti sono bloccati", () => {
    renderModal({ importing: true });

    expect(screen.getByRole("button", { name: "Importazione..." })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Annulla" })).toBeDisabled();
  });
});
