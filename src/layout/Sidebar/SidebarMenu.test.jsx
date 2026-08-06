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
