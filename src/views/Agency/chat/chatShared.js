// Utility condivise della chat (Fase 1/2), separate dal componente ChatBubble per
// non rompere il Fast Refresh (un file .jsx dovrebbe esportare solo componenti).
// Usate sia dalla scheda Chat del progetto sia dal popup di Chat globale.

export const formatTime = (value) => {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString("it-IT");
};

// Etichetta autore da mostrare sopra la bolla: nome, email o fallback.
export const authorLabel = (message) => {
  if (message.role === "assistant") {
    return "Assistente AI";
  }
  const author = message.author;
  return author?.name || author?.email || "Utente";
};

// Rileva se l'AI e' interpellata via menzione @AI (stessa regola del server).
export const mentionsAi = (text) => /(^|\s)@ai\b/i.test(text || "");
