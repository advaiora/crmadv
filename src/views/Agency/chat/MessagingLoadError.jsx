import React from "react";
import { Button } from "react-bootstrap";

// Cosa si vede quando NON si e' riusciti a sapere se i Messaggi sono disponibili,
// cioe' quando la lettura del profilo del workspace fallisce (rete, server giu').
//
// Prima al suo posto compariva la Chat AI: un errore momentaneo faceva apparire
// un'area DIVERSA da quella chiesta — e l'area Produzione AI al lancio e' nascosta,
// quindi comparirebbe a chi non deve nemmeno sapere che esiste. Il ripiego giusto e'
// dire che i messaggi non si sono caricati, non sostituirli con un altro modulo.
//
// Sta in un file suo, e non dentro AiChatWidget.jsx, perche' quel file e' a 1.454
// righe: la regola di CLAUDE.md vieta di aggiungergli funzioni.
const MessagingLoadError = ({ onRetry }) => (
  <div className="ai-chat-empty" role="status">
    Non è stato possibile caricare i Messaggi.
    <Button size="sm" variant="outline-secondary" className="mt-2" onClick={onRetry}>
      Riprova
    </Button>
  </div>
);

export default MessagingLoadError;
