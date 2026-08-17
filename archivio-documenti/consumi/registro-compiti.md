# Registro per compito

> Una riga per ogni pezzo di lavoro concluso, scritta da `npm run consumi:compito -- "<nome>"`.
> Per default conta la sessione in corso; con `--da 10:30` si parte da un'ora precisa, e con
> `--da "2026-07-31T07:40Z" --a "2026-07-31T08:26Z"` si annota un lavoro già concluso.
>
> **A cosa serve:** confrontare lavori SIMILI fra loro — per esempio i giri di spezzatura
> dei file-mostro — per capire se chiamare l'esploratore conviene. Non serve un periodo
> "senza agenti": le sessioni variano troppo per tipo di lavoro, la differenza sparirebbe
> nel rumore. Si confronta a parità di compito.
>
> Il consumo è in "unità": un indicatore di quanto si è mangiato della finestra, non una spesa.
> Le ore sono quelle del computer. Consumo e risparmio sono misurati sullo **stesso pezzo di
> tempo**: il risparmio di un agent chiamato a fine compito risulta quindi piccolo o negativo,
> perché le riletture che avrebbe evitato cadono nel compito dopo. Vale soprattutto per il
> revisore, che per contratto si chiama in chiusura — e che comunque non si tiene per far
> risparmiare token, ma per trovare errori.
>
> La **velocità** (unità/min = consumo/durata) risponde alle domande di capacità della finestra
> (rate × durata contro le 5 ore). NON giudica gli agent: il parallelismo alza le unità/min
> anche quando abbassa le unità totali (registro decisioni, team-agenti.md, 4/8/2026).
>
> Le prime tre righe sono state **ricostruite il 3/8/2026** dai registri del 31/7, delimitando
> i tre giri con l'ora dei rispettivi commit **al secondo** (`c2bb49d` 08:26:40Z, `05d1a24`
> 08:57:45Z, `bbcfd62` 09:58:57Z, a partire da 07:40:00Z). I secondi contano: arrotondando al
> minuto i numeri cambiano di qualche decimo. Se una riga va ricontrollata, si rifà con quegli
> stessi estremi — ed è una buona abitudine annotare gli estremi usati quando non coincidono
> con la sessione intera.

| quando | compito | durata | consumo | velocità (unità/min) | agenti usati | risparmio agenti |
|---|---|---:|---:|---:|---|---:|
| 2026-07-31 10:26 | Spezzatura ClientsList, giro 1 (896→703 righe) | 47 min | 38,8 | 0,83 | esploratore×1, revisore×1 | 6,1 |
| 2026-07-31 10:57 | Spezzatura ClientsList, giro 2 (703→476 righe) | 31 min | 23,5 | 0,76 | revisore×1 | -0,4 |
| 2026-07-31 11:58 | Spezzatura ProjectPipelineSettings, giro 1 (1148→975 righe) | 1h 01m | 31,8 | 0,52 | esploratore×1, revisore×1 | 2,7 |
| 2026-08-03 13:07 | Monitor consumi: report in italiano + bilancio agent calcolato | 2h 32m | 39,1 | 0,26 | revisore×3 | 2,4 |
| 2026-08-03 14:36 | Spezzatura ProjectPipelineSettings, giro 2 (975→492 righe) + convergenza duplicati | 1h 22m | 42,2 | 0,51 | esploratore×2, revisore×2 | 12,0 |
| 2026-08-03 15:07 | Spezzatura consumi.mjs in moduli (1.082→113 + 12 moduli, 48 test) | 28 min | 22,0 | 0,79 | revisore×1 | 0,2 |
| 2026-08-03 15:49 | Riordino pipeline giro 3: rinomina pipeline.utils | 20 min | 9,2 | 0,46 | nessuno | — |
| 2026-08-03 17:05 | Riordino pipeline giro 3: PipelineSettingsContent sotto soglia | 1h 16m | 47,4 | 0,62 | revisore×1 | 0,4 |
| 2026-08-03 17:51 | Fix selezione categoria appena creata (refetch a consegna dati) | 45 min | 34,9 | 0,78 | revisore×1 | 0,2 |
| 2026-08-04 11:07 | Fix gemello selezione Memo + analisi architetto + suite su threads (A+B) — lavori in parallelo, non separabili; ~61 min della durata sono i 5 giri di test (18+27 min i due giri a fork falliti per worker morti, 12 min il giro verde finale) | 1h 55m | 47,4 | 0,41 | architetto×1, revisore×1 | 2,7 |
| 2026-08-04 11:50 | Monitor consumi: colonna e righe velocità (unità/min) | 42 min | 19,1 | 0,45 | revisore×1 | -0,5 |
| 2026-08-04 12:43 | Esclusione antivirus: applicazione, misura e note | 53 min | 12,8 | 0,24 | nessuno | — |
| 2026-08-04 14:59 | Blocco Agency: spezzatura AgencyProjectWebPage chiusa (890→161) + Ads estratto per tre quarti (manca la riscrittura della pagina) — una riga sola perché la finestra misurata copre entrambi; ~35 min sono giri di test | 2h 10m | 36,9 | 0,28 | esploratore×2, revisore×1 | 14,9 |
| 2026-08-04 15:47 | Spezzatura AgencyProjectAdsPage - riscrittura pagina (ultimo passo) | 42 min | 9,6 | 0,23 | revisore×1 | -0,8 |
| 2026-08-05 10:57 | spezzatura AgencySettingsPage 739->83 | 1h 41m | 28,5 | 0,28 | esploratore×2, revisore×1 | 5,2 |
| 2026-08-05 12:13 | spezzatura ChecklistTemplates 877->127 | 2h 56m | 55,9 | 0,32 | esploratore×7, revisore×1 | 16,1 |
| 2026-08-05 14:12 | Chiusura giro Memo Operativi (revisore + rilievi) e spezzatura Calendar 807-120 | 1h 51m | 46,3 | 0,42 | revisore×2 | 6,2 |
| 2026-08-05 15:20 | Decisioni di metodo: censimento dimensione file di tutte le tipologie, nascita V13, correzione regola handoff | 1h 05m | 16,2 | 0,25 | nessuno | — |
| 2026-08-06 11:16 | Re-naming aree fase A (Piattaforma, Produzione AI, Pipeline) + fusione Diagnosis in Da risolvere | 1h 45m | 21,5 | 0,20 | esploratore×1 | -0,6 |
| 2026-08-06 13:46 | Re-naming: rimozione tre schede + rimandi + gergo dai titoli (lavoro in autonomia /vado) | 55 min | 23,2 | 0,42 | esploratore×1 | -0,4 |
| 2026-08-06 15:18 | Re-naming fase A: barra a quattro gruppi, pallini di priorita e rifiniture | 1h 31m | 37,8 | 0,42 | nessuno | — |
| 2026-08-07 11:39 | Re-naming fase A: coda + gruppo B completo | 20h 07m | 82,8 | 0,07 | esploratore×1, revisore×2 | 39,6 |
| 2026-08-07 13:58 | Re-naming fase A: gruppo B completo + revisione | 22h 26m | 94,5 | 0,07 | esploratore×1, revisore×2 | 44,8 |
| 2026-08-07 18:13 | Fase A2 re-naming: modulo permessi Produzione AI + italianizzazione catalogo | 3h 10m | 73,8 | 0,39 | esploratore×1, revisore×2 | 25,3 |
| 2026-08-17 11:00 | Chiusura rilievi fase A2 re-naming (descrizioni permessi, commenti falsi, roadmap) | 232h 48m | 47,9 | 0,00 | esploratore×1, Explore×6, revisore×1 | -4,6 |
