import { describe, expect, it } from 'vitest';
import { findActiveModuleWithTabs } from './menuUtils';

// Regressione CRMA-32: "Branding Workspace" e' stata promossa da sottovoce di
// "Profilo" a voce a se' nel gruppo "Impostazioni", ma il suo path resta sotto
// "/pages/", lo stesso prefisso usato da "Profilo" come contenitore. Senza il
// controllo sulla voce a percorso esatto, ModuleTabs mostrerebbe la barra di
// schede di Profilo (nessuna attiva) su una pagina che a Profilo non appartiene
// piu'.
describe('findActiveModuleWithTabs — una voce a percorso esatto vince sul prefisso di un contenitore', () => {
  const profilo = {
    name: 'Profilo',
    path: '/pages',
    childrens: [
      { name: 'Il Mio Profilo', path: '/pages/profile' },
      { name: 'Modifica Profilo', path: '/pages/edit-profile' },
    ],
  };

  const brandingWorkspace = {
    name: 'Branding Workspace',
    path: '/pages/workspace-branding',
  };

  const menuGroups = [
    { group: 'Impostazioni', contents: [brandingWorkspace] },
    { group: 'Account', contents: [profilo] },
  ];

  it('una voce senza sottoschede sul suo path esatto non prende le schede di un\'altra area', () => {
    expect(findActiveModuleWithTabs(menuGroups, '/pages/workspace-branding')).toBeNull();
  });

  it('le pagine vere di Profilo continuano a mostrare le sue schede', () => {
    expect(findActiveModuleWithTabs(menuGroups, '/pages/profile')).toBe(profilo);
  });

  it('un sotto-percorso non elencato di Profilo resta comunque suo (comportamento preesistente)', () => {
    expect(findActiveModuleWithTabs(menuGroups, '/pages/qualcosa-non-elencato')).toBe(profilo);
  });
});
