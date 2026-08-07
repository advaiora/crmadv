import { describe, expect, it } from 'vitest';
import { SidebarMenu } from './SidebarMenu';

// Questi test proteggono una scelta fragile presa il 5/8/2026: l'area Piattaforma
// e' stata tolta dalla sidebar (il suo ingresso e' l'icona in TopNav), ma la sua
// voce e' rimasta DENTRO questo array, perche' la ricerca rapida (Ctrl+K) legge
// da qui le proprie destinazioni. Sono due meccanismi che si tengono per mano
// senza che il codice lo dica: se qualcuno "ripulisce" l'array, o rinomina il
// gruppo, non si rompe niente in modo visibile — semplicemente l'unica via
// testuale per raggiungere l'area sparisce in silenzio. Da qui i test.

const PLATFORM_PATH = '/settings/platform-console';

const findPlatformGroup = () => SidebarMenu.find((group) => group.group === 'Piattaforma');

const findPlatformEntry = () =>
  SidebarMenu.flatMap((group) => group.contents).find((entry) => entry.path === PLATFORM_PATH);

describe('SidebarMenu — la voce Piattaforma', () => {
  it('resta nei dati del menu: e\' da qui che la ricerca rapida (Ctrl+K) la pesca', () => {
    expect(findPlatformEntry()).toBeDefined();
  });

  it('sta in un gruppo chiamato esattamente "Piattaforma": Sidebar.jsx lo esclude dal disegno per nome', () => {
    // Se il nome del gruppo cambia, il filtro di Sidebar.jsx smette di combaciare
    // e la voce ricompare nella sidebar senza che nessuno se ne accorga.
    expect(findPlatformGroup()).toBeDefined();
  });

  it('e\' l\'unica voce del suo gruppo, quindi escludere il gruppo basta a nasconderla', () => {
    expect(findPlatformGroup().contents).toHaveLength(1);
    expect(findPlatformGroup().contents[0].path).toBe(PLATFORM_PATH);
  });

  it('resta riservata ai Super Admin di piattaforma', () => {
    expect(findPlatformEntry().requirePlatformAdmin).toBe(true);
  });

  it('ha un nome che la rende trovabile per "workspace", "consumi" e "AI", non solo per "piattaforma"', () => {
    // Nella sidebar il nome non si legge (la voce non si disegna li'), ma la
    // ricerca rapida lo MOSTRA come testo della riga oltre a confrontarlo:
    // allungarlo ancora sporcherebbe una riga visibile di Ctrl+K.
    const name = findPlatformEntry().name.toLowerCase();
    expect(name).toContain('piattaforma');
    expect(name).toContain('workspace');
    expect(name).toContain('consumi');
    expect(name).toContain('ai');
  });
});

// Il 7/8/2026 l'area Produzione AI ha smesso di prendere in prestito modulo e
// permessi dalla Pipeline. Il difetto che questi test presidiano e' subdolo: un
// permesso qui che non combacia con quello che il server chiede non rompe niente
// a vista — mostra la voce, e il 403 arriva solo a chi ci clicca. Prima di questo
// giro due voci chiedevano 'dashboard.view' e una 'modules.manage'.
describe('SidebarMenu — Produzione AI e Pipeline non si scambiano i permessi', () => {
  const findEntry = (path) =>
    SidebarMenu.flatMap((group) => group.contents).find((entry) => entry.path === path);

  const produzioneAi = () => findEntry('/agency/projects');
  const pipeline = () => findEntry('/projects');

  it('la voce principale chiede il modulo e il permesso della Produzione AI', () => {
    expect(produzioneAi().requiredModule).toBe('ai_production');
    expect(produzioneAi().requiredPermission).toBe('ai_production.view');
  });

  it('tutte le sue sottovoci chiedono un permesso della Produzione AI', () => {
    for (const child of produzioneAi().childrens) {
      const chiavi = Array.isArray(child.requiredPermission)
        ? child.requiredPermission
        : [child.requiredPermission];

      for (const chiave of chiavi) {
        expect(chiave.startsWith('ai_production.')).toBe(true);
      }
    }
  });

  it('Impostazioni AI si apre a chi governa la spesa, non solo a chi configura', () => {
    // I due pannelli dentro la pagina seguono permessi diversi: chi ha solo il
    // budget deve poterci arrivare, o riceve un permesso che non puo' esercitare.
    const impostazioni = produzioneAi().childrens.find((child) => child.path === '/agency/settings');
    expect(impostazioni.requiredPermission).toContain('ai_production.manage_settings');
    expect(impostazioni.requiredPermission).toContain('ai_production.manage_budget');
  });

  it('la Pipeline resta sui permessi suoi: e\' un\'altra area, non la stessa', () => {
    expect(pipeline().requiredModule).toBe('projects');
    expect(pipeline().requiredPermission).toBe('projects.view');
  });
});
