import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
    clearSession,
    readSession,
    SESSION_CHANGED_EVENT,
    type SessionState,
    writeSession,
} from '../lib/session';
import { applyWorkspaceBranding, type WorkspaceBrandingState } from '../lib/workspaceBranding';

type LoginInput = {
    accessToken: string;
    userId: string;
    userEmail: string;
    userRole: string;
    workspaceId?: string;
    workspaceSlug?: string;
    workspaceBranding?: WorkspaceBrandingState;
};

type SessionContextValue = {
    session: SessionState | null;
    isAuthenticated: boolean;
    login: (input: LoginInput) => SessionState | null;
    logout: () => void;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export const SessionProvider = ({ children }: { children: React.ReactNode }) => {
    const [session, setSession] = useState<SessionState | null>(() => readSession());

    const login = useCallback((input: LoginInput) => {
        const nextSession = writeSession({
            accessToken: input.accessToken,
            userId: input.userId,
            userEmail: input.userEmail,
            userRole: input.userRole,
            workspaceId: input.workspaceId,
            workspaceSlug: input.workspaceSlug,
            workspaceBranding: input.workspaceBranding,
        });

        setSession(nextSession);
        return nextSession;
    }, []);

    const logout = useCallback(() => {
        clearSession();
        setSession(null);
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined') {
            return undefined;
        }

        const syncSessionFromStorage = () => {
            setSession(readSession());
        };

        window.addEventListener(SESSION_CHANGED_EVENT, syncSessionFromStorage);
        window.addEventListener('storage', syncSessionFromStorage);

        return () => {
            window.removeEventListener(SESSION_CHANGED_EVENT, syncSessionFromStorage);
            window.removeEventListener('storage', syncSessionFromStorage);
        };
    }, []);

    useEffect(() => {
        applyWorkspaceBranding(session?.workspaceBranding ?? null);
    }, [session]);

    const value = useMemo(
        () => ({
            session,
            isAuthenticated: Boolean(session),
            login,
            logout,
        }),
        [session, login, logout],
    );

    return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
};

export const useSessionContext = () => {
    const context = useContext(SessionContext);

    if (!context) {
        throw new Error('useSessionContext must be used inside SessionProvider');
    }

    return context;
};
