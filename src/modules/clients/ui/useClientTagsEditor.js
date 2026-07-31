// Stato e logica del modal "Modifica tag cliente", estratti da ClientsList.jsx
// (fase 2 riordino frontend, secondo giro). Il chiamante resta proprietario
// della lista: passa onSaved(clientId, tags) per riflettere il salvataggio
// nel proprio stato. La UI del modal sta in components/ClientTagsEditorModal.
import { useCallback, useState } from "react";
import { updateClient } from "./clientApi";
import { hasTag } from "./helpers";

export function useClientTagsEditor({ onSaved } = {}) {
  const [client, setClient] = useState(null);
  const [tags, setTags] = useState([]);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Stabile (useCallback): viene passata come onEditTags alle righe memoizzate
  // (ClientGridRow/ClientMobileCard) — se cambiasse a ogni render la loro
  // memoizzazione smetterebbe di funzionare in silenzio.
  const open = useCallback((nextClient) => {
    setClient(nextClient);
    setTags(Array.isArray(nextClient.tags) ? nextClient.tags.filter(Boolean) : []);
    setDraft("");
    setError("");
  }, []);

  const close = (force = false) => {
    const shouldForceClose = force === true;
    if (saving && !shouldForceClose) {
      return;
    }

    setClient(null);
    setTags([]);
    setDraft("");
    setError("");
  };

  const togglePreset = (presetTag) => {
    setTags((prev) => (hasTag(prev, presetTag) ? prev.filter((tag) => tag.toLowerCase() !== presetTag.toLowerCase()) : [...prev, presetTag]));
  };

  const removeTag = (tagToRemove) => {
    setTags((prev) => prev.filter((tag) => tag !== tagToRemove));
  };

  const addCustomTag = () => {
    const normalized = draft.trim();
    if (!normalized) {
      return;
    }

    setTags((prev) => (hasTag(prev, normalized) ? prev : [...prev, normalized]));
    setDraft("");
  };

  const save = async () => {
    if (!client) {
      return;
    }

    setSaving(true);
    setError("");

    try {
      await updateClient(client.id, { tags });
      onSaved?.(client.id, tags);
      close(true);
    } catch (updateError) {
      setError(updateError?.message || "Errore durante aggiornamento tag cliente.");
    } finally {
      setSaving(false);
    }
  };

  return { client, tags, draft, saving, error, open, close, togglePreset, removeTag, addCustomTag, setDraft, save };
}
