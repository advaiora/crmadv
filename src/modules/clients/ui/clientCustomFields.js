import { useCallback, useEffect, useRef, useState } from 'react';
import { listCustomFields } from '../../customFields/api/customFieldsApi';

// Supporto ai campi personalizzati dentro la scheda cliente: il caricamento
// delle definizioni e la validazione degli obbligatori, fuori dal componente
// perche' il form li usa ma non sono affar suo.

// Solo i campi attivi vengono mostrati nella scheda cliente.
export const selectActiveDefinitions = (result) =>
  (result?.definitions ?? []).filter((definition) => definition.active);

// Gli errori dei campi personalizzati convivono con quelli dei campi fissi
// nella stessa mappa: il prefisso evita che una chiave uguale li confonda.
export const customFieldErrorKey = (key) => `cf:${key}`;

export const isCustomFieldEmpty = (value) =>
  value === undefined || value === null || value === '' || value === false;

// Il server ripete comunque questa validazione: qui serve solo a non far
// partire una richiesta che sappiamo gia' che verrebbe rifiutata.
export const validateRequiredCustomFields = (definitions, values) => {
  const errors = {};
  const current = values || {};

  (definitions || []).forEach((definition) => {
    if (definition.required && isCustomFieldEmpty(current[definition.key])) {
      errors[customFieldErrorKey(definition.key)] = 'Questo campo è obbligatorio.';
    }
  });

  return errors;
};

export const useClientCustomFields = () => {
  const [definitions, setDefinitions] = useState([]);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const reload = useCallback(async () => {
    try {
      const result = await listCustomFields('client');
      if (mounted.current) {
        setDefinitions(selectActiveDefinitions(result));
      }
    } catch (loadError) {
      // Le definizioni sono un di piu': se non arrivano il form resta usabile.
      if (mounted.current) {
        setDefinitions([]);
      }
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { definitions, reload };
};
