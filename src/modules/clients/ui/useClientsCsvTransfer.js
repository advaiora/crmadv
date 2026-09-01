// Import/export della lista clienti, estratti da ClientsList.jsx
// (fase 2 riordino frontend, secondo giro). L'hook possiede gli stati di
// avanzamento e il messaggio d'esito; gli errori risalgono via onError
// (unico canale d'errore della pagina), il refresh post-import via onImported.
//
// L'import e' a DUE PASSI e l'ordine non e' negoziabile: prima l'anteprima, che
// chiede al backend cosa succederebbe senza scrivere niente, poi la conferma,
// che salva. Chi guarda l'anteprima e cambia idea non ha toccato nulla.
import { useState } from "react";
import { exportClients, importClients } from "./clientApi";
import { buildImportOutcome, buildImportPreview } from "./importSummary";

export function useClientsCsvTransfer({ onError, onImported } = {}) {
  // Il file resta qui fra i due passi: si conferma esattamente quello che e'
  // stato messo in anteprima, non un file riletto dall'input (che nel frattempo
  // viene svuotato, per poter riselezionare lo stesso file).
  const [preview, setPreview] = useState(null);
  const [previewing, setPreviewing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [actionMessage, setActionMessage] = useState(null);

  const dismissMessage = () => setActionMessage(null);

  // PRIMO PASSO — la prova senza salvare.
  // ⚠️ `dryRun: true` e' l'unica cosa che impedisce a questa funzione di creare
  // clienti. Non deve mai diventare una variabile, un parametro o un valore
  // preso da fuori: e' scritto qui, fisso, ed e' provato dal test.
  const requestPreview = async (file) => {
    if (previewing || importing) {
      return;
    }

    setPreviewing(true);
    onError?.("");
    setActionMessage(null);

    try {
      const result = await importClients(file, { dryRun: true });
      setPreview({ file, ...buildImportPreview(result?.summary) });
    } catch (previewError) {
      onError?.(previewError?.message || "Errore durante la lettura del file.");
    } finally {
      setPreviewing(false);
    }
  };

  // Tornare indietro dall'anteprima non deve disfare niente, perche' non e'
  // stato scritto niente: basta dimenticare il file.
  const cancelPreview = () => {
    if (importing) {
      return;
    }

    setPreview(null);
  };

  // SECONDO PASSO — la conferma, ed e' l'unico punto del frontend che salva.
  // Ci si arriva solo da un'anteprima gia' ottenuta: senza, non c'e' nessun
  // file da importare e la funzione non fa niente invece di indovinare.
  const confirmImport = async () => {
    if (!preview || importing) {
      return;
    }

    setImporting(true);
    onError?.("");
    setActionMessage(null);

    try {
      const result = await importClients(preview.file, { dryRun: false });
      setActionMessage(buildImportOutcome(result?.summary));
      setPreview(null);
      await onImported?.();
    } catch (importError) {
      // L'anteprima resta aperta: l'errore puo' essere passeggero e il file e'
      // ancora quello giusto, quindi si puo' riprovare senza ricaricarlo.
      onError?.(importError?.message || "Errore durante importazione clienti.");
    } finally {
      setImporting(false);
    }
  };

  const exportWithFilters = async (filters) => {
    if (exporting) {
      return;
    }

    setExporting(true);
    onError?.("");
    setActionMessage(null);

    try {
      const { blob, filename } = await exportClients(filters);

      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);

      setActionMessage({
        variant: "success",
        text: `Export completato: file ${filename} scaricato.`,
        errors: [],
      });
    } catch (exportError) {
      onError?.(exportError?.message || "Errore durante esportazione clienti.");
    } finally {
      setExporting(false);
    }
  };

  return {
    preview,
    previewing,
    importing,
    exporting,
    actionMessage,
    dismissMessage,
    requestPreview,
    cancelPreview,
    confirmImport,
    exportWithFilters,
  };
}
