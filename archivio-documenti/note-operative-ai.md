# Note operative AI — errori da non ripetere

> Documento di **auto-miglioramento** dell'assistente AI. Raccoglie modi sbagliati di eseguire operazioni ricorrenti (verifiche, avvii, comandi) e il modo corretto per non ripeterli.
>
> **Regola:** l'AI aggiorna questo file **in autonomia**, senza che glielo si chieda, ogni volta che individua un proprio procedimento inefficiente o errato. Va letto a inizio sessione (è richiamato in `CLAUDE.md`).
>
> Ogni voce è breve e azionabile: **Contesto → Errore → Modo corretto**.

---

## 1. Verifica visiva nell'anteprima: non ricaricare a raffica

**Contesto:** verifica di una modifica avviando l'anteprima locale (`preview_start` + controllo della pagina).

**Errore:** ricaricare / ri-navigare la pagina ripetutamente (`window.location.reload()`, riassegnare `location.href`) mentre sta ancora caricando. Ogni reload **interrompe** il caricamento in corso (errori `ERR_ABORTED`), trasformando un'attesa di ~10 secondi in decine di tentativi falliti e minuti persi.

**Modo corretto:**
- Dopo `preview_start`, **prima** guardare i log del server. Se compare `re-optimizing dependencies` (Vite, tipico al primo avvio di sessione o dopo un `npm install`), Vite ricaricherà **da solo** la pagina a fine ottimizzazione: **aspettare, non ricaricare**.
- Al primo avvio mettere in conto ~10 s una tantum (ready di Vite + eventuale ri-ottimizzazione dipendenze).
- Fare **un solo** controllo dopo un'attesa adeguata, non un ciclo reload–controlla–reload.
- Se serve davvero ricaricare, farlo **una volta sola** e poi attendere che `document.readyState === 'complete'` **e** che il nodo root sia montato (es. `#root` con figli), invece di controllare subito.
