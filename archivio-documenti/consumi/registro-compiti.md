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
> Le prime tre righe sono state **ricostruite il 3/8/2026** dai registri del 31/7, delimitando
> i tre giri con l'ora dei rispettivi commit **al secondo** (`c2bb49d` 08:26:40Z, `05d1a24`
> 08:57:45Z, `bbcfd62` 09:58:57Z, a partire da 07:40:00Z). I secondi contano: arrotondando al
> minuto i numeri cambiano di qualche decimo. Se una riga va ricontrollata, si rifà con quegli
> stessi estremi — ed è una buona abitudine annotare gli estremi usati quando non coincidono
> con la sessione intera.

| quando | compito | durata | consumo | agenti usati | risparmio agenti |
|---|---|---:|---:|---|---:|
| 2026-07-31 10:26 | Spezzatura ClientsList, giro 1 (896→703 righe) | 47 min | 38,8 | esploratore×1, revisore×1 | 6,1 |
| 2026-07-31 10:57 | Spezzatura ClientsList, giro 2 (703→476 righe) | 31 min | 23,5 | revisore×1 | -0,4 |
| 2026-07-31 11:58 | Spezzatura ProjectPipelineSettings, giro 1 (1148→975 righe) | 1h 01m | 31,8 | esploratore×1, revisore×1 | 2,7 |
| 2026-08-03 13:07 | Monitor consumi: report in italiano + bilancio agent calcolato | 2h 32m | 39,1 | revisore×3 | 2,4 |
| 2026-08-03 14:36 | Spezzatura ProjectPipelineSettings, giro 2 (975→492 righe) + convergenza duplicati | 1h 22m | 42,2 | esploratore×2, revisore×2 | 12,0 |
