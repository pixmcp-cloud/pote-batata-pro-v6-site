# POTÊ BATATA PRO — REGRAS DO DYAD (OBRIGATÓRIAS)
Leia e respeite as regras abaixo ANTES de editar arquivos.
1. Este repositório é uma cópia de desenvolvimento do site OFICIAL `https://pdv.livresom.com`; o site comercial NÃO está hospedado no Dyad nem no GitHub Pages. O frontend comercial está no Firebase Hosting projeto `potobatata-b71f3`, e os dados privados no Cloud Firestore.
2. Nunca execute `firebase deploy`, `wrangler deploy`, altere regras Firestore/Auth, acione cobrança, migre dados ou ative Worker de gravação sem autorização expressa. NÃO escreva nem leia dados reais do Firebase durante o laboratório.
3. Trabalhe somente na branch Git `feat/dyad-development-lab-20261119` ou em novas branches derivadas dela. Não edite/push `main`. Toda alteração precisa ser versionada no GitHub; não depender de alterações isoladas no editor.
4. A pasta `public/` é GERADA e ignorada pelo Git. Não edite `public/` como fonte. Edite `source/pote_app_base.html`, `*.js`, `*.mjs`, `*.css`, `assets/` e scripts originais. Gere a pasta pública usando `python build_hosting.py`.
5. O laboratório Dyad usa `npm run dev`, que executa `dyad/dev-server.mjs` e serve a pasta `public/` com CSP de conexão externa bloqueada. Use somente dados sintéticos. O cabeçalho `X-Pote-Lab: readonly-offline` indica isolamento.
6. Preserve interfaces, marca, logo original, UX do caixa com um clique, pedidos #P0000001, estoque, devoluções, precificação, WhatsApp, menus, gráficos, franquias, licenças, acessibilidade e todos os módulos existentes. Não reconstrua do zero removendo funcionalidades.
7. Prioridades: desempenho mobile, confiabilidade PDV, segurança, clareza dos relatórios financeiros, redução de dívida técnica. Refatore gradualmente com teste de regressão após cada mudança.
8. O Firebase atual tem registros por usuário em `users/{uid}/records`, sincronização V2 e Custom Claim admin `potebatataAdmin:true`; jamais presuma esquema Supabase ou e-mail sozinho como privilégio.
9. O Cloudflare Worker `pote-batata-guard-staging` usa `ENABLE_WRITES=false`; preserve isso. Nunca adicione chaves secretas ao repo. Nunca envie conteúdo privado ao modelo ou commits.
10. Execute antes de cada entrega: `npm run test:dyad`, `python build_hosting.py`, `node --check` dos JS modificados e testes específicos `node test_*.js`. Para operações críticas execute Firebase Emulator em projeto `demo-*`, nunca produção.
11. Sinalize honestamente o que foi testado em laboratório e o que ainda precisa ser homologado no Android real. Não alegar que preview em Chrome é APK testado.
12. Se o Dyad pedir chave/modelo de IA, solicite ao proprietário conexão voluntária; nunca colete senha, cookies ou tokens.
