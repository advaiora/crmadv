import React from 'react';
import { Form } from 'react-bootstrap';
import { MIN_PASSWORD_LENGTH } from '../../lib/passwordRules';

// I due campi «Password nuova» + «Ripeti la password nuova», identici ovunque si
// scelga una password: nel cambio password di Impostazioni Account e nella pagina
// di recupero. Stanno insieme perche' sono una cosa sola — la seconda esiste solo
// per controllare la prima — e perche' scritti due volte le due etichette, il
// testo d'aiuto e il minimo di caratteri divergono in silenzio.
//
// Nessun colore: tutto passa dai componenti Bootstrap standard, gia' rimappati
// sui token in `globals.css`, quindi chiaro e scuro funzionano da soli.

const NewPasswordFields = ({
  idPrefix,
  newPassword,
  confirmPassword,
  errors = {},
  onChangeNewPassword,
  onChangeConfirmPassword,
}) => {
  const helpId = `${idPrefix}-nuova-aiuto`;

  return (
    <>
      <Form.Group className="mb-3" controlId={`${idPrefix}-nuova`}>
        <Form.Label>Password nuova</Form.Label>
        <Form.Control
          type="password"
          value={newPassword}
          onChange={(event) => onChangeNewPassword(event.target.value)}
          isInvalid={Boolean(errors.newPassword)}
          autoComplete="new-password"
          aria-describedby={helpId}
        />
        <Form.Control.Feedback type="invalid">{errors.newPassword}</Form.Control.Feedback>
        <Form.Text id={helpId}>{`Almeno ${MIN_PASSWORD_LENGTH} caratteri.`}</Form.Text>
      </Form.Group>

      <Form.Group className="mb-3" controlId={`${idPrefix}-conferma`}>
        <Form.Label>Ripeti la password nuova</Form.Label>
        <Form.Control
          type="password"
          value={confirmPassword}
          onChange={(event) => onChangeConfirmPassword(event.target.value)}
          isInvalid={Boolean(errors.confirmPassword)}
          autoComplete="new-password"
        />
        <Form.Control.Feedback type="invalid">{errors.confirmPassword}</Form.Control.Feedback>
      </Form.Group>
    </>
  );
};

export default NewPasswordFields;
