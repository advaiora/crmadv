import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { clearSession, readSession, type SessionState, writeSession } from '../lib/session';

type LoginInput = {
    accessToken: string;
    userId: string;
    userEmail: string;
    userRole: string;
    workspaceId?: string;
    workspaceSlug?: string;
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
        });

        setSession(nextSession);
        return nextSession;
    }, []);

    const logout = useCallback(() => {
        clearSession();
        setSession(null);
    }, []);

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
