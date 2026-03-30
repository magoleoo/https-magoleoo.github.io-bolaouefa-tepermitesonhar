# Bolão Champions League

MVP estático para um site privado de bolão da Champions League com:

- login simples por participante
- ranking recalculado no navegador
- formulário de palpites dos jogos
- palpites especiais de favorito, campeão, artilheiro e garçom
- suporte às regras de pontuação por fase, bônus e casos especiais
- camada preparada para atualização automática de placares

## Como rodar

Na pasta do projeto:

```bash
cd /Users/leopicca/Downloads/06_Projetos_e_Criacao/champions-bolao
python3 -m http.server 4173
```

Depois abra no navegador:

[http://localhost:4173](http://localhost:4173)

## Códigos de teste

- `Leo Picca` -> `UCL-101`
- `Felippe Leite` -> `UCL-116`
- `Victor` -> `UCL-114`

## Observações importantes

- Este MVP usa autenticação local no navegador. Para produção, o ideal é trocar por backend com sessões reais.
- O fluxo oficial do projeto agora é **sem API**, usando Forms/planilha oficial.
- O ranking/resultados são atualizados por importação da planilha em `tools/action_sync_excel.py`.

## Próximo passo técnico

Agora o projeto também tem uma base de backend em [backend/README.md](/Users/leopicca/Downloads/06_Projetos_e_Criacao/champions-bolao/backend/README.md) com:

- schema inicial de banco
- rotas HTTP para ranking, jogos, sync e recálculo
- sincronização por base oficial (planilha/Forms)
- motor de pontuação isolado do frontend

## Forms para operação recorrente

Para rodar o bolão temporada após temporada com Google Forms:

- fluxo técnico: [docs/forms-flow.md](/Users/leopicca/Downloads/06_Projetos_e_Criacao/champions-bolao/docs/forms-flow.md)
- script de criação dos Forms: [tools/forms/create_bolao_forms.gs](/Users/leopicca/Downloads/06_Projetos_e_Criacao/champions-bolao/tools/forms/create_bolao_forms.gs)
- guia rápido: [tools/forms/README.md](/Users/leopicca/Downloads/06_Projetos_e_Criacao/champions-bolao/tools/forms/README.md)

### Encerramento oficial (campeão, artilheiro, garçom) via Forms

- o painel de encerramento no site está em **modo leitura**
- a fonte oficial vem de `window.tournamentOutcomeFormsConfig.csvUrl` em [data.js](/Users/leopicca/Downloads/06_Projetos_e_Criacao/champions-bolao/data.js)
- opcionalmente, adicione `formUrl` para exibir botão "Abrir Forms (admin)" no painel

## Atualização oficial do site (Forms/Planilha)

O projeto possui um workflow dedicado para sincronizar dados oficiais:

- arquivo: `.github/workflows/bolao-sync.yml`
- disparo manual (`workflow_dispatch`)
- saída atualizada: `api/ranking.json`, `api/ranking.js`, `api/matches.json`, `api/matches.js`

### Configuração no GitHub (uma vez)

No repositório, abra `Settings > Secrets and variables > Actions`.

1. Opcional:
- `BOLAO_SOURCE_XLSX_URL` = URL pública direta do `.xlsx` oficial

2. Se não configurar `BOLAO_SOURCE_XLSX_URL`:
- o workflow usa o arquivo versionado no repositório:
- `data/Bolao_UEFA_25_26_OFICIAL.xlsx`

### Primeiro disparo manual

1. Abra `Actions` no GitHub.
2. Selecione `Bolao Auto-Sync`.
3. Clique em `Run workflow`.

## Auditoria Funcional Guiada (UX em produção)

O projeto agora possui um script de auditoria clique a clique:

- script: [tools/qa_functional_audit.py](/Users/leopicca/Downloads/06_Projetos_e_Criacao/champions-bolao/tools/qa_functional_audit.py)
- saída JSON: `qa-functional-report.json`
- saída Markdown: `qa-functional-report.md`

### Instalação (uma vez)

```bash
python3 -m pip install playwright
python3 -m playwright install chromium
```

### Rodar auditoria local (arquivo index atual)

```bash
python3 tools/qa_functional_audit.py
```

### Rodar auditoria no site publicado

```bash
python3 tools/qa_functional_audit.py --url "https://magoleoo.github.io/https-magoleoo.github.io-bolaouefa-tepermitesonhar/"
```

### Resultado

- Exit `0`: auditoria crítica passou (desktop + mobile, sem erro de runtime/console).
- Exit `1`: houve falha crítica em algum check.
