window.leaguePhaseRawByMatchday = {
  1: `
Young Boys 0-3 Aston Villa
Juventus 3-1 PSV Eindhoven
Milan 1-3 Liverpool
Bayern Munich 9-2 Dinamo Zagreb
Real Madrid 3-1 VfB Stuttgart
Sporting CP 2-0 Lille
Sparta Prague 3-0 Red Bull Salzburg
Bologna 0-0 Shakhtar Donetsk
Celtic 5-1 Slovan Bratislava
Club Brugge 0-3 Borussia Dortmund
Manchester City 0-0 Inter Milan
Paris Saint-Germain 1-0 Girona
Feyenoord 0-4 Bayer Leverkusen
Red Star Belgrade 1-2 Benfica
Monaco 2-1 Barcelona
Atalanta 0-0 Arsenal
Atlético Madrid 2-1 RB Leipzig
Brest 2-1 Sturm Graz
`,
  2: `
Red Bull Salzburg 0-4 Brest
VfB Stuttgart 1-1 Sparta Prague
Arsenal 2-0 Paris Saint-Germain
Bayer Leverkusen 1-0 Milan
Borussia Dortmund 7-1 Celtic
Barcelona 5-0 Young Boys
Inter Milan 4-0 Red Star Belgrade
PSV Eindhoven 1-1 Sporting CP
Slovan Bratislava 0-4 Manchester City
Shakhtar Donetsk 0-3 Atalanta
Girona 2-3 Feyenoord
Aston Villa 1-0 Bayern Munich
Dinamo Zagreb 2-2 Monaco
Liverpool 2-0 Bologna
Lille 1-0 Real Madrid
RB Leipzig 2-3 Juventus
Sturm Graz 0-1 Club Brugge
Benfica 4-0 Atlético Madrid
`,
  3: `
Milan 3-1 Club Brugge
Monaco 5-1 Red Star Belgrade
Arsenal 1-0 Shakhtar Donetsk
Aston Villa 2-0 Bologna
Girona 2-0 Slovan Bratislava
Juventus 0-1 VfB Stuttgart
Paris Saint-Germain 1-1 PSV Eindhoven
Real Madrid 5-2 Borussia Dortmund
Sturm Graz 0-2 Sporting CP
Atalanta 0-0 Celtic
Brest 1-1 Bayer Leverkusen
Atlético Madrid 1-3 Lille
Young Boys 0-1 Inter Milan
Barcelona 4-1 Bayern Munich
Red Bull Salzburg 0-2 Dinamo Zagreb
Manchester City 5-0 Sparta Prague
RB Leipzig 0-1 Liverpool
Benfica 1-3 Feyenoord
`,
  4: `
PSV Eindhoven 4-0 Girona
Slovan Bratislava 1-4 Dinamo Zagreb
Bologna 0-1 Monaco
Borussia Dortmund 1-0 Sturm Graz
Celtic 3-1 RB Leipzig
Liverpool 4-0 Bayer Leverkusen
Lille 1-1 Juventus
Real Madrid 1-3 Milan
Sporting CP 4-1 Manchester City
Club Brugge 1-0 Aston Villa
Shakhtar Donetsk 2-1 Young Boys
Sparta Prague 1-2 Brest
Inter Milan 1-0 Arsenal
Feyenoord 1-3 Red Bull Salzburg
Red Star Belgrade 2-5 Barcelona
Paris Saint-Germain 1-2 Atlético Madrid
VfB Stuttgart 0-2 Atalanta
Bayern Munich 1-0 Benfica
`,
  5: `
Sparta Prague 0-6 Atlético Madrid
Slovan Bratislava 2-3 Milan
Bayer Leverkusen 5-0 Red Bull Salzburg
Young Boys 1-6 Atalanta
Barcelona 3-0 Brest
Bayern Munich 1-0 Paris Saint-Germain
Inter Milan 1-0 RB Leipzig
Manchester City 3-3 Feyenoord
Sporting CP 1-5 Arsenal
Red Star Belgrade 5-1 VfB Stuttgart
Sturm Graz 1-0 Girona
Monaco 2-3 Benfica
Aston Villa 0-0 Juventus
Bologna 1-2 Lille
Celtic 1-1 Club Brugge
Dinamo Zagreb 0-3 Borussia Dortmund
Liverpool 2-0 Real Madrid
PSV Eindhoven 3-2 Shakhtar Donetsk
`,
  6: `
Girona 0-1 Liverpool
Dinamo Zagreb 0-0 Celtic
Atalanta 2-3 Real Madrid
Bayer Leverkusen 1-0 Inter Milan
Club Brugge 2-1 Sporting CP
Red Bull Salzburg 0-3 Paris Saint-Germain
Shakhtar Donetsk 1-5 Bayern Munich
RB Leipzig 2-3 Aston Villa
Brest 1-0 PSV Eindhoven
Atlético Madrid 3-1 Slovan Bratislava
Lille 3-2 Sturm Graz
Milan 2-1 Red Star Belgrade
Arsenal 3-0 Monaco
Borussia Dortmund 2-3 Barcelona
Feyenoord 4-2 Sparta Prague
Juventus 2-0 Manchester City
Benfica 0-0 Bologna
VfB Stuttgart 5-1 Young Boys
`,
  7: `
Monaco 1-0 Aston Villa
Atalanta 5-0 Sturm Graz
Atlético Madrid 2-1 Bayer Leverkusen
Bologna 2-1 Borussia Dortmund
Club Brugge 0-0 Juventus
Red Star Belgrade 2-3 PSV Eindhoven
Liverpool 2-1 Lille
Slovan Bratislava 1-3 VfB Stuttgart
Benfica 4-5 Barcelona
Shakhtar Donetsk 2-0 Brest
RB Leipzig 2-1 Sporting CP
Milan 1-0 Girona
Sparta Prague 0-1 Inter Milan
Arsenal 3-0 Dinamo Zagreb
Celtic 1-0 Young Boys
Feyenoord 3-0 Bayern Munich
Paris Saint-Germain 4-2 Manchester City
Real Madrid 5-1 Red Bull Salzburg
`,
  8: `
Aston Villa 4-2 Celtic
Bayer Leverkusen 2-0 Sparta Prague
Borussia Dortmund 3-1 Shakhtar Donetsk
Young Boys 0-1 Red Star Belgrade
Barcelona 2-2 Atalanta
Bayern Munich 3-1 Slovan Bratislava
Inter Milan 3-0 Monaco
Red Bull Salzburg 1-4 Atlético Madrid
Girona 1-2 Arsenal
Dinamo Zagreb 2-1 Milan
Juventus 0-2 Benfica
Lille 6-1 Feyenoord
Manchester City 3-1 Club Brugge
PSV Eindhoven 3-2 Liverpool
Sturm Graz 1-0 RB Leipzig
Sporting CP 1-1 Bologna
Brest 0-3 Real Madrid
VfB Stuttgart 1-4 Paris Saint-Germain
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

window.leaguePhaseResults = Object.entries(window.leaguePhaseRawByMatchday).flatMap(
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

window.leaguePhaseTopEight = [
  "Arsenal",
  "Bayern München",
  "Liverpool",
  "Tottenham",
  "Barcelona",
  "Chelsea",
  "Sporting CP",
  "Man City",
];

window.resultsSources = {
  fixturesAndResultsUrl:
    "https://www.uefa.com/uefachampionsleague/news/029c-1e9a2f63fe2d-ebf9ad643892-1000--2025-26-champions-league-all-the-fixtures-and-results/",
  qualificationUrl:
    "https://www.uefa.com/uefachampionsleague/news/02a0-1f5779647b95-29ad8ef754a8-1000--champions-league-round-of-16-and-knockout-phase-play-offs-wh/",
};
