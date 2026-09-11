// Test di apiFetch.ts — la reazione della sessione a 401 e 403 (CRMA-158).
// Un 403 generico (permesso mancante) non deve buttare fuori l'utente; solo
// un 403 col codice dedicato `WORKSPACE_MEMBERSHIP_REQUIRED` lo fa, come il 401.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { apiFetch, WORKSPACE_MEMBERSHIP_REQUIRED_ERROR_CODE } from './apiFetch';
import { writeSession, readSession } from './session';

const jsonResponse = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });

describe('apiFetch — reazione della sessione', () => {
    let assignSpy: ReturnType<typeof vi.fn>;
    const originalLocation = window.location;

    beforeEach(() => {
        writeSession({
            accessToken: 'token-di-prova',
            userId: 'user-1',
            userEmail: 'prova@advaiora.com',
            userRole: 'member',
            workspaceId: 'workspace-1',
        });
        assignSpy = vi.fn();
        // `window.location.assign` e' read-only in jsdom: si sostituisce l'intero oggetto `location`.
        Object.defineProperty(window, 'location', {
            value: { ...originalLocation, assign: assignSpy },
            writable: true,
            configurable: true,
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
        Object.defineProperty(window, 'location', {
            value: originalLocation,
            writable: true,
            configurable: true,
        });
    });

    it('su 401 ripulisce la sessione e manda al login', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(401, {
            error: { code: 'UNAUTHORIZED', message: 'Sessione non valida' },
        })));

        await apiFetch('/qualcosa');

        expect(readSession()).toBeNull();
        expect(assignSpy).toHaveBeenCalledWith('/login');
    });

    it('su 403 col codice dedicato ripulisce la sessione e manda al login', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(403, {
            error: { code: WORKSPACE_MEMBERSHIP_REQUIRED_ERROR_CODE, message: 'Non sei piu\' membro' },
        })));

        await apiFetch('/qualcosa');

        expect(readSession()).toBeNull();
        expect(assignSpy).toHaveBeenCalledWith('/login');
    });

    it('su 403 generico (permesso mancante) NON tocca la sessione', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(403, {
            error: { code: 'FORBIDDEN', message: 'Permission denied' },
        })));

        await apiFetch('/qualcosa');

        expect(readSession()).not.toBeNull();
        expect(assignSpy).not.toHaveBeenCalled();
    });

    it('su 403 senza corpo JSON leggibile NON tocca la sessione', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('non e\' json', { status: 403 })));

        await apiFetch('/qualcosa');

        expect(readSession()).not.toBeNull();
        expect(assignSpy).not.toHaveBeenCalled();
    });

    it('su una risposta 2xx NON tocca la sessione', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, { data: { ok: true } })));

        await apiFetch('/qualcosa');

        expect(readSession()).not.toBeNull();
        expect(assignSpy).not.toHaveBeenCalled();
    });

    it('lascia il corpo della risposta leggibile da chi chiama, anche dopo averlo ispezionato', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(403, {
            error: { code: WORKSPACE_MEMBERSHIP_REQUIRED_ERROR_CODE, message: 'Non sei piu\' membro' },
        })));

        const response = await apiFetch('/qualcosa');
        const payload = await response.json();

        expect(payload.error.code).toBe(WORKSPACE_MEMBERSHIP_REQUIRED_ERROR_CODE);
    });
});
