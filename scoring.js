import { phaseRules } from "./data.js";

const phaseOrder = ["LEAGUE", "PLAYOFF", "ROUND_OF_16", "QUARTER", "SEMI", "FINAL"];

function round2(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function resultFromScore(score) {
  if (!score) {
    return null;
  }
  if (score.home > score.away) {
    return "HOME";
  }
  if (score.away > score.home) {
    return "AWAY";
  }
  return "DRAW";
}

function matchesScore(predicted, score) {
  return predicted && score && predicted.home === score.home && predicted.away === score.away;
}

function computeFavoritePoints(favoriteTeam, official) {
  const milestones = [
    ["leagueTop8", "LEAGUE"],
    ["roundOf16", "ROUND_OF_16"],
    ["quarterFinals", "QUARTER"],
    ["semiFinals", "SEMI"],
  ];
  let total = 0;

  milestones.forEach(([field, phase]) => {
    if (official.classifications[field].includes(favoriteTeam)) {
      total += phaseRules[phase].favoritePoints;
    }
  });

  if (official.classifications.champion === favoriteTeam) {
    total += phaseRules.FINAL.favoritePoints;
  }

  return total;
}

function computeClassificationPoints(predictions, official, matchContext) {
  const totals = {
    league: 0,
    playoff: 0,
    round16: 0,
    quarter: 0,
    semi: 0,
    final: 0,
    favorite: 0,
    topScorer: 0,
    topAssist: 0,
  };

  const leagueHits = predictions.leagueTop8.filter((team) =>
    official.classifications.leagueTop8.includes(team)
  ).length;
  totals.league += leagueHits * phaseRules.LEAGUE.qualificationPoints;

  predictions.leagueTop8.forEach((team, index) => {
    if (official.classifications.leagueTop8[index] === team) {
      totals.league += phaseRules.LEAGUE.orderPoints;
    }
  });

  const playoffHits = predictions.playoffWinners.filter((team) =>
    official.classifications.playoffWinners.includes(team)
  ).length;
  totals.playoff += playoffHits * phaseRules.PLAYOFF.qualificationPoints;

  const round16Hits = predictions.roundOf16.filter((team) =>
    official.classifications.roundOf16.includes(team)
  ).length;
  totals.round16 += round16Hits * phaseRules.ROUND_OF_16.qualificationPoints;

  const quarterHits = predictions.quarterFinals.filter((team) =>
    official.classifications.quarterFinals.includes(team)
  ).length;
  totals.quarter += quarterHits * phaseRules.QUARTER.qualificationPoints;

  const semiHits = predictions.semiFinals.filter((team) =>
    official.classifications.semiFinals.includes(team)
  ).length;
  totals.semi += semiHits * phaseRules.SEMI.qualificationPoints;

  const finalMatch = matchContext.find((match) => match.phase === "FINAL");
  const finalTiedAt90 = finalMatch?.score90 && resultFromScore(finalMatch.score90) === "DRAW";

  if (predictions.champion === official.classifications.champion) {
    totals.final += phaseRules.FINAL.qualificationPoints;
  } else if (finalTiedAt90) {
    totals.final += 0;
  }

  totals.favorite = computeFavoritePoints(predictions.favoriteTeam, official);
  totals.topScorer = predictions.topScorer === official.classifications.topScorer ? 15 : 0;
  totals.topAssist = predictions.topAssist === official.classifications.topAssist ? 15 : 0;

  return totals;
}

function buildExactHitMap(participants, allPredictions, matches) {
  const exactHits = {};

  matches.forEach((match) => {
    if (match.status !== "FINISHED") {
      return;
    }

    exactHits[match.id] = participants
      .filter((participant) => {
        const prediction = allPredictions[participant.id].matches[match.id];
        return matchesScore(prediction, match.score90);
      })
      .map((participant) => participant.id);
  });

  return exactHits;
}

function scoreFinishedMatch(match, prediction, exactHitMap) {
  if (!prediction || match.status !== "FINISHED") {
    return 0;
  }

  const rules = phaseRules[match.phase];
  const regulationResult = resultFromScore(match.score90);
  const predictedResult = resultFromScore(prediction);
  let total = 0;

  if (predictedResult === regulationResult) {
    total += rules.resultPoints;
  }

  let exactPoints = 0;
  const exactRegulation = matchesScore(prediction, match.score90);
  if (exactRegulation) {
    exactPoints = rules.exactScorePoints;
  } else if (match.wentExtraTime && matchesScore(prediction, match.scoreFinal)) {
    exactPoints = rules.exactScorePoints / 2;
  }

  if (exactPoints > 0 && match.superclassic) {
    exactPoints *= 2;
  }

  if (exactRegulation && exactHitMap[match.id]?.length === 1) {
    exactPoints *= 2;
  }

  total += exactPoints;
  return total;
}

export function computeLeaderboard({ participants, matches, official, predictionsByParticipant }) {
  const exactHitMap = buildExactHitMap(participants, predictionsByParticipant, matches);

  const rows = participants.map((participant) => {
    const participantPredictions = predictionsByParticipant[participant.id];
    const categoryTotals = {
      LEAGUE: 0,
      PLAYOFF: 0,
      ROUND_OF_16: 0,
      QUARTER: 0,
      SEMI: 0,
      FINAL: 0,
      favorite: 0,
      topScorer: 0,
      topAssist: 0,
    };

    matches.forEach((match) => {
      categoryTotals[match.phase] += scoreFinishedMatch(
        match,
        participantPredictions.matches[match.id],
        exactHitMap
      );
    });

    const classificationTotals = computeClassificationPoints(
      participantPredictions.classifications,
      official,
      matches
    );

    categoryTotals.LEAGUE += classificationTotals.league;
    categoryTotals.PLAYOFF += classificationTotals.playoff;
    categoryTotals.ROUND_OF_16 += classificationTotals.round16;
    categoryTotals.QUARTER += classificationTotals.quarter;
    categoryTotals.SEMI += classificationTotals.semi;
    categoryTotals.FINAL += classificationTotals.final;
    categoryTotals.favorite = classificationTotals.favorite;
    categoryTotals.topScorer = classificationTotals.topScorer;
    categoryTotals.topAssist = classificationTotals.topAssist;

    const knockoutTotal =
      categoryTotals.PLAYOFF +
      categoryTotals.ROUND_OF_16 +
      categoryTotals.QUARTER +
      categoryTotals.SEMI +
      categoryTotals.FINAL;

    const total = phaseOrder.reduce((sum, phase) => sum + categoryTotals[phase], 0)
      + categoryTotals.favorite
      + categoryTotals.topScorer
      + categoryTotals.topAssist;

    return {
      participant,
      total: round2(total),
      firstPhase: round2(categoryTotals.LEAGUE),
      knockout: round2(knockoutTotal),
      favorite: round2(categoryTotals.favorite),
      artGar: round2(categoryTotals.topScorer + categoryTotals.topAssist),
      categories: Object.fromEntries(
        Object.entries(categoryTotals).map(([key, value]) => [key, round2(value)])
      ),
    };
  });

  const sorted = rows.sort((a, b) => b.total - a.total || a.participant.name.localeCompare(b.participant.name));
  sorted.forEach((row, index) => {
    row.position = index + 1;
  });

  return sorted;
}
