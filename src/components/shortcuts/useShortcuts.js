import { useEffect, useReducer } from 'react';
import {
  getResolvedCommands,
  resetAllBindings,
  resetBinding,
  setBinding,
  subscribe,
} from './shortcutsStore';

// Hook che espone i comandi risolti (default + override utente) e si ri-renderizza
// quando le scorciatoie cambiano, così gestore e pagina impostazioni restano allineati.
export const useShortcuts = () => {
  const [, forceUpdate] = useReducer((value) => value + 1, 0);

  useEffect(() => subscribe(forceUpdate), []);

  return {
    commands: getResolvedCommands(),
    setBinding,
    resetBinding,
    resetAllBindings,
  };
};
