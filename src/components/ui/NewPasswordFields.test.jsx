import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import NewPasswordFields from './NewPasswordFields';

const monta = (props = {}) =>
  render(
    <NewPasswordFields
      idPrefix="prova-password"
      newPassword=""
      confirmPassword=""
      onChangeNewPassword={vi.fn()}
      onChangeConfirmPassword={vi.fn()}
      {...props}
    />,
  );

describe('NewPasswordFields', () => {
  it('rende i due campi con le etichette in italiano', () => {
    monta();
    expect(screen.getByLabelText('Password nuova')).toBeInTheDocument();
    expect(screen.getByLabelText('Ripeti la password nuova')).toBeInTheDocument();
  });

  it('dice quanti caratteri servono, leggendoli dalla regola condivisa', () => {
    monta();
    expect(screen.getByText('Almeno 8 caratteri.')).toBeInTheDocument();
  });

  it('riporta il valore digitato a chi lo gestisce', () => {
    const onChangeNewPassword = vi.fn();
    monta({ onChangeNewPassword });

    fireEvent.change(screen.getByLabelText('Password nuova'), {
      target: { value: 'passwordnuova' },
    });

    expect(onChangeNewPassword).toHaveBeenCalledWith('passwordnuova');
  });

  it('mostra gli errori per campo', () => {
    monta({ errors: { newPassword: 'Troppo corta', confirmPassword: 'Non coincidono' } });

    expect(screen.getByText('Troppo corta')).toBeInTheDocument();
    expect(screen.getByText('Non coincidono')).toBeInTheDocument();
  });

  it('separa gli identificativi con il prefisso, cosi\' due maschere possono convivere', () => {
    const { container } = monta({ idPrefix: 'recupero' });
    expect(container.querySelector('#recupero-nuova')).not.toBeNull();
    expect(container.querySelector('#recupero-conferma')).not.toBeNull();
  });
});
