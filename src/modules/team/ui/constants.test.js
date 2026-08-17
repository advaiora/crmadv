import { describe, expect, it } from 'vitest';
import { canActOnInvitePreset, invitableRolePresets } from './constants.js';

describe('invitableRolePresets', () => {
  it('al Superadmin offre tutti i ruoli, compreso il proprio', () => {
    expect(invitableRolePresets(['Superadmin'])).toEqual([
      'Superadmin',
      'Admin',
      'Manager',
      'Operativo',
      'Viewer',
    ]);
  });

  it('al Manager offre il proprio ruolo e quelli sotto, mai Admin o Superadmin', () => {
    const roles = invitableRolePresets(['Manager']);

    expect(roles).toEqual(['Manager', 'Operativo', 'Viewer']);
    expect(roles).not.toContain('Admin');
    expect(roles).not.toContain('Superadmin');
  });

  it('al Viewer offre solo Viewer', () => {
    expect(invitableRolePresets(['Viewer'])).toEqual(['Viewer']);
  });

  it('usa il ruolo piu alto quando la persona ne ha piu di uno', () => {
    expect(invitableRolePresets(['Viewer', 'Admin', 'Operativo'])).toEqual([
      'Admin',
      'Manager',
      'Operativo',
      'Viewer',
    ]);
  });

  it('non offre niente a chi non ha un ruolo di sistema riconosciuto', () => {
    expect(invitableRolePresets([])).toEqual([]);
    expect(invitableRolePresets(undefined)).toEqual([]);
    expect(invitableRolePresets(['RuoloPersonalizzato'])).toEqual([]);
  });
});

describe('canActOnInvitePreset', () => {
  it('lascia agire sul proprio livello e su quelli sotto', () => {
    expect(canActOnInvitePreset(['Manager'], 'Manager')).toBe(true);
    expect(canActOnInvitePreset(['Manager'], 'Viewer')).toBe(true);
  });

  it('blocca su un invito destinato a un ruolo piu alto', () => {
    expect(canActOnInvitePreset(['Manager'], 'Admin')).toBe(false);
    expect(canActOnInvitePreset(['Manager'], 'Superadmin')).toBe(false);
  });

  it('nel dubbio blocca: ruolo dell invito sconosciuto o attore senza ruolo', () => {
    expect(canActOnInvitePreset(['Superadmin'], 'RuoloMaiVisto')).toBe(false);
    expect(canActOnInvitePreset(['Superadmin'], undefined)).toBe(false);
    expect(canActOnInvitePreset([], 'Viewer')).toBe(false);
  });
});
