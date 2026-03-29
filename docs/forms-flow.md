# Fluxo Técnico do Bolão via Google Forms

## Objetivo

Manter o bolão ativo em todas as temporadas com um fluxo estável:

- coleta de palpites centralizada
- histórico por temporada
- recálculo confiável
- operação simples para você repetir ano após ano

## Fonte oficial de dados

Use **Google Forms + Google Sheets** como entrada oficial.

Motivos:

- evita perda de dados locais do navegador
- guarda carimbo de data/hora de cada envio
- facilita auditoria de divergências
- reduz retrabalho manual com imagens/planilha

## Arquitetura recomendada por temporada

1. Criar um bundle de Forms da temporada (script em `tools/forms/create_bolao_forms.gs`).
2. Cada fase recebe seu próprio Form.
3. Todos os Forms salvam respostas em uma planilha única da temporada.
4. O app lê CSV público por fase (quando necessário) e/ou usa importação batch para a base oficial.
5. A recalculadora aplica regras e atualiza ranking.

## Padrão de Forms por fase

- `PLAYOFF`
- `ROUND_OF_16`
- `QUARTER_FINALS`
- `SEMI_FINALS`
- `FINAL`
- `SPECIAL_PICKS` (favorito, artilheiro, garçom)
- `LEAGUE_SUPERCLASSIC` (apenas quando houver superclássicos na 1ª fase)

## Operação da temporada (runbook)

1. Fechar lista de participantes.
2. Gerar o bundle de Forms da temporada.
3. Abrir janela de envio dos palpites da fase.
4. Encerrar prazo da fase.
5. Atualizar a planilha oficial com resultados/palpites.
6. Rodar `Bolao Auto-Sync` no GitHub Actions (ou `python tools/action_sync_excel.py` localmente).
7. Publicar atualização do site.

## Virada para a próxima temporada

1. Duplicar o projeto.
2. Atualizar `SEASON_LABEL` no script de Forms.
3. Gerar novos Forms e nova planilha de respostas.
4. Atualizar `data.js` com os novos links (principalmente quartas, se usar envio direto no app).
5. Validar cálculo com backtest antes de abrir para os palpiteiros.

## Governança recomendada

- Bloquear edição da planilha de respostas para terceiros.
- Manter backup da planilha em Drive.
- Não sobrescrever respostas antigas.
- Tratar reenvio pelo mesmo participante com regra explícita:
  - recomendação: usar o envio mais recente antes do fechamento da fase.

## Sobre “montar o Forms”

Sim: eu já deixei o **script que cria os Forms automaticamente** no projeto.

Arquivo:

- `tools/forms/create_bolao_forms.gs`

Como eu não tenho acesso direto à sua conta Google daqui, você executa esse script uma vez no Apps Script e ele cria tudo no seu Drive.
