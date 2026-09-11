// Test di session.ts — clearSession() deve ripulire le cache di workspace
// (CRMA-164: chi viene cestinato o disconnesso non deve lasciarsi dati addosso)
// senza toccare le preferenze d'interfaccia.
import { describe, it, expect, afterEach } from 'vitest';
import { clearSession, readSession, writeSession } from './session';
import { STORAGE_KEY as CATEGORY_STORAGE_KEY } from '../modules/projects/hooks/useSelectedCategoryId';
import { STORAGE_KEY as PIPELINE_CATEGORY_STORAGE_KEY } from '../modules/projects/hooks/useSelectedPipelineCategoryId';

const validSession = {
    accessToken: 'token-123',
    userId: 'user-1',
    userEmail: 'persona@example.com',
    userRole: 'member',
};

afterEach(() => {
    localStorage.clear();
});

describe('clearSession', () => {
    it('rimuove la sessione e le cache di dati di workspace (prefisso agency-os.)', () => {
        writeSession(validSession);
        localStorage.setItem('agency-os.projects', '[]');
        localStorage.setItem('agency-os.ads.project-1', '{}');
        localStorage.setItem('agency-os.discovery.project-1', '{}');

        clearSession();

        expect(localStorage.getItem('advaiora.session')).toBeNull();
        expect(localStorage.getItem('agency-os.projects')).toBeNull();
        expect(localStorage.getItem('agency-os.ads.project-1')).toBeNull();
        expect(localStorage.getItem('agency-os.discovery.project-1')).toBeNull();
    });

    it('rimuove anche le categorie selezionate del modulo progetti (CRMA-167)', () => {
        writeSession(validSession);
        localStorage.setItem(CATEGORY_STORAGE_KEY, 'category-1');
        localStorage.setItem(PIPELINE_CATEGORY_STORAGE_KEY, 'category-2');

        clearSession();

        expect(localStorage.getItem(CATEGORY_STORAGE_KEY)).toBeNull();
        expect(localStorage.getItem(PIPELINE_CATEGORY_STORAGE_KEY)).toBeNull();
    });

    it('non tocca le preferenze d\'interfaccia (tema, profilo, modello AI)', () => {
        writeSession(validSession);
        localStorage.setItem('themePreference', 'dark');
        localStorage.setItem('advaiora.user-profile-prefs', '{"foo":"bar"}');
        localStorage.setItem('ai-chat:model-by-conversation', '{}');

        clearSession();

        expect(localStorage.getItem('themePreference')).toBe('dark');
        expect(localStorage.getItem('advaiora.user-profile-prefs')).toBe('{"foo":"bar"}');
        expect(localStorage.getItem('ai-chat:model-by-conversation')).toBe('{}');
    });
});

describe('readSession con un valore corrotto', () => {
    it('ripulisce anche le cache di workspace, non solo la chiave di sessione', () => {
        localStorage.setItem('advaiora.session', '{non e\' json valido');
        localStorage.setItem('agency-os.projects', '[]');

        expect(readSession()).toBeNull();

        expect(localStorage.getItem('advaiora.session')).toBeNull();
        expect(localStorage.getItem('agency-os.projects')).toBeNull();
    });
});

describe('writeSession con un payload non valido', () => {
    it('ripulisce anche le cache di workspace, non solo la chiave di sessione', () => {
        writeSession(validSession);
        localStorage.setItem('agency-os.ads.project-1', '{}');

        expect(writeSession({ userId: 'user-1' })).toBeNull();

        expect(localStorage.getItem('advaiora.session')).toBeNull();
        expect(localStorage.getItem('agency-os.ads.project-1')).toBeNull();
    });
});
