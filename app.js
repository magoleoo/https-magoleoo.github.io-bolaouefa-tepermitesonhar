import {
  competitionSnapshot,
  competitionAssets,
  knockoutResults as staticKnockoutResults,
  leaguePhaseSnapshot,
  officialSources,
  participantSnapshots,
  participants,
  phaseRules,
  predictionHighlightsByMatchTitle,
  predictionsGallery,
  quarterFinalsFormsConfig,
  rulesHighlights,
  rulesSections,
  teamLogos,
  winnersHistory,
} from "./data.js";

const storageKeys = {
  session: "ucl-bolao-session",
  manualSuperclassics: "ucl-bolao-manual-superclassics",
  qfDrafts: "ucl-bolao-qf-drafts",
};

const loginModal = document.querySelector("#login-modal");
const loginForm = document.querySelector("#login-form");
const loginUser = document.querySelector("#login-user");
const loginUserList = document.querySelector("#login-user-list");
const skipLoginButton = document.querySelector("#skip-login-button");
const loginFeedback = document.querySelector("#login-feedback");
const logoutButton = document.querySelector("#logout-button");
const overviewCards = document.querySelector("#overview-cards");
const rankingTable = document.querySelector("#ranking-table");
const matchesGrid = document.querySelector("#matches-grid");
const predictionsForm = document.querySelector("#predictions-form");
const userSummary = document.querySelector("#user-summary");
const awards = document.querySelector("#awards");
const rulesList = document.querySelector("#rules-list");
const liveSummary = document.querySelector("#live-summary");
const competitionMark = document.querySelector("#competition-mark");
const historyTable = document.querySelector("#history-table");
const hallOfFame = document.querySelector("#hall-of-fame");
const predictionsGalleryEl = document.querySelector("#predictions-gallery");
const predictionsConsultationEl = document.querySelector("#predictions-consultation");
const qfFormsPanel = document.querySelector("#qf-forms-panel");
const rulesPanel = document.querySelector("#rules-panel");
const superclassicPanel = document.querySelector("#superclassic-panel");
const tabRanking = document.querySelector("#tab-ranking");
const tabResults = document.querySelector("#tab-results");
const tabSubmitQf = document.querySelector("#tab-submit-qf");
const tabSuperclassic = document.querySelector("#tab-superclassic");
const tabPredictions = document.querySelector("#tab-predictions");
const tabHistory = document.querySelector("#tab-history");
const tabRules = document.querySelector("#tab-rules");
const panelRanking = document.querySelector("#panel-ranking");
const panelResults = document.querySelector("#panel-results");
const panelSubmitQf = document.querySelector("#panel-submit-qf");
const panelSuperclassic = document.querySelector("#panel-superclassic");
const panelPredictions = document.querySelector("#panel-predictions");
const panelHistory = document.querySelector("#panel-history");
const panelRules = document.querySelector("#panel-rules");
const qfPredictForm = document.querySelector("#qf-predict-form");

let currentUserId = localStorage.getItem(storageKeys.session) || "";
if (!localStorage.getItem("ucl-bolao-guest") && !currentUserId) {
  localStorage.setItem("ucl-bolao-guest", "1");
}
let leaguePhaseData = null;
let superclassicData = null;
let backtestData = null;
let quarterFinalsFormsData = null;
let manualSuperclassicIds = new Set(loadManualSuperclassicIds());

function loadManualSuperclassicIds() {
  try {
    const raw = localStorage.getItem(storageKeys.manualSuperclassics);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error("Falha ao ler superclássicos salvos no navegador.", error);
    return [];
  }
}

function saveManualSuperclassicIds() {
  localStorage.setItem(
    storageKeys.manualSuperclassics,
    JSON.stringify([...manualSuperclassicIds])
  );
}

function getParticipantById(id) {
  return participants.find((participant) => participant.id === id);
}

let knockoutResults = [...staticKnockoutResults];
let activeResultsTab = 'ROUND_OF_16';

window.setResultsTab = (tab) => {
  activeResultsTab = tab;
  renderMatches();
};

function normalizeText(text) {
  return text
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function getParticipantByName(name) {
  const normalized = normalizeText(name);
  return participants.find((participant) => normalizeText(participant.name) === normalized);
}

function getParticipantByAccessCode(accessCode) {
  const normalized = accessCode.trim().toUpperCase();
  return participants.find((participant) => participant.accessCode.toUpperCase() === normalized);
}

function getActiveParticipantLabel() {
  return getParticipantById(currentUserId)?.name || loginUser.value.trim() || "Visitante";
}

function getRankingRows() {
  if (!backtestData || !backtestData.ranking) return [];
  const mapped = backtestData.ranking.map((row) => {
    let nameToMatch = row.name;
    const participant = participants.find(
      (item) => normalizeText(item.name) === normalizeText(nameToMatch) 
      || item.id === nameToMatch.toLowerCase().replace(' ', '-')
    ) || {
      id: row.participant_id,
      name: nameToMatch.charAt(0).toUpperCase() + nameToMatch.slice(1),
      accessCode: "",
    };
    return { 
      participant: participant,
      total: row.total_points,
      firstPhase: row.first_phase_points,
      playoff: row.playoff_points,
      roundOf16: row.round_of_16_points,
      superclassic: row.superclassic_points,
      hopeSolo: row.hope_solo_hits,
      favoriteTeam: row.favorite_team || "-",
      scorerPick: row.scorer_pick || "-",
      assistPick: row.assist_pick || "-"
    };
  });
  mapped.sort((a, b) => b.total - a.total);
  return mapped.map((r, i) => ({ ...r, position: i + 1 }));
}

function formatPoints(value) {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: value % 1 ? 2 : 0,
    maximumFractionDigits: 2,
  });
}

function formatKickoff(value) {
  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function createLeagueMatchId(matchday, index) {
  return `league:${matchday}:${index + 1}`;
}

function createLeagueMatchTitle(matchday, index) {
  return `${matchday} • Jogo ${index + 1}`;
}

function createKnockoutMatchTitle(match) {
  return `${match.homeTeam} x ${match.awayTeam}`;
}

function renderPredictionHighlightList(label, names, tone) {
  if (!names?.length) {
    return `
      <div class="prediction-highlight-block">
        <span class="prediction-highlight-label">${label}</span>
        <span class="muted">Nenhum acerto identificado</span>
      </div>
    `;
  }

  return `
    <div class="prediction-highlight-block">
      <span class="prediction-highlight-label">${label}</span>
      <div class="prediction-highlight-list">
        ${names
          .map(
            (name) => `<span class="result-chip ${tone}">${name}</span>`
          )
          .join("")}
      </div>
    </div>
  `;
}

function isManualSuperclassic(matchId) {
  return manualSuperclassicIds.has(matchId);
}

function toggleManualSuperclassic(matchId) {
  if (manualSuperclassicIds.has(matchId)) {
    manualSuperclassicIds.delete(matchId);
  } else {
    manualSuperclassicIds.add(matchId);
  }
  saveManualSuperclassicIds();
  renderMatches();
  renderSuperclassicPanel();
}

function getManualSuperclassicEntries() {
  const entries = [];

  if (leaguePhaseData?.records?.length) {
    const recordsByMatchday = leaguePhaseData.records.reduce((acc, record) => {
      if (!record.matchday.startsWith("Machtday")) return acc;
      if (!acc[record.matchday]) acc[record.matchday] = [];
      acc[record.matchday].push(record);
      return acc;
    }, {});

    Object.entries(recordsByMatchday).forEach(([matchday, records]) => {
      records.forEach((record, index) => {
        const id = createLeagueMatchId(matchday, index);
        if (!isManualSuperclassic(id)) return;
        entries.push({
          id,
          phase: "Primeira fase",
          title: createLeagueMatchTitle(matchday, index),
          detail: `Resultado oficial: ${record.official}`,
        });
      });
    });
  }

  knockoutResults.forEach((match) => {
    if (!isManualSuperclassic(match.id)) return;
    entries.push({
      id: match.id,
      phase: phaseRules[match.phase]?.label || match.phase,
      title: createKnockoutMatchTitle(match),
      detail: `${match.roundLabel} • ${formatKickoff(match.kickoff)}`,
    });
  });

  return entries;
}

function competitionLogoMarkup() {
  return `
    <img class="competition-logo" src="${competitionAssets.mark}" alt="UEFA Champions League" />
  `;
}

function teamBadgeMarkup(team, size = "sm") {
  const short = team.slice(0, 3).toUpperCase();
  const logo = teamLogos[team];
  return `
    <span class="team-badge ${size}" aria-hidden="true">
      ${logo ? `<img src="${logo}" alt="${team}" loading="lazy" />` : `<span class="team-fallback">${short}</span>`}
    </span>
  `;
}

function populateLoginSelect() {
  loginUserList.innerHTML = participants
    .map((participant) => `<option value="${participant.name}"></option>`)
    .join("");
  loginUser.disabled = participants.length === 0;
  loginUser.value = currentUserId && getParticipantById(currentUserId) ? getParticipantById(currentUserId).name : "";
}

function renderRules() {
  rulesList.innerHTML = rulesHighlights
    .map((rule) => `<li>${rule}</li>`)
    .join("");
  competitionMark.innerHTML = competitionLogoMarkup();
}

function renderLiveSummary() {
  const playoffMatches = knockoutResults.filter((match) => match.phase === "PLAYOFF").length;
  const roundOf16Matches = knockoutResults.filter((match) => match.phase === "ROUND_OF_16").length;

  liveSummary.innerHTML = `
    <div class="stat-card">
      <span>1ª fase</span>
      <strong>${competitionSnapshot.leaguePhaseMatches}</strong>
      <small class="muted">partidas da fase de liga no formato atual</small>
    </div>
    <div class="stat-card">
      <span>Playoffs</span>
      <strong>${competitionSnapshot.playoffMatches}</strong>
      <small class="muted">${playoffMatches} jogos já organizados no app</small>
    </div>
    <div class="stat-card">
      <span>Oitavas</span>
      <strong>${roundOf16Matches}</strong>
      <small class="muted">${competitionSnapshot.roundOf16Matches} jogos oficiais do mata-mata</small>
    </div>
    <div class="stat-card">
      <span>Quartas definidas</span>
      <strong>${competitionSnapshot.quarterFinalists}</strong>
      <small class="muted">classificados confirmados pela UEFA</small>
    </div>
  `;
}

function renderOverview(leaderboard) {
  const currentRow = leaderboard.find((row) => row.participant.id === currentUserId);
  const leader = leaderboard[0];
  const biggestRoundOf16 = [...leaderboard].sort((a, b) => b.roundOf16 - a.roundOf16)[0];

  overviewCards.innerHTML = [
    {
      label: "Sua posição",
      value: currentRow ? `${currentRow.position}º` : "-",
      note: currentRow ? `${currentRow.participant.name} com ${formatPoints(currentRow.total)} pts` : "Faça login para ver",
    },
    {
      label: "Líder geral",
      value: leader ? leader.participant.name : "-",
      note: leader ? `${formatPoints(leader.total)} pontos` : "-",
    },
    {
      label: "Melhor nas oitavas",
      value: biggestRoundOf16 ? biggestRoundOf16.participant.name : "-",
      note: biggestRoundOf16 ? `${formatPoints(biggestRoundOf16.roundOf16)} pontos em oitavas` : "-",
    },
    {
      label: "Fonte oficial",
      value: "UEFA",
      note: "resultados cruzados com imagem do ranking",
    },
  ]
    .map(
      (item) => `
        <article class="stat-card">
          <span>${item.label}</span>
          <strong>${item.value}</strong>
          <small class="muted">${item.note}</small>
        </article>
      `
    )
    .join("");
}

function renderUserSummary(leaderboard) {
  const participant = getParticipantById(currentUserId);
  if (!participant) {
    userSummary.innerHTML = "<p class='muted'>Faça login para liberar a área exclusiva.</p>";
    return;
  }

  const row = leaderboard.find((item) => item.participant.id === participant.id);
  userSummary.innerHTML = `
    <p class="eyebrow">Participante logado</p>
    <h2>${participant.name}</h2>
    <p class="muted">Posição atual: ${row?.position || "-"}º</p>
    <p class="muted">Total oficial: ${row ? formatPoints(row.total) : "-"} pontos</p>
    <p class="muted">1ª fase: ${row ? formatPoints(row.firstPhase) : "-"} • Playoff: ${row ? formatPoints(row.playoff) : "-"} • Oitavas: ${row ? formatPoints(row.roundOf16) : "-"}</p>
  `;
}

function renderAwards(leaderboard) {
  const leader = leaderboard[0];
  const playoffLeader = [...leaderboard].sort((a, b) => b.playoff - a.playoff)[0];
  const roundOf16Leader = [...leaderboard].sort((a, b) => b.roundOf16 - a.roundOf16)[0];

  awards.innerHTML = [
    ["Liderança geral", leader ? `${leader.participant.name} com ${formatPoints(leader.total)} pts` : "-"],
    ["Melhor playoff", playoffLeader ? `${playoffLeader.participant.name} com ${formatPoints(playoffLeader.playoff)} pts` : "-" ],
    ["Melhor oitavas", roundOf16Leader ? `${roundOf16Leader.participant.name} com ${formatPoints(roundOf16Leader.roundOf16)} pts` : "-" ],
  ]
    .map(
      ([title, body]) => `
        <div class="award">
          <strong>${title}</strong>
          <p class="muted">${body}</p>
        </div>
      `
    )
    .join("");
}

function renderRanking(leaderboard) {
  const prizeClass = (position) => {
    if (position === 1) return "prize-gold";
    if (position === 2) return "prize-silver";
    if (position === 3) return "prize-bronze";
    return "prize-top4";
  };

  rankingTable.innerHTML = leaderboard
    .map(
      (row) => `
        <tr class="${row.position <= 4 ? "row-award" : ""}">
          <td>${row.position}</td>
          <td>
            <span class="name-cell">
              ${row.position <= 4 ? `<span class="prize-mark ${prizeClass(row.position)}">🏆</span>` : ""}
              <span>${row.participant.name}</span>
            </span>
          </td>
          <td><strong>${formatPoints(row.total)}</strong></td>
          <td>${formatPoints(row.firstPhase)}</td>
          <td>${formatPoints(row.playoff)}</td>
          <td>${formatPoints(row.roundOf16)}</td>
          <td>${formatPoints(row.superclassic)}</td>
          <td>
            <span class="hope-solo-cell" title="Quantidade de placares exatos solitários identificados no backtest">
              <span class="glove-mark" aria-hidden="true">🧤</span>
              <strong>${row.hopeSolo || 0}</strong>
            </span>
          </td>
          <td>${row.favoriteTeam || "-"}</td>
          <td>${row.scorerPick || "-"}</td>
          <td>${row.assistPick || "-"}</td>
        </tr>
      `
    )
    .join("");
}

function renderMatches() {
  const tabsMarkup = `
    <div class="tabs-bar" style="margin-bottom: 24px; border-bottom: 1px solid var(--line); padding-bottom: 12px; overflow-x: auto;">
      <button class="tab-button ${activeResultsTab === 'LEAGUE' ? 'is-active' : ''}" onclick="setResultsTab('LEAGUE')">Primeira Fase</button>
      <button class="tab-button ${activeResultsTab === 'PLAYOFF' ? 'is-active' : ''}" onclick="setResultsTab('PLAYOFF')">Playoffs</button>
      <button class="tab-button ${activeResultsTab === 'ROUND_OF_16' ? 'is-active' : ''}" onclick="setResultsTab('ROUND_OF_16')">Oitavas</button>
      <button class="tab-button ${activeResultsTab === 'QUARTER' ? 'is-active' : ''}" onclick="setResultsTab('QUARTER')">Quartas</button>
    </div>
  `;

  let contentMarkup = "";

  if (activeResultsTab === 'LEAGUE') {
    const leaguePhaseMarkup = leaguePhaseData
      ? Object.entries(
          leaguePhaseData.records.reduce((acc, record) => {
            if (!record.matchday.startsWith("Machtday")) return acc;
            if (!acc[record.matchday]) acc[record.matchday] = [];
            acc[record.matchday].push(record);
            return acc;
          }, {})
        )
          .map(
            ([matchday, records]) => `
              <section class="phase-block">
                <div class="phase-block-header">
                  <div>
                    <p class="eyebrow">Fase do campeonato</p>
                    <h3>Primeira fase • ${matchday}</h3>
                  </div>
                  <span class="tag">${records.length} partidas</span>
                </div>
                <div class="league-phase-grid">
                  ${records
                    .map(
                      (record, index) => `
                        <article class="league-row-card ${isManualSuperclassic(createLeagueMatchId(matchday, index)) ? "is-superclassic" : ""}">
                          <div class="superclassic-card-header">
                            <strong>Jogo ${index + 1}</strong>
                            ${
                              isManualSuperclassic(createLeagueMatchId(matchday, index))
                                ? `<span class="superclassic-chip">Superclássico</span>`
                                : ""
                            }
                          </div>
                          <span class="muted">Resultado oficial: ${record.official}</span>
                          <small class="muted">${record.picks.length} palpites registrados</small>
                          <button
                            class="superclassic-toggle"
                            type="button"
                            data-superclassic-id="${createLeagueMatchId(matchday, index)}"
                          >
                            ${
                              isManualSuperclassic(createLeagueMatchId(matchday, index))
                                ? "Remover de superclássicos"
                                : "Marcar como superclássico"
                            }
                          </button>
                        </article>
                      `
                    )
                    .join("")}
                </div>
              </section>
            `
          )
          .join("")
      : `
        <section class="phase-block">
          <div class="phase-block-header">
            <div>
              <p class="eyebrow">Fase do campeonato</p>
              <h3>Primeira fase</h3>
            </div>
            <span class="tag">carregando</span>
          </div>
          <p class="muted">Estou carregando os 144 jogos da fase de liga a partir da planilha oficial.</p>
        </section>
      `;
      contentMarkup = leaguePhaseMarkup;
  } else {
    const matches = knockoutResults.filter(m => m.phase === activeResultsTab);
    const phaseLabel = phaseRules[activeResultsTab] ? phaseRules[activeResultsTab].label : (activeResultsTab === 'QUARTER' ? 'Quartas' : activeResultsTab);
    contentMarkup = `
        <section class="phase-block">
          <div class="phase-block-header">
            <div>
              <p class="eyebrow">Fase do campeonato</p>
              <h3>${phaseLabel}</h3>
            </div>
            <span class="tag">${matches.length} jogos</span>
          </div>
          <div class="matches-grid">
            ${matches
              .map(
                (match) => {
                  const matchTitle = createKnockoutMatchTitle(match);
                  const highlights = predictionHighlightsByMatchTitle[matchTitle];
                  return `
                  <article class="match-card ${isManualSuperclassic(match.id) ? "is-superclassic" : ""}">
                    <div class="match-header">
                      <div>
                        <p class="eyebrow">${phaseLabel}</p>
                        <strong>${match.roundLabel}</strong>
                      </div>
                      <div class="match-header-tags">
                        ${isManualSuperclassic(match.id) ? `<span class="superclassic-chip">Superclássico</span>` : ""}
                        <span class="status-pill status-finished">Encerrado</span>
                      </div>
                    </div>
                    <div class="teams">
                      <span class="team-line">${teamBadgeMarkup(match.homeTeam)} ${match.homeTeam}</span>
                      <span class="team-line right">${match.awayTeam} ${teamBadgeMarkup(match.awayTeam)}</span>
                    </div>
                    <div class="scoreline">
                      <strong>${match.scoreFinal.home ?? '-'}</strong>
                      <strong>${match.scoreFinal.away ?? '-'}</strong>
                    </div>
                    <p class="muted">${formatKickoff(match.kickoff)}${match.aggregate ? ` • agregado ${match.aggregate}` : ''}${match.qualified ? ` • classificado: ${match.qualified}` : ""}${match.extraTime ? " • prorrogação" : ""}</p>
                    ${
                      highlights
                        ? `
                          <div class="prediction-highlights">
                            ${renderPredictionHighlightList("Placar exato", highlights.exact, "exact")}
                            ${renderPredictionHighlightList("Tendência", highlights.tendency, "trend")}
                          </div>
                        `
                        : ""
                    }
                    <button class="superclassic-toggle" type="button" data-superclassic-id="${match.id}">
                      ${isManualSuperclassic(match.id) ? "Remover de superclássicos" : "Marcar como superclássico"}
                    </button>
                  </article>
                `;
                }
              )
              .join("")}
          </div>
        </section>
      `;
  }

  matchesGrid.innerHTML = tabsMarkup + contentMarkup;
}

function renderParticipantSnapshot() {
  const participant = getParticipantById(currentUserId);
  if (!participant) {
    predictionsForm.innerHTML = "<p class='muted'>Entre com um participante para ver o recorte oficial atualizado até as oitavas.</p>";
    return;
  }

  const row = participantSnapshots[participant.id];
  if (!row) {
    predictionsForm.innerHTML = "<p class='muted'>Ainda não encontrei o recorte desse participante na imagem oficial do ranking.</p>";
    return;
  }

  predictionsForm.innerHTML = `
    <section class="form-block">
      <p class="eyebrow">Resumo oficial até as oitavas</p>
      <div class="classification-grid">
        <label>
          Ranking oficial
          <input value="${row.position}º lugar" disabled />
        </label>
        <label>
          Pontuação total
          <input value="${formatPoints(row.total)} pontos" disabled />
        </label>
        <label>
          1ª fase
          <input value="${formatPoints(row.firstPhase)}" disabled />
        </label>
        <label>
          Playoff 1ª fase
          <input value="${formatPoints(row.playoff)}" disabled />
        </label>
        <label>
          Oitavas
          <input value="${formatPoints(row.roundOf16)}" disabled />
        </label>
        <label>
          Superclássicos
          <input value="${formatPoints(row.superclassic)}" disabled />
        </label>
      </div>
    </section>
    <section class="form-block">
      <p class="eyebrow">Picks do participante</p>
      <div class="classification-grid">
        <label>
          Time favorito
          <input value="${row.favoriteTeam}" disabled />
        </label>
        <label>
          Artilheiro
          <input value="${row.scorerPick}" disabled />
        </label>
        <label>
          Garçom
          <input value="${row.assistPick}" disabled />
        </label>
        <label>
          Fonte do ranking
          <input value="Imagem oficial enviada + UEFA" disabled />
        </label>
      </div>
    </section>
    <section class="form-block">
      <p class="eyebrow">Fontes usadas</p>
      <div class="classification-grid">
        <label>
          Ranking local
          <input value="${officialSources.rankingImage}" disabled />
        </label>
        <label>
          Resultados oficiais
          <input value="${officialSources.uefaResultsUrl}" disabled />
        </label>
      </div>
    </section>
    <p class="feedback success">${leaguePhaseSnapshot.updatedAtLabel}</p>
  `;
}

function renderHistory() {
  historyTable.innerHTML = [...winnersHistory]
    .reverse()
    .map(
      (row) => `
        <tr>
          <td>${row.season}</td>
          <td>${row.guanabara || "-"}</td>
          <td><strong>${row.first || "-"}</strong></td>
          <td>${row.second || "-"}</td>
          <td>${row.third || "-"}</td>
          <td>${row.fourth || "-"}</td>
          <td>${row.participants}</td>
        </tr>
      `
    )
    .join("");

  const championCounts = winnersHistory.reduce((acc, row) => {
    if (!row.first) return acc;
    acc[row.first] = (acc[row.first] || 0) + 1;
    return acc;
  }, {});

  hallOfFame.innerHTML = Object.entries(championCounts)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt-BR"))
    .slice(0, 8)
    .map(
      ([name, titles]) => `
        <div class="award">
          <strong>${name}</strong>
          <p class="muted">${titles} título${titles > 1 ? "s" : ""} de campeão</p>
        </div>
      `
    )
    .join("");
}

function renderRulesPanel() {
  rulesPanel.innerHTML = rulesSections
    .map(
      (section) => `
        <article class="rules-card">
          <h3>${section.title}</h3>
          <ul class="rules-detail-list">
            ${section.items.map((item) => `<li>${item}</li>`).join("")}
          </ul>
        </article>
      `
    )
    .join("");
}

function renderSuperclassicPanel() {
  const manualEntries = getManualSuperclassicEntries();
  const blocks = (superclassicData?.blocks || []).filter(
    (block) => block.matches?.length && block.submissions?.length
  );

  if (!blocks.length && !manualEntries.length) {
    superclassicPanel.innerHTML = `
      <article class="rules-card">
        <h3>Superclássicos</h3>
        <p class="muted">Nenhum bloco de superclássico estruturado ainda.</p>
      </article>
    `;
    return;
  }

  const manualMarkup = manualEntries.length
    ? `
      <article class="rules-card">
        <h3>Seleção manual no app</h3>
        <p class="muted">Clique nos jogos da aba Resultados para definir quais confrontos entram como superclássico.</p>
        <div class="superclassic-manual-grid">
          ${manualEntries
            .map(
              (entry) => `
                <article class="league-row-card is-superclassic">
                  <p class="eyebrow">${entry.phase}</p>
                  <strong>${entry.title}</strong>
                  <span class="muted">${entry.detail}</span>
                </article>
              `
            )
            .join("")}
        </div>
      </article>
    `
    : "";

  const blockMarkup = blocks
    .map(
      (block, index) => `
        <article class="rules-card">
          <h3>Bloco ${index + 1}</h3>
          <p class="muted">${block.matches.map((match) => match.title).join(" • ")}</p>
          <div class="superclassic-submissions">
            ${block.submissions
              .map(
                (submission) => `
                  <article class="league-row-card">
                    <strong>${submission.participant}</strong>
                    ${submission.predictions
                      .map(
                        (prediction) => `
                          <span class="muted">${prediction.title}: ${prediction.home} x ${prediction.away}</span>
                        `
                      )
                      .join("")}
                  </article>
                `
              )
              .join("")}
          </div>
        </article>
      `
    )
    .join("");

  superclassicPanel.innerHTML = `${manualMarkup}${blockMarkup}`;
}

function setActiveTab(tab) {
  const showRanking = tab === "ranking";
  const showResults = tab === "results";
  const showSubmitQf = tab === "submit-qf";
  const showSuperclassic = tab === "superclassic";
  const showPredictions = tab === "predictions";
  const showHistory = tab === "history";
  const showRules = tab === "rules";
  tabRanking.classList.toggle("is-active", showRanking);
  tabResults.classList.toggle("is-active", showResults);
  tabSubmitQf.classList.toggle("is-active", showSubmitQf);
  tabSuperclassic.classList.toggle("is-active", showSuperclassic);
  tabPredictions.classList.toggle("is-active", showPredictions);
  tabHistory.classList.toggle("is-active", showHistory);
  tabRules.classList.toggle("is-active", showRules);
  panelRanking.classList.toggle("is-active", showRanking);
  panelResults.classList.toggle("is-active", showResults);
  panelSubmitQf.classList.toggle("is-active", showSubmitQf);
  panelSuperclassic.classList.toggle("is-active", showSuperclassic);
  panelPredictions.classList.toggle("is-active", showPredictions);
  panelHistory.classList.toggle("is-active", showHistory);
  panelRules.classList.toggle("is-active", showRules);
}

const qrMatches = [
  { id: "Q1", home1: "Paris Saint-Germain", away1: "Liverpool", home2: "Liverpool", away2: "Paris Saint-Germain" },
  { id: "Q2", home1: "Real Madrid", away1: "Bayern München", home2: "Bayern München", away2: "Real Madrid" },
  { id: "Q3", home1: "Barcelona", away1: "Atlético de Madrid", home2: "Atlético de Madrid", away2: "Barcelona" },
  { id: "Q4", home1: "Sporting CP", away1: "Arsenal", home2: "Arsenal", away2: "Sporting CP" }
];

function loadQfDrafts() {
  try {
    const raw = localStorage.getItem(storageKeys.qfDrafts);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (error) {
    console.error("Falha ao ler os rascunhos das quartas.", error);
    return {};
  }
}

function saveQfDrafts(drafts) {
  localStorage.setItem(storageKeys.qfDrafts, JSON.stringify(drafts));
}

function getQfDraftKey() {
  return currentUserId || normalizeText(loginUser.value || "visitante");
}

function getQfDraft() {
  const drafts = loadQfDrafts();
  return drafts[getQfDraftKey()] || {};
}

function saveQfDraftField(name, value) {
  const drafts = loadQfDrafts();
  const key = getQfDraftKey();
  drafts[key] = {
    ...(drafts[key] || {}),
    participant: getActiveParticipantLabel(),
    [name]: value,
  };
  saveQfDrafts(drafts);
}

function clearQfDraft() {
  const drafts = loadQfDrafts();
  delete drafts[getQfDraftKey()];
  saveQfDrafts(drafts);
}

function buildQfWhatsAppMessage(formData) {
  const participant = getActiveParticipantLabel();
  let message = `🏆 *Palpites Quartas de Final - ${participant}*\n\n`;

  qrMatches.forEach((match) => {
    message += `🔹 *${match.home1} x ${match.away1}*\n`;
    message += `Ida: ${match.home1} ${formData.get(`${match.id}_ida_home`)} x ${formData.get(`${match.id}_ida_away`)} ${match.away1}\n`;
    message += `Volta: ${match.home2} ${formData.get(`${match.id}_volta_home`)} x ${formData.get(`${match.id}_volta_away`)} ${match.away2}\n`;
    message += `Classificado: ${formData.get(`${match.id}_classificado`)}\n\n`;
  });

  return message.trim();
}

function parseCsvLine(line) {
  const values = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      values.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current);
  return values.map((value) => value.trim());
}

function parseCsv(text) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) return [];

  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const row = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, row[index] || ""]));
  });
}

function renderQuarterFinalsFormsPanel() {
  if (!quarterFinalsFormsConfig.csvUrl) {
    qfFormsPanel.innerHTML = `
      <article class="rules-card">
        <h3>Integração pronta</h3>
        <p class="muted">${quarterFinalsFormsConfig.description}</p>
        <p class="muted">Colunas esperadas:</p>
        <div class="result-chip-row">
          ${quarterFinalsFormsConfig.expectedColumns.map((column) => `<span class="result-chip">${column}</span>`).join("")}
        </div>
      </article>
    `;
    return;
  }

  if (!quarterFinalsFormsData) {
    qfFormsPanel.innerHTML = `
      <article class="rules-card">
        <h3>Respostas do Forms</h3>
        <p class="muted">Estou carregando as respostas publicadas do Google Forms.</p>
      </article>
    `;
    return;
  }

  if (!quarterFinalsFormsData.length) {
    qfFormsPanel.innerHTML = `
      <article class="rules-card">
        <h3>Respostas do Forms</h3>
        <p class="muted">A URL está configurada, mas ainda não encontrei respostas publicadas.</p>
      </article>
    `;
    return;
  }

  qfFormsPanel.innerHTML = qrMatches
    .map((match) => `
      <article class="prediction-consult-card" style="margin-bottom: 24px;">
        <div class="prediction-consult-header">
          <div>
            <strong>${match.home1} x ${match.away1}</strong>
            <p class="muted">Confronto ${match.id.replace('Q', '')}</p>
          </div>
          <span class="tag">Forms</span>
        </div>
        <div class="table-wrap">
          <table class="dashboard-table compact-table">
            <thead>
              <tr>
                <th>Palpiteiro</th>
                <th>Ida</th>
                <th>Volta</th>
                <th>Classificado</th>
              </tr>
            </thead>
            <tbody>
              ${quarterFinalsFormsData.map((row) => `
                <tr>
                  <td><strong>${row.Participante || row.participante || row.Nome || "Sem nome"}</strong></td>
                  <td style="white-space:nowrap">${row[`${match.id}_ida_home`] || "-"} x ${row[`${match.id}_ida_away`] || "-"}</td>
                  <td style="white-space:nowrap">${row[`${match.id}_volta_home`] || "-"} x ${row[`${match.id}_volta_away`] || "-"}</td>
                  <td>${row[`${match.id}_classificado`] || "-"}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </article>
    `)
    .join("");
}

function renderQuarterFinalsForm() {
  const draft = getQfDraft();
  qfPredictForm.innerHTML = `
    <section class="qf-form-shell">
      <article class="form-block">
        <p class="eyebrow">Participante</p>
        <div class="qf-toolbar">
          <div>
            <strong>${getActiveParticipantLabel()}</strong>
            <p class="muted">O rascunho fica salvo neste navegador enquanto você preenche.</p>
          </div>
          <button class="ghost-button qf-clear-button" type="button" id="qf-clear-draft">Limpar rascunho</button>
        </div>
      </article>

      <div class="matches-grid">
      ${qrMatches.map((m) => `
        <article class="match-card qf-match-card">
          <div class="match-header">
            <div>
              <p class="eyebrow">Confronto ${m.id.replace('Q', '')}</p>
              <strong>${m.home1} x ${m.away1}</strong>
            </div>
            <span class="status-pill">Quartas</span>
          </div>
          <div class="qf-legs">
            <div class="qf-leg-row">
              <span class="qf-leg-label">Ida</span>
              <div class="qf-score-inputs">
                ${teamBadgeMarkup(m.home1)}
                <input type="number" min="0" required name="${m.id}_ida_home" value="${draft[`${m.id}_ida_home`] || ""}" class="qf-score-input">
                <span class="muted">x</span>
                <input type="number" min="0" required name="${m.id}_ida_away" value="${draft[`${m.id}_ida_away`] || ""}" class="qf-score-input">
                ${teamBadgeMarkup(m.away1)}
              </div>
            </div>
            <div class="qf-leg-row">
              <span class="qf-leg-label">Volta</span>
              <div class="qf-score-inputs">
                ${teamBadgeMarkup(m.home2)}
                <input type="number" min="0" required name="${m.id}_volta_home" value="${draft[`${m.id}_volta_home`] || ""}" class="qf-score-input">
                <span class="muted">x</span>
                <input type="number" min="0" required name="${m.id}_volta_away" value="${draft[`${m.id}_volta_away`] || ""}" class="qf-score-input">
                ${teamBadgeMarkup(m.away2)}
              </div>
            </div>
          </div>
          <label>
            Classificado
            <select name="${m.id}_classificado" required>
              <option value="">Selecione...</option>
              <option value="${m.home1}" ${draft[`${m.id}_classificado`] === m.home1 ? "selected" : ""}>${m.home1}</option>
              <option value="${m.away1}" ${draft[`${m.id}_classificado`] === m.away1 ? "selected" : ""}>${m.away1}</option>
            </select>
          </label>
        </article>
      `).join("")}
      </div>
      <div class="form-block qf-actions-block">
        <button class="primary-button" type="submit">Copiar para WhatsApp</button>
        <p class="muted">Depois de preencher, o app monta o texto pronto para colar no grupo.</p>
      </div>
      <p id="qf-feedback" class="feedback"></p>
    </section>
  `;

  qfPredictForm.oninput = (event) => {
    const field = event.target;
    if (!field.name) return;
    saveQfDraftField(field.name, field.value);
  };

  qfPredictForm.onsubmit = (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const message = buildQfWhatsAppMessage(fd);
    navigator.clipboard.writeText(message).then(() => {
      document.querySelector("#qf-feedback").textContent = "Copiado para a área de transferência! Cole no grupo do WhatsApp.";
      document.querySelector("#qf-feedback").classList.add("success");
    }).catch((err) => {
      document.querySelector("#qf-feedback").textContent = "Erro ao copiar: " + err;
      document.querySelector("#qf-feedback").classList.remove("success");
    });
  };

  const clearButton = document.querySelector("#qf-clear-draft");
  if (clearButton) {
    clearButton.onclick = () => {
      clearQfDraft();
      renderQuarterFinalsForm();
      document.querySelector("#qf-feedback").textContent = "Rascunho limpo.";
      document.querySelector("#qf-feedback").classList.add("success");
    };
  }
}

function renderPredictionsGallery() {
  predictionsGalleryEl.innerHTML = predictionsGallery
    .map(
      (item) => `
        <article class="prediction-card">
          <img src="${item.image}" alt="${item.title}" loading="lazy" />
          <div class="prediction-card-body">
            <div>
              <p class="eyebrow">${item.phase}</p>
              <h3>${item.title}</h3>
            </div>
            <div class="result-chip-row">
              <span class="result-chip hit">Resultado oficial confirmado</span>
              <span class="result-chip">${item.official}</span>
            </div>
          </div>
        </article>
      `
    )
let activeConsultTab = 'playoff';

window.setConsultTab = function(tab) {
  activeConsultTab = tab;
  renderPredictionConsultation();
};

function renderMatches() {
  const container = document.getElementById("results-container");
  if (!container || !backtestData?.phases) return;

  let sourceFixtures = [];
  if (activePhaseFilter === 'league') {
    sourceFixtures = backtestData.phases['LEAGUE']?.fixtures || [];
  } else if (activePhaseFilter === 'playoffs') {
    sourceFixtures = backtestData.phases['PLAYOFF']?.fixtures || [];
  } else if (activePhaseFilter === 'oitavas') {
    sourceFixtures = backtestData.phases['ROUND_OF_16']?.fixtures || [];
  }

  const finishedFixtures = sourceFixtures.filter(f => f.official && f.official.trim() !== "" && f.official !== "-");

  container.innerHTML = `
    <div style="margin-bottom: 24px; text-align: center;">
      <h3 style="margin-bottom: 8px;">Resultados Processados</h3>
      <p class="muted">${finishedFixtures.length} jogos computados nesta fase</p>
    </div>
    <div class="matches-grid">
      ${finishedFixtures.map(fixture => {
        let h_score = '';
        let a_score = '';
        if (fixture.official.includes('x')) {
          h_score = fixture.official.split('x')[0] || '';
          a_score = fixture.official.split('x')[1] || '';
        } else {
          h_score = fixture.official;
        }
        
        let t1 = fixture.label;
        let t2 = '';
        if (fixture.label.includes(' x ')) {
           t1 = fixture.label.split(' x ')[0];
           t2 = fixture.label.split(' x ')[1];
        }

        return `
        <article class="match-card">
          <div class="match-header" style="justify-content: center;">
            <span class="tag">Finalizado</span>
          </div>
          <div class="match-teams">
            <div class="team">
              <strong>${t1}</strong>
              <div class="score">${h_score}</div>
            </div>
            ${t2 ? `
            <div class="team">
              <div class="score">${a_score}</div>
              <strong>${t2}</strong>
            </div>
            ` : ''}
          </div>
        </article>`
      }).join('')}
    </div>
  `;
}
function renderPredictionConsultation() {
  const container = document.getElementById("picks-container");
  if (!container) return;
  
  if (!backtestData?.phases) {
    container.innerHTML = `
      <div class="text-center muted" style="padding: 3rem;">
        Aguardando estruturação das tabelas de palpites oficiais...
      </div>`;
    return;
  }

  const tabsMarkup = `
    <div class="tabs-bar" style="margin-bottom: 24px; border-bottom: 1px solid var(--line); padding-bottom: 12px; overflow-x: auto;">
      <button class="tab-button ${activeConsultTab === 'playoff' ? 'is-active' : ''}" onclick="setConsultTab('playoff')">Ligas</button>
      <button class="tab-button ${activeConsultTab === 'oitavas' ? 'is-active' : ''}" onclick="setConsultTab('oitavas')">Playoffs</button>
      <button class="tab-button ${activeConsultTab === 'class8' ? 'is-active' : ''}" onclick="setConsultTab('class8')">Oitavas</button>
    </div>
  `;

  let phaseKey = 'LEAGUE';
  if (activeConsultTab === 'oitavas') phaseKey = 'PLAYOFF';
  else if (activeConsultTab === 'class8') phaseKey = 'ROUND_OF_16';

  const phaseData = backtestData.phases[phaseKey] || { fixtures: [] };

  const matchesMarkup = phaseData.fixtures.map((fixture) => `
    <article class="prediction-consult-card">
      <div class="prediction-consult-header">
        <div>
          <strong>${fixture.label}</strong>
          <p class="muted">Placar oficial: <strong>${fixture.official || '-'}</strong></p>
        </div>
        <span class="tag">Jogo</span>
      </div>
      <div class="table-wrap">
        <table class="dashboard-table compact-table">
          <thead>
            <tr>
              <th>Palpiteiro</th>
              <th>Palpite</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${fixture.picks.map(pick => `
              <tr>
                <td><strong>${pick.participant}</strong></td>
                <td>${pick.pick}</td>
                <td><span class="result-chip ${pick.rank_value && parseFloat(pick.rank_value) > 3 ? 'exact' : (pick.rank_value ? 'trend' : '')}">${pick.rank_value ? pick.rank_value + ' pts' : '-'}</span></td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </article>
  `).join("");

  container.innerHTML = `
    ${tabsMarkup}
    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px;">
      ${matchesMarkup || '<p class="muted">Nenhum jogo carregado para esta fase.</p>'}
    </div>
  `;
}

function toggleLoginState() {
  loginModal.classList.toggle("hidden", localStorage.getItem("ucl-bolao-guest") === "1" || Boolean(currentUserId));
}

function renderApp() {
  const leaderboard = getRankingRows();
  renderLiveSummary();
  renderOverview(leaderboard);
  renderUserSummary(leaderboard);
  renderAwards(leaderboard);
  renderRanking(leaderboard);
  renderMatches();
  renderParticipantSnapshot();
  renderHistory();
  renderPredictionConsultation();
  renderPredictionsGallery();
  renderRulesPanel();
  renderSuperclassicPanel();
  renderQuarterFinalsForm();
  renderQuarterFinalsFormsPanel();
  toggleLoginState();
}

async function loadLeaguePhaseData() {
  try {
    const response = await fetch("./league-phase.json", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Falha ao carregar league-phase.json: ${response.status}`);
    }
    leaguePhaseData = await response.json();
  } catch (error) {
    console.error(error);
    leaguePhaseData = { records: [] };
  }
}

async function loadSuperclassicData() {
  try {
    const response = await fetch("./superclassicos.json", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Falha ao carregar superclassicos.json: ${response.status}`);
    }
    superclassicData = await response.json();
  } catch (error) {
    console.error(error);
    superclassicData = { blocks: [] };
  }
}

async function loadBacktestData() {
  try {
    const response = await fetch("./api/ranking.json", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Falha ao carregar ranking.json: ${response.status}`);
    }
    backtestData = await response.json();
  } catch (error) {
    console.error(error);
    backtestData = { ranking: [] };
  }
}

async function loadQuarterFinalsFormsData() {
  if (!quarterFinalsFormsConfig.csvUrl) {
    quarterFinalsFormsData = [];
    return;
  }

  try {
    const response = await fetch(quarterFinalsFormsConfig.csvUrl, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Falha ao carregar CSV do Forms: ${response.status}`);
    }
    const csvText = await response.text();
    quarterFinalsFormsData = parseCsv(csvText);
  } catch (error) {
    console.error(error);
    quarterFinalsFormsData = [];
  }
}

async function loadMatchesData() {
  try {
    const response = await fetch("./api/matches.json", { cache: "no-store" });
    if (!response.ok) throw new Error("Falha api/matches.json");
    const data = await response.json();
    knockoutResults = data.matches.map(m => ({
      id: m.id.toString(),
      phase: m.phase_key,
      roundLabel: m.round_label,
      kickoff: m.kickoff_utc,
      homeTeam: m.home_team_name,
      awayTeam: m.away_team_name,
      scoreFinal: { home: m.score_home_90, away: m.score_away_90 },
      aggregate: m.score_home_90 !== null ? `${m.score_home_90}-${m.score_away_90}` : null,
      qualified: m.qualified_team_name,
    }));
  } catch (e) {
    console.error(e);
    knockoutResults = [...staticKnockoutResults];
  }
}

loginForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const participant = getParticipantByName(loginUser.value);
  if (!participant && loginUser.value.trim()) {
    loginFeedback.textContent = "Nome não encontrado. Escolha um participante da lista ou entre sem identificar.";
    return;
  }
  currentUserId = participant?.id || "";
  if (currentUserId) {
    localStorage.setItem(storageKeys.session, currentUserId);
  } else {
    localStorage.removeItem(storageKeys.session);
  }
  localStorage.setItem("ucl-bolao-guest", "1");
  loginFeedback.textContent = "";
  loginUser.value = participant?.name || "";
  renderApp();
});

logoutButton.addEventListener("click", () => {
  currentUserId = "";
  localStorage.removeItem(storageKeys.session);
  localStorage.removeItem("ucl-bolao-guest");
  loginUser.value = "";
  renderApp();
});

skipLoginButton.addEventListener("click", () => {
  currentUserId = "";
  localStorage.removeItem(storageKeys.session);
  localStorage.setItem("ucl-bolao-guest", "1");
  loginFeedback.textContent = "";
  loginUser.value = "";
  renderApp();
});

matchesGrid.addEventListener("click", (event) => {
  const toggleButton = event.target.closest("[data-superclassic-id]");
  if (!toggleButton) return;
  toggleManualSuperclassic(toggleButton.dataset.superclassicId);
});

tabRanking.addEventListener("click", () => setActiveTab("ranking"));
tabResults.addEventListener("click", () => setActiveTab("results"));
tabSuperclassic.addEventListener("click", () => setActiveTab("superclassic"));
tabPredictions.addEventListener("click", () => setActiveTab("predictions"));
tabHistory.addEventListener("click", () => setActiveTab("history"));
tabRules.addEventListener("click", () => setActiveTab("rules"));
tabSubmitQf.addEventListener("click", () => setActiveTab("submit-qf"));

populateLoginSelect();
renderRules();
renderApp();
loadLeaguePhaseData().then(renderApp);
loadSuperclassicData().then(renderApp);
loadBacktestData().then(renderApp);
loadQuarterFinalsFormsData().then(renderApp);
loadMatchesData().then(renderApp);
