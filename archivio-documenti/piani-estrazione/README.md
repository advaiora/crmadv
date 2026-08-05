# Piani di estrazione dei file .jsx grossi

Qui stanno i **piani preparati in anticipo** per spezzare i file grossi del frontend, uno per file. Li produce l'agent *esploratore*; la sessione principale li scrive qui perché gli agent non possono scrivere file, e senza questo passaggio il piano morirebbe con la sessione che l'ha chiesto.

## A cosa servono

Il giro di spezzatura di un file-mostro costa parecchio tempo, e la parte più delicata è **capire cosa estrarre e in che ordine** senza rompere comportamenti che sembrano difetti e non lo sono. Avere il piano già pronto quando si arriva al file taglia quella parte.

Servono anche a Claudio: sono committati, quindi passano da una persona all'altra come l'handoff.

## Come si leggono

Ogni piano ha in testa un riquadro con **il numero di righe del file** e **il commit** a cui il piano si riferisce.

> **Prima di seguire un piano, controlla quel riquadro.** Se il file nel frattempo è cambiato di parecchio (righe molto diverse, oppure `git log` mostra lavoro su quel file dopo quel commit), il piano va rifatto invece che seguito: i riferimenti alle righe non tornerebbero più.

Un piano **non è un ordine**. È il risultato di una lettura statica del codice, fatta da chi non l'ha eseguito: contiene sempre una sezione *"cosa non ho controllato"*, e va letta.

## Metodo del giro (promemoria)

Sta in `CLAUDE.md`, sezione «Frontend `.jsx` — regole di manutenzione». In breve: `npm run mappa` → si estrae in un giro solo, **committando per estrazione** → verifica in anteprima → **revisore una volta sola, a giro completo** → commit di chiusura → `npm run consumi:compito`.

## Quando un piano si butta

Quando il file è stato spezzato: il piano ha finito il suo lavoro e il codice nuovo racconta già la storia. Si cancella il file da questa cartella nello stesso commit che chiude il giro, così qui resta solo ciò che è ancora da fare.
