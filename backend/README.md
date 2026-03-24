# Backend do Bolao

Base técnica para sair do MVP estático e evoluir para um bolão recalculado automaticamente.

## O que já vem pronto

- `schema.sql`: modelo inicial do banco
- `server.py`: API HTTP simples com rotas de saúde, ranking, jogos, sync e recálculo
- `sync_api_football.py`: sincronização base com a API-Football
- `scoring_engine.py`: recalculadora preparada para as regras do bolão
- `.env.example`: variáveis principais

## Rotas

- `GET /health`
- `GET /api/participants`
- `GET /api/matches?season=2025&phase=PLAYOFF`
- `GET /api/ranking?season=2025`
- `POST /api/admin/sync`
- `POST /api/admin/recalculate`
- `POST /api/admin/season-state`

## Rodando localmente

```bash
cd /Users/leopicca/Downloads/06_Projetos_e_Criacao/champions-bolao
cp backend/.env.example backend/.env
python3 -m backend.server
```

## Fluxo sugerido

1. Popular `participants`, palpites e picks especiais.
2. Rodar `POST /api/admin/sync` para puxar jogos da Champions.
3. Atualizar `season_state` com classificados oficiais, artilheiro e garçom.
4. Rodar `POST /api/admin/recalculate`.
5. Fazer o frontend consumir `GET /api/ranking` e `GET /api/matches`.

## Observações

- O banco atual usa SQLite para acelerar o MVP técnico.
- A estrutura foi desenhada para migrar com pouca dor para Postgres/Supabase.
- A liga padrão da Champions está configurada como `2`, seguindo a convenção documentada pela API-Football para a competição.
