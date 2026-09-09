// Logica PURA di lettura della variabile `TRUST_PROXY`. Sta qui accanto a
// `cors-origins.ts` per lo stesso motivo di quella: e' una regola di sicurezza
// che si legge all'avvio, e tenerla dentro `app.ts` la renderebbe provabile
// solo accendendo tutta l'applicazione (rotte, Prisma, database).

/**
 * Se e da chi ci si lascia dire qual e' l'indirizzo IP del chiamante.
 *
 * ⚠️ Il valore predefinito e' «non fidarsi di nessuno», ed e' la scelta sicura:
 * `X-Forwarded-For` la scrive il client, quindi finche' l'API riceve traffico
 * diretto l'unico indirizzo vero e' quello della presa di rete. Da questo
 * dipendono tutti i limiti di frequenza per IP — quelli di
 * `@fastify/rate-limit` sulle rotte pubbliche del recupero password e quelli
 * costruiti su `resolveRequestClientIp` — e la colonna
 * `PasswordResetToken.requestIp`.
 *
 * ⚠️ Ma se l'API finisce dietro un reverse proxy (nginx, Caddy, un
 * bilanciatore) e questa variabile resta vuota, quei limiti smettono di
 * distinguere i chiamanti: ogni richiesta risultera' provenire dal proxy, cioe'
 * da un solo indirizzo, e il primo che supera il tetto chiude la porta a tutti.
 * Va impostata NELLO STESSO momento in cui si mette un proxy davanti.
 *
 * Valori accettati, dal piu' sicuro al meno:
 *  - un elenco di indirizzi/sottoreti fidate (`"10.0.0.1,192.168.1.0/24"`);
 *  - un numero, quanti hop fidati ci sono davanti (`"1"` con un solo proxy);
 *  - `"true"`, che si fida di CHIUNQUE dichiari un `X-Forwarded-For` e quindi
 *    rende di nuovo falsificabili tutti i limiti per IP: da usare solo se il
 *    proxy e' l'unica strada per raggiungere l'API.
 */
export const parseTrustProxy = (rawValue: string | undefined): boolean | string | number => {
  const raw = rawValue?.trim();
  if (!raw) {
    return false;
  }

  const normalized = raw.toLowerCase();
  if (normalized === 'false' || normalized === '0' || normalized === 'no') {
    return false;
  }

  if (normalized === 'true' || normalized === 'yes') {
    return true;
  }

  if (/^\d+$/.test(normalized)) {
    return Number.parseInt(normalized, 10);
  }

  return raw;
};
