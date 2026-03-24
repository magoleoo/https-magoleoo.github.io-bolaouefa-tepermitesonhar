# Backtest playoff + oitavas

Base analisada: `/Users/leopicca/Downloads/06_Projetos_e_Criacao/2025/11/copia_de_bolao_uefa_25_26_oficial.xlsx`

## Resultado geral

- Playoff: `19/21` participantes batem exatamente com a planilha.
- Oitavas: `18/21` participantes batem exatamente com a planilha.
- Oitavas vs aba `Acertos`: `18/21` participantes batem nos contadores de tendência, placar e classificados.

## Participante por participante

| Participante | Playoff calc | Playoff planilha | Delta | Oitavas calc | Oitavas planilha | Delta | Hope Solo | Acertos 8as |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Biel | 11.00 | 11.00 | 0.00 | 39.00 | 39.00 | 0.00 | 0 | T 11/11 • P 2/2 • C 6/6 |
| Celsinho | 6.00 | 6.00 | 0.00 | 21.00 | 21.00 | 0.00 | 0 | T 7/7 • P 1/1 • C 3/3 |
| Dan | 10.50 | 10.50 | 0.00 | 26.00 | 26.00 | 0.00 | 0 | T 6/6 • P 1/1 • C 5/5 |
| Deco | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0 | - |
| Enrico | 12.50 | 12.50 | 0.00 | 35.00 | 36.00 | -1.00 | 1 | T 7/7 • P 2/2 • C 6/6 |
| Faber | 16.00 | 16.00 | 0.00 | 25.00 | 25.00 | 0.00 | 0 | T 5/5 • P 1/1 • C 5/5 |
| Feijão | 10.00 | 10.00 | 0.00 | 49.00 | 49.00 | 0.00 | 0 | T 11/11 • P 4/4 • C 6/6 |
| Felippe Leite | 11.50 | 11.50 | 0.00 | 39.00 | 39.00 | 0.00 | 0 | T 8/8 • P 2/2 • C 7/7 |
| Gui Giron | 11.50 | 11.50 | 0.00 | 44.00 | 47.00 | -3.00 | 0 | T 10/10 • P 2/2 • C 8/8 |
| Ivan | 9.00 | 9.00 | 0.00 | 32.00 | 32.00 | 0.00 | 0 | T 6/0 • P 1/0 • C 7/0 |
| Leo Picca | 10.00 | 10.00 | 0.00 | 38.00 | 38.00 | 0.00 | 0 | T 7/7 • P 2/2 • C 7/7 |
| Leo Raposo | 16.50 | 16.50 | 0.00 | 27.00 | 27.00 | 0.00 | 0 | T 9/9 • P 0/0 • C 6/6 |
| Marcel | 13.00 | 13.00 | 0.00 | 35.00 | 35.00 | 0.00 | 0 | T 7/7 • P 2/2 • C 6/6 |
| Michel | 11.50 | 11.50 | 0.00 | 31.00 | 31.00 | 0.00 | 0 | T 8/0 • P 1/0 • C 6/0 |
| Muca | 13.00 | 13.00 | 0.00 | 46.00 | 46.00 | 0.00 | 0 | T 8/8 • P 4/4 • C 6/6 |
| Nanel | 20.00 | 22.00 | -2.00 | 28.00 | 28.00 | 0.00 | 1 | T 5/5 • P 1/1 • C 6/6 |
| Rafinha | 17.00 | 17.00 | 0.00 | 31.00 | 31.00 | 0.00 | 0 | T 6/6 • P 2/2 • C 5/5 |
| Ranieri | 15.00 | 15.00 | 0.00 | 38.00 | 38.00 | 0.00 | 0 | T 7/7 • P 2/2 • C 7/7 |
| Scarpa | 10.00 | 10.00 | 0.00 | 27.00 | 27.00 | 0.00 | 0 | T 7/7 • P 1/1 • C 5/5 |
| Serginho | 13.00 | 13.00 | 0.00 | 40.00 | 40.00 | 0.00 | 0 | T 9/9 • P 2/2 • C 7/7 |
| Victor | 20.00 | 21.50 | -1.50 | 32.00 | 32.00 | 0.00 | 0 | T 9/9 • P 1/1 • C 6/6 |

## Observações

- Neste workbook, o placar exato substitui a pontuação de tendência no mata-mata. Exemplo: oitavas usam `6` para exato ou `1` para tendência, não `7` acumulado.
- O relatório reconstrói apenas `PLAYOFF_1aFASE` e `OITAVAS`, porque foram as abas pedidas.
- Contagem de `Hope Solo` considera jogos em que exatamente um participante foi o único a acertar o jogo, seja por `placar exato` ou por `tendência`.
