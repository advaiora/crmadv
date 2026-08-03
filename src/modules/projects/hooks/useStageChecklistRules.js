import { useCallback, useEffect, useState } from 'react';
import { listStageChecklistRules, replaceStageChecklistRules } from '../../checklists/api/checklists.api';
import {
    getErrorMessage,
    setStageRuleGate,
    toStageRulesDraft,
    toggleStageRuleTemplate,
} from '../ui/pipelineSettings.utils';

// Regole checklist degli stage di una categoria, estratte da
// src/views/Projects/ProjectPipelineSettings.jsx (fase 2 riordino frontend).
// Tiene una bozza per stage — {loading, saving, error, rules} — la carica
// quando cambiano categoria o stage, e la salva su richiesta.
//
// Due cose non ovvie, entrambe volute:
// - il caricamento e' una chiamata per stage in parallelo, e ogni risposta
//   aggiorna solo la propria voce: uno stage che va in errore non spegne gli
//   altri;
// - ricaricando si TIENE la bozza gia' in pagina (`existing || {loading}`),
//   cosi' una modifica non salvata non sparisce sotto le mani mentre la
//   richiesta e' in volo.
export const useStageChecklistRules = ({ categoryId, stages, enabled }) => {
    const [rulesByStageId, setRulesByStageId] = useState({});

    useEffect(() => {
        let isMounted = true;

        if (!enabled || !categoryId || stages.length === 0) {
            setRulesByStageId({});
            return () => {
                isMounted = false;
            };
        }

        const stageIds = stages.map((stage) => stage.id);

        setRulesByStageId((current) => {
            const next = {};
            stageIds.forEach((stageId) => {
                next[stageId] = current[stageId] || {
                    loading: true,
                    saving: false,
                    error: '',
                    rules: [],
                };
            });
            return next;
        });

        stageIds.forEach(async (stageId) => {
            try {
                const payload = await listStageChecklistRules(categoryId, stageId);
                if (!isMounted) {
                    return;
                }

                setRulesByStageId((current) => ({
                    ...current,
                    [stageId]: {
                        loading: false,
                        saving: false,
                        error: '',
                        rules: toStageRulesDraft(payload),
                    },
                }));
            } catch (error) {
                if (!isMounted) {
                    return;
                }

                setRulesByStageId((current) => ({
                    ...current,
                    [stageId]: {
                        loading: false,
                        saving: false,
                        error: getErrorMessage(error),
                        rules: [],
                    },
                }));
            }
        });

        return () => {
            isMounted = false;
        };
    }, [categoryId, enabled, stages]);

    const updateDraft = useCallback((stageId, updater) => {
        setRulesByStageId((current) => ({
            ...current,
            [stageId]: updater(
                current[stageId] || {
                    loading: false,
                    saving: false,
                    error: '',
                    rules: [],
                },
            ),
        }));
    }, []);

    const toggleTemplate = useCallback(
        (stageId, templateId, checked) => {
            updateDraft(stageId, (current) => ({
                ...current,
                error: '',
                rules: toggleStageRuleTemplate(current.rules, templateId, checked),
            }));
        },
        [updateDraft],
    );

    const toggleGate = useCallback(
        (stageId, templateId, gateEnabled) => {
            updateDraft(stageId, (current) => ({
                ...current,
                error: '',
                rules: setStageRuleGate(current.rules, templateId, gateEnabled),
            }));
        },
        [updateDraft],
    );

    // Torna sempre {attempted, error}: il toast lo fa il chiamante, l'hook non
    // conosce l'interfaccia. `attempted: false` vuol dire che il salvataggio
    // non e' nemmeno partito — non e' un successo, e chi chiama non deve
    // annunciarlo. Tenerli distinti serve anche per dopo: qualunque altra
    // uscita anticipata aggiunta qui non diventa per sbaglio un "salvato".
    const saveRules = useCallback(
        async (stageId) => {
            if (!categoryId || !enabled) {
                return { attempted: false, error: '' };
            }

            const draft = rulesByStageId[stageId] || { rules: [] };

            updateDraft(stageId, (current) => ({ ...current, saving: true, error: '' }));

            try {
                const payload = await replaceStageChecklistRules(categoryId, stageId, draft.rules);

                updateDraft(stageId, (current) => ({
                    ...current,
                    saving: false,
                    error: '',
                    rules: toStageRulesDraft(payload),
                }));

                return { attempted: true, error: '' };
            } catch (error) {
                const message = getErrorMessage(error) || 'Errore salvataggio regole checklist';
                updateDraft(stageId, (current) => ({ ...current, saving: false, error: message }));
                return { attempted: true, error: message };
            }
        },
        [categoryId, enabled, rulesByStageId, updateDraft],
    );

    return { rulesByStageId, toggleTemplate, toggleGate, saveRules };
};
