import { GAME_MINUTES, MAX_SUBS } from '../match/engine';
import { NATURES, STAT_NAMES } from '../game/natures';
import { FLY_BADGES } from '../game/kanto';
import { LEAGUE_FIELD } from '../game/league';
import { CAP, EV_PER_SESSION } from '../game/progression';
import { SHINY_RATE } from '../game/recruit';
import { BENCH_MAX, ROSTER_MAX, SESSIONS_PER_PLACE } from '../game/save';
import { MAX_TECHNIQUES } from '../game/stats';
import { BADGE_BONUS, BADGE_BONUS_PCT, TECHNIQUES } from '../game/techniques';
import { GYMS } from '../game/gyms';
import { bindThemeToggle, themeToggleHtml } from './theme';

/**
 * Regolamento: le istruzioni di gioco in una pagina sola, con l'indice. I numeri vengono dalle costanti
 * del gioco, così il testo resta giusto quando si ritara qualcosa.
 */
type Stat = keyof typeof STAT_NAMES;
const STATS: Stat[] = ['att', 'dif', 'vel', 'pv'];

/** La tabella delle nature: riga = statistica che sale, colonna = statistica che scende. */
function naturesTable(): string {
  const cell = (up: Stat, down: Stat) => {
    const n = up === down ? NATURES.filter((x) => !x.up)[STATS.indexOf(up)] : NATURES.find((x) => x.up === up && x.down === down);
    return `<td class="${up === down ? 'neutral' : ''}">${n?.name ?? '—'}</td>`;
  };
  return `<div class="guide-table"><table>
    <thead><tr><th></th>${STATS.map((d) => `<th>↓ ${STAT_NAMES[d]}</th>`).join('')}</tr></thead>
    <tbody>${STATS.map((u) => `<tr><th>↑ ${STAT_NAMES[u]}</th>${STATS.map((d) => cell(u, d)).join('')}</tr>`).join('')}</tbody>
  </table></div>`;
}

const SECTIONS: [string, string, () => string][] = [
  ['scopo', 'Lo scopo', () => `
    <p>Sei l'allenatore di un club di calcio a 5 fatto di Pokémon. Viaggi per Kanto, batti gli allenatori e gli
    ${GYMS.length} capipalestra per le medaglie, vinci la Lega Pokémon e diventi Campione battendo Blu. Intanto
    raccogli Pokémon e completi il Pokédex.</p>`],
  ['partita', 'La partita', () => `
    <p>Due tempi, ${GAME_MINUTES} minuti in tutto, 5 contro 5. I Pokémon giocano da soli: tu fai l'allenatore.</p>
    <ul>
      <li><b>Evoluzioni</b>: la barra lilla di ogni Pokémon si riempie con gol, assist, parate e contrasti vinti. Quando
      la carta si illumina tocca <b>Evolvi</b> (o premi 1–5). Evolvere rende più forti e fa recuperare un po' di PV; serve
      il livello giusto. A fine partita tutti tornano allo stadio base.</li>
      <li><b>Cambi</b>: fino a ${MAX_SUBS} a partita, solo con le riserve in panchina; chi esce non rientra.</li>
      <li><b>KO</b>: a 0 PV un Pokémon si ferma per qualche minuto e rientra con parte dei PV. Il portiere non va mai KO:
      stremato para peggio, ma resta in porta.</li>
      <li><b>Falli e calci piazzati</b>: chi entra con tanto Attacco e poca Difesa è irruento. In area è rigore, vicino alla
      porta punizione. Su angoli e cross vince chi ha Difesa, PV e altezza.</li>
      <li><b>Rigori</b>: in palestra e in Lega non si pareggia, si va ai rigori.</li>
      <li><b>Velocità, pausa, replay</b>: da 1× a 8× (la scelta resta), Spazio per la pausa; dopo un gol «Replay» lo fa
      rivedere al rallentatore. Se esci dall'app la partita si ferma da sola.</li>
      <li><b>Salta</b>: le partite si possono saltare e vedere solo il risultato: cambi ed evoluzioni li decide la CPU.</li>
      <li><b>Meteo</b>: nei luoghi all'aperto pioggia, sole, sabbia o grandine rafforzano o indeboliscono alcuni tipi.
      Palestre e Lega sono al chiuso.</li>
    </ul>`],
  ['statistiche', 'Statistiche e ruoli', () => `
    <ul>
      <li><b>Attacco</b> (il più alto tra fisico e speciale): tiri e dribbling. <b>Difesa</b>: contrasti e parate.
      <b>Velocità</b>: quanto corre. <b>Resistenza</b> (PV): quanto regge prima del KO.</li>
      <li><b>Ruoli</b>: portiere (Difesa, PV, Velocità e altezza: più è alto, più porta copre), difensore, centrocampista,
      attaccante. Ogni Pokémon ha un <b>voto</b> per ruolo: in Formazione tocchi una posizione e scegli chi ci gioca.</li>
      <li><b>Moduli</b>: Rombo (1-1-2-1, con i centrocampisti) o Quadrato (2-2, più solido e fisico).</li>
      <li><b>Scheda</b>: tocca lo sprite di un tuo Pokémon per vedere tutto di lui.</li>
    </ul>`],
  ['tipi', 'I tipi', () => `
    <p>Contano molto: il vantaggio di tipo dei giochi qui vale ×1,25 (lo svantaggio ×0,8) su contrasti, tiri, danni e
    parate. Tocca un'etichetta di tipo per sapere contro chi è forte e da chi è battuto. Prima di una sfida
    importante, il <b>Confronto di tipo</b> ti dice chi dei tuoi è forte o debole contro ogni avversario e
    «Formazione consigliata» schiera la squadra adatta.</p>`],
  ['nature', 'Le nature', () => `
    <p>Ogni Pokémon ha una natura: alza del 10% una statistica (riga) e ne abbassa del 10% un'altra (colonna).
    Sulla diagonale le quattro neutre, che non cambiano niente.</p>
    ${naturesTable()}`],
  ['crescere', 'Crescere', () => `
    <ul>
      <li><b>Esperienza</b>: si guadagna giocando (chi resta in panchina un po' meno). Vincere ne dà di più, pareggiare la
      metà, perdere niente. Un avversario più forte rende di più.</li>
      <li><b>Tetto di livello</b>: si cresce fino a ${CAP.margin} livelli sopra la prossima palestra, poi serve la medaglia.
      Da Campione il tetto sparisce.</li>
      <li><b>Allenamento</b>: ogni luogo nuovo dà ${SESSIONS_PER_PLACE} sessioni (+${EV_PER_SESSION} EV ciascuna) per alzare
      una statistica. Le sessioni non usate restano; gli EV crescono solo viaggiando.</li>
      <li><b>MT</b>: ogni medaglia dà una tecnica (${TECHNIQUES.map((t) => t.name).join(', ')}). Come le MT di Rosso/Blu
      si usa una volta sola; ogni Pokémon ne impara fino a ${MAX_TECHNIQUES}.</li>
      <li><b>Bonus delle medaglie</b>: ${BADGE_BONUS.map((b) => `${GYMS[b.badge].badge} +${BADGE_BONUS_PCT}% ${b.label}`).join(', ')} su tutta la squadra.</li>
      <li><b>Talento</b>: ogni Pokémon nasce con un talento nascosto (come gli IV dei giochi): la scheda lo mostra.</li>
    </ul>`],
  ['squadra', 'La squadra', () => `
    <ul>
      <li><b>Nuovi Pokémon</b>: niente Poké Ball. Se vinci la partitella con i selvatici, di solito uno chiede di unirsi:
      <b>Cattura</b> o <b>Libera</b>. Chi evolve si convince più facilmente, i forti e rari molto meno, e conta come ha
      giocato contro di te.</li>
      <li><b>Rosa</b>: al massimo ${ROSTER_MAX} Pokémon; in partita 5 titolari e fino a ${BENCH_MAX} riserve in panchina.</li>
      <li><b>PC di Bill</b>: chi non sta nella rosa va nel PC, senza limiti, e resta tuo. Durante l'avventura si deposita
      soltanto; da Campione si ritira al Centro Pokémon di una città.</li>
      <li><b>Shiny</b>: uno su ${Math.round(1 / SHINY_RATE)} tra i selvatici e tra i Pokémon iniziali ha colori rari (solo
      da collezione). Si vede già prima della partitella; se la vinci, chiede di unirsi.</li>
    </ul>`],
  ['viaggio', 'Il viaggio', () => `
    <ul>
      <li><b>Mappa</b>: ti sposti nei luoghi vicini; le medaglie aprono nuove zone. Dalla ${GYMS[FLY_BADGES - 1].badge}
      puoi volare nelle città già visitate. «Nuovo» segna i luoghi ancora da esplorare.</li>
      <li><b>Allenatori</b>: sui percorsi, da battere una volta. Il rivale <b>Blu</b> ti sbarra la strada in alcuni punti:
      senza batterlo non si prosegue.</li>
      <li><b>Partitella con i selvatici</b>: in ogni luogo, ripetibile, fa esperienza e porta nuovi Pokémon (nelle città
      si gioca con quelli dei dintorni).</li>
      <li><b>Eventi nascosti</b>: come in Pokémon Giallo, qualcuno ti affida un Pokémon speciale. Non sono segnati:
      compaiono nel posto giusto al momento giusto e vanno conquistati con una sfida.</li>
      <li><b>Leggendari</b>: Zapdos, Articuno, Moltres e (dopo il titolo) Mewtwo guidano una squadra di selvatici già
      evoluti e crescono con il livello della tua squadra. Se vinci, chiedono di unirsi.</li>
    </ul>`],
  ['palestre', 'Palestre e Lega', () => `
    <ul>
      <li><b>Palestre</b>: si battono in ordine. Ognuna ha un tipo; in campo ci sono sempre l'asso e la contromossa,
      gli altri il capopalestra li sceglie studiando la tua squadra. Vincere dà la medaglia, una MT e a volte un bonus.</li>
      <li><b>Lega Pokémon</b>: con tutte le medaglie, all'Altopiano Blu. Torneo a eliminazione diretta contro
      ${LEAGUE_FIELD} avversari sorteggiati tra Superquattro, Campioni e rivali di tutte le regioni; chi vince il torneo
      sfida Blu, il Campione. Se perdi, ti iscrivi a una nuova edizione.</li>
      <li><b>Da Campione</b>: il tetto di livello sparisce, si apre la Grotta Ignota, nelle città ti aspettano le rivincite
      con i capipalestra e il PC di Bill si apre.</li>
    </ul>`],
  ['extra', 'Missioni ed extra', () => `
    <ul>
      <li><b>Missioni</b>: la prossima missione principale e le facoltative, con i loro premi.</li>
      <li><b>Obiettivi</b>: imprese in partita e in carriera; ognuno dà una sessione di allenamento e un titolo da mostrare.</li>
      <li><b>Pokédex</b>: le 151 di Kanto; tocca una casella per sapere dove trovarla.</li>
      <li><b>Albo d'Oro</b>: la squadra di ogni titolo.</li>
      <li><b>Sfida del giorno</b>: una squadra nuova ogni giorno, uguale per tutti. <b>Amichevole</b>: giochi contro la
      squadra di un amico con il suo codice. Nessuna delle due dà esperienza.</li>
      <li><b>Salvataggio</b>: la carriera resta in questo browser. Esportala ogni tanto (te lo ricordiamo dopo ogni
      medaglia) e installa l'app sul telefono: si apre a schermo intero e funziona anche senza rete.</li>
      <li><b>Impostazioni</b>: colore del club, tema, suoni, velocità di partenza, evoluzione automatica.</li>
    </ul>`],
];

export function renderGuide(app: HTMLElement, onBack: () => void) {
  app.innerHTML = `
    <div class="topbar">
      <span class="brand">Poké<span>.</span>Calcio</span>
      <span class="sparkle">✦</span>
      <span>Regolamento</span>
      ${themeToggleHtml()}
    </div>
    <div class="guide">
      <div class="guide-head"><button data-guide-back>‹ Torna al gioco</button><h1>Regolamento</h1></div>
      <nav class="card guide-toc">${SECTIONS.map(([id, title]) => `<a href="#g-${id}" data-guide-go="${id}">${title}</a>`).join('')}</nav>
      ${SECTIONS.map(([id, title, body]) => `<section class="card guide-section" id="g-${id}"><h2>${title}</h2>${body()}</section>`).join('')}
      <div class="guide-head"><button data-guide-back>‹ Torna al gioco</button></div>
    </div>`;
  bindThemeToggle(app);
  app.querySelectorAll<HTMLButtonElement>('[data-guide-back]').forEach((b) => (b.onclick = onBack));
  // l'indice scorre alla sezione senza cambiare l'indirizzo della pagina
  app.querySelectorAll<HTMLAnchorElement>('[data-guide-go]').forEach((a) => {
    a.onclick = (e) => {
      e.preventDefault();
      document.getElementById(`g-${a.dataset.guideGo}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
  });
  window.scrollTo({ top: 0 });
}
