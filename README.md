# PokéCalcio — prototipo

Manageriale di calcio a 5 con i Pokémon: carriera salvata nel browser, formazione, allenamento e partite in 2D.

```bash
npm install
npm run dev        # http://localhost:5173
npm run sim -- 300 # simula 300 partite CPU vs CPU e stampa le medie (bilanciamento)
npm run career -- 10  # simula 10 carriere sulla mappa: livello d'arrivo, tentativi e grinding per palestra
npm run import-pokedex -- /cartella/csv  # rigenera src/data/pokedex.json dai CSV di PokeAPI
```

## Dati

Tutte le 1025 specie (Gen 1–9, forma standard) vengono dai CSV di [PokeAPI](https://github.com/PokeAPI/pokeapi/tree/master/data/v2/csv), che riportano le stesse statistiche di Bulbapedia. Servono `pokemon`, `pokemon_stats`, `pokemon_types`, `types`, `pokemon_species`, `pokemon_evolution`, `pokemon_species_names`, `languages` ed `evolution_triggers`. Per ogni specie ci sono: nome italiano, tipi, statistiche base, altezza, generazione, tasso di cattura, leggendario/misterioso e la lista delle evoluzioni (anche ramificate, es. Eevee).

Livello di evoluzione in partita: se nei giochi si evolve di livello si usa quello; per pietre, scambio, amicizia ecc. è stimato dalla potenza della forma evoluta (10 + 0.12 · (somma statistiche − 250)), sempre almeno 5 livelli dopo lo stadio precedente. Con più rami in partita si sceglie con ⇄; la CPU sceglie il più forte.

## Carriera

- **Mappa di Kanto** (`src/game/kanto.ts`): 35 luoghi come in Rosso/Blu, cioè città, percorsi, Bosco Smeraldo, Monte Luna, Tunnel Roccioso, Torre Pokémon, Zona Safari, Isole Spumarine, Via Vittoria e Altopiano Blu. Ci si sposta nei luoghi vicini; le medaglie aprono le zone come nei giochi (sotterranei compresi) e dalla Medaglia Tuono si vola nelle città già visitate. Ogni palestra si sfida nella sua città, la Lega all'Altopiano Blu.
- **Percorsi**: ogni luogo ha i Pokémon selvatici della zona (in forma base) e uno o più allenatori iconici da battere una volta: i Pigliamosche del Bosco, il Team Rocket, i Karateka del Dojo, i Nuotatori e il rivale Blu nei punti della storia. La partitella con i selvatici, ripetibile, serve anche per fare un po' di grinding. Il livello degli allenatori sale tra una palestra e l'altra.
- **Esperienza in base al livello dell'avversario**: un avversario di livello più alto rende di più, uno più debole molto meno. Così seguendo i percorsi si arriva a ogni palestra 1–4 livelli sopra il suo, con 0–3 partite di grinding (`npm run career`).

- **Prima squadra**: a inizio carriera si scelgono 5 Pokémon, tutti al livello 30, da un gruppo di 15 forme base di forza simile: gli starter di Kanto, Eevee, portieri come Onix e Geodude, attaccanti, e le scommesse Dratini e Magikarp (`STARTER_POOL` in `src/game/save.ts`). All'inizio niente riserve: gli altri Pokémon arrivano con il reclutamento.
- **Tetto di livello**: l'esperienza (partite e sparring) si ferma 2 livelli sopra la prossima palestra (68 prima della Lega); ogni medaglia lo alza e da Campione sparisce. Così le partitelle ripetibili non portano fuori scala.
- **Leggendari** (come in Rosso/Blu): Zapdos alla Centrale Elettrica, Articuno alle Isole Spumarine, Moltres sulla Via Vittoria e Mewtwo nella Grotta Ignota, che si apre dopo aver vinto la Lega. Nel loro luogo c'è una partita extra: il leggendario, con IV perfetti e un po' sopra il livello del luogo, gioca con 4 selvatici della zona allenati e al livello pieno, senza panchina né cambi. Se vinci si unisce a te senza tasso di cattura; se perdi riprovi. Si vince circa il 55% delle volte al livello con cui ci si arriva (tarato con le simulazioni).
- **Reclutamento senza lotte** (`src/game/recruit.ts`): in ogni luogo c'è una partitella ripetibile contro i selvatici della zona (nelle città quelli dei dintorni). Se la vinci, di solito un selvatico chiede di unirsi (a volte due) e basta accettare; perdendo o pareggiando nessuno. Chi si propone dipende dal tasso di cattura dei giochi (chi evolve è più disponibile, i forti che non evolvono meno) e da come ha giocato contro di te. Entra con il livello e il talento che aveva in partita. La rosa non ha limiti, come un box.
- **Salvataggi**: la carriera (rosa, formazione, posizione sulla mappa, medaglie, record) è salvata in `localStorage`. Le specie restano sempre in forma base.
- **Formazione**: moduli Rombo (1-1-2-1) e Quadrato (2-2); ogni posizione mostra il voto del ruolo. C'è la formazione automatica, che prova tutte le combinazioni.
- **Esperienza**: per salire dal livello L servono 50 + 10·L EXP. In partita i titolari prendono 150 EXP, più 100 se vincono o 50 se pareggiano, più bonus per gol, assist, parate e contrasti. Le riserve prendono 40 EXP. Salire di livello sblocca le evoluzioni in partita.
- **Allenamento**: 3 sessioni per giornata. ATT/DIF/VEL/PV danno +40 EV alla statistica dei giochi corrispondente (per ATT e DIF quella già più alta tra fisica e speciale), fino a 252 per statistica e 510 in totale. Lo sparring dà +150 EXP.
- **Palestre e medaglie**: niente campionato. Ci sono le 8 Palestre di Kanto (Brock, Misty, Lt. Surge, Erika, Koga, Sabrina, Blaine, Giovanni), da battere in ordine. Ognuna ha un tipo e un livello fisso, da 30 a 63. Ogni capopalestra ha il suo asso sempre presente; gli altri 6 li pesca a ogni sfida da un gruppo di 9 specie. Il gruppo parte dalla sua squadra di Rosso/Blu (in forma base) ed è completato da specie del suo tipo che ne coprono le debolezze. Una sola specie è di un altro tipo, la contromossa, che batte chi lo mette in difficoltà (es. Misty → Numel, Fuoco/Terra). Sono forme base allenate in modo crescente: Brock al 30% (IV 20, EV mirati al ruolo 76+76), poi sempre di più fino a Giovanni e alla Lega con IV 31 e 510 EV. Così la prima palestra si batte circa una volta su due con una squadra appena formata. I ruoli si assegnano in base al voto. Vincere dà la medaglia; con una sconfitta o un pareggio si riprova. La scheda Sfide mostra chi della rosa è forte o debole contro il tipo della palestra (`src/game/gyms.ts`).
- **Lega Pokémon** (dopo l'8ª medaglia): torneo a eliminazione diretta a 8. A ogni edizione si sorteggiano 7 avversari tra 65 allenatori: tutti i Superquattro, i Campioni e i rivali delle regioni da Kanto a Paldea, più Rosso e Ash. Sono a livello 64–70 e i nomi sono quelli italiani di Pokémon Central (Pino, Antemia, Iridio, Mary, Hop, Pepe, Riben…). Le squadre partono da quelle dei videogiochi (in forma base) e sono completate da Pokémon che coprono le debolezze della squadra originale e ne condividono i tipi; gli specialisti restano nel loro tipo. Asso e portiere sono fissi, gli altri si pescano a ogni sfida. Penny schiera una squadra di Eevee che in partita evolvono in Eeveeluzioni diverse. Alcuni hanno i loro leggendari, sempre in squadra: N uno tra Zekrom e Reshiram, Hop Zacian, Iridio Tipo Zero (che in partita evolve in Silvally). Zekrom, Reshiram e Zacian non evolvono e partono già al massimo, quindi giocano 12 livelli sotto il resto della squadra (`LEGENDARY_LEVEL_GAP`). Anche il tabellone si sorteggia. Si giocano quarti, semifinale e finale; in caso di pareggio si tirano i rigori (5 a testa, poi a oltranza). Le altre partite si giocano in automatico, dopo un'eliminazione ci si può iscrivere a una nuova edizione e i titoli restano nel salvataggio (`src/game/league.ts`).

## Regole implementate

- **Statistiche**: ATT = max(Atk, SpA), DIF = max(Def, SpD), VEL = Spe, PV = HP. Si parte dalle statistiche base di Bulbapedia e si applica la formula ufficiale con livello, IV ed EV (`src/game/stats.ts`).
- **Contrasti**: l'ATT di chi porta palla sfida la DIF di chi interviene. Il vantaggio di tipo è attenuato (×1.25 / ×0.8). Entrambi perdono PV secondo la formula dei danni semplificata.
- **KO**: a 0 PV il Pokémon resta fermo per 6' e rientra con il 50% dei PV al primo KO e con il 25% dal secondo in poi. All'intervallo tutti recuperano il 25%. Il portiere non va mai KO: senza PV para peggio (fino al 70% della sua bravura), ma la porta non resta mai vuota.
- **Falli e calci piazzati**: la probabilità di fallo cresce con ATT/(ATT+DIF) di chi entra. In area è rigore, entro 32 m punizione (tiro diretto con barriera o cross), più lontano si riparte subito. La palla che esce dal fondo toccata da un difensore dà angolo, le parate e i tiri murati possono finire in angolo.
- **Rimesse laterali** (regola del calcio a 5): con i piedi dalla linea, avversari ad almeno 5 m, batte il compagno più vicino. Le palle escono soprattutto per contrasti sporchi, spazzate e intercetti che carambolano.
- **Colpo di testa** = (0.35·ATT + 0.45·DIF + 0.2·PV) × bonus altezza. Decide i duelli aerei sui cross; il portiere può uscire sui palloni vicini alla porta.
- **Portiere**: parata = 0.5·DIF + 0.3·PV + 0.2·VEL; la portata cresce con l'altezza (2.5 m + altezza, max 4 m di bonus).
- **Evoluzione**: la barra si riempie con gol, assist, parate, contrasti e tempo giocato. Serve il livello minimo della specie, senza limiti di numero; a fine gara tutti tornano allo stadio base.
- **Sostituzioni**: massimo 2 a partita con le riserve; chi esce non rientra, chi entra parte in forma base con i PV pieni. La CPU sostituisce chi è KO a lungo o quasi senza PV. Chi entra prende l'esperienza da titolare.

## Struttura

- `src/data/pokedex.json`: dati generati (non modificare a mano); `src/data/pokedex.ts`: tipi e funzioni di accesso
- `src/game/`: statistiche, tabella dei tipi, moduli, salvataggio, progressione (EXP/allenamento)
- `src/match/engine.ts`: simulazione pura, senza DOM; la usa anche `scripts/sim.ts`
- `src/match/renderer.ts`: disegno del campo su canvas
- `src/ui/hub.ts`: formazione, allenamento, prossima partita
- `src/ui/matchScreen.ts`: partita e resoconto (tabellino + esperienza)
- `src/main.ts`: carriera e navigazione tra le schermate

Gli sprite vengono caricati da PokeAPI. Pokémon è © Nintendo/Game Freak: va bene per uso personale, non va pubblicato.
