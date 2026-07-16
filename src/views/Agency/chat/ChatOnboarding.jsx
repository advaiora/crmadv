import React from "react";
import { IconClose } from "./chatIcons";

// Onboarding LEGGERO della chat (V4, trasversale — "guida in-contesto, non tutorial
// pesante"). Una riga dismissibile in cima alla Chat AI: spiega i due mondi e come si
// interpella l'assistente, poi sparisce per sempre (ricordata in localStorage). Non e'
// un wizard, non ruba spazio: quando l'utente ha capito, la chiude e non torna.
//
// Sta accanto agli altri aiuti in-contesto gia' presenti (testo del selettore
// progetti/clienti, empty state dei messaggi): insieme sono l'onboarding della chat.

const STORAGE_KEY = "ai-chat:onboarding-v1";

const readDismissed = () => {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch (_err) {
    // localStorage non disponibile (modalita' privata, permessi): si mostra la guida,
    // al massimo non ricorda la chiusura. Meglio un aiuto in piu' che un errore.
    return false;
  }
};

// `canUseMessaging`: se il mondo Messaggi non c'e', non lo si nomina — sarebbe una
// guida a qualcosa che l'utente non vede.
const ChatOnboarding = ({ canUseMessaging }) => {
  const [dismissed, setDismissed] = React.useState(readDismissed);

  const dismiss = () => {
    setDismissed(true);
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch (_err) {
      // Se non si puo' salvare, pazienza: si richiudera' la prossima volta.
    }
  };

  if (dismissed) {
    return null;
  }

  return (
    <div className="ai-chat-onboard" role="note">
      <p className="ai-chat-onboard-text mb-0">
        {canUseMessaging && (
          <>
            Due mondi sotto lo stesso pulsante: <strong>Chat AI</strong> per lavorare con l&rsquo;assistente,{" "}
            <strong>Messaggi</strong> per parlare con i colleghi.{" "}
          </>
        )}
        Nella Chat AI scrivi <strong>@AI</strong> (o usa <strong>Chiedi all&rsquo;AI</strong>) per una risposta; se sei
        da solo nella conversazione l&rsquo;assistente risponde a ogni messaggio.
      </p>
      <button type="button" className="ai-chat-onboard-dismiss" aria-label="Ho capito, nascondi" onClick={dismiss}>
        <IconClose size={14} />
      </button>
    </div>
  );
};

export default ChatOnboarding;
