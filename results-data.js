const leaguePhaseRawByMatchday = {
  1: `
Athletic Club 0-2 Arsenal
PSV Eindhoven 1-3 Union Saint-Gilloise
Juventus 4-4 Borussia Dortmund
Real Madrid 2-1 Marseille
Benfica 2-3 Qarabağ
Tottenham 1-0 Villarreal
Olympiacos 0-0 Pafos
Slavia Praha 2-2 Bodø/Glimt
Ajax 0-2 Inter
Bayern München 3-1 Chelsea
Liverpool 3-2 Atlético de Madrid
Paris Saint-Germain 4-0 Atalanta
Club Brugge 4-1 Monaco
Copenhagen 2-2 Leverkusen
Frankfurt 5-1 Galatasaray
Manchester City 2-0 Napoli
Newcastle United 1-2 Barcelona
Sporting CP 4-1 Kairat Almaty
`,
  2: `
Atalanta 2-1 Club Brugge
Kairat Almaty 0-5 Real Madrid
Atlético de Madrid 5-1 Frankfurt
Chelsea 1-0 Benfica
Inter 3-0 Slavia Praha
Bodø/Glimt 2-2 Tottenham
Galatasaray 1-0 Liverpool
Marseille 4-0 Ajax
Pafos 1-5 Bayern München
Qarabağ 2-0 Copenhagen
Union Saint-Gilloise 0-4 Newcastle United
Arsenal 2-0 Olympiacos
Monaco 2-2 Manchester City
Leverkusen 1-1 PSV Eindhoven
Borussia Dortmund 4-1 Athletic Club
Barcelona 1-2 Paris Saint-Germain
Napoli 2-1 Sporting CP
Villarreal 2-2 Juventus
`,
  3: `
Barcelona 6-1 Olympiacos
Kairat Almaty 0-0 Pafos
Arsenal 4-0 Atlético de Madrid
Leverkusen 2-7 Paris Saint-Germain
Copenhagen 2-4 Borussia Dortmund
Newcastle United 3-0 Benfica
PSV Eindhoven 6-2 Napoli
Union Saint-Gilloise 0-4 Inter
Villarreal 0-2 Manchester City
Athletic Club 3-1 Qarabağ
Galatasaray 3-1 Bodø/Glimt
Monaco 0-0 Tottenham
Atalanta 0-0 Slavia Praha
Chelsea 5-1 Ajax
Frankfurt 1-5 Liverpool
Bayern München 4-0 Club Brugge
Real Madrid 1-0 Juventus
Sporting CP 2-1 Marseille
`,
  4: `
Slavia Praha 0-3 Arsenal
Napoli 0-0 Frankfurt
Atlético de Madrid 3-1 Union Saint-Gilloise
Bodø/Glimt 0-1 Monaco
Juventus 1-1 Sporting CP
Liverpool 1-0 Real Madrid
Olympiacos 1-1 PSV Eindhoven
Paris Saint-Germain 1-2 Bayern München
Tottenham 4-0 Copenhagen
Pafos 1-0 Villarreal
Qarabağ 2-2 Chelsea
Ajax 0-3 Galatasaray
Club Brugge 3-3 Barcelona
Inter 2-1 Kairat Almaty
Manchester City 4-1 Borussia Dortmund
Newcastle United 2-0 Athletic Club
Marseille 0-1 Atalanta
Benfica 0-1 Leverkusen
`,
  5: `
Ajax 0-2 Benfica
Galatasaray 0-1 Union Saint-Gilloise
Borussia Dortmund 4-0 Villarreal
Chelsea 3-0 Barcelona
Bodø/Glimt 2-3 Juventus
Manchester City 0-2 Leverkusen
Marseille 2-1 Newcastle United
Slavia Praha 0-0 Athletic Club
Napoli 2-0 Qarabağ
Copenhagen 3-2 Kairat Almaty
Pafos 2-2 Monaco
Arsenal 3-1 Bayern München
Atlético de Madrid 2-1 Inter
Frankfurt 0-3 Atalanta
Liverpool 1-4 PSV Eindhoven
Olympiacos 3-4 Real Madrid
Paris Saint-Germain 5-3 Tottenham
Sporting CP 3-0 Club Brugge
`,
  6: `
Kairat Almaty 0-1 Olympiacos
Bayern München 3-1 Sporting CP
Monaco 1-0 Galatasaray
Atalanta 2-1 Chelsea
Barcelona 2-1 Frankfurt
Inter 0-1 Liverpool
PSV Eindhoven 2-3 Atlético de Madrid
Union Saint-Gilloise 2-3 Marseille
Tottenham 3-0 Slavia Praha
Qarabağ 2-4 Ajax
Villarreal 2-3 Copenhagen
Athletic Club 0-0 Paris Saint-Germain
Leverkusen 2-2 Newcastle United
Borussia Dortmund 2-2 Bodø/Glimt
Club Brugge 0-3 Arsenal
Juventus 2-0 Pafos
Real Madrid 1-2 Manchester City
Benfica 2-0 Napoli
`,
  7: `
Kairat Almaty 1-4 Club Brugge
Bodø/Glimt 3-1 Manchester City
Copenhagen 1-1 Napoli
Inter 1-3 Arsenal
Olympiacos 2-0 Leverkusen
Real Madrid 6-1 Monaco
Sporting CP 2-1 Paris Saint-Germain
Tottenham 2-0 Borussia Dortmund
Villarreal 1-2 Ajax
Galatasaray 1-1 Atlético de Madrid
Qarabağ 3-2 Frankfurt
Atalanta 2-3 Athletic Club
Chelsea 1-0 Pafos
Bayern München 2-0 Union Saint-Gilloise
Juventus 2-0 Benfica
Newcastle United 3-0 PSV Eindhoven
Marseille 0-3 Liverpool
Slavia Praha 2-4 Barcelona
`,
  8: `
Ajax 1-2 Olympiacos
Arsenal 3-2 Kairat Almaty
Monaco 0-0 Juventus
Athletic Club 2-3 Sporting CP
Atlético de Madrid 1-2 Bodø/Glimt
Leverkusen 3-0 Villarreal
Borussia Dortmund 0-2 Inter
Club Brugge 3-0 Marseille
Frankfurt 0-2 Tottenham
Barcelona 4-1 Copenhagen
Liverpool 6-0 Qarabağ
Manchester City 2-0 Galatasaray
Pafos 4-1 Slavia Praha
Paris Saint-Germain 1-1 Newcastle United
PSV Eindhoven 1-2 Bayern München
Union Saint-Gilloise 1-0 Atalanta
Benfica 4-2 Real Madrid
Napoli 2-3 Chelsea
`,
};

function parseLeagueLine(line) {
  const trimmed = line.trim();
  const match = trimmed.match(/^(.*?) (\d+)-(\d+) (.*?)$/);

  if (!match) {
    throw new Error(`Linha de resultado inválida: ${line}`);
  }

  return {
    homeTeam: match[1].trim(),
    awayTeam: match[4].trim(),
    scoreFinal: {
      home: Number(match[2]),
      away: Number(match[3]),
    },
  };
}

export const leaguePhaseResults = Object.entries(leaguePhaseRawByMatchday).flatMap(
  ([matchday, block]) =>
    block
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line, index) => ({
        id: `LEAGUE-${matchday}-${index + 1}`,
        phase: "LEAGUE",
        matchday: `Matchday ${matchday}`,
        ...parseLeagueLine(line),
      }))
);

export const leaguePhaseTopEight = [
  "Arsenal",
  "Barcelona",
  "Bayern München",
  "Chelsea",
  "Liverpool",
  "Manchester City",
  "Sporting CP",
  "Tottenham",
];

export const resultsSources = {
  fixturesAndResultsUrl:
    "https://www.uefa.com/uefachampionsleague/news/029c-1e9a2f63fe2d-ebf9ad643892-1000--2025-26-champions-league-all-the-fixtures-and-results/",
  qualificationUrl:
    "https://www.uefa.com/uefachampionsleague/news/02a0-1f5779647b95-29ad8ef754a8-1000--champions-league-round-of-16-and-knockout-phase-play-offs-wh/",
};
