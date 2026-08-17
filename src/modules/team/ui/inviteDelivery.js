/**
 * Come si racconta a schermo l'esito di un invito.
 *
 * Fino al 17/8/2026 il CRM diceva sempre "Invito creato con successo", anche
 * quando l'email non partiva affatto: chi invitava restava convinto di aver
 * fatto il suo, e la persona invitata non riceveva niente. Qui l'esito reale
 * diventa un messaggio, uno per ogni causa possibile.
 */

export const INVITE_DELIVERY_TONE = {
  ok: 'ok',
  warning: 'warning',
};

const EMAIL_NOT_SENT = "L'invito è stato creato, ma l'email non è partita";

const FAILURE_MESSAGES = {
  MAIL_NOT_CONFIGURED: {
    title: EMAIL_NOT_SENT,
    detail:
      'Il server di posta non è ancora configurato. Copia il link qui sotto e mandalo tu, oppure configura il server di posta nelle impostazioni.',
  },
  SEND_FAILED: {
    title: EMAIL_NOT_SENT,
    detail:
      'Il server di posta ha rifiutato il messaggio. Copia il link qui sotto e mandalo tu; controlla poi i parametri del server di posta.',
  },
  INVITE_LINK_UNAVAILABLE: {
    title: "L'invito è stato creato, ma non è utilizzabile",
    detail:
      "Il CRM non sa a quale indirizzo pubblico risponde, quindi non ha potuto comporre il link di accettazione. Va indicato nella configurazione del server (variabile APP_BASE_URL) prima di invitare qualcuno.",
  },
};

const UNKNOWN_FAILURE = {
  title: EMAIL_NOT_SENT,
  detail: 'Copia il link qui sotto e mandalo tu.',
};

/**
 * @param {{ emailSent?: boolean, reason?: string }|null|undefined} delivery
 * @param {{ hasLink?: boolean }} [options]
 */
export const describeInviteDelivery = (delivery, options = {}) => {
  const hasLink = Boolean(options.hasLink);

  // Una risposta senza esito arriva solo da un CRM piu' vecchio di questo
  // codice: si preferisce non dire nulla piuttosto che dire una cosa falsa.
  if (!delivery || typeof delivery.emailSent !== 'boolean') {
    return {
      tone: INVITE_DELIVERY_TONE.ok,
      title: 'Invito creato',
      detail: '',
      showLink: hasLink,
    };
  }

  if (delivery.emailSent) {
    return {
      tone: INVITE_DELIVERY_TONE.ok,
      title: 'Invito creato, email inviata',
      detail: '',
      showLink: false,
    };
  }

  const message = FAILURE_MESSAGES[delivery.reason] ?? UNKNOWN_FAILURE;

  return {
    tone: INVITE_DELIVERY_TONE.warning,
    title: message.title,
    detail: message.detail,
    showLink: hasLink,
  };
};
