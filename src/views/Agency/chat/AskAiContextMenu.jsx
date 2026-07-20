import React from "react";
import { createPortal } from "react-dom";
import { MessageCircle, MessageSquare, Paperclip } from "lucide-react";
import {
  ASK_AI_LABELS,
  ASK_AI_TYPES,
  askAiWithEntity,
  isAskAiScopeType,
  openAiChatOnEntity,
  pickChatForEntity,
} from "./askAi";
import "./ai-chat-widget.css";

// Menu contestuale globale "Chiedi all'AI" (Fase 3a). Montato una volta sola nello
// shell, accanto al popup di chat. Al tasto destro cerca l'elemento piu' vicino con
// gli attributi data-ask-ai-* (vedi askAi.js): se lo trova apre questo menu, se no
// lascia il menu del browser. Cosi' una lista si abilita aggiungendo attributi alla
// riga, senza montare componenti per riga ne' ri-renderizzare nulla.

const MENU_WIDTH = 232;
// Fino a tre voci (progetto/cliente); per fonte/preventivo una sola. Sovrastimare e'
// sicuro: serve solo a non far uscire il menu dal fondo dello schermo.
const MENU_HEIGHT = 132;

const AskAiContextMenu = () => {
  const [menu, setMenu] = React.useState(null);

  React.useEffect(() => {
    const onContextMenu = (event) => {
      const node = event.target.closest?.("[data-ask-ai-type]");
      if (!node) {
        return;
      }
      const entityType = node.getAttribute("data-ask-ai-type");
      const entityId = node.getAttribute("data-ask-ai-id");
      if (!ASK_AI_TYPES.includes(entityType) || !entityId) {
        return;
      }
      event.preventDefault();
      // Tengo il menu dentro la finestra anche vicino ai bordi.
      setMenu({
        x: Math.min(event.clientX, window.innerWidth - MENU_WIDTH - 8),
        y: Math.min(event.clientY, window.innerHeight - MENU_HEIGHT - 8),
        entityType,
        entityId,
        name: node.getAttribute("data-ask-ai-name") || "",
      });
    };

    document.addEventListener("contextmenu", onContextMenu);
    return () => document.removeEventListener("contextmenu", onContextMenu);
  }, []);

  React.useEffect(() => {
    if (!menu) {
      return undefined;
    }
    const close = () => setMenu(null);
    const onKey = (event) => {
      if (event.key === "Escape") {
        close();
      }
    };
    // Un clic o uno scroll altrove chiude, come ogni menu contestuale.
    window.addEventListener("click", close);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [menu]);

  if (!menu) {
    return null;
  }

  const entity = { id: menu.entityId, name: menu.name };
  const run = (action) => {
    action(menu.entityType, entity);
    setMenu(null);
  };

  return createPortal(
    <div
      className="ai-chat-ctxmenu"
      style={{ top: menu.y, left: menu.x }}
      role="menu"
      aria-label="Chiedi all'AI"
      onContextMenu={(event) => event.preventDefault()}
    >
      <div className="ai-chat-ctxmenu-head" title={menu.name}>
        {menu.name || "Elemento"}
      </div>
      {/* Progetto e cliente SONO ambiti-chat: hanno "aggiungi/apri". Fonte e preventivo
          no: per loro solo "allega a una chat…" (scegli tu la destinazione). */}
      {isAskAiScopeType(menu.entityType) && (
        <>
          <button type="button" role="menuitem" className="ai-chat-ctxmenu-item" onClick={() => run(askAiWithEntity)}>
            <Paperclip size={14} />
            <span>{ASK_AI_LABELS.attach}</span>
          </button>
          <button type="button" role="menuitem" className="ai-chat-ctxmenu-item" onClick={() => run(openAiChatOnEntity)}>
            <MessageCircle size={14} />
            <span>{ASK_AI_LABELS.open}</span>
          </button>
        </>
      )}
      <button type="button" role="menuitem" className="ai-chat-ctxmenu-item" onClick={() => run(pickChatForEntity)}>
        <MessageSquare size={14} />
        <span>{ASK_AI_LABELS.pick}</span>
      </button>
    </div>,
    document.body,
  );
};

export default AskAiContextMenu;
