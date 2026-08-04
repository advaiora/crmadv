import React from "react";
import { useDropzone } from "react-dropzone";
import { uploadAgencyProjectSourceFile } from "../../../../../modules/agency-os/data/agencyDataAdapter";
import { createId } from "../assetsFormatters";
import { ALLOWED_EXTENSIONS_TEXT, MAX_FILE_SIZE_BYTES } from "../assetsPageConstants";

// La coda di caricamento: cosa e' stato trascinato nel riquadro, cosa e' stato
// scartato e perche', e l'invio vero al server.
//
// Separata dagli altri gesti sui materiali (metadata, apertura, rimozione)
// perche' insieme superavano la soglia di lunghezza del lint, e perche' sono
// davvero due momenti diversi: qui si porta dentro roba nuova, di la' si
// lavora su quello che c'e' gia'.
export const useAgencyProjectAssetsUploadQueue = ({
  projectId,
  setError,
  setMessage,
  loadSources,
}) => {
  const [uploadQueue, setUploadQueue] = React.useState([]);
  const [uploading, setUploading] = React.useState(false);

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
    // uno `useState` dello stesso componente, e React lo garantisce stabile.
    // Ora arriva dai parametri, quindi va dichiarato: il chiamante passa
    // comunque un setter di `useState`, percio' la funzione resta stabile.
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
    uploadQueue,
    uploading,
    getRootProps,
    getInputProps,
    isDragActive,
    uploadQueuedFiles,
  };
};

export default useAgencyProjectAssetsUploadQueue;
