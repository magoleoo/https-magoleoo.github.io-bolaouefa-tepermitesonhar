const {
  competitionSnapshot,
  competitionAssets,
  knockoutResults: staticKnockoutResults,
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
  superclassicConfig,
  teamLogos,
  winnersHistory,
} = window;

const storageKeys = {
  session: "ucl-bolao-session",
  qfDrafts: "ucl-bolao-qf-drafts",
};

const loginModal = document.querySelector("#login-modal");
const loginForm = document.querySelector("#login-form");
const loginUser = document.querySelector("#login-user");
const loginUserList =
  document.querySelector("#login-user-list") || document.querySelector("#participant-list");
const skipLoginButton = document.querySelector("#skip-login-button");
const loginFeedback = document.querySelector("#login-feedback");
const logoutButton = document.querySelector("#logout-button");
const overviewCards = document.querySelector("#overview-cards");
const rankingTable = document.querySelector("#ranking-table");
const matchesGrid =
  document.querySelector("#matches-grid") || document.querySelector("#matches-list");
const predictionsForm = document.querySelector("#predictions-form");
const userSummary = document.querySelector("#user-summary");
const awards = document.querySelector("#awards");
const rulesList = document.querySelector("#rules-list");
const liveSummary = document.querySelector("#live-summary");
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
const tabPlayoff = document.querySelector("#tab-playoff");
const tabRound16 = document.querySelector("#tab-round-of-16");
const tabAwards = document.querySelector("#tab-awards");
const tabPredictions = document.querySelector("#tab-predictions");
const tabHistory = document.querySelector("#tab-history");
const tabRules = document.querySelector("#tab-rules");

const resultsTabs = document.querySelector("#results-tabs");
const matchesList = document.querySelector("#matches-list");
const top8Grid = document.querySelector("#top-8-grid");

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
let backtestData = null;
let quarterFinalsFormsData = null;

function getParticipantById(id) {
  return participants.find((participant) => participant.id === id);
}

let knockoutResults = [...staticKnockoutResults];
let activeResultsTab = "LEAGUE";
let activeLeagueMatchday = "1";

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

const fallbackSuperclassicConfig = {
  eligiblePhases: ["LEAGUE", "PLAYOFF", "ROUND_OF_16", "QUARTER"],
  eligibleTeams: [
    "Real Madrid",
    "Barcelona",
    "Bayern de Munique",
    "Manchester City",
    "Liverpool",
    "Chelsea",
    "Paris Saint-Germain",
  ],
};

const superclassicTeamAliases = {
  "bayern de munique": "bayern munchen",
  "bayern münchen": "bayern munchen",
  "bayern munchen": "bayern munchen",
  "bayern munich": "bayern munchen",
  "atlético de madrid": "atletico de madrid",
  "atletico de madrid": "atletico de madrid",
  "paris saint-germain": "paris saint germain",
  "paris saint germain": "paris saint germain",
  psg: "paris saint germain",
  inter: "internazionale",
  internazionale: "internazionale",
};

function canonicalTeamKey(teamName) {
  const normalized = normalizeText(teamName || "").replace(/-/g, " ");
  return superclassicTeamAliases[normalized] || normalized;
}

const superclassicEligiblePhases = new Set(
  (superclassicConfig?.eligiblePhases?.length
    ? superclassicConfig.eligiblePhases
    : fallbackSuperclassicConfig.eligiblePhases
  ).map((phase) => String(phase).trim().toUpperCase())
);

const superclassicEligibleTeamKeys = new Set(
  (superclassicConfig?.eligibleTeams?.length
    ? superclassicConfig.eligibleTeams
    : fallbackSuperclassicConfig.eligibleTeams
  ).map(canonicalTeamKey)
);

function isEligibleSuperclassicMatch(homeTeam, awayTeam) {
  return (
    superclassicEligibleTeamKeys.has(canonicalTeamKey(homeTeam)) &&
    superclassicEligibleTeamKeys.has(canonicalTeamKey(awayTeam))
  );
}

const superclassicPhaseOrder = ["LEAGUE", "PLAYOFF", "ROUND_OF_16", "QUARTER"];

function normalizeScoreToken(value) {
  const text = String(value || "").trim();
  const match = text.match(/^(\d+)\s*[xX-]\s*(\d+)$/);
  if (!match) return "";
  return `${match[1]}x${match[2]}`;
}

function splitFixtureLabel(label) {
  if (!label || !label.includes(" x ")) return null;
  const [homeTeam, awayTeam] = label.split(" x ");
  if (!homeTeam || !awayTeam) return null;
  return {
    homeTeam: homeTeam.trim(),
    awayTeam: awayTeam.trim(),
  };
}

function normalizeSuperclassicPicks(rawPicks) {
  return (rawPicks || [])
    .map((pick) => ({
      participant: String(pick?.participant || "").trim(),
      pick: normalizeScoreToken(pick?.pick),
    }))
    .filter((pick) => pick.participant && pick.pick);
}

function buildAutomaticSuperclassicFixtures() {
  const fixturesByKey = new Map();

  const upsertFixture = ({ phase, phaseDetail, title, official, picks }) => {
    const key = `${phase}::${normalizeText(phaseDetail || "")}::${normalizeText(title)}`;
    const existing = fixturesByKey.get(key);

    if (!existing) {
      fixturesByKey.set(key, {
        key,
        phase,
        phaseDetail,
        title,
        official: official || "",
        picks: [...(picks || [])],
      });
      return;
    }

    if (!existing.official && official) {
      existing.official = official;
    }

    const merged = new Map(
      (existing.picks || []).map((pick) => [normalizeText(pick.participant), pick])
    );
    (picks || []).forEach((pick) => {
      merged.set(normalizeText(pick.participant), pick);
    });
    existing.picks = [...merged.values()].sort((a, b) =>
      a.participant.localeCompare(b.participant, "pt-BR")
    );
  };

  superclassicPhaseOrder.forEach((phaseKey) => {
    if (!superclassicEligiblePhases.has(phaseKey)) return;
    const fixtures = backtestData?.phases?.[phaseKey]?.fixtures || [];

    fixtures.forEach((fixture) => {
      const parsed = splitFixtureLabel(fixture.label);
      if (!parsed) return;
      if (!isEligibleSuperclassicMatch(parsed.homeTeam, parsed.awayTeam)) return;

      let phaseDetail = phaseRules[phaseKey]?.label || phaseKey;
      const matchday = String(fixture.matchday || "").replace("Machtday", "Matchday");
      const leg = String(fixture.leg || "").trim();
      if (phaseKey === "LEAGUE" && matchday) phaseDetail = matchday;
      if (leg) phaseDetail = `${phaseDetail} • ${leg.toUpperCase()}`;

      upsertFixture({
        phase: phaseKey,
        phaseDetail,
        title: `${parsed.homeTeam} x ${parsed.awayTeam}`,
        official: normalizeScoreToken(fixture.official),
        picks: normalizeSuperclassicPicks(fixture.picks),
      });
    });
  });

  (knockoutResults || []).forEach((match) => {
    if (!superclassicEligiblePhases.has(match.phase)) return;
    if (!isEligibleSuperclassicMatch(match.homeTeam, match.awayTeam)) return;

    const title = `${match.homeTeam} x ${match.awayTeam}`;
    let phaseDetail = match.roundLabel || phaseRules[match.phase]?.label || match.phase;
    const legMatch = String(match.roundLabel || "").match(/\b(ida|volta)\b/i);
    if (legMatch) {
      phaseDetail = `${phaseRules[match.phase]?.label || match.phase} • ${legMatch[1].toUpperCase()}`;
    }

    const hasScore =
      typeof match?.scoreFinal?.home === "number" && typeof match?.scoreFinal?.away === "number";
    const official = hasScore ? `${match.scoreFinal.home}x${match.scoreFinal.away}` : "";

    upsertFixture({
      phase: match.phase,
      phaseDetail,
      title,
      official,
      picks: [],
    });
  });

  const fixtures = [...fixturesByKey.values()];
  fixtures.sort((a, b) => {
    const phaseDiff = superclassicPhaseOrder.indexOf(a.phase) - superclassicPhaseOrder.indexOf(b.phase);
    if (phaseDiff !== 0) return phaseDiff;

    if (a.phase === "LEAGUE") {
      const aMd = Number((a.phaseDetail.match(/(\d+)/) || [])[1] || 0);
      const bMd = Number((b.phaseDetail.match(/(\d+)/) || [])[1] || 0);
      if (aMd !== bMd) return aMd - bMd;
    }
    return a.title.localeCompare(b.title, "pt-BR");
  });

  return fixtures;
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
  if (!loginUserList) {
    return;
  }
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

window.setLeagueMatchday = (md) => {
  activeLeagueMatchday = md;
  renderMatches();
}

function renderMatches() {
  if (!matchesList) return;

  const tabsMarkup = `
    <div class="tabs-bar results-tabs">
      <button class="tab-button ${activeResultsTab === "LEAGUE" ? "is-active" : ""}" onclick="setResultsTab('LEAGUE')">Primeira fase</button>
      <button class="tab-button ${activeResultsTab === "PLAYOFF" ? "is-active" : ""}" onclick="setResultsTab('PLAYOFF')">Playoffs</button>
      <button class="tab-button ${activeResultsTab === "ROUND_OF_16" ? "is-active" : ""}" onclick="setResultsTab('ROUND_OF_16')">Oitavas</button>
      <button class="tab-button ${activeResultsTab === "QUARTER" ? "is-active" : ""}" onclick="setResultsTab('QUARTER')">Quartas</button>
      <button class="tab-button ${activeResultsTab === "SEMI" ? "is-active" : ""}" onclick="setResultsTab('SEMI')">Semi</button>
      <button class="tab-button ${activeResultsTab === "FINAL" ? "is-active" : ""}" onclick="setResultsTab('FINAL')">Final</button>
    </div>
  `;

  const renderMatchCard = (match, meta = {}) => {
    const superclassic =
      superclassicEligiblePhases.has(match.phase) &&
      isEligibleSuperclassicMatch(match.homeTeam, match.awayTeam);
    const hasScore =
      typeof match?.scoreFinal?.home === "number" && typeof match?.scoreFinal?.away === "number";
    const status = meta.statusLabel || match.status || (hasScore ? "Finalizado" : "Agendado");
    const secondary = meta.secondaryLine
      ? `<p class="muted match-card-note">${meta.secondaryLine}</p>`
      : "";
    const homeScore = hasScore ? match.scoreFinal.home : "-";
    const awayScore = hasScore ? match.scoreFinal.away : "-";

    return `
      <article class="match-card ${superclassic ? "is-superclassic" : ""}">
        <div class="match-header">
          <span class="tag ${hasScore ? "status-finished" : ""}">${status}</span>
          <div class="match-header-tags">
            ${superclassic ? `<span class="tag">Superclássico</span>` : ""}
          </div>
        </div>
        <div class="teams">
          <span class="team-line">
            ${teamBadgeMarkup(match.homeTeam)}
            <strong>${match.homeTeam}</strong>
          </span>
          <span class="team-line right">
            <strong>${match.awayTeam}</strong>
            ${teamBadgeMarkup(match.awayTeam)}
          </span>
        </div>
        <div class="scoreline">
          <strong>${homeScore}</strong>
          <strong>${awayScore}</strong>
        </div>
        ${secondary}
      </article>
    `;
  };

  const renderGroup = (title, matches, formatter) => `
    <section class="results-phase-block">
      <div class="section-heading">
        <div>
          <p class="eyebrow">${title}</p>
          <h2>${matches.length} jogo${matches.length === 1 ? "" : "s"}</h2>
        </div>
      </div>
      <div class="matches-grid">
        ${matches.map(formatter).join("")}
      </div>
    </section>
  `;

  const shouldShowAggregate = (match) => {
    if (!match.aggregate) return false;
    const isPlayoffOrRoundOf16 = ["PLAYOFF", "ROUND_OF_16"].includes(match.phase);
    const isFirstLeg = /ida/i.test(match.roundLabel || "");
    if (isPlayoffOrRoundOf16 && isFirstLeg) return false;
    return true;
  };

  if (top8Grid) {
    top8Grid.innerHTML = leaguePhaseTopEight
      .map(
        (team, index) => `
          <article class="qualified-card">
            <span class="position-badge" style="font-weight:bold; color:var(--clr-primary-400); font-family:var(--font-heading); font-size:1.5rem; line-height:1; min-width:30px">${index + 1}º</span>
            ${teamBadgeMarkup(team, "lg")}
            <strong>${team}</strong>
          </article>
        `
      )
      .join("");
  }

  let contentMarkup = "";

  if (activeResultsTab === "LEAGUE") {
    const grouped = leaguePhaseResults.reduce((acc, match) => {
      const matchdayNumber = match.matchday.replace(/\D/g, "");
      if (!acc[matchdayNumber]) acc[matchdayNumber] = [];
      acc[matchdayNumber].push(match);
      return acc;
    }, {});

    const phaseTabs = `
      <div class="tabs-bar" style="margin-bottom: 24px;">
        ${Object.keys(grouped).sort((a,b) => Number(a)-Number(b)).map(md => `
          <button class="tab-button ${activeLeagueMatchday === md ? "is-active" : ""}" onclick="setLeagueMatchday('${md}')">Rodada ${md}</button>
        `).join("")}
      </div>
    `;

    const matchesForActiveMatchday = grouped[activeLeagueMatchday] || [];
    
    const phasesMarkup = renderGroup(`Rodada ${activeLeagueMatchday}`, matchesForActiveMatchday, (match, index) =>
      renderMatchCard(match, {
        matchId: createLeagueMatchId(`Matchday ${activeLeagueMatchday}`, index),
      })
    );

    contentMarkup = phaseTabs + phasesMarkup;
  } else {
    const matches = knockoutResults.filter((match) => match.phase === activeResultsTab);
    const grouped = matches.reduce((acc, match) => {
      if (!acc[match.roundLabel]) acc[match.roundLabel] = [];
      acc[match.roundLabel].push(match);
      return acc;
    }, {});

    const titleByPhase = {
      PLAYOFF: "Playoffs completos",
      ROUND_OF_16: "Oitavas completas",
      QUARTER: "Quartas de final",
      SEMI: "Semifinais",
      FINAL: "Final",
    };

    const phasesMarkup = Object.entries(grouped)
      .map(([roundLabel, phaseMatches]) =>
        renderGroup(roundLabel, phaseMatches, (match) =>
          renderMatchCard(match, {
            statusLabel: match.status || undefined,
            secondaryLine: [
              shouldShowAggregate(match) ? `Agregado: ${match.aggregate}` : "",
              match.qualified ? `Classificado: ${match.qualified}` : "",
              formatKickoff(match.kickoff),
            ]
              .filter(Boolean)
              .join(" • "),
          })
        )
      )
      .join("");

    contentMarkup = `
      <div class="results-summary">
        <h3>${titleByPhase[activeResultsTab] || "Mata-mata"}</h3>
        <p class="muted">${matches.length} jogos oficiais carregados</p>
      </div>
      ${phasesMarkup || `<p class="muted">Sem jogos carregados para esta fase ainda.</p>`}
    `;
  }

  resultsTabs.innerHTML = tabsMarkup;
  matchesList.innerHTML = contentMarkup;
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
  const fixtures = buildAutomaticSuperclassicFixtures();
  if (!fixtures.length) {
    superclassicPanel.innerHTML = `
      <article class="rules-card">
        <h3>Superclássicos</h3>
        <p class="muted">Nenhum confronto elegível encontrado nas fases com pontuação de superclássico.</p>
      </article>
    `;
    return;
  }

  const matrixStyles = `
    <style>
      .predictions-matrix-table { width: 100%; border-collapse: collapse; text-align: center; }
      .predictions-matrix-table th { background: var(--clr-surface-200); padding: 1rem; border: 1px solid var(--clr-surface-300); font-weight:500; font-size:0.85rem; }
      .predictions-matrix-table td { padding: 1rem; border: 1px solid var(--clr-surface-300); }
      .predictions-matrix-table td.participant-name { text-align: left; font-weight: bold; background: var(--clr-surface-100); position: sticky; left: 0; z-index: 2; width: 150px;}
      .table-wrapper { overflow-x: auto; max-width: 100%; border-radius: 8px; border: 1px solid var(--clr-surface-300); }
      .superclassic-pick-cell { background: rgba(255, 200, 0, 0.1); color: #ffe6a0; font-weight: 600; }
      .superclassic-exact-hit { background: rgba(59, 201, 114, 0.16); color: #d8f3dc; font-weight: 700; box-shadow: inset 0 0 0 1px rgba(59, 201, 114, 0.28); }
      .superclassic-exact-mark { display: block; margin-top: 4px; font-size: 0.68rem; letter-spacing: 0.06em; text-transform: uppercase; color: #86efac; }
      .superclassic-official-pill { display: inline-block; background: rgba(59, 201, 114, 0.2); color: #d8f3dc; padding: 2px 8px; border-radius: 12px; border: 1px solid rgba(59, 201, 114, 0.32); }
      .superclassic-official-pending { display: inline-block; background: rgba(255, 255, 255, 0.08); color: var(--clr-text-muted); padding: 2px 8px; border-radius: 12px; border: 1px solid var(--clr-surface-300); }
      .superclassic-exact-summary { margin-top: 14px; display: grid; gap: 10px; }
    </style>
  `;

  const participantOrder = new Map(
    participants.map((participant, index) => [normalizeText(participant.name), index])
  );

  const sortParticipants = (nameA, nameB) => {
    const posA = participantOrder.get(normalizeText(nameA));
    const posB = participantOrder.get(normalizeText(nameB));
    if (typeof posA === "number" && typeof posB === "number") return posA - posB;
    if (typeof posA === "number") return -1;
    if (typeof posB === "number") return 1;
    return nameA.localeCompare(nameB, "pt-BR");
  };

  const renderSuperclassicMatrix = (phaseFixtures) => {
    const matchCols = phaseFixtures.map((fixture) => ({
      label: fixture.title,
      detail: fixture.phaseDetail,
      key: fixture.key,
      official: fixture.official,
      picks: fixture.picks || [],
    }));

    const picksByParticipant = new Map();
    matchCols.forEach((match) => {
      match.picks.forEach((pick) => {
        if (!picksByParticipant.has(pick.participant)) {
          picksByParticipant.set(pick.participant, new Map());
        }
        picksByParticipant.get(pick.participant).set(match.key, pick.pick);
      });
    });

    const knownParticipants = participants.map((participant) => participant.name);
    const knownParticipantsNormalized = new Set(knownParticipants.map(normalizeText));
    const extraParticipants = Array.from(picksByParticipant.keys())
      .filter((name) => !knownParticipantsNormalized.has(normalizeText(name)))
      .sort(sortParticipants);
    const participantNames = [...knownParticipants, ...extraParticipants];
    const officialByMatch = new Map(matchCols.map((match) => [match.key, match.official]));

    const exactSummaryMarkup = `
      <div class="superclassic-exact-summary">
        ${matchCols
          .map((match) => {
            const official = officialByMatch.get(match.key);
            if (!official) {
              return `
                <div class="prediction-highlight-block">
                  <span class="prediction-highlight-label">${match.label}</span>
                  <span class="muted">Resultado oficial ainda não disponível.</span>
                </div>
              `;
            }
            const exactHits = participantNames.filter((participantName) => {
              const picksByTitle = picksByParticipant.get(participantName) || new Map();
              return (picksByTitle.get(match.key) || "") === official;
            });

            return `
              <div class="prediction-highlight-block">
                <span class="prediction-highlight-label">${match.label} • Oficial ${official}</span>
                <div class="prediction-highlight-list">
                  ${
                    exactHits.length
                      ? exactHits
                          .map((name) => `<span class="result-chip exact">${name}</span>`)
                          .join("")
                      : `<span class="muted">Ninguém acertou o placar exato.</span>`
                  }
                </div>
              </div>
            `;
          })
          .join("")}
      </div>
    `;

    const hasAnyPicks = matchCols.some((match) => match.picks.length > 0);
    if (!hasAnyPicks) {
      return `
        <div class="superclassic-manual-grid">
          ${matchCols
            .map(
              (match) => `
                <article class="league-row-card is-superclassic">
                  <p class="eyebrow">${match.detail}</p>
                  <strong>${match.label}</strong>
                  <span class="muted">Resultado oficial: ${match.official || "pendente"}</span>
                </article>
              `
            )
            .join("")}
        </div>
      `;
    }

    return `
      <div class="table-wrapper">
        <table class="predictions-matrix-table">
          <thead>
            <tr>
              <th class="participant-name">Participante</th>
              ${matchCols
                .map(
                  (match) => `
                    <th>
                      <div style="font-size:0.7rem; color:var(--clr-text-muted); margin-bottom:4px;">${match.detail}</div>
                      <div style="margin-bottom:8px;">${match.label}</div>
                      ${
                        officialByMatch.get(match.key)
                          ? `<div class="superclassic-official-pill">Oficial: ${officialByMatch.get(match.key)}</div>`
                          : `<div class="superclassic-official-pending">Oficial pendente</div>`
                      }
                    </th>
                  `
                )
                .join("")}
            </tr>
          </thead>
          <tbody>
            ${participantNames
              .map((participantName) => {
                const picksByTitle = picksByParticipant.get(participantName) || new Map();
                return `
                  <tr>
                    <td class="participant-name">
                      <div style="display:flex; align-items:center; gap:8px;">
                        <div style="width:24px; height:24px; border-radius:50%; background:var(--clr-surface-300); display:flex; align-items:center; justify-content:center; font-size:0.7rem;">${participantName.charAt(0)}</div>
                        ${participantName}
                      </div>
                    </td>
                    ${matchCols
                      .map((match) => {
                        const pick = picksByTitle.get(match.key) || "-";
                        const official = officialByMatch.get(match.key);
                        const isExactHit = pick !== "-" && official && pick === official;
                        const className = pick === "-"
                          ? ""
                          : isExactHit
                            ? "superclassic-exact-hit"
                            : "superclassic-pick-cell";
                        return `
                          <td class="${className}">
                            ${pick}
                            ${isExactHit ? `<span class="superclassic-exact-mark">Placar exato</span>` : ""}
                          </td>
                        `;
                      })
                      .join("")}
                  </tr>
                `;
              })
              .join("")}
          </tbody>
        </table>
      </div>
      ${exactSummaryMarkup}
    `;
  };

  const fixturesByPhase = superclassicPhaseOrder.reduce((acc, phaseKey) => {
    acc[phaseKey] = fixtures.filter((fixture) => fixture.phase === phaseKey);
    return acc;
  }, {});

  const overviewMarkup = `
    <article class="rules-card">
      <h3>Confrontos superclássicos elegíveis</h3>
      <p class="muted">Aplicação automática nas fases 1ª fase, playoff, oitavas e quartas.</p>
      <div class="result-chip-row" style="margin-top:10px;">
        ${superclassicPhaseOrder
          .filter((phaseKey) => (fixturesByPhase[phaseKey] || []).length > 0)
          .map(
            (phaseKey) =>
              `<span class="result-chip exact">${phaseRules[phaseKey]?.label || phaseKey}: ${(fixturesByPhase[phaseKey] || []).length}</span>`
          )
          .join("")}
      </div>
    </article>
  `;

  const blockMarkup = superclassicPhaseOrder
    .filter((phaseKey) => (fixturesByPhase[phaseKey] || []).length > 0)
    .map(
      (phaseKey) => `
        <article class="rules-card">
          <h3>${phaseRules[phaseKey]?.label || phaseKey}</h3>
          <p class="muted">${(fixturesByPhase[phaseKey] || []).length} confronto(s) elegível(is).</p>
          ${renderSuperclassicMatrix(fixturesByPhase[phaseKey] || [])}
        </article>
      `
    )
    .join("");

  superclassicPanel.innerHTML = `${matrixStyles}${overviewMarkup}${blockMarkup}`;
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
    .join("");
}

let activePredictionsPhase = "LEAGUE";
let activePredictionsFilter = "Matchday 1";

function renderPredictionConsultation() {
  const container = document.getElementById("predictions-consultation");
  if (!container) return;

  const validPhases = [
    { id: "LEAGUE", label: "Primeira Fase" },
    { id: "PLAYOFF", label: "Playoffs" },
    { id: "ROUND_OF_16", label: "Oitavas" },
    { id: "QUARTER_FINALS", label: "Quartas" },
    { id: "SEMI_FINALS", label: "Semis" },
    { id: "FINAL", label: "Final" }
  ];

  const leagueRounds = Array.from({length: 8}, (_, i) => `Matchday ${i+1}`);

  let phaseTabsHTML = `<div class="subtabs" style="margin-bottom:1rem; border-bottom:1px solid var(--clr-surface-200); padding-bottom:0.5rem; display:flex; gap:1rem; overflow-x:auto;">`;
  validPhases.forEach(ph => {
    const act = ph.id === activePredictionsPhase ? 'style="color:var(--clr-primary-400); font-weight:bold; border-bottom:2px solid var(--clr-primary-400); padding-bottom:8px;"' : 'style="color:var(--clr-text-muted); cursor:pointer;"';
    phaseTabsHTML += `<div onclick="window.setPredictPhase('${ph.id}')" ${act}>${ph.label}</div>`;
  });
  phaseTabsHTML += `</div>`;

  let secondaryTabsHTML = '';
  if (activePredictionsPhase === "LEAGUE") {
    secondaryTabsHTML = `<div class="subtabs" style="background:var(--clr-surface-200); border-radius:8px; padding:0.5rem; margin-bottom:1rem; display:flex; gap:1rem; overflow-x:auto;">`;
    leagueRounds.forEach(r => {
      const badgeText = r.replace("Matchday", "Rodada");
      const act = r === activePredictionsFilter ? 'style="background:var(--clr-primary-500); color:white; padding:4px 12px; border-radius:4px; cursor:pointer;"' : 'style="color:var(--clr-text-muted); padding:4px 12px; cursor:pointer;"';
      secondaryTabsHTML += `<div onclick="window.setPredictFilter('${r}')" ${act}>${badgeText}</div>`;
    });
    secondaryTabsHTML += `</div>`;
  }

  let srcFixtures = [];
  if (activePredictionsPhase === "LEAGUE") {
    const rawMatches = backtestData?.phases?.[activePredictionsPhase]?.fixtures || [];
    srcFixtures = rawMatches.filter(f => f.matchday === activePredictionsFilter.replace("Matchday", "Machtday"));
  } else {
    srcFixtures = backtestData?.phases?.[activePredictionsPhase]?.fixtures || [];
  }

  if (!srcFixtures.length) {
    container.innerHTML = phaseTabsHTML + secondaryTabsHTML + `<div class="empty-state">Nenhum palpite registrado nesta etapa ainda.</div>`;
    return;
  }

  const tableStyles = `
    <style>
      .predictions-matrix-table { width: 100%; border-collapse: collapse; text-align: center; }
      .predictions-matrix-table th { background: var(--clr-surface-200); padding: 1rem; border: 1px solid var(--clr-surface-300); font-weight:500; font-size:0.85rem; }
      .predictions-matrix-table td { padding: 1rem; border: 1px solid var(--clr-surface-300); }
      .predictions-matrix-table td.participant-name { text-align: left; font-weight: bold; background: var(--clr-surface-100); position: sticky; left: 0; z-index: 2; width: 150px;}
      .hit-cell { background: rgba(34,197,94,0.15) !important; color: #4ade80 !important; font-weight: bold; }
      .miss-cell { background: var(--clr-surface-100); color: var(--clr-text-muted); }
      .table-wrapper { overflow-x: auto; max-width: 100%; border-radius: 8px; border: 1px solid var(--clr-surface-300); }
      .predictions-section-title { margin: 1.5rem 0 0.75rem; color: var(--clr-text-100); font-size: 1rem; letter-spacing: 0.03em; }
      .predictions-section-title:first-of-type { margin-top: 0; }
    </style>
  `;

  const renderMatrixTable = (matchCols, sectionTitle = "") => {
    if (!matchCols.length) {
      return "";
    }

    const participantsSet = new Set();
    matchCols.forEach(m => {
      (m.picks || []).forEach(p => participantsSet.add(p.participant));
    });
    const participants = Array.from(participantsSet).sort();

    return `
      ${sectionTitle ? `<h3 class="predictions-section-title">${sectionTitle}</h3>` : ""}
      <div class="table-wrapper">
        <table class="predictions-matrix-table">
          <thead>
            <tr>
              <th class="participant-name">Participante</th>
              ${matchCols.map(m => `
                <th>
                  <div style="font-size:0.7rem; color:var(--clr-text-muted); margin-bottom:4px;">${m.matchday && m.matchday.includes("Machtday") ? m.matchday.replace("Machtday", "Rodada") : "Jogo Oficial"}</div>
                  <div style="margin-bottom:8px;">${m.label}</div>
                  <div style="display:inline-block; background:var(--clr-surface-400); color:white; padding:2px 8px; border-radius:12px;">${m.official || "-"}</div>
                </th>
              `).join("")}
            </tr>
          </thead>
          <tbody>
            ${participants.map(part => `
              <tr>
                <td class="participant-name">
                   <div style="display:flex; align-items:center; gap:8px;">
                     <div style="width:24px; height:24px; border-radius:50%; background:var(--clr-surface-300); display:flex; align-items:center; justify-content:center; font-size:0.7rem;">${part.charAt(0)}</div>
                     ${part}
                   </div>
                </td>
                ${matchCols.map(m => {
                  const pickObj = (m.picks || []).find(p => p.participant === part);
                  const pickStr = pickObj ? pickObj.pick : "-";
                  let isHit = false;
                  if (m.official && m.official !== "-") {
                    if (pickStr.toLowerCase() === m.official.toLowerCase()) isHit = true;
                  }
                  const cellClass = isHit ? "hit-cell" : "miss-cell";
                  return `<td class="${pickStr === "-" ? "" : cellClass}">${pickStr}</td>`;
                }).join("")}
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;
  };

  const phasesWithTwoLegs = ["PLAYOFF", "ROUND_OF_16"];
  let tablesMarkup = "";

  if (phasesWithTwoLegs.includes(activePredictionsPhase)) {
    let idaFixtures = srcFixtures.filter((fixture) => (fixture.leg || "").toUpperCase() === "IDA");
    let voltaFixtures = srcFixtures.filter((fixture) => (fixture.leg || "").toUpperCase() === "VOLTA");

    // Fallback para bases antigas sem o campo "leg".
    if (!idaFixtures.length && !voltaFixtures.length && srcFixtures.length > 1) {
      const midpoint = Math.ceil(srcFixtures.length / 2);
      idaFixtures = srcFixtures.slice(0, midpoint);
      voltaFixtures = srcFixtures.slice(midpoint);
    }

    tablesMarkup += renderMatrixTable(idaFixtures, "Jogos de Ida");
    tablesMarkup += renderMatrixTable(voltaFixtures, "Jogos de Volta");
  } else {
    tablesMarkup = renderMatrixTable(srcFixtures);
  }

  if (!tablesMarkup.trim()) {
    container.innerHTML = phaseTabsHTML + secondaryTabsHTML + `<div class="empty-state">Nenhum palpite registrado nesta etapa ainda.</div>`;
    return;
  }

  container.innerHTML = phaseTabsHTML + secondaryTabsHTML + tableStyles + tablesMarkup;
}

window.setPredictPhase = (ph) => {
  activePredictionsPhase = ph;
  if(ph === "LEAGUE") activePredictionsFilter = "Matchday 1";
  renderPredictionConsultation();
};

window.setPredictFilter = (f) => {
  activePredictionsFilter = f;
  renderPredictionConsultation();
};

function toggleLoginState() {
  const isLogged = localStorage.getItem("ucl-bolao-guest") === "1" || Boolean(currentUserId);
  loginModal.classList.toggle("hidden", isLogged);
  loginModal.style.display = isLogged ? "none" : "grid";
}

function renderApp() {
  loadImmediateData();
  console.log("Entrando no renderApp... Resolvendo ranking.");
  const leaderboard = getRankingRows();
  console.log("Leaderboard resolvido:", leaderboard.length, "linhas. window.backtestData size:", window.backtestData?.ranking?.length);
  renderOverview(leaderboard);
  console.log("Overview resolvido.");
  renderUserSummary(leaderboard);
  console.log("User summary resolvido.");
  renderAwards(leaderboard);
  renderRanking(leaderboard);
  renderMatches();
  renderParticipantSnapshot();
  renderHistory();
  renderPredictionConsultation();
  renderRulesPanel();
  renderSuperclassicPanel();
  renderQuarterFinalsForm();
  renderQuarterFinalsFormsPanel();
  toggleLoginState();
}

function loadImmediateData() {
  backtestData = window.backtestData || { ranking: [] };
  leaguePhaseData = window.leaguePhaseData || { records: [] };
  if (window.apiMatchesData?.matches?.length) {
    knockoutResults = window.apiMatchesData.matches.map(m => ({
      id: m.id.toString(),
      phase: m.phase_key,
      roundLabel: m.round_label,
      kickoff: m.kickoff_utc,
      homeTeam: m.home_team_name,
      awayTeam: m.away_team_name,
      scoreFinal: { home: m.score_home_90, away: m.score_away_90 },
      aggregate: m.score_home_90 !== null ? `${m.score_home_90}-${m.score_away_90}` : null,
      qualified: m.qualified_team_name,
      status: m.score_home_90 !== null && m.score_away_90 !== null ? "Finalizado" : "Agendado",
    }));
  } else {
    knockoutResults = staticKnockoutResults;
  }
}

// Quarters final load still using fetch if URL provided
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

loginForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const participant = getParticipantByName(loginUser.value);
  const loginPassword = document.getElementById("login-password");
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
  if (loginPassword) loginPassword.value = "";
  renderApp();
});

logoutButton.addEventListener("click", () => {
  currentUserId = "";
  localStorage.removeItem(storageKeys.session);
  localStorage.removeItem("ucl-bolao-guest");
  loginUser.value = "";
  const loginPassword = document.getElementById("login-password");
  if (loginPassword) loginPassword.value = "";
  renderApp();
});

skipLoginButton.addEventListener("click", () => {
  currentUserId = "";
  localStorage.removeItem(storageKeys.session);
  localStorage.setItem("ucl-bolao-guest", "1");
  loginFeedback.textContent = "";
  loginUser.value = "";
  const loginPassword = document.getElementById("login-password");
  if (loginPassword) loginPassword.value = "";
  renderApp();
});

tabRanking.addEventListener("click", () => setActiveTab("ranking"));
tabResults.addEventListener("click", () => setActiveTab("results"));
tabSuperclassic.addEventListener("click", () => setActiveTab("superclassic"));
tabPredictions.addEventListener("click", () => setActiveTab("predictions"));
tabHistory.addEventListener("click", () => setActiveTab("history"));
tabRules.addEventListener("click", () => setActiveTab("rules"));
tabSubmitQf.addEventListener("click", () => setActiveTab("submit-qf"));

console.log(">>> APP.JS CARREGADO NO FINAL DO ARQUIVO! ATRIBUINDO LISTENERS...");

window.addEventListener("DOMContentLoaded", () => {
  console.log(">>> DOM COMPLETAMENTE CARREGADO! INICIANDO APP...");
  loadImmediateData();
  populateLoginSelect();
  renderRules();
  renderApp();
  loadQuarterFinalsFormsData().then(renderApp);
});
