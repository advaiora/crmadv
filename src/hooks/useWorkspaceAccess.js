import { useCallback, useEffect, useState } from 'react';
import { fetchWorkspaceAccess } from '../utils/workspaceAccess';

export const useWorkspaceAccess = () => {
    const [access, setAccess] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const loadAccess = useCallback(async () => {
        setLoading(true);
        setError('');

        try {
            const result = await fetchWorkspaceAccess();
            setAccess(result);
        } catch (loadError) {
            setAccess(null);
            setError(loadError?.message || 'Impossibile caricare i permessi utente.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadAccess();
    }, [loadAccess]);

    return {
        access,
        loading,
        error,
        reload: loadAccess,
    };
};
