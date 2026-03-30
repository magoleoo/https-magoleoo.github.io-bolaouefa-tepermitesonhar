const {
  competitionSnapshot,
  competitionAssets,
  knockoutResults: staticKnockoutResults,
  leaguePhaseSnapshot,
  officialSources,
  participantSnapshots,
  participants,
  phaseRules,
  leagueSuperclassicFormsConfig,
  predictionHighlightsByMatchTitle,
  predictionsGallery,
  quarterFinalsFormsConfig,
  tournamentOutcomeFormsConfig,
  rulesHighlights,
  rulesSections,
  superclassicConfig,
  superclassicData,
  teamLogos,
  winnersHistory,
} = window;

const storageKeys = {
  session: "ucl-bolao-session",
  leagueSuperclassicDrafts: "ucl-bolao-league-superclassic-drafts",
  qfDrafts: "ucl-bolao-qf-drafts",
  tournamentOutcome: "ucl-bolao-tournament-outcome",
};

// Modo consultivo: acesso único para todos, sem identificação por participante.
const PUBLIC_CONSULT_MODE = true;
const PUBLIC_ACCESS_LABEL = "Consulta pública";

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
const mobileTabSelect = document.querySelector("#mobile-tab-select");

const resultsTabs = document.querySelector("#results-tabs");
const matchesList = document.querySelector("#matches-list");
const top8Grid = document.querySelector("#top-8-grid");
const tournamentOutcomePanel = document.querySelector("#tournament-outcome-panel");

const panelRanking = document.querySelector("#panel-ranking");
const panelResults = document.querySelector("#panel-results");
const panelSubmitQf = document.querySelector("#panel-submit-qf");
const panelSuperclassic = document.querySelector("#panel-superclassic");
const panelPredictions = document.querySelector("#panel-predictions");
const panelHistory = document.querySelector("#panel-history");
const panelRules = document.querySelector("#panel-rules");
const qfPredictForm = document.querySelector("#qf-predict-form");

let currentUserId = PUBLIC_CONSULT_MODE ? "" : localStorage.getItem(storageKeys.session) || "";
if (PUBLIC_CONSULT_MODE) {
  localStorage.removeItem(storageKeys.session);
  localStorage.setItem("ucl-bolao-guest", "1");
} else if (!localStorage.getItem("ucl-bolao-guest") && !currentUserId) {
  localStorage.setItem("ucl-bolao-guest", "1");
}
let activeMainTab = "ranking";
let leaguePhaseData = null;
let backtestData = null;
let quarterFinalsFormsData = null;
let tournamentOutcomeFormsData = null;
let latestClosingAuditContext = null;

function getParticipantById(id) {
  return participants.find((participant) => participant.id === id);
}

let knockoutResults = [...staticKnockoutResults];
let liveLeaguePhaseResults = [];
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

function normalizePhaseKey(rawPhase) {
  const normalized = normalizeText(String(rawPhase || ""));
  if (normalized === "round of 16" || normalized === "round_of_16") return "ROUND_OF_16";
  if (normalized === "quarter finals" || normalized === "quarter") return "QUARTER";
  if (normalized === "semi finals" || normalized === "semi") return "SEMI";
  if (normalized === "playoff" || normalized === "play offs" || normalized === "play-off") return "PLAYOFF";
  if (normalized === "league") return "LEAGUE";
  if (normalized === "final") return "FINAL";
  return String(rawPhase || "").toUpperCase();
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

function findKnockoutMatchByTeams(phase, homeTeam, awayTeam) {
  return (knockoutResults || []).find(
    (match) =>
      match.phase === phase &&
      compareNormalizedNames(match.homeTeam, homeTeam) &&
      compareNormalizedNames(match.awayTeam, awayTeam)
  );
}

function parseFormsTimestamp(row) {
  if (!row || typeof row !== "object") return Number.NaN;
  const candidates = [
    row.Timestamp,
    row.timestamp,
    row["Carimbo de data/hora"],
    row["Carimbo de data/hora (GMT-03:00)"],
    row["Data/hora"],
    row["Data e hora"],
    row["Submitted at"],
  ];
  const raw = String(candidates.find((value) => String(value || "").trim()) || "").trim();
  if (!raw) return Number.NaN;
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function extractQuarterFormsRows(rawRows) {
  if (!Array.isArray(rawRows) || !rawRows.length) return [];

  const participantIndex = new Map(
    participants.map((participant) => [normalizeText(participant.name), participant.name])
  );
  const canonicalParticipantName = (name) =>
    participantIndex.get(normalizeText(name)) || String(name || "").trim();

  const latestByParticipant = new Map();
  rawRows.forEach((row, sourceIndex) => {
    const participant = canonicalParticipantName(resolveParticipantNameFromFormRow(row));
    if (!participant) return;

    const key = normalizeText(participant);
    const candidate = {
      participant,
      row,
      sourceIndex,
      timestamp: parseFormsTimestamp(row),
    };

    const current = latestByParticipant.get(key);
    if (!current) {
      latestByParticipant.set(key, candidate);
      return;
    }

    const currentTime = Number.isFinite(current.timestamp) ? current.timestamp : Number.NEGATIVE_INFINITY;
    const candidateTime = Number.isFinite(candidate.timestamp) ? candidate.timestamp : Number.NEGATIVE_INFINITY;
    if (candidateTime > currentTime || (candidateTime === currentTime && sourceIndex > current.sourceIndex)) {
      latestByParticipant.set(key, candidate);
    }
  });

  return [...latestByParticipant.values()].sort((a, b) =>
    a.participant.localeCompare(b.participant, "pt-BR")
  );
}

function buildQuarterScoringContext() {
  const empty = {
    byParticipant: new Map(),
    processedAt: null,
  };
  if (!Array.isArray(quarterFinalsFormsData) || !quarterFinalsFormsData.length) return empty;
  const rows = extractQuarterFormsRows(quarterFinalsFormsData);

  if (!rows.length) return empty;

  const byParticipant = new Map(
    rows.map((entry) => [
      normalizeText(entry.participant),
      { quarter: 0, superclassic: 0, hopeSolo: 0 },
    ])
  );

  const quarterLegs = qrMatches.flatMap((match) => [
    {
      id: `${match.id}_IDA`,
      sourceId: match.id,
      fieldHome: `${match.id}_ida_home`,
      fieldAway: `${match.id}_ida_away`,
      homeTeam: match.home1,
      awayTeam: match.away1,
    },
    {
      id: `${match.id}_VOLTA`,
      sourceId: match.id,
      fieldHome: `${match.id}_volta_home`,
      fieldAway: `${match.id}_volta_away`,
      homeTeam: match.home2,
      awayTeam: match.away2,
    },
  ]);

  quarterLegs.forEach((leg) => {
    const officialMatch = findKnockoutMatchByTeams("QUARTER", leg.homeTeam, leg.awayTeam);
    const officialHome = parseIntegerScore(officialMatch?.scoreFinal?.home);
    const officialAway = parseIntegerScore(officialMatch?.scoreFinal?.away);
    if (!Number.isFinite(officialHome) || !Number.isFinite(officialAway)) return;

    const officialResult = matchResultFromScores(officialHome, officialAway);
    const isSuperclassic = isEligibleSuperclassicMatch(leg.homeTeam, leg.awayTeam);
    const legHits = [];

    rows.forEach((entry) => {
      const key = normalizeText(entry.participant);
      const participantTotals = byParticipant.get(key);
      if (!participantTotals) return;

      const predictedHome = parseIntegerScore(entry.row[leg.fieldHome]);
      const predictedAway = parseIntegerScore(entry.row[leg.fieldAway]);
      if (!Number.isFinite(predictedHome) || !Number.isFinite(predictedAway)) return;

      const predictedResult = matchResultFromScores(predictedHome, predictedAway);
      if (!predictedResult || !officialResult) return;

      if (predictedHome === officialHome && predictedAway === officialAway) {
        let exactPoints = quarterScoringRules.exact;
        if (isSuperclassic) {
          participantTotals.superclassic += quarterScoringRules.exact;
          exactPoints *= 2;
        }
        participantTotals.quarter += exactPoints;
        legHits.push({
          participantKey: key,
          pointsAwarded: exactPoints,
        });
        return;
      }

      if (predictedResult === officialResult) {
        participantTotals.quarter += quarterScoringRules.result;
        legHits.push({
          participantKey: key,
          pointsAwarded: quarterScoringRules.result,
        });
      }
    });

    if (legHits.length === 1) {
      const solo = legHits[0];
      const participantTotals = byParticipant.get(solo.participantKey);
      if (!participantTotals) return;
      participantTotals.quarter += solo.pointsAwarded;
      participantTotals.hopeSolo += 1;
    }
  });

  qrMatches.forEach((match) => {
    const legMatches = [
      findKnockoutMatchByTeams("QUARTER", match.home1, match.away1),
      findKnockoutMatchByTeams("QUARTER", match.home2, match.away2),
    ].filter(Boolean);
    const qualified = legMatches.find((item) => item?.qualified)?.qualified || "";
    if (!qualified) return;

    rows.forEach((entry) => {
      const participantTotals = byParticipant.get(normalizeText(entry.participant));
      if (!participantTotals) return;
      const predictedQualified = String(entry.row[`${match.id}_classificado`] || "").trim();
      if (!predictedQualified) return;
      if (compareNormalizedNames(predictedQualified, qualified)) {
        participantTotals.quarter += quarterScoringRules.qualified;
      }
    });
  });

  return {
    byParticipant,
    processedAt: new Date().toISOString(),
  };
}

const superclassicPhaseOrder = ["LEAGUE", "PLAYOFF", "ROUND_OF_16", "QUARTER"];
const quarterScoringRules = {
  result: 1.44,
  exact: 8.64,
  qualified: 4.32,
};

function normalizeScoreToken(value) {
  const text = String(value || "").trim();
  const match = text.match(/^(\d+)\s*[xX-]\s*(\d+)$/);
  if (!match) return "";
  return `${match[1]}x${match[2]}`;
}

function parseIntegerScore(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
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

function compareNormalizedNames(a, b) {
  return normalizeText(String(a || "")) === normalizeText(String(b || ""));
}

function resolveParticipantNameFromFormRow(row) {
  if (!row || typeof row !== "object") return "";
  const candidates = [
    row.Participante,
    row.participante,
    row.Nome,
    row.nome,
    row["Nome completo"],
    row["Nome Completo"],
    row["Seu nome"],
  ];
  return String(candidates.find((value) => String(value || "").trim()) || "").trim();
}

function matchResultFromScores(homeScore, awayScore) {
  if (!Number.isFinite(homeScore) || !Number.isFinite(awayScore)) return null;
  if (homeScore > awayScore) return "HOME";
  if (awayScore > homeScore) return "AWAY";
  return "DRAW";
}

function normalizeSuperclassicPicks(rawPicks) {
  return (rawPicks || [])
    .map((pick) => ({
      participant: String(pick?.participant || "").trim(),
      pick: normalizeScoreToken(pick?.pick),
    }))
    .filter((pick) => pick.participant && pick.pick);
}

function getSuperclassicFixtureKey(label) {
  const parsed = splitFixtureLabel(label);
  if (!parsed) return normalizeText(label || "");
  return `${canonicalTeamKey(parsed.homeTeam)}::${canonicalTeamKey(parsed.awayTeam)}`;
}

function mergeSuperclassicPicks(...groups) {
  const merged = new Map();
  groups.forEach((group) => {
    (group || []).forEach((pick) => {
      const participant = String(pick?.participant || "").trim();
      const score = normalizeScoreToken(pick?.pick);
      if (!participant || !score) return;
      merged.set(normalizeText(participant), { participant, pick: score });
    });
  });
  return [...merged.values()].sort((a, b) =>
    a.participant.localeCompare(b.participant, "pt-BR")
  );
}

function buildLegacySuperclassicPicksByMatch() {
  const blocks = Array.isArray(superclassicData?.blocks) ? superclassicData.blocks : [];
  if (!blocks.length) return new Map();

  const participantsByKey = new Map(
    participants.map((participant) => [normalizeText(participant.name), participant.name])
  );
  const canonicalParticipant = (rawName) =>
    participantsByKey.get(normalizeText(rawName || "")) || String(rawName || "").trim();

  const byMatch = new Map();
  blocks.forEach((block) => {
    const submissions = Array.isArray(block?.submissions) ? block.submissions : [];
    submissions.forEach((submission) => {
      const participant = canonicalParticipant(submission?.participant);
      if (!participant) return;

      const predictions = Array.isArray(submission?.predictions) ? submission.predictions : [];
      predictions.forEach((prediction) => {
        const title = String(prediction?.title || "").trim();
        if (!title) return;

        const home = parseIntegerScore(prediction?.home);
        const away = parseIntegerScore(prediction?.away);
        if (!Number.isFinite(home) || !Number.isFinite(away)) return;

        const key = getSuperclassicFixtureKey(title);
        if (!byMatch.has(key)) {
          byMatch.set(key, new Map());
        }
        byMatch
          .get(key)
          .set(normalizeText(participant), { participant, pick: `${home}x${away}` });
      });
    });
  });

  const flattened = new Map();
  byMatch.forEach((picksMap, key) => {
    flattened.set(
      key,
      [...picksMap.values()].sort((a, b) => a.participant.localeCompare(b.participant, "pt-BR"))
    );
  });
  return flattened;
}

function buildLegacySuperclassicTitleIndex() {
  const blocks = Array.isArray(superclassicData?.blocks) ? superclassicData.blocks : [];
  const titlesByKey = new Map();

  blocks.forEach((block) => {
    const matches = Array.isArray(block?.matches) ? block.matches : [];
    matches.forEach((match) => {
      const title = String(match?.title || "").trim();
      if (!title) return;
      titlesByKey.set(getSuperclassicFixtureKey(title), title);
    });
  });

  return titlesByKey;
}

function buildAutomaticSuperclassicFixtures() {
  const fixturesByKey = new Map();
  const legacyLeaguePicksByMatch = buildLegacySuperclassicPicksByMatch();
  const legacyTitlesByMatch = buildLegacySuperclassicTitleIndex();
  const officialScoreByTeams = new Map(
    (leaguePhaseResults || []).map((match) => [
      `${canonicalTeamKey(match.homeTeam)}::${canonicalTeamKey(match.awayTeam)}`,
      `${match.scoreFinal.home}x${match.scoreFinal.away}`,
    ])
  );

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

      const title = `${parsed.homeTeam} x ${parsed.awayTeam}`;
      const titleKey = getSuperclassicFixtureKey(title);
      const phasePicks = normalizeSuperclassicPicks(fixture.picks);
      const fallbackPicks =
        phaseKey === "LEAGUE" ? legacyLeaguePicksByMatch.get(titleKey) || [] : [];

      upsertFixture({
        phase: phaseKey,
        phaseDetail,
        title,
        official:
          phaseKey === "LEAGUE"
            ? officialScoreByTeams.get(
                `${canonicalTeamKey(parsed.homeTeam)}::${canonicalTeamKey(parsed.awayTeam)}`
              ) || normalizeScoreToken(fixture.official)
            : normalizeScoreToken(fixture.official),
        picks: mergeSuperclassicPicks(fallbackPicks, phasePicks),
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

  const hasLeaguePicks = [...fixturesByKey.values()].some(
    (fixture) => fixture.phase === "LEAGUE" && (fixture.picks || []).length > 0
  );

  if (!hasLeaguePicks && legacyLeaguePicksByMatch.size) {
    legacyLeaguePicksByMatch.forEach((picks, matchKey) => {
      const fallbackTitle = legacyTitlesByMatch.get(matchKey);
      if (!fallbackTitle) return;

      const parsed = splitFixtureLabel(fallbackTitle);
      if (!parsed) return;
      if (!isEligibleSuperclassicMatch(parsed.homeTeam, parsed.awayTeam)) return;

      upsertFixture({
        phase: "LEAGUE",
        phaseDetail: "Primeira fase",
        title: `${parsed.homeTeam} x ${parsed.awayTeam}`,
        official:
          officialScoreByTeams.get(
            `${canonicalTeamKey(parsed.homeTeam)}::${canonicalTeamKey(parsed.awayTeam)}`
          ) || "",
        picks: mergeSuperclassicPicks(picks),
      });
    });
  }

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
  if (PUBLIC_CONSULT_MODE) return PUBLIC_ACCESS_LABEL;
  return getParticipantById(currentUserId)?.name || loginUser.value.trim() || "Visitante";
}

function createDefaultTournamentOutcome() {
  return {
    champion: "",
    scorer: "",
    assist: "",
    updatedAt: "",
    updatedBy: "",
    source: "none",
  };
}

function hasTournamentOutcomeCsvConfigured() {
  return Boolean(String(tournamentOutcomeFormsConfig?.csvUrl || "").trim());
}

function resolveFirstNonEmptyField(row, aliases) {
  if (!row || typeof row !== "object") return "";

  for (const alias of aliases) {
    const directValue = String(row[alias] || "").trim();
    if (directValue) return directValue;
  }

  const normalizedAliases = new Set(aliases.map((alias) => normalizeText(alias)));
  for (const [key, value] of Object.entries(row)) {
    if (!normalizedAliases.has(normalizeText(key))) continue;
    const parsedValue = String(value || "").trim();
    if (parsedValue) return parsedValue;
  }

  return "";
}

function extractLatestTournamentOutcomeFromForms(rawRows) {
  if (!Array.isArray(rawRows) || !rawRows.length) return createDefaultTournamentOutcome();

  const candidates = rawRows
    .map((row, sourceIndex) => {
      const champion = resolveFirstNonEmptyField(row, [
        "Campeão oficial",
        "Campeao oficial",
        "Campeão",
        "Campeao",
        "Champion",
        "Time campeão",
        "Time campeao",
      ]);
      const scorer = resolveFirstNonEmptyField(row, [
        "Artilheiro oficial",
        "Artilheiro",
        "Top Scorer",
        "Scorer",
      ]);
      const assist = resolveFirstNonEmptyField(row, [
        "Garçom oficial",
        "Garcom oficial",
        "Garçom",
        "Garcom",
        "Assist king",
        "Assist",
      ]);
      const updatedBy = resolveFirstNonEmptyField(row, [
        "Atualizado por",
        "Atualizado_por",
        "Responsável",
        "Responsavel",
        "Admin",
      ]);

      return {
        champion,
        scorer,
        assist,
        updatedBy,
        timestamp: parseFormsTimestamp(row),
        sourceIndex,
      };
    })
    .filter((entry) => entry.champion || entry.scorer || entry.assist);

  if (!candidates.length) {
    return createDefaultTournamentOutcome();
  }

  candidates.sort((a, b) => {
    const timeA = Number.isFinite(a.timestamp) ? a.timestamp : Number.NEGATIVE_INFINITY;
    const timeB = Number.isFinite(b.timestamp) ? b.timestamp : Number.NEGATIVE_INFINITY;
    if (timeA !== timeB) return timeA - timeB;
    return a.sourceIndex - b.sourceIndex;
  });

  const latest = candidates[candidates.length - 1];
  return {
    champion: latest.champion,
    scorer: latest.scorer,
    assist: latest.assist,
    updatedAt: Number.isFinite(latest.timestamp) ? new Date(latest.timestamp).toISOString() : "",
    updatedBy: latest.updatedBy || "Forms oficial",
    source: "forms",
  };
}

function loadTournamentOutcome() {
  if (hasTournamentOutcomeCsvConfigured()) {
    return {
      ...createDefaultTournamentOutcome(),
      ...extractLatestTournamentOutcomeFromForms(tournamentOutcomeFormsData || []),
      source: "forms",
    };
  }

  try {
    const raw = localStorage.getItem(storageKeys.tournamentOutcome);
    const parsed = raw ? JSON.parse(raw) : {};
    if (!parsed || typeof parsed !== "object") return createDefaultTournamentOutcome();
    return {
      ...createDefaultTournamentOutcome(),
      ...parsed,
      source: "legacy-local",
    };
  } catch (error) {
    console.error("Falha ao ler dados de encerramento do bolão.", error);
    return createDefaultTournamentOutcome();
  }
}

function renderClosingAuditChip(status, points) {
  if (status === "hit") {
    return `<span class="result-chip hit">+${formatPoints(points)}</span>`;
  }
  if (status === "miss") {
    return `<span class="result-chip miss">0</span>`;
  }
  if (status === "missing") {
    return `<span class="result-chip">Sem pick</span>`;
  }
  return `<span class="result-chip">Pendente</span>`;
}

function renderClosingAuditTable(leaderboard, closingContext) {
  if (!Array.isArray(leaderboard) || !leaderboard.length) {
    return `<p class="muted">Sem participantes para auditar.</p>`;
  }

  const championHeader = closingContext?.hasChampionPicks
    ? "Campeão (+7)"
    : "Campeão (+7) • aguardando pick na base";

  return `
    <div class="table-wrap closing-audit-table-wrap">
      <table class="dashboard-table is-wide compact-table closing-audit-table">
        <thead>
          <tr>
            <th>Participante</th>
            <th>${championHeader}</th>
            <th>Artilheiro (+15)</th>
            <th>Garçom (+15)</th>
            <th>Favorito campeão (+10)</th>
            <th>Bônus de fechamento</th>
          </tr>
        </thead>
        <tbody>
          ${leaderboard
            .map((row) => {
              const audit =
                closingContext?.byParticipant?.get(normalizeText(row.participant.name)) ||
                createEmptyClosingAuditRow();
              return `
                <tr>
                  <td>${row.participant.name}</td>
                  <td>${renderClosingAuditChip(audit.championStatus, audit.championPoints)}</td>
                  <td>${renderClosingAuditChip(audit.scorerStatus, audit.scorerPoints)}</td>
                  <td>${renderClosingAuditChip(audit.assistStatus, audit.assistPoints)}</td>
                  <td>${renderClosingAuditChip(
                    audit.favoriteStatus,
                    audit.favoriteChampionPoints
                  )}</td>
                  <td><strong>${formatPoints(audit.totalBonus || 0)}</strong></td>
                </tr>
              `;
            })
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderTournamentOutcomePanel(leaderboard, flashMessage = "") {
  if (!tournamentOutcomePanel) return;

  const outcome = loadTournamentOutcome();
  const safeLeaderboard = Array.isArray(leaderboard) ? leaderboard : [];
  const closingContext =
    latestClosingAuditContext || buildClosingAuditContext(safeLeaderboard, outcome);
  const closingAuditMarkup = renderClosingAuditTable(safeLeaderboard, closingContext);
  const csvConfigured = hasTournamentOutcomeCsvConfigured();
  const formUrl = String(tournamentOutcomeFormsConfig?.formUrl || "").trim();
  const sourceLabel =
    outcome.source === "forms"
      ? "Fonte oficial: Forms (somente admin)"
      : "Fonte local (legado do navegador)";
  const updatedAtLabel = outcome.updatedAt
    ? new Date(outcome.updatedAt).toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  tournamentOutcomePanel.innerHTML = `
    <article class="rules-card">
      <section class="form-block">
        <p class="muted">Consulta oficial em modo leitura. O preenchimento de campeão, artilheiro e garçom deve ser feito no Forms do admin.</p>
        <div class="result-chip-row" style="margin: 10px 0 12px;">
          <span class="result-chip ${csvConfigured ? "hit" : ""}">Leitura CSV: ${csvConfigured ? "ativa" : "pendente"}</span>
          <span class="result-chip">${sourceLabel}</span>
          ${
            formUrl
              ? `<a class="ghost-button" href="${formUrl}" target="_blank" rel="noopener noreferrer">Abrir Forms (admin)</a>`
              : ""
          }
        </div>
        <div class="classification-grid">
          <label>
            Campeão oficial
            <input type="text" value="${outcome.champion || "Pendente"}" disabled />
          </label>
          <label>
            Artilheiro oficial
            <input type="text" value="${outcome.scorer || "Pendente"}" disabled />
          </label>
          <label>
            Garçom oficial
            <input type="text" value="${outcome.assist || "Pendente"}" disabled />
          </label>
        </div>
        ${
          updatedAtLabel
            ? `<p class="muted" style="margin-top:10px;">Última atualização: ${updatedAtLabel}${outcome.updatedBy ? ` • por ${outcome.updatedBy}` : ""}</p>`
            : `<p class="muted" style="margin-top:10px;">Sem preenchimento oficial ainda.</p>`
        }
        ${
          !csvConfigured
            ? `
              <p class="muted" style="margin-top: 10px;">${tournamentOutcomeFormsConfig?.description || "Configure a URL CSV do Forms para ativar essa seção."}</p>
              <div class="result-chip-row" style="margin-top: 10px;">
                ${(tournamentOutcomeFormsConfig?.expectedColumns || [])
                  .map((column) => `<span class="result-chip">${column}</span>`)
                  .join("")}
              </div>
            `
            : ""
        }
        <section class="closing-audit-block">
          <h3>Auditoria automática do fechamento</h3>
          <p class="muted">Quando campeão, artilheiro e garçom forem atualizados no Forms, o ranking soma os bônus finais automaticamente e mostra o detalhamento por participante.</p>
          ${closingAuditMarkup}
        </section>
        <p id="tournament-outcome-feedback" class="feedback ${flashMessage ? "success" : ""}">${flashMessage || ""}</p>
      </section>
    </article>
  `;
}

const liveRankingPhaseRules = {
  LEAGUE: {
    result: 0.85,
  },
  PLAYOFF: {
    result: 0.5,
    exact: 3,
  },
  ROUND_OF_16: {
    result: 1,
    exact: 6,
  },
};

function roundToTwo(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function createEmptyPhaseScoreRow() {
  return {
    firstPhase: 0,
    playoff: 0,
    roundOf16: 0,
    superclassic: 0,
    hopeSolo: 0,
  };
}

function parseScoreFromText(value) {
  const normalized = normalizeScoreToken(value);
  if (!normalized) return null;
  const [homeToken, awayToken] = normalized.split("x");
  const home = parseIntegerScore(homeToken);
  const away = parseIntegerScore(awayToken);
  if (!Number.isFinite(home) || !Number.isFinite(away)) return null;
  return { home, away };
}

function resolveTrendTokenFromPick(value, homeTeam, awayTeam) {
  const normalized = normalizeText(String(value || ""));
  if (!normalized) return null;
  if (normalized === "empate" || normalized === "draw") return "DRAW";

  const pickKey = canonicalTeamKey(String(value || ""));
  if (pickKey === canonicalTeamKey(homeTeam)) return "HOME";
  if (pickKey === canonicalTeamKey(awayTeam)) return "AWAY";
  return null;
}

function resolveFixtureTeams(fixture) {
  if (!fixture || typeof fixture !== "object") return null;
  const home = String(fixture.home || "").trim();
  const away = String(fixture.away || "").trim();
  if (home && away) {
    return {
      homeTeam: home,
      awayTeam: away,
    };
  }
  return splitFixtureLabel(String(fixture.label || "").trim());
}

function isLeagueClassificationFixture(fixture) {
  return /^classificado em\s+\d+/i.test(String(fixture?.label || "").trim());
}

function buildLiveScoreLookupMaps() {
  const leagueByTeams = new Map();
  const knockoutByPhaseTeams = new Map();

  (liveLeaguePhaseResults || []).forEach((match) => {
    const home = parseIntegerScore(match?.scoreFinal?.home);
    const away = parseIntegerScore(match?.scoreFinal?.away);
    if (!Number.isFinite(home) || !Number.isFinite(away)) return;
    const key = `${canonicalTeamKey(match.homeTeam)}::${canonicalTeamKey(match.awayTeam)}`;
    leagueByTeams.set(key, { home, away });
  });

  (knockoutResults || []).forEach((match) => {
    if (!match?.phase || match.phase === "LEAGUE") return;
    const home = parseIntegerScore(match?.scoreFinal?.home);
    const away = parseIntegerScore(match?.scoreFinal?.away);
    if (!Number.isFinite(home) || !Number.isFinite(away)) return;
    const key = `${match.phase}::${canonicalTeamKey(match.homeTeam)}::${canonicalTeamKey(match.awayTeam)}`;
    knockoutByPhaseTeams.set(key, { home, away });
  });

  return {
    leagueByTeams,
    knockoutByPhaseTeams,
  };
}

function computePhaseScoringSnapshot({ useLiveOfficial = false } = {}) {
  const byParticipant = new Map(
    participants.map((participant) => [normalizeText(participant.name), createEmptyPhaseScoreRow()])
  );

  const ensureParticipantScore = (participantName) => {
    const key = normalizeText(String(participantName || ""));
    if (!key) return null;
    if (!byParticipant.has(key)) {
      byParticipant.set(key, createEmptyPhaseScoreRow());
    }
    return byParticipant.get(key);
  };

  const lookups = buildLiveScoreLookupMaps();
  const phaseDescriptors = [
    { phase: "LEAGUE", field: "firstPhase" },
    { phase: "PLAYOFF", field: "playoff" },
    { phase: "ROUND_OF_16", field: "roundOf16" },
  ];

  phaseDescriptors.forEach(({ phase, field }) => {
    const rules = liveRankingPhaseRules[phase];
    if (!rules) return;

    const fixtures = backtestData?.phases?.[phase]?.fixtures || [];
    fixtures.forEach((fixture) => {
      if (phase === "LEAGUE" && isLeagueClassificationFixture(fixture)) {
        return;
      }

      const teams = resolveFixtureTeams(fixture);
      if (!teams) return;

      let officialScore = null;
      if (useLiveOfficial) {
        if (phase === "LEAGUE") {
          const leagueKey = `${canonicalTeamKey(teams.homeTeam)}::${canonicalTeamKey(teams.awayTeam)}`;
          officialScore = lookups.leagueByTeams.get(leagueKey) || null;
        } else {
          const knockoutKey = `${phase}::${canonicalTeamKey(teams.homeTeam)}::${canonicalTeamKey(teams.awayTeam)}`;
          officialScore = lookups.knockoutByPhaseTeams.get(knockoutKey) || null;
        }
      }

      let officialTrend = null;
      if (phase === "LEAGUE") {
        if (officialScore) {
          officialTrend = matchResultFromScores(officialScore.home, officialScore.away);
        } else {
          officialTrend = resolveTrendTokenFromPick(
            fixture.official,
            teams.homeTeam,
            teams.awayTeam
          );
        }
      } else {
        const fallbackScore = parseScoreFromText(fixture.official);
        const resolvedScore = officialScore || fallbackScore;
        if (!resolvedScore) return;
        officialScore = resolvedScore;
        officialTrend = matchResultFromScores(officialScore.home, officialScore.away);
      }

      if (!officialTrend) return;

      const isSuperclassicKnockout =
        phase !== "LEAGUE" &&
        superclassicEligiblePhases.has(phase) &&
        isEligibleSuperclassicMatch(teams.homeTeam, teams.awayTeam);

      const hits = [];
      (fixture.picks || []).forEach((pick) => {
        const participantScores = ensureParticipantScore(pick?.participant);
        if (!participantScores) return;

        let pointsAwarded = 0;
        let superclassicBonus = 0;

        if (phase === "LEAGUE") {
          const predictedTrend = resolveTrendTokenFromPick(
            pick?.pick,
            teams.homeTeam,
            teams.awayTeam
          );
          if (predictedTrend && predictedTrend === officialTrend) {
            pointsAwarded = rules.result;
          }
        } else {
          const predictedScore = parseScoreFromText(pick?.pick);
          if (!predictedScore) return;

          const predictedTrend = matchResultFromScores(
            predictedScore.home,
            predictedScore.away
          );

          if (
            predictedScore.home === officialScore.home &&
            predictedScore.away === officialScore.away
          ) {
            pointsAwarded = rules.exact;
            if (isSuperclassicKnockout) {
              superclassicBonus = rules.exact;
              pointsAwarded += superclassicBonus;
            }
          } else if (predictedTrend && predictedTrend === officialTrend) {
            pointsAwarded = rules.result;
          }
        }

        if (!pointsAwarded) return;
        participantScores[field] += pointsAwarded;
        if (superclassicBonus) {
          participantScores.superclassic += superclassicBonus;
        }
        hits.push({
          participantScores,
          pointsAwarded,
        });
      });

      if (hits.length === 1) {
        hits[0].participantScores[field] += hits[0].pointsAwarded;
        hits[0].participantScores.hopeSolo += 1;
      }
    });
  });

  byParticipant.forEach((row) => {
    row.firstPhase = roundToTwo(row.firstPhase);
    row.playoff = roundToTwo(row.playoff);
    row.roundOf16 = roundToTwo(row.roundOf16);
    row.superclassic = roundToTwo(row.superclassic);
    row.hopeSolo = roundToTwo(row.hopeSolo);
  });

  return {
    byParticipant,
  };
}

const closingScoringRules = {
  champion: 7,
  scorer: 15,
  assist: 15,
  favoriteChampion: 10,
};

function normalizeLooseToken(value) {
  const normalized = normalizeText(String(value || ""));
  return normalized.replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();
}

function resolveChampionPickFromRow(row) {
  const candidates = [
    row?.champion_pick,
    row?.championPick,
    row?.champion,
    row?.campeao_pick,
    row?.campeao,
  ];
  return String(candidates.find((item) => String(item || "").trim()) || "").trim();
}

function createEmptyClosingAuditRow() {
  return {
    championPoints: 0,
    scorerPoints: 0,
    assistPoints: 0,
    favoriteChampionPoints: 0,
    totalBonus: 0,
    championStatus: "pending",
    scorerStatus: "pending",
    assistStatus: "pending",
    favoriteStatus: "pending",
    championPick: "",
  };
}

function buildClosingAuditContext(rows, outcome = loadTournamentOutcome()) {
  const byParticipant = new Map();
  const championOfficialKey = canonicalTeamKey(outcome?.champion);
  const scorerOfficialKey = normalizeLooseToken(outcome?.scorer);
  const assistOfficialKey = normalizeLooseToken(outcome?.assist);
  let hasChampionPicks = false;

  (rows || []).forEach((row) => {
    const audit = createEmptyClosingAuditRow();
    const participantKey = normalizeText(row?.participant?.name || "");
    const championPick = String(row?.championPick || "").trim();
    const championPickKey = canonicalTeamKey(championPick);
    const hasChampionPick = Boolean(championPick && championPick !== "-");
    if (hasChampionPick) {
      hasChampionPicks = true;
      audit.championPick = championPick;
    }

    if (championOfficialKey) {
      if (hasChampionPick) {
        if (championPickKey === championOfficialKey) {
          audit.championStatus = "hit";
          audit.championPoints = closingScoringRules.champion;
        } else {
          audit.championStatus = "miss";
        }
      } else {
        audit.championStatus = "missing";
      }

      const favoriteKey = canonicalTeamKey(row?.favoriteTeam);
      if (favoriteKey && favoriteKey === championOfficialKey) {
        audit.favoriteStatus = "hit";
        audit.favoriteChampionPoints = closingScoringRules.favoriteChampion;
      } else {
        audit.favoriteStatus = "miss";
      }
    }

    if (scorerOfficialKey) {
      const scorerPickKey = normalizeLooseToken(row?.scorerPick);
      if (scorerPickKey && scorerPickKey === scorerOfficialKey) {
        audit.scorerStatus = "hit";
        audit.scorerPoints = closingScoringRules.scorer;
      } else {
        audit.scorerStatus = "miss";
      }
    }

    if (assistOfficialKey) {
      const assistPickKey = normalizeLooseToken(row?.assistPick);
      if (assistPickKey && assistPickKey === assistOfficialKey) {
        audit.assistStatus = "hit";
        audit.assistPoints = closingScoringRules.assist;
      } else {
        audit.assistStatus = "miss";
      }
    }

    audit.totalBonus = roundToTwo(
      audit.championPoints +
        audit.scorerPoints +
        audit.assistPoints +
        audit.favoriteChampionPoints
    );
    byParticipant.set(participantKey, audit);
  });

  return {
    byParticipant,
    hasChampionPicks,
    official: outcome,
  };
}

function getRankingRows() {
  if (!backtestData || !backtestData.ranking) return [];

  const quarterContext = buildQuarterScoringContext();
  const hasApiMatches =
    Array.isArray(window.apiMatchesData?.matches) &&
    window.apiMatchesData.matches.length > 0;
  const baselineSnapshot = computePhaseScoringSnapshot({ useLiveOfficial: false });
  const liveSnapshot = hasApiMatches
    ? computePhaseScoringSnapshot({ useLiveOfficial: true })
    : baselineSnapshot;

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
    const quarterAdd = quarterContext.byParticipant.get(normalizeText(participant.name)) || {
      quarter: 0,
      superclassic: 0,
      hopeSolo: 0,
    };

    const participantKey = normalizeText(participant.name);
    const baselineScores =
      baselineSnapshot.byParticipant.get(participantKey) || createEmptyPhaseScoreRow();
    const liveScores = liveSnapshot.byParticipant.get(participantKey) || baselineScores;

    const deltaFirstPhase = roundToTwo(liveScores.firstPhase - baselineScores.firstPhase);
    const deltaPlayoff = roundToTwo(liveScores.playoff - baselineScores.playoff);
    const deltaRoundOf16 = roundToTwo(liveScores.roundOf16 - baselineScores.roundOf16);
    const deltaSuperclassic = roundToTwo(liveScores.superclassic - baselineScores.superclassic);
    const deltaHopeSolo = roundToTwo(liveScores.hopeSolo - baselineScores.hopeSolo);

    return { 
      participant: participant,
      total:
        row.total_points +
        deltaFirstPhase +
        deltaPlayoff +
        deltaRoundOf16 +
        quarterAdd.quarter,
      firstPhase: row.first_phase_points + deltaFirstPhase,
      playoff: row.playoff_points + deltaPlayoff,
      roundOf16: row.round_of_16_points + deltaRoundOf16,
      quarter: quarterAdd.quarter,
      superclassic:
        row.superclassic_points + deltaSuperclassic + quarterAdd.superclassic,
      hopeSolo: row.hope_solo_hits + deltaHopeSolo + quarterAdd.hopeSolo,
      favoriteTeam: row.favorite_team || "-",
      championPick: resolveChampionPickFromRow(row) || "-",
      scorerPick: row.scorer_pick || "-",
      assistPick: row.assist_pick || "-"
    };
  });

  const outcome = loadTournamentOutcome();
  const closingContext = buildClosingAuditContext(mapped, outcome);
  latestClosingAuditContext = closingContext;

  const mappedWithClosing = mapped.map((row) => {
    const audit =
      closingContext.byParticipant.get(normalizeText(row.participant.name)) ||
      createEmptyClosingAuditRow();
    return {
      ...row,
      closingBonus: audit.totalBonus,
      closingAudit: audit,
      total: roundToTwo(row.total + audit.totalBonus),
    };
  });

  mappedWithClosing.sort((a, b) => b.total - a.total);
  return mappedWithClosing.map((r, i) => ({ ...r, position: i + 1 }));
}

function formatPoints(value) {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: value % 1 ? 2 : 0,
    maximumFractionDigits: 2,
  });
}

function formatKickoff(value) {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleDateString("pt-BR", {
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
  if (PUBLIC_CONSULT_MODE) {
    loginUserList.innerHTML = "";
    if (loginUser) {
      loginUser.value = "";
      loginUser.disabled = true;
    }
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
  const overviewFirstCard = PUBLIC_CONSULT_MODE
    ? {
      label: "Consulta pública",
      value: `${leaderboard.length}`,
      note: "palpiteiros na base oficial",
    }
    : {
      label: "Sua posição",
      value: currentRow ? `${currentRow.position}º` : "-",
      note: currentRow ? `${currentRow.participant.name} com ${formatPoints(currentRow.total)} pts` : "Faça login para ver",
    };

  overviewCards.innerHTML = [
    overviewFirstCard,
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
      label: "Base oficial",
      value: "Planilha do bolão",
      note: "ranking auditado com as regras oficiais",
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
    userSummary.innerHTML = PUBLIC_CONSULT_MODE
      ? "<p class='muted'>Acesso único liberado para todos. O site está em modo consulta pública.</p>"
      : "<p class='muted'>Faça login para liberar a área exclusiva.</p>";
    return;
  }

  const row = leaderboard.find((item) => item.participant.id === participant.id);
  userSummary.innerHTML = `
    <p class="eyebrow">Participante logado</p>
    <h2>${participant.name}</h2>
    <p class="muted">Posição atual: ${row?.position || "-"}º</p>
    <p class="muted">Total oficial: ${row ? formatPoints(row.total) : "-"} pontos</p>
    <p class="muted">1ª fase: ${row ? formatPoints(row.firstPhase) : "-"} • Playoff: ${row ? formatPoints(row.playoff) : "-"} • Oitavas: ${row ? formatPoints(row.roundOf16) : "-"} • Quartas: ${row ? formatPoints(row.quarter || 0) : "-"}</p>
  `;
}

function renderAwards(leaderboard) {
  const leader = leaderboard[0];
  const playoffLeader = [...leaderboard].sort((a, b) => b.playoff - a.playoff)[0];
  const roundOf16Leader = [...leaderboard].sort((a, b) => b.roundOf16 - a.roundOf16)[0];
  const tournamentOutcome = loadTournamentOutcome();

  awards.innerHTML = [
    ["Liderança geral", leader ? `${leader.participant.name} com ${formatPoints(leader.total)} pts` : "-"],
    ["Melhor playoff", playoffLeader ? `${playoffLeader.participant.name} com ${formatPoints(playoffLeader.playoff)} pts` : "-" ],
    ["Melhor oitavas", roundOf16Leader ? `${roundOf16Leader.participant.name} com ${formatPoints(roundOf16Leader.roundOf16)} pts` : "-" ],
    ["Campeão oficial", tournamentOutcome.champion || "Pendente"],
    ["Artilheiro oficial", tournamentOutcome.scorer || "Pendente"],
    ["Garçom oficial", tournamentOutcome.assist || "Pendente"],
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
    const leagueSource = liveLeaguePhaseResults.length ? liveLeaguePhaseResults : leaguePhaseResults;
    const grouped = leagueSource.reduce((acc, match) => {
      const matchdayNumber = String(match.matchday || "Matchday 0").replace(/\D/g, "") || "0";
      if (!acc[matchdayNumber]) acc[matchdayNumber] = [];
      acc[matchdayNumber].push(match);
      return acc;
    }, {});
    const matchdayKeys = Object.keys(grouped).sort((a, b) => Number(a) - Number(b));
    const effectiveMatchday = matchdayKeys.includes(activeLeagueMatchday)
      ? activeLeagueMatchday
      : (matchdayKeys[0] || "1");
    if (effectiveMatchday !== activeLeagueMatchday) {
      activeLeagueMatchday = effectiveMatchday;
    }

    const phaseTabs = `
      <div class="tabs-bar" style="margin-bottom: 24px;">
        ${matchdayKeys.map(md => `
          <button class="tab-button ${activeLeagueMatchday === md ? "is-active" : ""}" onclick="setLeagueMatchday('${md}')">Rodada ${md}</button>
        `).join("")}
      </div>
    `;

    const matchesForActiveMatchday = grouped[effectiveMatchday] || [];
    
    const phasesMarkup = renderGroup(`Rodada ${effectiveMatchday}`, matchesForActiveMatchday, (match, index) =>
      renderMatchCard(match, {
        statusLabel: match.status || undefined,
        secondaryLine: [
          formatKickoff(match.kickoff),
        ]
          .filter(Boolean)
          .join(" • "),
        matchId: createLeagueMatchId(`Matchday ${effectiveMatchday}`, index),
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
    predictionsForm.innerHTML = PUBLIC_CONSULT_MODE
      ? "<p class='muted'>Modo consulta pública ativo: recorte individual por participante está desativado.</p>"
      : "<p class='muted'>Entre com um participante para ver o recorte oficial atualizado até as oitavas.</p>";
    return;
  }

  const row = participantSnapshots[participant.id];
  if (!row) {
    predictionsForm.innerHTML = "<p class='muted'>Ainda não encontrei o recorte oficial desse participante na base atual.</p>";
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
          Base de cálculo
          <input value="Planilha oficial do bolão" disabled />
        </label>
      </div>
    </section>
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

  const isValidPlacementName = (value) => {
    const text = String(value || "").trim();
    return Boolean(text && text !== "-" && text !== "?");
  };

  const parseGuanabaraWinners = (value) => {
    const text = String(value || "").trim();
    if (!text) return [];
    return text
      .split(/\s*\/\s*|\s*,\s*|\s+e\s+|\s*&\s*/i)
      .map((item) => item.trim())
      .filter((item) => isValidPlacementName(item));
  };

  const podiumMap = new Map();
  const ensurePodiumEntry = (name) => {
    const displayName = String(name || "").trim();
    if (!isValidPlacementName(displayName)) return null;
    const key = normalizeText(displayName);
    if (!podiumMap.has(key)) {
      podiumMap.set(key, {
        name: displayName,
        champion: 0,
        vice: 0,
        third: 0,
        fourth: 0,
        guanabara: 0,
      });
    }
    return podiumMap.get(key);
  };

  winnersHistory.forEach((row) => {
    const championEntry = ensurePodiumEntry(row.first);
    if (championEntry) championEntry.champion += 1;

    const viceEntry = ensurePodiumEntry(row.second);
    if (viceEntry) viceEntry.vice += 1;

    const thirdEntry = ensurePodiumEntry(row.third);
    if (thirdEntry) thirdEntry.third += 1;

    const fourthEntry = ensurePodiumEntry(row.fourth);
    if (fourthEntry) fourthEntry.fourth += 1;

    parseGuanabaraWinners(row.guanabara).forEach((winnerName) => {
      const guanabaraEntry = ensurePodiumEntry(winnerName);
      if (guanabaraEntry) guanabaraEntry.guanabara += 1;
    });
  });

  const hallRows = [...podiumMap.values()]
    .map((row) => ({
      ...row,
      podiums: row.champion + row.vice + row.third + row.fourth,
    }))
    .sort((a, b) =>
      b.champion - a.champion
      || b.vice - a.vice
      || b.third - a.third
      || b.fourth - a.fourth
      || b.guanabara - a.guanabara
      || b.podiums - a.podiums
      || a.name.localeCompare(b.name, "pt-BR")
    );

  if (!hallRows.length) {
    hallOfFame.innerHTML = "<p class='muted'>Sem dados de pódio para montar o Hall da Fama.</p>";
    return;
  }

  hallOfFame.innerHTML = `
    <p class="muted">Ordem priorizada por títulos de campeão (desempate: vice, 3º, 4º e Taça Guanabara).</p>
    <div class="table-wrap">
      <table class="dashboard-table is-wide hall-fame-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Palpiteiro</th>
            <th>Campeão</th>
            <th>Vice</th>
            <th>3º</th>
            <th>4º</th>
            <th>Taça Guanabara</th>
            <th>Pódios</th>
          </tr>
        </thead>
        <tbody>
          ${hallRows
            .map(
              (row, index) => `
                <tr>
                  <td>${index + 1}</td>
                  <td><strong>${row.name}</strong></td>
                  <td>
                    <span class="hall-champion-pill">
                      🏆 ${row.champion}
                    </span>
                  </td>
                  <td>${row.vice}</td>
                  <td>${row.third}</td>
                  <td>${row.fourth}</td>
                  <td>${row.guanabara}</td>
                  <td><strong>${row.podiums}</strong></td>
                </tr>
              `
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
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

  const drawTokens = new Set(["empate", "draw", "x", "igual"]);
  const parseScoreToken = (token) => {
    const normalized = normalizeScoreToken(token);
    if (!normalized) return null;
    const [homeRaw, awayRaw] = normalized.split("x");
    const home = Number(homeRaw);
    const away = Number(awayRaw);
    if (!Number.isFinite(home) || !Number.isFinite(away)) return null;
    return { home, away, token: normalized };
  };
  const resolveLeagueHitType = (fixture, pick) => {
    const pickText = String(pick || "").trim();
    const officialScore = parseScoreToken(fixture.official);
    if (!pickText || !officialScore) return "";

    const pickScore = parseScoreToken(pickText);
    if (pickScore && pickScore.token === officialScore.token) return "exact";

    const officialResult = matchResultFromScores(officialScore.home, officialScore.away);
    if (!officialResult) return "";

    let predictedResult = null;
    if (pickScore) {
      predictedResult = matchResultFromScores(pickScore.home, pickScore.away);
    } else {
      const fixtureTeams = splitFixtureLabel(fixture.title) || { homeTeam: "", awayTeam: "" };
      const normalizedPick = normalizeText(pickText);
      if (drawTokens.has(normalizedPick)) {
        predictedResult = "DRAW";
      } else if (compareNormalizedNames(pickText, fixtureTeams.homeTeam)) {
        predictedResult = "HOME";
      } else if (compareNormalizedNames(pickText, fixtureTeams.awayTeam)) {
        predictedResult = "AWAY";
      }
    }

    return predictedResult && predictedResult === officialResult ? "trend" : "";
  };

  const resolveScoreHitType = (officialScoreText, pickText) => {
    const officialScore = parseScoreToken(officialScoreText);
    const predictedScore = parseScoreToken(pickText);
    if (!officialScore || !predictedScore) return "";

    if (officialScore.token === predictedScore.token) return "exact";

    const officialResult = matchResultFromScores(officialScore.home, officialScore.away);
    const predictedResult = matchResultFromScores(predictedScore.home, predictedScore.away);
    if (!officialResult || !predictedResult) return "";

    return officialResult === predictedResult ? "trend" : "";
  };

  const renderSuperclassicMobileBoard = ({
    matchCols,
    participantNames,
    picksByParticipant,
    resolveHitType,
  }) => `
    <div class="superclassic-mobile-board">
      ${matchCols
        .map((match) => {
          const picks = participantNames
            .map((participantName) => {
              const picksByMatch = picksByParticipant.get(participantName) || new Map();
              const value = picksByMatch.get(match.key) || "-";
              if (value === "-") return null;
              return {
                participantName,
                value,
                hitType: resolveHitType(match, value),
              };
            })
            .filter(Boolean);

          const exactHits = picks.filter((entry) => entry.hitType === "exact");
          const trendHits = picks.filter((entry) => entry.hitType === "trend");
          const otherPicks = picks.filter(
            (entry) => entry.hitType !== "exact" && entry.hitType !== "trend"
          );

          const renderPickRows = (entries, tone = "") =>
            entries
              .map(
                (entry) => `
                  <li class="prediction-mobile-row ${tone}">
                    <span class="prediction-mobile-name">${entry.participantName}</span>
                    <span class="prediction-mobile-pick">${entry.value}</span>
                  </li>
                `
              )
              .join("");

          return `
            <article class="prediction-mobile-match">
              <header class="prediction-mobile-head">
                <p class="eyebrow">${match.detail || "Superclássico"}</p>
                <strong>${match.label || "-"}</strong>
                <span class="status-pill">Oficial: ${match.official || "pendente"}</span>
              </header>
              ${
                picks.length
                  ? `
                    <div class="prediction-mobile-stats">
                      <span class="prediction-mobile-stat exact">🎯 ${exactHits.length} exato(s)</span>
                      <span class="prediction-mobile-stat trend">📈 ${trendHits.length} tendência(s)</span>
                      <span class="prediction-mobile-stat neutral">${otherPicks.length} outro(s)</span>
                    </div>
                    ${
                      !exactHits.length && !trendHits.length
                        ? `<p class="prediction-mobile-empty-hit muted">Ninguém acertou placar exato ou tendência neste jogo.</p>`
                        : ""
                    }
                    ${
                      exactHits.length
                        ? `
                          <section class="prediction-mobile-group">
                            <h4 class="prediction-mobile-group-title">Placar exato</h4>
                            <ul class="prediction-mobile-list">
                              ${renderPickRows(exactHits, "is-exact")}
                            </ul>
                          </section>
                        `
                        : ""
                    }
                    ${
                      trendHits.length
                        ? `
                          <section class="prediction-mobile-group">
                            <h4 class="prediction-mobile-group-title">Tendência</h4>
                            <ul class="prediction-mobile-list">
                              ${renderPickRows(trendHits, "is-trend")}
                            </ul>
                          </section>
                        `
                        : ""
                    }
                    ${
                      otherPicks.length
                        ? `
                          <details class="prediction-mobile-details">
                            <summary>Ver outros palpites (${otherPicks.length})</summary>
                            <ul class="prediction-mobile-list is-secondary">
                              ${renderPickRows(otherPicks, "is-neutral")}
                            </ul>
                          </details>
                        `
                        : ""
                    }
                  `
                  : `<ul class="prediction-mobile-list"><li class="prediction-mobile-row"><span class="muted">Sem palpites neste jogo.</span></li></ul>`
              }
            </article>
          `;
        })
        .join("")}
    </div>
  `;

  const renderLeagueSuperclassicTable = (phaseFixtures) => {
    if (!phaseFixtures.length) return "";

    const legacyPicksByMatch = buildLegacySuperclassicPicksByMatch();
    const matchCols = phaseFixtures.map((fixture) => ({
      key: fixture.key,
      label: fixture.title,
      detail: fixture.phaseDetail || "1ª fase",
      official: fixture.official,
      picks: mergeSuperclassicPicks(
        legacyPicksByMatch.get(getSuperclassicFixtureKey(fixture.title)) || [],
        fixture.picks || []
      ),
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
    const mobileBoardMarkup = renderSuperclassicMobileBoard({
      matchCols,
      participantNames,
      picksByParticipant,
      resolveHitType: resolveLeagueHitType,
    });

    return `
      <article class="rules-card">
        <h3>Primeira fase: palpites e resultados dos superclássicos</h3>
        <p class="muted">${matchCols.length} jogo(s) em tabela única.</p>
        <div class="table-wrapper superclassic-table-desktop">
          <table class="predictions-matrix-table superclassic-matrix-table">
            <thead>
              <tr>
                <th class="participant-name">Participante</th>
                ${matchCols
                  .map(
                    (match, index) => `
                      <th>
                        <div class="predictions-column-subtitle">Jogo ${index + 1}</div>
                        <div class="predictions-column-title">${match.label}</div>
                        ${
                          match.official
                            ? `<div class="superclassic-official-pill">Oficial: ${match.official}</div>`
                            : `<div class="superclassic-official-pending">Oficial pendente</div>`
                        }
                      </th>
                    `
                  )
                  .join("")}
              </tr>
            </thead>
            <tbody>
              <tr class="superclassic-official-row">
                <td class="participant-name">Resultado oficial</td>
                ${matchCols
                  .map(
                    (match) => `
                      <td>
                        ${match.official || "-"}
                      </td>
                    `
                  )
                  .join("")}
              </tr>
              ${participantNames
                .map((participantName) => {
                  const picksByMatch = picksByParticipant.get(participantName) || new Map();
                  return `
                    <tr>
                      <td class="participant-name">
                        <span class="predictions-participant-cell">
                          <span class="predictions-participant-avatar">${participantName.charAt(0)}</span>
                          ${participantName}
                        </span>
                      </td>
                      ${matchCols
                        .map((match) => {
                          const pick = picksByMatch.get(match.key) || "-";
                          const hitType = resolveLeagueHitType(match, pick);
                          const className = pick === "-"
                            ? ""
                            : hitType === "exact"
                              ? "hit-exact"
                              : hitType === "trend"
                                ? "hit-trend"
                                : "";

                          return `
                            <td class="${className}">
                              ${pick}
                              ${
                                hitType === "exact"
                                  ? `<span class="predictions-cell-mark exact">Placar exato</span>`
                                  : hitType === "trend"
                                    ? `<span class="predictions-cell-mark trend">Tendência</span>`
                                    : ""
                              }
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
        ${mobileBoardMarkup}
      </article>
    `;
  };

  const renderSuperclassicMatrix = (phaseFixtures) => {
    const matchCols = phaseFixtures.map((fixture) => ({
      label: fixture.title,
      detail: fixture.phaseDetail || (phaseRules[fixture.phase]?.label || fixture.phase),
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
    const mobileBoardMarkup = renderSuperclassicMobileBoard({
      matchCols,
      participantNames,
      picksByParticipant,
      resolveHitType: (match, pick) => resolveScoreHitType(match.official, pick),
    });

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
      <div class="table-wrapper superclassic-table-desktop">
        <table class="predictions-matrix-table superclassic-matrix-table">
          <thead>
            <tr>
              <th class="participant-name">Participante</th>
              ${matchCols
                .map(
                  (match) => `
                    <th>
                      <div class="predictions-column-subtitle">${match.detail}</div>
                      <div class="predictions-column-title">${match.label}</div>
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
                      <span class="predictions-participant-cell">
                        <span class="predictions-participant-avatar">${participantName.charAt(0)}</span>
                        ${participantName}
                      </span>
                    </td>
                    ${matchCols
                      .map((match) => {
                        const pick = picksByTitle.get(match.key) || "-";
                        const official = officialByMatch.get(match.key);
                        const hitType = pick !== "-" ? resolveScoreHitType(official, pick) : "";
                        const className = pick === "-"
                          ? ""
                          : hitType === "exact"
                            ? "hit-exact"
                            : hitType === "trend"
                              ? "hit-trend"
                            : "";
                        return `
                          <td class="${className}">
                            ${pick}
                            ${
                              hitType === "exact"
                                ? `<span class="predictions-cell-mark exact">Placar exato</span>`
                                : hitType === "trend"
                                  ? `<span class="predictions-cell-mark trend">Tendência</span>`
                                  : ""
                            }
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
      ${mobileBoardMarkup}
      ${exactSummaryMarkup}
    `;
  };

  const fixturesByPhase = superclassicPhaseOrder.reduce((acc, phaseKey) => {
    acc[phaseKey] = fixtures.filter((fixture) => fixture.phase === phaseKey);
    return acc;
  }, {});

  const leagueFixtures = fixturesByPhase.LEAGUE || [];
  const leagueDraft = getLeagueSuperclassicDraft();

  const leagueFormMarkup = leagueFixtures.length
    ? `
      <article class="rules-card">
        <h3>Palpitar Superclássicos da 1ª fase</h3>
        <p class="muted">${leagueSuperclassicFormsConfig?.description || "Preencha os placares dos superclássicos da primeira fase."}</p>
        <form id="league-superclassic-form" class="predictions-form">
          <section class="form-block">
            <p class="eyebrow">Participante</p>
            <div class="qf-toolbar">
              <div>
                <strong>${leagueDraft.participant || getActiveParticipantLabel()}</strong>
                <p class="muted">Rascunho salvo neste navegador.</p>
              </div>
              <button class="ghost-button qf-clear-button" type="button" id="league-superclassic-clear">Limpar rascunho</button>
            </div>
          </section>
          <div class="matches-grid">
            ${leagueFixtures
              .map((fixture, index) => {
                const pick = leagueDraft.picks?.[fixture.key] || {};
                return `
                  <article class="match-card qf-match-card">
                    <div class="match-header">
                      <div>
                        <p class="eyebrow">Superclássico ${index + 1}</p>
                        <strong>${fixture.title}</strong>
                        <p class="muted">${fixture.phaseDetail}</p>
                      </div>
                      <span class="status-pill">1ª fase</span>
                    </div>
                    <div class="qf-leg-row">
                      <span class="qf-leg-label">Placar</span>
                      <div class="qf-score-inputs">
                        <input
                          type="number"
                          min="0"
                          required
                          data-fixture-key="${fixture.key}"
                          data-side="home"
                          value="${pick.home || ""}"
                          class="qf-score-input"
                        />
                        <span class="muted">x</span>
                        <input
                          type="number"
                          min="0"
                          required
                          data-fixture-key="${fixture.key}"
                          data-side="away"
                          value="${pick.away || ""}"
                          class="qf-score-input"
                        />
                      </div>
                    </div>
                  </article>
                `;
              })
              .join("")}
          </div>
          <div class="form-block qf-actions-block">
            <div style="display:flex; gap:10px; flex-wrap:wrap;">
              <button class="primary-button" type="submit">Copiar para WhatsApp</button>
              ${
                leagueSuperclassicFormsConfig?.formUrl
                  ? `<a class="ghost-button" href="${leagueSuperclassicFormsConfig.formUrl}" target="_blank" rel="noopener noreferrer">Abrir Forms</a>`
                  : ""
              }
            </div>
            <p class="muted">Use este espaço para registrar placares dos superclássicos da liga e compartilhar no fluxo oficial.</p>
          </div>
          <p id="league-superclassic-feedback" class="feedback"></p>
        </form>
      </article>
    `
    : "";

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

  const leagueTableMarkup = renderLeagueSuperclassicTable(leagueFixtures);

  const blockMarkup = superclassicPhaseOrder
    .filter((phaseKey) => phaseKey !== "LEAGUE" && (fixturesByPhase[phaseKey] || []).length > 0)
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

  superclassicPanel.innerHTML = `${leagueTableMarkup}${overviewMarkup}${blockMarkup}`;

  const leagueForm = superclassicPanel.querySelector("#league-superclassic-form");
  const leagueFeedback = superclassicPanel.querySelector("#league-superclassic-feedback");
  const clearLeagueButton = superclassicPanel.querySelector("#league-superclassic-clear");

  if (leagueForm) {
    leagueForm.oninput = (event) => {
      const field = event.target;
      const fixtureKey = field?.dataset?.fixtureKey;
      const side = field?.dataset?.side;
      if (!fixtureKey || !side) return;
      saveLeagueSuperclassicDraftField(fixtureKey, side, field.value);
    };

    leagueForm.onsubmit = (event) => {
      event.preventDefault();
      const draft = getLeagueSuperclassicDraft();
      const hasAllScores = leagueFixtures.every((fixture) => {
        const pick = draft.picks?.[fixture.key] || {};
        return String(pick.home || "").trim() !== "" && String(pick.away || "").trim() !== "";
      });

      if (!hasAllScores) {
        if (leagueFeedback) {
          leagueFeedback.textContent = "Preencha todos os placares antes de copiar.";
          leagueFeedback.classList.remove("success");
        }
        return;
      }

      const message = buildLeagueSuperclassicMessage(leagueFixtures, draft);
      navigator.clipboard.writeText(message).then(() => {
        if (leagueFeedback) {
          leagueFeedback.textContent = "Copiado para a área de transferência! Agora é só colar no fluxo oficial.";
          leagueFeedback.classList.add("success");
        }
      }).catch((error) => {
        if (leagueFeedback) {
          leagueFeedback.textContent = `Erro ao copiar: ${error}`;
          leagueFeedback.classList.remove("success");
        }
      });
    };
  }

  if (clearLeagueButton) {
    clearLeagueButton.onclick = () => {
      clearLeagueSuperclassicDraft();
      renderSuperclassicPanel();
    };
  }
}

function setActiveTab(tab) {
  activeMainTab = tab;
  const showRanking = tab === "ranking";
  const showResults = tab === "results";
  const showSubmitQf = tab === "submit-qf";
  const showSuperclassic = tab === "superclassic";
  const showPredictions = tab === "predictions";
  const showHistory = tab === "history";
  const showRules = tab === "rules";
  tabRanking.classList.toggle("is-active", showRanking);
  tabResults.classList.toggle("is-active", showResults);
  if (tabSubmitQf) tabSubmitQf.classList.toggle("is-active", showSubmitQf);
  tabSuperclassic.classList.toggle("is-active", showSuperclassic);
  tabPredictions.classList.toggle("is-active", showPredictions);
  tabHistory.classList.toggle("is-active", showHistory);
  tabRules.classList.toggle("is-active", showRules);
  panelRanking.classList.toggle("is-active", showRanking);
  panelResults.classList.toggle("is-active", showResults);
  if (panelSubmitQf) panelSubmitQf.classList.toggle("is-active", showSubmitQf);
  panelSuperclassic.classList.toggle("is-active", showSuperclassic);
  panelPredictions.classList.toggle("is-active", showPredictions);
  panelHistory.classList.toggle("is-active", showHistory);
  panelRules.classList.toggle("is-active", showRules);
  if (mobileTabSelect && mobileTabSelect.value !== tab) {
    mobileTabSelect.value = tab;
  }
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

async function submitQuarterPicksToForms(formData) {
  if (!hasQuarterFormsSubmitConfigured()) {
    return { ok: false, reason: "not-configured" };
  }

  const submitUrl = String(quarterFinalsFormsConfig.submitUrl || "").trim();
  const fieldMap = getQuarterFormsFieldMap();
  const payload = new URLSearchParams();
  const appendField = (fieldKey, value) => {
    const entryKey = String(fieldMap[fieldKey] || "").trim();
    if (!entryKey) return;
    payload.append(entryKey, String(value ?? "").trim());
  };

  appendField("participant", getActiveParticipantLabel());
  qrMatches.forEach((match) => {
    appendField(`${match.id}_ida_home`, formData.get(`${match.id}_ida_home`));
    appendField(`${match.id}_ida_away`, formData.get(`${match.id}_ida_away`));
    appendField(`${match.id}_volta_home`, formData.get(`${match.id}_volta_home`));
    appendField(`${match.id}_volta_away`, formData.get(`${match.id}_volta_away`));
    appendField(`${match.id}_classificado`, formData.get(`${match.id}_classificado`));
  });

  await fetch(submitUrl, {
    method: "POST",
    mode: "no-cors",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
    },
    body: payload.toString(),
  });

  return { ok: true };
}

function loadLeagueSuperclassicDrafts() {
  try {
    const raw = localStorage.getItem(storageKeys.leagueSuperclassicDrafts);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (error) {
    console.error("Falha ao ler rascunhos de superclássicos da 1ª fase.", error);
    return {};
  }
}

function saveLeagueSuperclassicDrafts(drafts) {
  localStorage.setItem(storageKeys.leagueSuperclassicDrafts, JSON.stringify(drafts));
}

function getLeagueSuperclassicDraftKey() {
  return currentUserId || normalizeText(loginUser.value || "visitante");
}

function getLeagueSuperclassicDraft() {
  const drafts = loadLeagueSuperclassicDrafts();
  const payload = drafts[getLeagueSuperclassicDraftKey()] || {};
  return {
    participant: payload.participant || getActiveParticipantLabel(),
    picks: payload.picks && typeof payload.picks === "object" ? payload.picks : {},
  };
}

function saveLeagueSuperclassicDraftField(fixtureKey, side, value) {
  const drafts = loadLeagueSuperclassicDrafts();
  const draftKey = getLeagueSuperclassicDraftKey();
  const current = drafts[draftKey] || {};
  const picks = current.picks && typeof current.picks === "object" ? current.picks : {};
  const previous = picks[fixtureKey] && typeof picks[fixtureKey] === "object" ? picks[fixtureKey] : {};
  picks[fixtureKey] = {
    ...previous,
    [side]: value,
  };
  drafts[draftKey] = {
    participant: getActiveParticipantLabel(),
    picks,
  };
  saveLeagueSuperclassicDrafts(drafts);
}

function clearLeagueSuperclassicDraft() {
  const drafts = loadLeagueSuperclassicDrafts();
  delete drafts[getLeagueSuperclassicDraftKey()];
  saveLeagueSuperclassicDrafts(drafts);
}

function buildLeagueSuperclassicMessage(fixtures, draft) {
  const participant = draft.participant || getActiveParticipantLabel();
  let message = `🏆 *Superclássicos - 1ª Fase (${participant})*\n\n`;
  fixtures.forEach((fixture, index) => {
    const pick = draft.picks?.[fixture.key] || {};
    const home = String(pick.home || "").trim();
    const away = String(pick.away || "").trim();
    message += `🔹 *Jogo ${index + 1}* - ${fixture.title}\n`;
    message += `Placar: ${home || "_"} x ${away || "_"}\n`;
    if (fixture.official) {
      message += `Oficial: ${fixture.official}\n`;
    }
    message += "\n";
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

function getQuarterFormsFieldMap() {
  const map = quarterFinalsFormsConfig?.fieldMap;
  return map && typeof map === "object" ? map : {};
}

function hasQuarterFormsCsvConfigured() {
  return Boolean(String(quarterFinalsFormsConfig?.csvUrl || "").trim());
}

function hasQuarterFormsSubmitConfigured() {
  const submitUrl = String(quarterFinalsFormsConfig?.submitUrl || "").trim();
  if (!submitUrl) return false;

  const map = getQuarterFormsFieldMap();
  const requiredKeys = ["participant", ...qrMatches.flatMap((match) => [
    `${match.id}_ida_home`,
    `${match.id}_ida_away`,
    `${match.id}_volta_home`,
    `${match.id}_volta_away`,
    `${match.id}_classificado`,
  ])];

  return requiredKeys.every((key) => String(map[key] || "").trim());
}

function renderQuarterFinalsFormsPanel() {
  if (!qfFormsPanel) return;
  const csvConfigured = hasQuarterFormsCsvConfigured();
  const submitConfigured = hasQuarterFormsSubmitConfigured();
  const rows = extractQuarterFormsRows(quarterFinalsFormsData || []);

  if (!csvConfigured) {
    qfFormsPanel.innerHTML = `
      <article class="rules-card">
        <h3>Integração pronta</h3>
        <p class="muted">${quarterFinalsFormsConfig.description}</p>
        <p class="muted">Status do fluxo:</p>
        <div class="result-chip-row">
          <span class="result-chip ${submitConfigured ? "hit" : ""}">Envio direto ao Forms: ${submitConfigured ? "ativo" : "pendente"}</span>
          <span class="result-chip">Leitura CSV para ranking: pendente</span>
        </div>
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

  if (!rows.length) {
    qfFormsPanel.innerHTML = `
      <article class="rules-card">
        <h3>Respostas do Forms</h3>
        <p class="muted">A URL está configurada, mas ainda não encontrei respostas publicadas (ou identificadas por participante).</p>
      </article>
    `;
    return;
  }

  qfFormsPanel.innerHTML = `
    <article class="rules-card" style="margin-bottom: 16px;">
      <h3>Status da integração</h3>
      <div class="result-chip-row">
        <span class="result-chip hit">Leitura CSV: ativa</span>
        <span class="result-chip ${submitConfigured ? "hit" : ""}">Envio direto ao Forms: ${submitConfigured ? "ativo" : "pendente"}</span>
      </div>
      <p class="muted">Palpiteiros únicos carregados para cálculo: <strong>${rows.length}</strong>.</p>
      <p class="muted">No ranking, quando houver mais de uma resposta do mesmo palpiteiro, fica valendo somente a mais recente.</p>
    </article>
    ${qrMatches
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
              ${rows.map((entry) => `
                <tr>
                  <td><strong>${entry.participant || "Sem nome"}</strong></td>
                  <td style="white-space:nowrap">${entry.row[`${match.id}_ida_home`] || "-"} x ${entry.row[`${match.id}_ida_away`] || "-"}</td>
                  <td style="white-space:nowrap">${entry.row[`${match.id}_volta_home`] || "-"} x ${entry.row[`${match.id}_volta_away`] || "-"}</td>
                  <td>${entry.row[`${match.id}_classificado`] || "-"}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </article>
    `)
    .join("")}
  `;
}

function renderQuarterFinalsForm() {
  if (!qfPredictForm) return;
  const draft = getQfDraft();
  const formsSubmissionActive = hasQuarterFormsSubmitConfigured();
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
        <button class="primary-button" type="submit">${formsSubmissionActive ? "Enviar no Forms + Copiar para WhatsApp" : "Copiar para WhatsApp"}</button>
        <p class="muted">
          ${formsSubmissionActive
            ? "Ao enviar, o palpite é salvo no Forms e entra na base oficial do ranking assim que o CSV atualizar."
            : "Depois de preencher, o app monta o texto pronto para colar no grupo. Para ranking oficial, ative a integração com Forms."}
        </p>
      </div>
      <p id="qf-feedback" class="feedback"></p>
    </section>
  `;

  qfPredictForm.oninput = (event) => {
    const field = event.target;
    if (!field.name) return;
    saveQfDraftField(field.name, field.value);
  };

  qfPredictForm.onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const feedbackEl = document.querySelector("#qf-feedback");
    const message = buildQfWhatsAppMessage(fd);
    let copied = false;

    try {
      await navigator.clipboard.writeText(message);
      copied = true;
    } catch (error) {
      feedbackEl.textContent = `Erro ao copiar: ${error}`;
      feedbackEl.classList.remove("success");
      return;
    }

    if (!formsSubmissionActive) {
      feedbackEl.textContent =
        "Copiado para a área de transferência. Para entrar no ranking oficial, envie também pelo Forms.";
      feedbackEl.classList.add("success");
      return;
    }

    try {
      const submitResult = await submitQuarterPicksToForms(fd);
      if (!submitResult.ok) {
        feedbackEl.textContent =
          "Copiado para WhatsApp, mas o envio ao Forms não está configurado.";
        feedbackEl.classList.remove("success");
        return;
      }

      if (hasQuarterFormsCsvConfigured()) {
        await loadQuarterFinalsFormsData();
      }
      renderApp();
      const refreshedFeedbackEl = document.querySelector("#qf-feedback") || feedbackEl;
      refreshedFeedbackEl.textContent =
        copied
          ? "Palpite enviado ao Forms e copiado para WhatsApp. Esse envio entra na base usada no ranking."
          : "Palpite enviado ao Forms. Esse envio entra na base usada no ranking.";
      refreshedFeedbackEl.classList.add("success");
    } catch (error) {
      feedbackEl.textContent =
        `Copiado para WhatsApp, mas falhou o envio ao Forms: ${error}`;
      feedbackEl.classList.remove("success");
    }
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
let latestPredictionExportPayload = {
  title: "",
  sections: [],
};

function getMatchdayNumber(value) {
  const match = String(value || "").match(/(\d+)/);
  return match ? Number(match[1]) : null;
}

function formatRoundLabel(value) {
  const number = getMatchdayNumber(value);
  return number ? `Rodada ${number}` : String(value || "Jogo oficial").replace(/machtday|matchday/gi, "Rodada");
}

function getLegToken(value) {
  const normalized = normalizeText(String(value || ""));
  if (normalized.includes("ida")) return "IDA";
  if (normalized.includes("volta")) return "VOLTA";
  return "";
}

function resolvePredictionHitType(fixture, pickValue) {
  const pickText = String(pickValue || "").trim();
  if (!pickText || pickText === "-") return "";

  const teams = resolveFixtureTeams(fixture);
  const officialScore = parseScoreFromText(fixture?.official);
  const predictedScore = parseScoreFromText(pickText);

  if (
    officialScore &&
    predictedScore &&
    officialScore.home === predictedScore.home &&
    officialScore.away === predictedScore.away
  ) {
    return "exact";
  }

  let officialTrend = null;
  if (officialScore) {
    officialTrend = matchResultFromScores(officialScore.home, officialScore.away);
  } else if (teams) {
    officialTrend = resolveTrendTokenFromPick(
      fixture?.official,
      teams.homeTeam,
      teams.awayTeam
    );
  }

  let predictedTrend = null;
  if (predictedScore) {
    predictedTrend = matchResultFromScores(predictedScore.home, predictedScore.away);
  } else if (teams) {
    predictedTrend = resolveTrendTokenFromPick(
      pickText,
      teams.homeTeam,
      teams.awayTeam
    );
  }

  if (officialTrend && predictedTrend && officialTrend === predictedTrend) {
    return "trend";
  }

  return "";
}

function splitPredictionFixturesByLeg(fixtures) {
  let idaFixtures = fixtures.filter((fixture) => getLegToken(fixture?.leg) === "IDA");
  let voltaFixtures = fixtures.filter((fixture) => getLegToken(fixture?.leg) === "VOLTA");

  if (!idaFixtures.length && !voltaFixtures.length && fixtures.length > 1) {
    const midpoint = Math.ceil(fixtures.length / 2);
    idaFixtures = fixtures.slice(0, midpoint);
    voltaFixtures = fixtures.slice(midpoint);
  }

  return { idaFixtures, voltaFixtures };
}

function buildPredictionMatrixSection(fixtures, sectionTitle = "") {
  const knownParticipants = participants.map((participant) => participant.name);
  const knownParticipantsKeys = new Set(knownParticipants.map((name) => normalizeText(name)));
  const extraParticipantsByKey = new Map();

  const columns = fixtures.map((fixture) => {
    const picksByParticipant = new Map();
    (fixture?.picks || []).forEach((pick) => {
      const participantName = String(pick?.participant || "").trim();
      if (!participantName) return;
      const participantKey = normalizeText(participantName);
      const pickValue = String(pick?.pick || "").trim();
      picksByParticipant.set(participantKey, pickValue || "-");
      if (!knownParticipantsKeys.has(participantKey) && !extraParticipantsByKey.has(participantKey)) {
        extraParticipantsByKey.set(participantKey, participantName);
      }
    });

    const legToken = getLegToken(fixture?.leg);
    const subtitle = legToken || formatRoundLabel(fixture?.matchday || "");
    return {
      fixture,
      subtitle,
      label: String(fixture?.label || "").trim(),
      official: String(fixture?.official || "-").trim() || "-",
      picksByParticipant,
    };
  });

  const extraParticipants = [...extraParticipantsByKey.values()].sort((a, b) =>
    a.localeCompare(b, "pt-BR")
  );
  const allParticipants = [...knownParticipants, ...extraParticipants];

  const rows = allParticipants.map((participantName) => {
    const participantKey = normalizeText(participantName);
    const cells = columns.map((column) => {
      const value = column.picksByParticipant.get(participantKey) || "-";
      const hitType = value !== "-" ? resolvePredictionHitType(column.fixture, value) : "";
      return {
        value,
        hitType,
      };
    });

    return {
      participantName,
      cells,
    };
  });

  return {
    sectionTitle,
    columns,
    rows,
  };
}

function drawWrappedCanvasText(ctx, text, x, y, maxWidth, lineHeight, maxLines = 3) {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  if (!words.length) return 0;

  const lines = [];
  let current = words[0];
  for (let index = 1; index < words.length; index += 1) {
    const candidate = `${current} ${words[index]}`;
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
    } else {
      lines.push(current);
      current = words[index];
      if (lines.length >= maxLines - 1) break;
    }
  }
  lines.push(current);

  let rendered = lines.slice(0, maxLines);
  if (lines.length > maxLines) {
    const last = rendered[maxLines - 1];
    rendered[maxLines - 1] = `${last.slice(0, Math.max(0, last.length - 1))}…`;
  }

  rendered.forEach((line, lineIndex) => {
    ctx.fillText(line, x, y + lineIndex * lineHeight);
  });
  return rendered.length;
}

function buildPredictionExportCanvas(payload) {
  const sections = Array.isArray(payload?.sections) ? payload.sections : [];
  if (!sections.length) return null;

  const padding = 24;
  const titleHeight = 56;
  const firstColWidth = 200;
  const colWidth = 160;
  const headerHeight = 116;
  const rowHeight = 34;
  const sectionTitleHeight = 30;
  const sectionGap = 20;

  let contentWidth = 0;
  let totalHeight = padding + titleHeight;

  sections.forEach((section) => {
    const tableWidth = firstColWidth + section.columns.length * colWidth;
    contentWidth = Math.max(contentWidth, tableWidth);
    totalHeight += sectionTitleHeight + headerHeight + section.rows.length * rowHeight + sectionGap;
  });

  const width = Math.max(900, contentWidth + padding * 2);
  const height = totalHeight + padding;
  const scale = 2;

  const canvas = document.createElement("canvas");
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.scale(scale, scale);

  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, "#1a46ff");
  gradient.addColorStop(0.45, "#0a23b8");
  gradient.addColorStop(1, "#041356");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // Glow decor para aproximar do visual atual do bolão.
  ctx.fillStyle = "rgba(117, 209, 255, 0.16)";
  ctx.beginPath();
  ctx.arc(width - 140, 90, 120, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#f5f8ff";
  ctx.font = '700 24px "Space Grotesk", sans-serif';
  ctx.fillText(payload.title || "Palpites do bolão", padding, padding + 24);

  ctx.fillStyle = "#c4d5ff";
  ctx.font = '500 13px "Space Grotesk", sans-serif';
  const generatedAt = new Date().toLocaleString("pt-BR");
  ctx.fillText(`Gerado em ${generatedAt}`, padding, padding + 44);

  const legendY = padding + 42;
  ctx.fillStyle = "rgba(0, 255, 135, 0.26)";
  ctx.fillRect(width - 340, legendY - 12, 18, 12);
  ctx.fillStyle = "#d8f3dc";
  ctx.font = '600 11px "Space Grotesk", sans-serif';
  ctx.fillText("Placar exato", width - 316, legendY - 2);
  ctx.fillStyle = "rgba(255, 200, 0, 0.24)";
  ctx.fillRect(width - 210, legendY - 12, 18, 12);
  ctx.fillStyle = "#ffe6a0";
  ctx.fillText("Tendência", width - 186, legendY - 2);

  let y = padding + titleHeight;
  sections.forEach((section) => {
    const sectionHeight = sectionTitleHeight + headerHeight + section.rows.length * rowHeight;
    ctx.fillStyle = "rgba(8, 26, 122, 0.68)";
    ctx.fillRect(padding, y - 4, contentWidth, sectionHeight + 8);
    ctx.strokeStyle = "rgba(173, 199, 255, 0.24)";
    ctx.strokeRect(padding, y - 4, contentWidth, sectionHeight + 8);

    ctx.fillStyle = "#eaf2ff";
    ctx.font = '700 17px "Space Grotesk", sans-serif';
    const sectionName = section.sectionTitle || "Tabela";
    ctx.fillText(sectionName, padding, y + 20);
    y += sectionTitleHeight;

    ctx.fillStyle = "rgba(22, 44, 188, 0.5)";
    ctx.fillRect(padding, y, contentWidth, headerHeight);

    ctx.fillStyle = "rgba(8, 20, 90, 0.94)";
    ctx.fillRect(padding, y, firstColWidth, headerHeight);

    ctx.strokeStyle = "rgba(173, 199, 255, 0.24)";
    ctx.lineWidth = 1;
    ctx.strokeRect(padding, y, contentWidth, headerHeight);

    ctx.fillStyle = "#75d1ff";
    ctx.font = '700 12px "Space Grotesk", sans-serif';
    ctx.fillText("Participante", padding + 12, y + 22);

    section.columns.forEach((column, columnIndex) => {
      const columnX = padding + firstColWidth + columnIndex * colWidth;
      ctx.strokeStyle = "rgba(173, 199, 255, 0.24)";
      ctx.strokeRect(columnX, y, colWidth, headerHeight);

      ctx.fillStyle = "#c4d5ff";
      ctx.font = '700 10px "Space Grotesk", sans-serif';
      ctx.fillText(column.subtitle || "Jogo", columnX + 10, y + 18);

      ctx.fillStyle = "#f5f8ff";
      ctx.font = '600 12px "Space Grotesk", sans-serif';
      drawWrappedCanvasText(ctx, column.label || "-", columnX + 10, y + 38, colWidth - 20, 14, 3);

      ctx.fillStyle = "#d8f3dc";
      ctx.font = '700 11px "Space Grotesk", sans-serif';
      drawWrappedCanvasText(
        ctx,
        `Oficial: ${column.official || "-"}`,
        columnX + 10,
        y + 96,
        colWidth - 20,
        13,
        1
      );
    });

    y += headerHeight;

    section.rows.forEach((row, rowIndex) => {
      const rowY = y + rowIndex * rowHeight;
      const rowBase = rowIndex % 2 ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.012)";
      ctx.fillStyle = rowBase;
      ctx.fillRect(padding, rowY, contentWidth, rowHeight);

      ctx.fillStyle = "rgba(6,18,48,0.92)";
      ctx.fillRect(padding, rowY, firstColWidth, rowHeight);

      ctx.strokeStyle = "rgba(173, 199, 255, 0.24)";
      ctx.strokeRect(padding, rowY, firstColWidth, rowHeight);

      ctx.fillStyle = "#f5f8ff";
      ctx.font = '600 12px "Space Grotesk", sans-serif';
      const participantName = String(row.participantName || "-");
      drawWrappedCanvasText(ctx, participantName, padding + 10, rowY + 20, firstColWidth - 20, 13, 2);

      row.cells.forEach((cell, cellIndex) => {
        const cellX = padding + firstColWidth + cellIndex * colWidth;
        if (cell.hitType === "exact") {
          ctx.fillStyle = "rgba(0,255,135,0.24)";
          ctx.fillRect(cellX, rowY, colWidth, rowHeight);
        } else if (cell.hitType === "trend") {
          ctx.fillStyle = "rgba(255,200,0,0.24)";
          ctx.fillRect(cellX, rowY, colWidth, rowHeight);
        }

        ctx.strokeStyle = "rgba(173, 199, 255, 0.24)";
        ctx.strokeRect(cellX, rowY, colWidth, rowHeight);
        ctx.fillStyle = cell.hitType === "trend" ? "#ffe6a0" : "#f5f8ff";
        ctx.font = '600 12px "Space Grotesk", sans-serif';
        ctx.fillText(String(cell.value || "-"), cellX + 12, rowY + 21);
      });
    });

    y += section.rows.length * rowHeight + sectionGap;
  });

  return canvas;
}

function setPredictionsExportFeedback(message, isSuccess = false) {
  const feedback = document.querySelector("#predictions-export-feedback");
  if (!feedback) return;
  feedback.textContent = String(message || "");
  feedback.classList.toggle("success", Boolean(isSuccess));
}

function exportPredictionsAsPdf() {
  const canvas = buildPredictionExportCanvas(latestPredictionExportPayload);
  if (!canvas) {
    setPredictionsExportFeedback("Nada para exportar nesta visão.");
    return;
  }

  const imageUrl = canvas.toDataURL("image/png");
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    setPredictionsExportFeedback("Libere pop-up do navegador para exportar em PDF.");
    return;
  }

  const safeTitle = String(latestPredictionExportPayload.title || "Palpites");
  printWindow.document.write(`
    <!doctype html>
    <html lang="pt-BR">
      <head>
        <meta charset="UTF-8" />
        <title>${safeTitle}</title>
        <style>
          body {
            margin: 0;
            padding: 24px;
            font-family: "Space Grotesk", Arial, sans-serif;
            background: linear-gradient(180deg, #1434d8 0%, #0b1ca6 34%, #060d62 72%, #040a42 100%);
            color: #f5f8ff;
          }
          .sheet {
            border: 1px solid rgba(178, 201, 255, 0.24);
            border-radius: 18px;
            padding: 16px;
            background: rgba(8, 26, 122, 0.72);
          }
          h1 { margin: 0 0 8px; font-size: 20px; letter-spacing: .02em; }
          p { margin: 0 0 14px; font-size: 12px; color: #c4d5ff; }
          img {
            width: 100%;
            height: auto;
            border: 1px solid rgba(178, 201, 255, 0.24);
            border-radius: 12px;
            background: rgba(4, 19, 86, 0.85);
          }
          @media print {
            body { padding: 0; background: #ffffff; }
            .sheet { border: 0; border-radius: 0; background: #ffffff; padding: 0; }
            h1, p { margin-left: 10mm; margin-right: 10mm; color: #111; }
            img { border: 0; border-radius: 0; background: #fff; }
          }
        </style>
      </head>
      <body>
        <main class="sheet">
          <h1>${safeTitle}</h1>
          <p>Selecione "Salvar como PDF" na janela de impressão para baixar o arquivo.</p>
          <img src="${imageUrl}" alt="Tabela de palpites" />
        </main>
        <script>
          window.addEventListener("load", function () {
            setTimeout(function () { window.print(); }, 250);
          });
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
  setPredictionsExportFeedback("PDF aberto na janela de impressão.", true);
}

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

  let phaseTabsHTML = `<div class="predictions-subtabs predictions-subtabs--framed">`;
  validPhases.forEach(ph => {
    const isActive = ph.id === activePredictionsPhase;
    phaseTabsHTML += `
      <button
        type="button"
        class="predictions-tab-button ${isActive ? "is-active" : ""}"
        onclick="window.setPredictPhase('${ph.id}')"
      >
        ${ph.label}
      </button>
    `;
  });
  phaseTabsHTML += `</div>`;

  let secondaryTabsHTML = '';
  if (activePredictionsPhase === "LEAGUE") {
    secondaryTabsHTML = `<div class="predictions-subtabs">`;
    leagueRounds.forEach(r => {
      const badgeText = r.replace("Matchday", "Rodada");
      const isActive = r === activePredictionsFilter;
      secondaryTabsHTML += `
        <button
          type="button"
          class="predictions-tab-button ${isActive ? "is-active" : ""}"
          onclick="window.setPredictFilter('${r}')"
        >
          ${badgeText}
        </button>
      `;
    });
    secondaryTabsHTML += `</div>`;
  }

  let srcFixtures = [];
  if (activePredictionsPhase === "LEAGUE") {
    const rawMatches = backtestData?.phases?.[activePredictionsPhase]?.fixtures || [];
    const targetRound = getMatchdayNumber(activePredictionsFilter);
    srcFixtures = rawMatches.filter((fixture) => {
      const matchdayLabel = normalizeText(String(fixture?.matchday || ""));
      const isRoundFixture =
        matchdayLabel.includes("matchday") || matchdayLabel.includes("machtday");
      if (!isRoundFixture) return false;
      return getMatchdayNumber(fixture?.matchday) === targetRound;
    });
  } else {
    srcFixtures = backtestData?.phases?.[activePredictionsPhase]?.fixtures || [];
  }

  const activePhaseMeta = validPhases.find((phase) => phase.id === activePredictionsPhase);
  const exportTitle = activePredictionsPhase === "LEAGUE"
    ? `Palpites ${activePhaseMeta?.label || "Primeira Fase"} - ${activePredictionsFilter.replace("Matchday", "Rodada")}`
    : `Palpites ${activePhaseMeta?.label || activePredictionsPhase}`;

  let matrixSections = [];
  const phasesWithTwoLegs = ["PLAYOFF", "ROUND_OF_16"];
  if (srcFixtures.length) {
    if (phasesWithTwoLegs.includes(activePredictionsPhase)) {
      const { idaFixtures, voltaFixtures } = splitPredictionFixturesByLeg(srcFixtures);
      if (idaFixtures.length) matrixSections.push(buildPredictionMatrixSection(idaFixtures, "Jogos de Ida"));
      if (voltaFixtures.length) matrixSections.push(buildPredictionMatrixSection(voltaFixtures, "Jogos de Volta"));
      if (!matrixSections.length) matrixSections.push(buildPredictionMatrixSection(srcFixtures));
    } else {
      matrixSections = [buildPredictionMatrixSection(srcFixtures)];
    }
  }

  latestPredictionExportPayload = {
    title: exportTitle,
    sections: matrixSections,
  };

  const exportActionsHTML = `
    <div class="predictions-export-actions">
      <button
        type="button"
        id="predictions-export-pdf"
        class="ghost-button"
        ${matrixSections.length ? "" : "disabled"}
      >
        Exportar PDF
      </button>
    </div>
    <p class="predictions-export-hint muted">No PDF, o app abre a tela de impressão para você salvar como PDF.</p>
    <p id="predictions-export-feedback" class="feedback"></p>
  `;

  if (!srcFixtures.length) {
    container.innerHTML =
      phaseTabsHTML +
      secondaryTabsHTML +
      exportActionsHTML +
      `<div class="empty-state">Nenhum palpite registrado nesta etapa ainda.</div>`;
    const pdfButton = container.querySelector("#predictions-export-pdf");
    if (pdfButton) pdfButton.addEventListener("click", exportPredictionsAsPdf);
    return;
  }

  const renderMatrixSection = (section) => {
    if (!section.columns.length) {
      return "";
    }

    return `
      <section class="predictions-matrix-section">
        ${section.sectionTitle ? `<h3 class="predictions-section-title">${section.sectionTitle}</h3>` : ""}

        <div class="table-wrapper predictions-table-desktop">
          <table class="predictions-matrix-table">
            <thead>
              <tr>
                <th class="participant-name">Participante</th>
                ${section.columns
                  .map(
                    (column) => `
                      <th>
                        <div class="predictions-column-subtitle">${column.subtitle || "Jogo oficial"}</div>
                        <div class="predictions-column-title">${column.label || "-"}</div>
                        <div class="predictions-column-official">Oficial: ${column.official || "-"}</div>
                      </th>
                    `
                  )
                  .join("")}
              </tr>
            </thead>
            <tbody>
              ${section.rows
                .map(
                  (row) => `
                    <tr>
                      <td class="participant-name">
                        <span class="predictions-participant-cell">
                          <span class="predictions-participant-avatar">${row.participantName.charAt(0)}</span>
                          ${row.participantName}
                        </span>
                      </td>
                      ${row.cells
                        .map((cell) => {
                          const hitClass = cell.hitType === "exact"
                            ? "hit-exact"
                            : cell.hitType === "trend"
                              ? "hit-trend"
                              : "";
                          const marker = cell.hitType === "exact"
                            ? `<span class="predictions-cell-mark exact">Placar exato</span>`
                            : cell.hitType === "trend"
                              ? `<span class="predictions-cell-mark trend">Tendência</span>`
                              : "";
                          return `
                            <td class="${hitClass}">
                              ${cell.value}
                              ${marker}
                            </td>
                          `;
                        })
                        .join("")}
                    </tr>
                  `
                )
                .join("")}
            </tbody>
          </table>
        </div>

        <div class="predictions-mobile-board">
          ${section.columns
            .map((column, columnIndex) => {
              const picks = section.rows
                .map((row) => ({
                  participantName: row.participantName,
                  value: row.cells[columnIndex]?.value || "-",
                  hitType: row.cells[columnIndex]?.hitType || "",
                }))
                .filter((entry) => entry.value !== "-");
              const exactHits = picks.filter((entry) => entry.hitType === "exact");
              const trendHits = picks.filter((entry) => entry.hitType === "trend");
              const otherPicks = picks.filter(
                (entry) => entry.hitType !== "exact" && entry.hitType !== "trend"
              );
              const renderPickRows = (entries, tone = "") =>
                entries
                  .map(
                    (entry) => `
                      <li class="prediction-mobile-row ${tone}">
                        <span class="prediction-mobile-name">${entry.participantName}</span>
                        <span class="prediction-mobile-pick">${entry.value}</span>
                      </li>
                    `
                  )
                  .join("");

              return `
                <article class="prediction-mobile-match">
                  <header class="prediction-mobile-head">
                    <p class="eyebrow">${column.subtitle || "Jogo oficial"}</p>
                    <strong>${column.label || "-"}</strong>
                    <span class="status-pill">Oficial: ${column.official || "-"}</span>
                  </header>
                  ${
                    picks.length
                      ? `
                        <div class="prediction-mobile-stats">
                          <span class="prediction-mobile-stat exact">🎯 ${exactHits.length} exato(s)</span>
                          <span class="prediction-mobile-stat trend">📈 ${trendHits.length} tendência(s)</span>
                          <span class="prediction-mobile-stat neutral">${otherPicks.length} outro(s)</span>
                        </div>

                        ${
                          !exactHits.length && !trendHits.length
                            ? `<p class="prediction-mobile-empty-hit muted">Ninguém acertou placar exato ou tendência neste jogo.</p>`
                            : ""
                        }

                        ${
                          exactHits.length
                            ? `
                              <section class="prediction-mobile-group">
                                <h4 class="prediction-mobile-group-title">Placar exato</h4>
                                <ul class="prediction-mobile-list">
                                  ${renderPickRows(exactHits, "is-exact")}
                                </ul>
                              </section>
                            `
                            : ""
                        }

                        ${
                          trendHits.length
                            ? `
                              <section class="prediction-mobile-group">
                                <h4 class="prediction-mobile-group-title">Tendência</h4>
                                <ul class="prediction-mobile-list">
                                  ${renderPickRows(trendHits, "is-trend")}
                                </ul>
                              </section>
                            `
                            : ""
                        }

                        ${
                          otherPicks.length
                            ? `
                              <details class="prediction-mobile-details">
                                <summary>Ver outros palpites (${otherPicks.length})</summary>
                                <ul class="prediction-mobile-list is-secondary">
                                  ${renderPickRows(otherPicks, "is-neutral")}
                                </ul>
                              </details>
                            `
                            : ""
                        }
                      `
                      : `<ul class="prediction-mobile-list"><li class="prediction-mobile-row"><span class="muted">Sem palpites neste jogo.</span></li></ul>`
                  }
                </article>
              `;
            })
            .join("")}
        </div>
      </section>
    `;
  };

  const tablesMarkup = matrixSections.map((section) => renderMatrixSection(section)).join("");

  if (!tablesMarkup.trim()) {
    container.innerHTML =
      phaseTabsHTML +
      secondaryTabsHTML +
      exportActionsHTML +
      `<div class="empty-state">Nenhum palpite registrado nesta etapa ainda.</div>`;
    const pdfButton = container.querySelector("#predictions-export-pdf");
    if (pdfButton) pdfButton.addEventListener("click", exportPredictionsAsPdf);
    return;
  }

  container.innerHTML = phaseTabsHTML + secondaryTabsHTML + exportActionsHTML + tablesMarkup;
  const pdfButton = container.querySelector("#predictions-export-pdf");
  if (pdfButton) pdfButton.addEventListener("click", exportPredictionsAsPdf);
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
  if (PUBLIC_CONSULT_MODE) {
    if (loginModal) {
      loginModal.classList.add("hidden");
      loginModal.style.display = "none";
    }
    return;
  }
  const isLogged = localStorage.getItem("ucl-bolao-guest") === "1" || Boolean(currentUserId);
  loginModal.classList.toggle("hidden", isLogged);
  loginModal.style.display = isLogged ? "none" : "grid";
}

function renderApp() {
  loadImmediateData();
  const leaderboard = getRankingRows();
  renderOverview(leaderboard);
  renderUserSummary(leaderboard);
  renderAwards(leaderboard);
  renderRanking(leaderboard);
  renderMatches();
  renderTournamentOutcomePanel(leaderboard);
  renderParticipantSnapshot();
  renderHistory();
  renderPredictionConsultation();
  renderRulesPanel();
  renderSuperclassicPanel();
  renderQuarterFinalsForm();
  renderQuarterFinalsFormsPanel();
  if (logoutButton) {
    logoutButton.style.display = PUBLIC_CONSULT_MODE ? "none" : "";
  }
  toggleLoginState();
}

function loadImmediateData() {
  backtestData = window.backtestData || { ranking: [] };
  leaguePhaseData = window.leaguePhaseData || { records: [] };
  const toNumberOrNull = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };
  const resolveStatusLabel = (statusShort, home, away) => {
    const key = String(statusShort || "").toUpperCase();
    if (["1H", "2H", "HT", "ET", "BT", "P", "LIVE", "SUSP", "INT"].includes(key)) return "Ao vivo";
    if (["FT", "AET", "PEN"].includes(key)) return "Finalizado";
    if (home !== null && away !== null) return "Finalizado";
    return "Agendado";
  };
  const leagueMatchdayFromRound = (roundLabel) => {
    const text = String(roundLabel || "");
    const match = text.match(/(\d+)/);
    const value = match ? Number(match[1]) : 0;
    return `Matchday ${Number.isFinite(value) && value > 0 ? value : 0}`;
  };

  if (window.apiMatchesData?.matches?.length) {
    const mappedMatches = window.apiMatchesData.matches.map((m) => {
      const homeScore = toNumberOrNull(m.score_home_90);
      const awayScore = toNumberOrNull(m.score_away_90);
      const phase = normalizePhaseKey(m.phase_key);
      return {
        id: String(m.id ?? ""),
        phase,
        roundLabel: String(m.round_label || ""),
        kickoff: m.kickoff_utc || null,
        homeTeam: String(m.home_team_name || ""),
        awayTeam: String(m.away_team_name || ""),
        scoreFinal: { home: homeScore, away: awayScore },
        aggregate: homeScore !== null && awayScore !== null ? `${homeScore}-${awayScore}` : null,
        qualified: m.qualified_team_name || null,
        status: resolveStatusLabel(m.status_short, homeScore, awayScore),
        statusShort: String(m.status_short || "").toUpperCase(),
        matchday: leagueMatchdayFromRound(m.round_label),
      };
    });
    knockoutResults = mappedMatches.filter((match) => match.phase !== "LEAGUE");
    liveLeaguePhaseResults = mappedMatches
      .filter((match) => match.phase === "LEAGUE")
      .map((match) => ({
        id: match.id,
        phase: "LEAGUE",
        matchday: match.matchday,
        homeTeam: match.homeTeam,
        awayTeam: match.awayTeam,
        scoreFinal: match.scoreFinal,
        status: match.status,
        kickoff: match.kickoff,
      }));
  } else {
    knockoutResults = staticKnockoutResults;
    liveLeaguePhaseResults = [];
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

async function loadTournamentOutcomeFormsData() {
  if (!hasTournamentOutcomeCsvConfigured()) {
    tournamentOutcomeFormsData = [];
    return;
  }

  try {
    const response = await fetch(tournamentOutcomeFormsConfig.csvUrl, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Falha ao carregar CSV de encerramento: ${response.status}`);
    }
    const csvText = await response.text();
    tournamentOutcomeFormsData = parseCsv(csvText);
  } catch (error) {
    console.error(error);
    tournamentOutcomeFormsData = [];
  }
}

loginForm.addEventListener("submit", (event) => {
  if (PUBLIC_CONSULT_MODE) {
    event.preventDefault();
    return;
  }
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
  if (PUBLIC_CONSULT_MODE) return;
  currentUserId = "";
  localStorage.removeItem(storageKeys.session);
  localStorage.removeItem("ucl-bolao-guest");
  loginUser.value = "";
  renderApp();
});

skipLoginButton.addEventListener("click", () => {
  if (PUBLIC_CONSULT_MODE) return;
  currentUserId = "";
  localStorage.removeItem(storageKeys.session);
  localStorage.setItem("ucl-bolao-guest", "1");
  loginFeedback.textContent = "";
  loginUser.value = "";
  renderApp();
});

tabRanking.addEventListener("click", () => setActiveTab("ranking"));
tabResults.addEventListener("click", () => setActiveTab("results"));
tabSuperclassic.addEventListener("click", () => setActiveTab("superclassic"));
tabPredictions.addEventListener("click", () => setActiveTab("predictions"));
tabHistory.addEventListener("click", () => setActiveTab("history"));
tabRules.addEventListener("click", () => setActiveTab("rules"));
if (tabSubmitQf) tabSubmitQf.addEventListener("click", () => setActiveTab("submit-qf"));
if (mobileTabSelect) {
  mobileTabSelect.addEventListener("change", (event) => {
    const nextTab = String(event.target.value || "").trim();
    if (!nextTab) return;
    setActiveTab(nextTab);
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}

window.addEventListener("DOMContentLoaded", () => {
  loadImmediateData();
  populateLoginSelect();
  renderRules();
  renderApp();
  setActiveTab(activeMainTab);
  Promise.all([loadQuarterFinalsFormsData(), loadTournamentOutcomeFormsData()]).then(renderApp);
});
