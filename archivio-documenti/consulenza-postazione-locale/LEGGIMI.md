<!-- AMBITO-DOCUMENTO: consulenza-postazione-locale -->

> # ⛔ Questa cartella non riguarda lo sviluppo del CRM
>
> **Chiave d'ambito:** `AMBITO-DOCUMENTO: consulenza-postazione-locale`
>
> **Vale solo per:** le sessioni dell'assistente che girano sul **PC Windows di Jacopo**, dentro un clone locale di questo repository, con ruolo di **consulenza** — leggere il codice, ragionare, preparare i testi dei compiti da affidare a Paperclip, verificare cosa è tornato indietro.
>
> **NON vale per:** l'assistente che sviluppa il CRM **dentro Paperclip, sulla VPS**. Se stai scrivendo codice, aprendo rami o facendo commit su questo repository, **niente di quanto sta qui dentro ti riguarda**: non leggerlo come regola, non applicarlo, non aggiornarlo, non citarlo, non tenerne conto nelle tue decisioni. Passa oltre.
>
> **Come sai in quale dei due casi sei, senza doverlo chiedere a nessuno:** se il sistema operativo è **Linux** e la cartella di lavoro sta sulla VPS → sei lo sviluppo, **ignora**. Se il sistema è **Windows** e la cartella sta sotto `C:\Users\jacop\` → sei la consulenza, **questi documenti sono per te**.

---

## Cosa c'è qui dentro, e perché è separato

Questi documenti descrivono **come lavora una postazione**, non come si lavora al CRM. Sono cose vere e utili in un solo contesto — il PC di Jacopo — e **false o dannose se applicate altrove**.

L'esempio che ha fatto nascere la cartella: `come-stanno-le-cose.md` contiene la frase *«in questa fase l'assistente non scrive nel repository»*. È corretta per la postazione locale, dove il ruolo è consulenziale. Sarebbe **disastrosa** se la leggesse e la applicasse l'assistente di Paperclip, che il codice lo deve scrivere per mestiere. Un documento del genere non può stare in mezzo agli altri.

## La regola in tre punti

1. **Un documento che serve solo alla postazione locale sta qui**, non in `archivio-documenti/` insieme agli altri.
2. **Porta in cima la riga d'ambito** `<!-- AMBITO-DOCUMENTO: consulenza-postazione-locale -->` e il riquadro qui sopra. Doppia protezione: chi arriva dal percorso lo capisce dalla cartella, chi ci arriva aprendo il file lo capisce dalla prima riga.
3. **I documenti condivisi restano condivisi e non si sporcano.** In particolare `archivio-documenti/note-operative-ai.md` continua a valere per tutti: le note che riguardano solo la postazione locale vanno in `note-operative-locali.md`, qui dentro. Oltre al motivo di ambito ce n'è uno pratico: le note del file condiviso sono numerate in sequenza, e due contesti che ci aggiungono voci in parallelo si scontrerebbero sullo stesso numero.

## L'indice

| File | Cosa contiene |
|---|---|
| `come-stanno-le-cose.md` | Dove vive lo sviluppo oggi, com'è messo il clone locale, qual è il ruolo dell'assistente sulla postazione |
| `note-operative-locali.md` | Errori operativi che capitano solo su questa postazione (Windows, PowerShell, i due terminali) |
