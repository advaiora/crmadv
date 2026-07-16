import React from "react";
import AiChatWidget from "../Agency/chat/AiChatWidget";

// La CASELLA (spec 4-ter §4): il modulo Messaggi diventa la versione a tutto schermo,
// montata su rotta (/apps/email), della stessa chat che vive nel popup. NON e' una
// copia: e' lo stesso `AiChatWidget` in modalita' inline — un solo componente, due
// contenitori (overlay globale + questa pagina). Parte dal mondo Messaggi perche' la
// voce di menu si chiama cosi'; il selettore in cima porta all'altro mondo (Chat AI).
const MessagingInboxPage = () => (
  <div className="hk-pg-body messaging-inbox-page">
    <AiChatWidget inline initialMode="messaging" />
  </div>
);

export default MessagingInboxPage;
