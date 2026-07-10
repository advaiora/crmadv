# Idee fuori roadmap (parcheggio)

> Questo file **non è la roadmap** e **non impegna nessuna versione programmata** (V1…V9).
> È un parcheggio di idee potenziali, da valutare/concordare in futuro tra Jacopo e Claudio
> prima di eventualmente promuoverle a lavoro pianificato. Aggiungere in fondo, con data.

---

## Marketplace / connettore generico per integrazioni "self-service"

**Data:** 9 luglio 2026 — proposta da Jacopo.

**Idea:** un meccanismo per **aggiungere nuove integrazioni senza toccare il codice** — es. un pulsante "Aggiungi plug-in" dall'interfaccia — così l'utente finale può collegare servizi terzi che *non erano stati codificati prima*.

**Perché è "fuori roadmap":** ad oggi (roadmap + bibbia) è previsto solo un **API framework a plugin lato-sviluppatore** (aggiungere un connettore = scrivere un piccolo modulo, come `server/modules/integrations/connectors/brevo.ts`). Il layer integrazioni base + Brevo è già fatto (V3). Un vero marketplace no-code è invece una **scelta di prodotto nuova**, non pianificata.

**Direzioni possibili se un giorno la si vuole (da valutare):**
- Connettore **generico webhook** (in/out) configurabile da UI: URL, metodo, header/segreti, mappatura campi.
- Integrazione con **Zapier / Make** come "ponte" verso migliaia di app senza scrivere connettori uno a uno.
- Definizione di connettori via **manifest/JSON** (endpoint, auth, mappatura) interpretati a runtime, invece che via codice.

**Nota tecnica:** la base attuale (`Integration` per workspace + segreti cifrati con la DEK del vault) è già un buon punto di partenza per estendere in questa direzione, se e quando si deciderà.
