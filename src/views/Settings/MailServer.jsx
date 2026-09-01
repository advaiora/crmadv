import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Badge, Button, Card, Col, Form, Row, Spinner } from 'react-bootstrap';
import ModulePermissionGate from '../../components/guards/ModulePermissionGate';
import {
  eliminaImpostazioniMail,
  leggiImpostazioniMail,
  provaServerMail,
  salvaImpostazioniMail,
} from '../../modules/mail/api/mailApi';
import {
  CAMPI_VUOTI,
  campiDaImpostazioni,
  ciSonoModifichePendenti,
} from './mailServerModifiche';
import { AIUTO_RETE_INTERNA, ETICHETTA_RETE_INTERNA, rimandoAllInterruttore } from './mailServerReteInterna';

const MESSAGGIO_ERRORE = (errore, ripiego) => errore?.message || ripiego;

/**
 * Cosa sta usando il CRM adesso per spedire. E' la prima cosa da dire in questa
 * pagina: senza, un workspace che spedisce benissimo con le variabili
 * d'ambiente sembrerebbe non avere nessun server di posta solo perche' nessuno
 * ha ancora compilato questa maschera.
 */
const descriviOrigine = (origine, stato) => {
  // ⚠️ "In pausa" NON è "non configurata", ed è il motivo per cui questa
  // funzione ha bisogno anche dello stato salvato e non della sola origine.
  // Con l'interruttore spento il CRM ripiega sulle variabili d'ambiente,
  // quindi `origineInUso` diventa 'env' o 'nessuna' — e senza questa
  // distinzione la pagina annuncerebbe "nessun server configurato" davanti a
  // una maschera piena e giusta, mandando a riscrivere parametri corretti.
  // È la stessa bugia silenziosa già pagata due volte (server/core/mail.ts).
  const inPausa = Boolean(stato?.configurata) && !stato?.attivo;

  if (origine === 'database') {
    return {
      variante: 'success',
      testo: 'Il CRM sta spedendo con questa configurazione.',
    };
  }

  if (origine === 'env') {
    return {
      variante: 'info',
      testo: inPausa
        ? "La configurazione qui sotto è in pausa: il CRM sta spedendo con i parametri scritti nella configurazione del server (file .env). Per usare quella qui sotto non basta salvarla — riaccendi «Usa questo server per spedire»."
        : "Il CRM sta spedendo con i parametri scritti nella configurazione del server (file .env). Quello che salvi qui prende il posto di quelli.",
    };
  }

  // Il guasto per cui questa pagina serve davvero: i parametri qui sotto sono
  // giusti, non vanno riscritti — è la sola password a non essere più
  // leggibile. Dirlo con parole diverse da "non configurato" è la differenza
  // fra reinserire una password e rifare tutta la configurazione da capo.
  //   ⚠️ Va PRIMA del ramo "in pausa": oggi il backend non decifra nemmeno la
  //   password di una configurazione spenta, quindi i due casi non si
  //   sovrappongono — ma se un domani lo facesse, "la password non si legge
  //   più" è la cosa urgente da dire, non "è in pausa".
  if (origine === 'illeggibile') {
    return {
      variante: 'danger',
      testo:
        "Il server di posta è configurato, ma il CRM non riesce più a leggerne la password: succede quando cambia la chiave di cifratura del server (ENCRYPTION_KEY), o quando il database arriva da un altro ambiente. Finché non reinserisci la password qui sotto e salvi, il CRM non spedisce — e non ripiega sui parametri del file .env, per non mandare email da un mittente che nessuno ha scelto.",
    };
  }

  // Configurazione salvata, messa in pausa, e nemmeno un ripiego nel file
  // .env: il CRM non spedisce, ma non perché manchi una configurazione —
  // perché quella che c'è è spenta. Il rimedio è un interruttore, non una
  // maschera da ricompilare.
  if (inPausa) {
    return {
      variante: 'warning',
      testo:
        "La configurazione qui sotto è in pausa e non ci sono parametri nella configurazione del server (file .env): in questo momento il CRM non spedisce niente — inviti al team e notifiche dei preventivi non vengono recapitati. I parametri sono salvati e intatti: per tornare a spedire riaccendi «Usa questo server per spedire».",
    };
  }

  return {
    variante: 'warning',
    testo:
      "Nessun server di posta configurato: gli inviti al team e le notifiche dei preventivi non vengono recapitati.",
  };
};

/**
 * Su quale server è stata fatta la prova. Va detto sempre, anche quando
 * riesce: con la configurazione in pausa la prova ricade sui parametri del
 * file .env, e un "connessione riuscita" senza questa precisazione farebbe
 * credere collaudato il server appena scritto nella maschera.
 */
const descriviProvato = (esito) => {
  if (!esito?.server) {
    return 'il server di posta';
  }

  if (esito.origine === 'env') {
    return `«${esito.server}», preso dalla configurazione del server (file .env) perché quella salvata qui è in pausa o assente`;
  }

  return `«${esito.server}»`;
};

const MailServerPage = () => {
  const [campi, setCampi] = useState(CAMPI_VUOTI);
  const [password, setPassword] = useState('');
  const [statoSalvato, setStatoSalvato] = useState(null);
  const [caricamento, setCaricamento] = useState(true);
  const [salvataggio, setSalvataggio] = useState(false);
  const [prova, setProva] = useState(false);
  const [eliminazione, setEliminazione] = useState(false);
  const [errore, setErrore] = useState('');
  const [conferma, setConferma] = useState('');
  const [esitoProva, setEsitoProva] = useState(null);

  const applicaStato = (impostazioni) => {
    setStatoSalvato(impostazioni ?? null);
    // Stessa mappatura usata dal confronto delle modifiche pendenti: se le due
    // divergessero, la pagina segnalerebbe modifiche appena aperta.
    setCampi(campiDaImpostazioni(impostazioni));
    setPassword('');
  };

  const carica = async () => {
    setCaricamento(true);
    setErrore('');
    try {
      const payload = await leggiImpostazioniMail();
      applicaStato(payload?.impostazioni);
    } catch (erroreCaricamento) {
      setStatoSalvato(null);
      setErrore(MESSAGGIO_ERRORE(erroreCaricamento, 'Impossibile leggere le impostazioni del server di posta'));
    } finally {
      setCaricamento(false);
    }
  };

  useEffect(() => {
    void carica();
  }, []);

  const origine = useMemo(
    () => descriviOrigine(statoSalvato?.origineInUso ?? 'nessuna', statoSalvato),
    [statoSalvato],
  );

  // La prova gira sul server e il server prova cio' che e' salvato: se la
  // maschera dice altro, chi preme «Prova connessione» deve saperlo prima di
  // leggere l'esito. Vedi mailServerModifiche.js per il perche' del confronto.
  const modifichePendenti = useMemo(
    () => ciSonoModifichePendenti({ campi, statoSalvato, password }),
    [campi, statoSalvato, password],
  );

  const aggiorna = (campo, valore) => {
    setCampi((correnti) => ({ ...correnti, [campo]: valore }));
    setConferma('');
    setEsitoProva(null);
  };

  const onSalva = async (event) => {
    event.preventDefault();
    if (salvataggio) {
      return;
    }

    setSalvataggio(true);
    setErrore('');
    setConferma('');
    setEsitoProva(null);

    try {
      const payload = await salvaImpostazioniMail({
        attivo: campi.attivo,
        server: campi.server.trim(),
        porta: Number(campi.porta),
        connessioneSicura: campi.connessioneSicura,
        // ⚠️ Va nominato SEMPRE, anche da spento: nello schema del server e'
        // `.default(false)` e non `.optional()`, quindi ometterlo non conserva
        // il valore salvato — lo spegne, e la prova ricomincia a rifiutare senza
        // che niente dica perche'. E' la regola OPPOSTA a quella di `password`
        // qui sotto, nello stesso corpo: per questo sta scritto qui.
        retePrivataConsentita: campi.retePrivataConsentita,
        utente: campi.utente.trim() ? campi.utente.trim() : null,
        mittente: campi.mittente.trim(),
        // Il campo lasciato vuoto NON cancella la password gia' salvata: si
        // manda solo se qualcuno ci ha scritto dentro davvero.
        ...(password.length > 0 ? { password } : {}),
      });
      applicaStato(payload?.impostazioni);
      setConferma('Impostazioni salvate. Prova la connessione per sapere se il server le accetta.');
    } catch (erroreSalvataggio) {
      setErrore(MESSAGGIO_ERRORE(erroreSalvataggio, 'Impossibile salvare le impostazioni'));
    } finally {
      setSalvataggio(false);
    }
  };

  const onProva = async () => {
    if (prova) {
      return;
    }

    setProva(true);
    setErrore('');
    setConferma('');
    setEsitoProva(null);

    try {
      const esito = await provaServerMail();
      setEsitoProva(esito ?? null);
    } catch (erroreProva) {
      setErrore(MESSAGGIO_ERRORE(erroreProva, 'Impossibile provare la connessione'));
    } finally {
      setProva(false);
    }
  };

  const onElimina = async () => {
    if (eliminazione) {
      return;
    }

    const messaggio = statoSalvato?.origineInUso === 'database'
      ? 'Elimini la configurazione salvata qui? Il CRM tornerà a spedire con i parametri scritti nella configurazione del server, se ci sono. La password andrà ridigitata.'
      : 'Elimini la configurazione salvata qui? La password andrà ridigitata.';

    if (!window.confirm(messaggio)) {
      return;
    }

    setEliminazione(true);
    setErrore('');
    setConferma('');
    setEsitoProva(null);

    try {
      await eliminaImpostazioniMail();
      await carica();
      setConferma('Configurazione eliminata.');
    } catch (erroreEliminazione) {
      setErrore(MESSAGGIO_ERRORE(erroreEliminazione, 'Impossibile eliminare la configurazione'));
    } finally {
      setEliminazione(false);
    }
  };

  const occupato = salvataggio || prova || eliminazione;

  return (
    <ModulePermissionGate
      requiredModule="mail"
      requiredPermission="mail.manage"
      moduleName="Server di posta"
    >
      <div className="container-fluid page-flat">
        <div className="hk-pg-header pt-7 pb-4">
          <h1 className="pg-title">Server di posta</h1>
          <p>
            Da qui il CRM spedisce gli inviti al team e le notifiche dei preventivi.
          </p>
        </div>

        <div className="hk-pg-body">
          {caricamento && (
            <div className="d-flex align-items-center gap-2 text-muted py-4">
              <Spinner animation="border" size="sm" />
              Caricamento impostazioni...
            </div>
          )}

          {!caricamento && (
            <>
              <Alert variant={origine.variante}>{origine.testo}</Alert>

              {errore && <Alert variant="danger">{errore}</Alert>}
              {conferma && <Alert variant="success">{conferma}</Alert>}

              {esitoProva && (
                <Alert variant={esitoProva.riuscita ? 'success' : 'danger'}>
                  {esitoProva.riuscita
                    ? `Connessione riuscita: ${descriviProvato(esitoProva)} ha accettato le credenziali. Nessuna email è stata spedita.`
                    : `Non è stato possibile provare ${descriviProvato(esitoProva)}: ${esitoProva.errore}${rimandoAllInterruttore(esitoProva)}`}
                </Alert>
              )}

              <Card className="card-border glass-sep">
                <Card.Body>
                  <Form onSubmit={onSalva}>
                    <Row className="g-3">
                      <Col md={8}>
                        <Form.Group controlId="mail-server">
                          <Form.Label>Indirizzo del server</Form.Label>
                          <Form.Control
                            type="text"
                            value={campi.server}
                            onChange={(event) => aggiorna('server', event.target.value)}
                            placeholder="mail.esempio.it"
                            maxLength={255}
                            required
                          />
                        </Form.Group>
                      </Col>

                      <Col md={4}>
                        <Form.Group controlId="mail-porta">
                          <Form.Label>Porta</Form.Label>
                          <Form.Control
                            type="number"
                            value={campi.porta}
                            onChange={(event) => aggiorna('porta', event.target.value)}
                            min={1}
                            max={65535}
                            required
                          />
                          <Form.Text muted>587 nella maggior parte dei casi, 465 con TLS diretto.</Form.Text>
                        </Form.Group>
                      </Col>

                      <Col md={6}>
                        <Form.Group controlId="mail-utente">
                          <Form.Label>Utente</Form.Label>
                          <Form.Control
                            type="text"
                            value={campi.utente}
                            onChange={(event) => aggiorna('utente', event.target.value)}
                            placeholder="noreply@esempio.it"
                            maxLength={255}
                            autoComplete="off"
                          />
                          <Form.Text muted>
                            Lascialo vuoto se il server accetta la posta senza autenticazione.
                          </Form.Text>
                        </Form.Group>
                      </Col>

                      <Col md={6}>
                        <Form.Group controlId="mail-password">
                          <Form.Label>Password</Form.Label>
                          <Form.Control
                            type="password"
                            value={password}
                            onChange={(event) => {
                              setPassword(event.target.value);
                              setConferma('');
                              setEsitoProva(null);
                            }}
                            placeholder={
                              statoSalvato?.passwordSalvata
                                ? '••••••••  (già salvata, lascia vuoto per non cambiarla)'
                                : 'La password della casella'
                            }
                            maxLength={255}
                            autoComplete="new-password"
                          />
                          <Form.Text muted>
                            Viene salvata cifrata e non viene mai rimostrata, nemmeno qui.
                          </Form.Text>
                        </Form.Group>
                      </Col>

                      <Col md={8}>
                        <Form.Group controlId="mail-mittente">
                          <Form.Label>Mittente</Form.Label>
                          <Form.Control
                            type="text"
                            value={campi.mittente}
                            onChange={(event) => aggiorna('mittente', event.target.value)}
                            placeholder="Studio <noreply@esempio.it>"
                            maxLength={255}
                            required
                          />
                          <Form.Text muted>
                            L&apos;indirizzo che vede chi riceve. Puoi anteporre il nome da mostrare.
                          </Form.Text>
                        </Form.Group>
                      </Col>

                      <Col md={4} className="d-flex align-items-center">
                        <Form.Check
                          type="switch"
                          id="mail-connessione-sicura"
                          checked={campi.connessioneSicura}
                          onChange={(event) => aggiorna('connessioneSicura', event.target.checked)}
                          label="TLS diretto (porta 465)"
                        />
                      </Col>

                      <Col xs={12}>
                        <Form.Check
                          type="switch"
                          id="mail-rete-privata-consentita"
                          checked={campi.retePrivataConsentita}
                          onChange={(event) => aggiorna('retePrivataConsentita', event.target.checked)}
                          label={ETICHETTA_RETE_INTERNA}
                        />
                        <div className="small text-muted">{AIUTO_RETE_INTERNA}</div>
                      </Col>

                      <Col xs={12}>
                        <hr className="my-2" />
                        <Form.Check
                          type="switch"
                          id="mail-attivo"
                          checked={campi.attivo}
                          onChange={(event) => aggiorna('attivo', event.target.checked)}
                          label="Usa questo server per spedire"
                        />
                        <div className="small text-muted">
                          Spento, la configurazione resta salvata ma il CRM torna a spedire con i
                          parametri scritti nella configurazione del server.
                        </div>
                      </Col>
                    </Row>

                    <div className="d-flex flex-wrap align-items-center gap-2 mt-4">
                      <Button type="submit" variant="primary" disabled={occupato}>
                        {salvataggio && <Spinner animation="border" size="sm" className="me-2" />}
                        Salva impostazioni
                      </Button>

                      <Button
                        type="button"
                        variant="outline-secondary"
                        onClick={() => void onProva()}
                        disabled={occupato || !statoSalvato?.configurata}
                        aria-describedby={
                          modifichePendenti ? 'mail-modifiche-pendenti' : undefined
                        }
                      >
                        {prova && <Spinner animation="border" size="sm" className="me-2" />}
                        Prova connessione
                      </Button>

                      {statoSalvato?.configurata && (
                        <Button
                          type="button"
                          variant="outline-danger"
                          onClick={() => void onElimina()}
                          disabled={occupato}
                          className="ms-auto"
                        >
                          Elimina configurazione
                        </Button>
                      )}
                    </div>

                    {!statoSalvato?.configurata && (
                      <div className="small text-muted mt-2">
                        Salva le impostazioni per poter provare la connessione.
                      </div>
                    )}

                    {/* Un Alert e non una riga muta come quella qui sopra: quella
                        informa, questa deve fermare la mano prima che si legga
                        un esito riferito ad altri parametri. Il colore arriva da
                        `variant`, cioe' dai token del tema — l'unica classe di
                        testo con abbastanza contrasto in chiaro e in scuro. */}
                    {modifichePendenti && (
                      <Alert
                        id="mail-modifiche-pendenti"
                        variant="warning"
                        className="small mt-3 mb-0"
                      >
                        Hai modifiche non salvate: la prova collauda la configurazione{' '}
                        <strong>salvata</strong>, non quella che vedi qui. Salva prima di
                        provare.
                      </Alert>
                    )}
                  </Form>
                </Card.Body>
              </Card>

              {statoSalvato?.configurata && (
                <div className="d-flex align-items-center gap-2 mt-3 small text-muted">
                  <Badge bg={statoSalvato.attivo ? 'success' : 'secondary'}>
                    {statoSalvato.attivo ? 'In uso' : 'In pausa'}
                  </Badge>
                  {statoSalvato.aggiornatoIl && (
                    <span>
                      Ultima modifica: {new Date(statoSalvato.aggiornatoIl).toLocaleString('it-IT')}
                    </span>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </ModulePermissionGate>
  );
};

export default MailServerPage;
