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
- Os placares ao vivo estão simulados localmente para demonstrar atualização automática sem depender de API externa.
- A integração futura pode substituir a função de live timeline por um provedor real de dados esportivos.

## Próximo passo técnico

Agora o projeto também tem uma base de backend em [backend/README.md](/Users/leopicca/Downloads/06_Projetos_e_Criacao/champions-bolao/backend/README.md) com:

- schema inicial de banco
- rotas HTTP para ranking, jogos, sync e recálculo
- sincronização preparada para API-Football
- motor de pontuação isolado do frontend
