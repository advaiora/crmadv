import { createId } from "../assetsFormatters";

// Gli indirizzi registrati come fonti: aggiunta, modifica, rimozione e scelta
// del sito principale.
//
// Il sito principale e' salvato due volte, in `primaryWebsiteUrl` e in
// `websiteUrl`: i due campi vanno tenuti allineati a ogni cambiamento. Quando
// si rimuove l'indirizzo che era il principale se ne rieleva un altro (prima
// un "website" attivo, poi un attivo qualsiasi), invece di lasciare il campo
// che punta a un indirizzo non piu' in elenco.
export const useAgencyProjectAssetsUrls = ({ setSources, setError }) => {
  const updateUrlSource = (urlId, patch) => {
    setSources((current) => ({
      ...(current || {}),
      urls: (current?.urls || []).map((entry) => (
        entry.id === urlId ? { ...entry, ...patch } : entry
      )),
    }));
  };

  const addUrlSource = () => {
    setSources((current) => ({
      ...(current || {}),
      urls: [
        ...((current?.urls || [])),
        {
          id: createId("url"),
          label: "Link utile",
          type: "other",
          url: "",
          status: "active",
          notes: "",
          addedAt: new Date().toISOString(),
        },
      ],
    }));
  };

  const removeUrlSource = (urlId) => {
    setSources((current) => {
      const nextUrls = (current?.urls || []).filter((entry) => entry.id !== urlId);
      const primaryWebsiteUrl = current?.primaryWebsiteUrl && nextUrls.some((entry) => entry.url === current.primaryWebsiteUrl)
        ? current.primaryWebsiteUrl
        : nextUrls.find((entry) => entry.type === "website" && entry.status !== "ignored")?.url || nextUrls.find((entry) => entry.status !== "ignored")?.url || "";
      return {
        ...(current || {}),
        urls: nextUrls,
        primaryWebsiteUrl,
        websiteUrl: primaryWebsiteUrl,
      };
    });
  };

  const setPrimaryUrlSource = (urlEntry) => {
    const url = String(urlEntry?.url || "").trim();
    if (!url) {
      setError("Inserisci l'URL prima di impostarlo come sito principale.");
      return;
    }
    setSources((current) => ({
      ...(current || {}),
      primaryWebsiteUrl: url,
      websiteUrl: url,
      urls: (current?.urls || []).map((entry) => (
        entry.id === urlEntry.id ? { ...entry, type: "website", status: "active" } : entry
      )),
    }));
  };

  return {
    addUrlSource,
    updateUrlSource,
    removeUrlSource,
    setPrimaryUrlSource,
  };
};

export default useAgencyProjectAssetsUrls;
