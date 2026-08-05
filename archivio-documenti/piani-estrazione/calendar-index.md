# Piano di estrazione — `src/views/Calendar/index.jsx`

| | |
|---|---|
| **Righe del file quando il piano è stato scritto** | 807 |
| **Commit di riferimento** | `41bd412` (5/8/2026) |
| **Migrazioni / permessi / rotte nuovi** | nessuno |
| **Test esistenti sul file** | nessuno (si parte da copertura zero) |

> Prima di seguirlo, controlla che il file sia ancora intorno alle 807 righe e che `git log -- src/views/Calendar/index.jsx` non mostri lavoro dopo `41bd412`. Se è cambiato parecchio, rifai il piano invece di seguirlo.

## In breve

Il file mette insieme in un solo componente: sette funzioni pure di formattazione date ed errori, la gestione di FullCalendar (viste, navigazione, trascinamento), le quattro chiamate al server per gli eventi, il form di creazione/modifica e il riquadro di dettaglio. Non cambia niente del contratto esterno: stesso export, stesso percorso, stessa rotta `/apps/calendar`.

## Trappola della cartella — leggere prima di scegliere i nomi

`src/views/Calendar/` contiene **sei file collegati a nulla**, relitti del tema Jampack: `AddCategory.jsx`, `CalendarSidebar.jsx`, `CreateNewEvent.jsx`, `Events.jsx`, `EventsDrawer.jsx`, `SetReminder.jsx`. Nessuno è importato da niente (verificato con due giri di ricerca separati).

Conseguenza pratica: **i file nuovi vanno in una sottocartella dedicata**, `board/`, altrimenti si rischia una collisione di nome con un relitto (un `CalendarSidebar.jsx` nuovo sbatterebbe contro quello morto). E **non chiamarla `events/`**: su Windows i nomi non distinguono maiuscole, e `events/` confliggerebbe con `Events.jsx` lì accanto.

I sei file morti non sono oggetto del giro. Andrebbero segnalati in roadmap come codice morto.

## 1. Blocchi da estrarre

### Costanti e funzioni pure

| blocco | righe origine | destinazione | ~righe |
|---|---|---|---|
| `SOURCE_FILTERS`, `EVENT_SOURCE_BADGE` | 38-50 | `board/boardConstants.js` | 16 |
| `buildDefaultFormState`, `normalizeHexColor`, `toOptionalTrimmedString`, `toLocalDateInput`, `toLocalDateTimeInput`, `parseFormDateValue`, `mapApiError` | 52-164 | `board/boardPureFunctions.js` | 115 |
| logica del "Intera giornata", oggi dentro il JSX | 718-730 | `board/boardPureFunctions.js`, come `applyAllDayToggle(formState, checked)` | +15 |

### Hook

| blocco | righe origine | destinazione | ~righe |
|---|---|---|---|
| `calendarRef`, `visibleRangeRef`, `dateLabel`, `currentView`, `calendarHeight`, navigazione, cambio vista, **la sola metà "vista"** di `handleDatesSet` | 167-171, 188, 250-292 | `board/hooks/useCalendarBoardViewState.js` | 75 |
| `events`, `loading`, `error`, `saving`, `sourceFilters`, `loadEvents`, `reloadVisibleRange`, `filteredEvents`, `upcomingEvents` | 172-186, 197-248 | `board/hooks/useCalendarBoardEvents.js` (riceve i ref per parametro) | 95 |
| `formState`, stato del riquadro, apertura in creazione e in modifica, salvataggio | 177-180, 190-195, 304-406 | `board/hooks/useCalendarBoardEventForm.js` | 120 |
| `selectedEvent`, click sull'evento, selezione di un'area vuota, eliminazione, trascinamento e ridimensionamento | 176, 294-302, 350-360, 408-455 | `board/hooks/useCalendarBoardSelection.js` | 80 |
| composizione dei quattro, più `handleDatesSet` **ricomposto per intero** | — | `board/hooks/useCalendarBoard.js` | 60 |

### Sottocomponenti

| blocco | righe origine | destinazione | ~righe |
|---|---|---|---|
| pannello sinistro: nuovo evento, filtri, prossimi eventi | 534-583 | `board/CalendarFiltersPanel.jsx` | 70 |
| barra in alto: oggi/precedente/successivo, titolo, viste | 588-632 | `board/CalendarToolbar.jsx` | 65 |
| errore, caricamento, il componente FullCalendar | 585-587, 634-662 | `board/CalendarGrid.jsx` | 60 |
| riquadro di creazione/modifica evento | 667-792 | `board/CalendarEventFormModal.jsx` | 145 |
| riquadro di dettaglio evento | 457-520 | `board/CalendarEventDetailsModal.jsx` | 80 |

### Guscio finale

`src/views/Calendar/index.jsx` resta dov'è: il gate dei permessi col calcolo di `canCreate`/`canEdit`/`canDelete` (522-527, invariati), la chiamata a `useCalendarBoard()`, la composizione dei cinque sottocomponenti, e `connect` in fondo (802-807, invariato). Stima 100-115 righe.

## 2. Ordine dei commit

1. `board/boardConstants.js`
2. `board/boardPureFunctions.js` + test
3. `board/hooks/useCalendarBoardViewState.js`
4. `board/hooks/useCalendarBoardEvents.js` (riceve i ref dal 3)
5. `board/hooks/useCalendarBoardEventForm.js`
6. `board/hooks/useCalendarBoardSelection.js` (riceve dal 4 e dal 5)
7. `board/hooks/useCalendarBoard.js` + test — **il test degli hook si scrive una volta sola, sulla radice**, come in tutti e cinque i giri precedenti
8. i cinque sottocomponenti + `board/CalendarBoardPageUi.test.jsx`, in un commit solo
9. riscrittura del guscio + test di cablaggio — ultimo, è l'unico che toglie codice vecchio

## 3. Confini di stato delicati

- **`error` e `saving` sono condivisi, non vanno duplicati per hook.** `error` lo scrivono il caricamento, il salvataggio, l'eliminazione **e** il trascinamento: un solo avviso in cima mostra l'ultimo, da qualunque parte arrivi. `saving` invece è condiviso fra salvataggio ed eliminazione, **ma non** dal trascinamento, che scrive solo l'errore senza spegnere niente. Aggiungere un "sto salvando" al trascinamento cambierebbe ciò che si vede.
- **`calendarRef` e `visibleRangeRef` si creano in un punto solo** (l'hook della vista) e si passano per parametro. Ricrearli nell'hook degli eventi darebbe un riferimento diverso da quello attaccato davvero al calendario.
- **`handleDatesSet` è il punto di giunzione critico.** Nell'originale fa due cose insieme: aggiorna vista ed etichetta, **e** ricarica gli eventi del nuovo periodo. Se le due metà finiscono in hook diversi, la ricomposizione va fatta **esplicitamente** nella radice. È l'unico punto del giro dove un errore sarebbe silenzioso: il calendario cambia mese e mostra ancora gli eventi di quello prima, senza nessun errore.
- **`filteredEvents` e `upcomingEvents` restano derivati**, non diventano stato.
- **Asimmetria da preservare**: il click su un evento lo cerca fra quelli *filtrati*, il trascinamento fra quelli *grezzi*. In pratica danno lo stesso risultato, ma non va uniformata dentro un riordino.
- **`openCreateEventModal` è chiamata da due punti** (bottone "Nuovo evento" e trascinamento su un'area vuota): l'hook della selezione la riceve per parametro, non se ne fa una copia.
- **Ordine da preservare nel passaggio "Modifica"**: il riquadro di dettaglio salva l'evento in una variabile **prima** di chiudersi, e solo dopo apre il form (503-507). Invertendo si perde l'evento.
- **`topNavCollapsed`/`toggleTopNav` sono stato Redux esterno**: restano nel guscio, non entrano nell'hook.
- **`calendarHeight` non è stato**: si ricalcola a ogni render da un hook esterno.
- **I tre permessi restano calcolati nel guscio** e passati come parametro alle azioni, esattamente come oggi: l'hook resta cieco ai permessi.

## 4. Altre trappole

- Nessun test preesistente, né sul frontend né sul backend del calendario: non c'è una rete da cui verificare "non ho cambiato comportamento" — solo la lettura del codice.
- **Le date escono in inglese** ("August 2026"): nel progetto non è caricata nessuna localizzazione italiana di `moment`. È così da prima: **non correggerlo in questo giro**, semmai va in roadmap.
- Le chiamate al server del calendario usano `utils/apiClient` (`apiGet`/`apiPost`/…), **non** `src/lib/apiFetch.ts` come il resto del progetto. Chi scrive i test deve fingere *quel* modulo, con *quel* percorso.
- FullCalendar è usato solo qui: nessun altro punto da tenere allineato, ma nemmeno un precedente su come si monta nei test. Da decidere scrivendo: se il montaggio vero regge, o se serve fingere la libreria.

## 5. Test del giro

- **Funzioni pure**: casi diretti per tutte e otto. In particolare la mappatura degli errori HTTP (400/403/404/409 più il ripiego, ed estrazione dei dettagli di validazione), il parsing di una data non valida (lancia un errore), il colore che ripiega sul valore predefinito.
- **Hook radice**: `renderHook` fingendo le quattro chiamate al server. Casi minimi: caricamento, errore mappato, creazione bloccata dalla validazione, aggiornamento con ricarico e chiusura del riquadro, eliminazione con e senza conferma, trascinamento riuscito e fallito (**verificare che sull'errore venga chiamato `revert()`**), filtro che esclude eventi. **Attenzione**: con `renderHook` non c'è DOM, quindi il riferimento al calendario resta vuoto — va provato il ripiego già presente nell'originale.
- **Sottocomponenti**: un file unico, come nei giri precedenti.
- **Guscio**: fingendo l'hook radice e il gate dei permessi. **Nel progetto non esiste un precedente** di test che finga un gate: va costruito da zero, sapendo che i permessi arrivano come elenco di stringhe in `access.permissions`.

## 6. Librerie e navigazione temporale

FullCalendar con quattro estensioni (mese, settimana, elenco, interazione), `moment` solo per formattare, e un hook esterno per l'altezza della finestra. **Nessuna gestione di fusi orari**: si usa quello del browser.

Lo stato di navigazione temporale può stare in un hook a parte, **ma non può essere staccato dal caricamento eventi**: ogni cambio di periodo deve far ricaricare. È il punto di maggiore attenzione del giro.

**Logica di dominio sulle date: assente.** Niente ricorrenze, niente controllo di sovrapposizioni. Le funzioni pure sono solo formattazione e parsing per i campi data, usate da nessun altro punto del progetto.

## Censimento import

Un solo import diretto del file: `src/routes/RouteList.jsx:23`, montato su `apps/calendar` (`RouteList.jsx:78`). Altri sei punti nominano la **stringa di rotta**, non il modulo: sidebar, barra mobile, titolo pagina, elenco QA responsive, scorciatoie del profilo. Poiché il guscio resta allo stesso percorso con lo stesso export, **nessuno dei sei va toccato**.

## Cosa l'esploratore non ha controllato

- Non ha verificato a runtime il comportamento degli eventi di FullCalendar: la lettura è statica.
- Non sa se il montaggio vero di FullCalendar regga nei test o se serva fingerlo.
- La nota sulla duplicazione minore delle conversioni di data con `views/WebAssets/index.jsx` viene da una ricerca mirata, non da un confronto riga per riga.
- Non ha cercato in modo dedicato un eventuale salvataggio di preferenze del calendario nel browser (dal codice letto non ce n'è traccia).
