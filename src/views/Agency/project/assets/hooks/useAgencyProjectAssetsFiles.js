import React from "react";
import {
  deleteAgencyProjectSourceFile,
  fetchAgencyProjectSourceFileBlob,
} from "../../../../../modules/agency-os/data/agencyDataAdapter";
import { readAgencyDataMeta } from "../../../../../modules/agency-os/data/agencyDataSource";
import { createId } from "../assetsFormatters";
import { EMPTY_FILE } from "../assetsPageConstants";

// I materiali gia' in elenco: registrarne uno senza file, modificarne le note,
// aprirlo o scaricarlo, rimuoverlo. Quel che si trascina dentro sta invece in
// useAgencyProjectAssetsUploadQueue.
//
// La rimozione ha DUE nature nello stesso gesto: se il file sta davvero nello
// storage e' un'operazione col server (e allora risincronizza fonti, casella
// competitor e provenienza dei dati, esattamente come il salvataggio); se e'
// solo un metadata scritto a mano si toglie dall'elenco e basta. Per questo
// riceve dall'hook dei dati tutti e cinque i setter di quel giro: se ne
// mancasse uno, il file sparirebbe ma la casella competitor o il badge
// resterebbero disallineati fino al ricaricamento successivo.
export const useAgencyProjectAssetsFiles = ({
  projectId,
  setSources,
  setError,
  setMessage,
  setSaving,
  setCompetitorUrlsText,
  setDataMeta,
}) => {
  const [fileDraft, setFileDraft] = React.useState(EMPTY_FILE);
  const [fileActionId, setFileActionId] = React.useState("");

  const addFileMetadata = () => {
    if (!fileDraft.name.trim()) {
      setError("Inserisci almeno il nome file per aggiungere metadata.");
      return;
    }

    setError("");
    setSources((current) => ({
      ...(current || {}),
      uploadedFiles: [
        ...((current?.uploadedFiles || [])),
        {
          id: createId("file"),
          name: fileDraft.name.trim(),
          type: fileDraft.type.trim(),
          size: 0,
          status: "metadata_only",
          source: "manual_upload",
          notes: fileDraft.notes.trim(),
        },
      ],
    }));
    setFileDraft(EMPTY_FILE);
  };

  const removeFile = async (file) => {
    if (file.storagePath) {
      setSaving(true);
      setError("");
      try {
        const saved = await deleteAgencyProjectSourceFile(projectId, file.id);
        setSources(saved);
        setCompetitorUrlsText((saved.competitorUrls || []).join("\n"));
        setDataMeta(readAgencyDataMeta(saved));
        setMessage("File caricato rimosso.");
      } catch (removeError) {
        setError(removeError instanceof Error ? removeError.message : "Rimozione file non riuscita.");
      } finally {
        setSaving(false);
      }
      return;
    }

    setSources((current) => ({
      ...(current || {}),
      uploadedFiles: (current?.uploadedFiles || []).filter((entry) => entry.id !== file.id),
    }));
  };

  const updateFileMetadata = (fileId, patch) => {
    setSources((current) => ({
      ...(current || {}),
      uploadedFiles: (current?.uploadedFiles || []).map((entry) => (
        entry.id === fileId ? { ...entry, ...patch } : entry
      )),
    }));
  };

  // L'indirizzo temporaneo del file si libera dopo un minuto: abbastanza
  // perche' il browser abbia finito di aprirlo o scaricarlo.
  const openOrDownloadFile = async (file, download = false) => {
    if (!file.storagePath) {
      setError("Questo materiale e registrato solo come metadata: non c'e un file da aprire.");
      return;
    }

    setFileActionId(`${file.id}:${download ? "download" : "open"}`);
    setError("");
    try {
      const result = await fetchAgencyProjectSourceFileBlob(projectId, file.id, { download });
      const objectUrl = URL.createObjectURL(result.blob);
      if (download) {
        const anchor = document.createElement("a");
        anchor.href = objectUrl;
        anchor.download = result.filename || file.originalName || file.name;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
      } else {
        window.open(objectUrl, "_blank", "noopener,noreferrer");
      }
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
    } catch (fileError) {
      setError(fileError instanceof Error ? fileError.message : "File non apribile.");
    } finally {
      setFileActionId("");
    }
  };

  return {
    fileDraft,
    setFileDraft,
    fileActionId,
    addFileMetadata,
    removeFile,
    updateFileMetadata,
    openOrDownloadFile,
  };
};

export default useAgencyProjectAssetsFiles;
