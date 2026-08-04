import React from "react";
import { useDropzone } from "react-dropzone";
import {
  deleteAgencyProjectSourceFile,
  fetchAgencyProjectSourceFileBlob,
  uploadAgencyProjectSourceFile,
} from "../../../../../modules/agency-os/data/agencyDataAdapter";
import { readAgencyDataMeta } from "../../../../../modules/agency-os/data/agencyDataSource";
import { createId } from "../assetsFormatters";
import { ALLOWED_EXTENSIONS_TEXT, EMPTY_FILE, MAX_FILE_SIZE_BYTES } from "../assetsPageConstants";

// I materiali: coda di caricamento, upload vero, metadata senza file,
// apertura/scaricamento e rimozione.
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
  loadSources,
}) => {
  const [fileDraft, setFileDraft] = React.useState(EMPTY_FILE);
  const [uploadQueue, setUploadQueue] = React.useState([]);
  const [uploading, setUploading] = React.useState(false);
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

  const onDrop = React.useCallback((acceptedFiles, rejectedFiles) => {
    const nextAccepted = acceptedFiles.map((file) => ({
      id: createId("upload"),
      file,
      name: file.name,
      size: file.size,
      status: "queued",
      error: "",
    }));
    const nextRejected = rejectedFiles.map((rejected) => ({
      id: createId("upload"),
      file: rejected.file,
      name: rejected.file.name,
      size: rejected.file.size,
      status: "failed",
      error: rejected.errors?.[0]?.code === "file-too-large"
        ? "Il file supera 20 MB."
        : `Formato non supportato. Usa ${ALLOWED_EXTENSIONS_TEXT}.`,
    }));

    setUploadQueue((current) => [...current, ...nextAccepted, ...nextRejected]);
    setError("");
    // Nell'originale le dipendenze erano vuote perche' `setError` veniva da
    // uno `useState` di questo stesso componente, e React lo garantisce
    // stabile. Ora arriva dai parametri, quindi va dichiarato: il chiamante
    // passa comunque un setter di `useState`, percio' la funzione resta
    // stabile come prima.
  }, [setError]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: true,
    maxSize: MAX_FILE_SIZE_BYTES,
    accept: {
      "application/pdf": [".pdf"],
      "application/msword": [".doc"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
      "text/plain": [".txt"],
      "text/csv": [".csv"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "image/png": [".png"],
      "image/jpeg": [".jpg", ".jpeg"],
    },
  });

  // I file si caricano UNO ALLA VOLTA di proposito (await dentro il ciclo):
  // ognuno aggiorna il proprio stato nella coda, e uno che fallisce non ferma
  // gli altri. Alla fine si ricaricano le fonti dal server una volta sola.
  const uploadQueuedFiles = async () => {
    const queuedFiles = uploadQueue.filter((entry) => entry.status === "queued" && entry.file);
    if (queuedFiles.length === 0) {
      setError("Aggiungi almeno un file valido alla coda di upload.");
      return;
    }

    setUploading(true);
    setError("");
    setMessage("");
    try {
      for (const queueItem of queuedFiles) {
        setUploadQueue((current) => current.map((entry) => (
          entry.id === queueItem.id ? { ...entry, status: "uploading", error: "" } : entry
        )));
        try {
          await uploadAgencyProjectSourceFile(projectId, queueItem.file);
          setUploadQueue((current) => current.map((entry) => (
            entry.id === queueItem.id ? { ...entry, status: "uploaded", error: "" } : entry
          )));
        } catch (uploadError) {
          setUploadQueue((current) => current.map((entry) => (
            entry.id === queueItem.id
              ? {
                  ...entry,
                  status: "failed",
                  error: uploadError instanceof Error ? uploadError.message : "Upload non riuscito.",
                }
              : entry
          )));
        }
      }
      await loadSources();
      setMessage("Upload completato. TXT, CSV, PDF e DOCX vengono letti quando il parsing riesce; gli altri file restano materiali allegati.");
    } finally {
      setUploading(false);
    }
  };

  return {
    fileDraft,
    setFileDraft,
    uploadQueue,
    uploading,
    fileActionId,
    getRootProps,
    getInputProps,
    isDragActive,
    addFileMetadata,
    removeFile,
    updateFileMetadata,
    openOrDownloadFile,
    uploadQueuedFiles,
  };
};

export default useAgencyProjectAssetsFiles;
