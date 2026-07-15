// "Chiedi all'AI" sugli elementi del CRM (Fase 3a).
//
// Un elemento diventa interpellabile aggiungendo alla sua riga/card gli attributi
// data-* qui sotto (vedi askAiRowProps): il menu contestuale globale
// (AskAiContextMenu) li legge al tasto destro, senza che la lista debba montare
// nulla ne' ri-renderizzarsi. Le voci del menu "⋯" usano invece askAiWithEntity /
// openAiChatOnEntity direttamente.
//
// Due sensi, come da spec:
//  - "aggiungi alla chat aperta" -> mode 'attach': se una conversazione e' aperta,
//    l'elemento ci finisce come allegato; se non lo e', si apre quella dell'elemento.
//  - "apri chat su questo"       -> mode 'open': apre la chat DELL'elemento
//    (progetto -> ambito Progetto, cliente -> ambito Cliente).

export const AI_CHAT_ASK_EVENT = "ai-chat:ask";

// Tipi che l'utente puo' interpellare dalle liste. Il server ne accetta anche altri
// (fonte, preventivo): si aggiungeranno quando quelle liste avranno il loro menu.
export const ASK_AI_TYPES = ["project", "client"];

// Attributi da mettere sulla riga/card di una lista per abilitare il tasto destro.
export const askAiRowProps = (entityType, entity) => ({
  "data-ask-ai-type": entityType,
  "data-ask-ai-id": entity?.id || "",
  "data-ask-ai-name": entity?.name || "",
});

// Chiede al popup di chat di prendere in carico l'elemento.
const dispatchAsk = (detail) => {
  window.dispatchEvent(new CustomEvent(AI_CHAT_ASK_EVENT, { detail }));
};

// "Aggiungi alla chat aperta" (o aprila su questo elemento, se non ce n'e' una).
export const askAiWithEntity = (entityType, entity) => {
  dispatchAsk({ mode: "attach", entityType, entityId: entity?.id, name: entity?.name || "" });
};

// "Apri chat su questo": porta la chat sull'ambito dell'elemento.
export const openAiChatOnEntity = (entityType, entity) => {
  dispatchAsk({ mode: "open", entityType, entityId: entity?.id, name: entity?.name || "" });
};

// Etichette delle due voci, condivise tra menu contestuale e menu "⋯".
export const ASK_AI_LABELS = {
  attach: "Aggiungi alla chat aperta",
  open: "Apri chat su questo",
};
