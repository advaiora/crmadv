import { useEffect, useState } from "react";
import { getAgencyAiEstimates } from "../data/agencyDataAdapter";

// Carica una volta le stime di costo dei pulsanti AI del workspace ed espone una
// mappa per functionName. Da usare a livello di pagina: una sola chiamata anche
// se la pagina ha più pulsanti AI (ognuno legge la propria voce dalla mappa).
export const useAgencyAiEstimates = () => {
  const [state, setState] = useState({ loading: true, aiConfigured: false, byFunction: {} });

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await getAgencyAiEstimates();
        if (!active) {
          return;
        }
        const byFunction = {};
        for (const estimate of data?.estimates ?? []) {
          byFunction[estimate.functionName] = estimate;
        }
        setState({ loading: false, aiConfigured: Boolean(data?.aiConfigured), byFunction });
      } catch {
        if (active) {
          setState({ loading: false, aiConfigured: false, byFunction: {} });
        }
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return state;
};
