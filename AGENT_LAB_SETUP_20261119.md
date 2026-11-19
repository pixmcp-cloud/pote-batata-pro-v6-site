# OpenCode Desktop + Cline Desktop — implantação e auditoria inicial (19/11/2026)

## Escopo confirmado
PC Windows 11 Pro for Workstations x64 `DESKTOP-9481JM1`, Intel i7-13620H (10 cores), RAM 15.71 GiB, livre entre 0.84–1.16 GiB no período; C: livre ~93.77 GB. Git, Node v24.18.0, Python 3.10, VS Code disponíveis.

Log Mestre GitHub da branch `feat/f35-completion-audit-20261118` foi lido (643 linhas) e comparado à cópia de `C:\Users\LIVRESOM\Documents\POTE_BATATA_PRO_LOG_MESTRE.md`. A versão local era prefixo da versão Git; foi feito backup `.backup-before-ai-tools-20261119` e atualizada a cópia do PC sem exclusão de histórico.

## Instalações oficiais verificadas
- **OpenCode Desktop v2.3.2** — release `anomalyco/opencode`, instalador `opencode-desktop-win-x64.exe`, 269731480 bytes, SHA-256 `1e73b4f49f591971f4ad61c5a39b284bf74d41f50ca1b84e68ccf2ab2be91e8d`; Authenticode `Valid`, Anomaly Innovations, Inc.; instalado por perfil em `%LOCALAPPDATA%\Programs\ai.opencode.desktop\OpenCode.exe`, processo e janela `OpenCode` responderam.
- **Cline Desktop v0.0.49** — release `cline/cline` tag `desktop-v0.0.49`, instalador `Cline_0.0.49_x64-setup.exe`, 133492016 bytes, SHA-256 `fa2242d743e2b75d422c16cfab4d534a1c2bc687ec73572be643a6d34663bcba`; Authenticode `Valid`, Cline Bot Inc.; instalado por perfil em `%LOCALAPPDATA%\Cline\cline-app.exe`, processo e janela `Cline` responderam. Tela inicial `Get started` confirmada.
- Os instaladores foram obtidos de releases oficiais e executados após verificar tamanho, hash e assinatura.

## Ambiente Git
Worktree dedicado: `C:\Users\LIVRESOM\Documents\GitHub\pote-batata-agent-lab-f35` exclusivamente na branch `feat/f35-completion-audit-20261118` do GitHub. Nenhuma alteração em `main`, Floot, Hosting, Firestore ou Worker comercial.

Arquivos de configuração versionados:
- `opencode.jsonc`: inicializa agente `plan`, solicita aprovação para edições/comandos, permite inspeções Git comuns, nega `git push`, `git reset`, `git clean`, deploy e acesso externo; impede leitura de `.env`, `.pem`, `.key` e credenciais.
- `AGENTS.md`: regras obrigatórias de segurança, branch, dado sintético, backend e documentação.
- `.opencode/agents/{auditor,tester,reviewer}.md`: agentes especializados, com auditor e reviewer sem escrita/comandos; tester sem escrita, comandos com aprovação.
- `.clinerules/01-potebatata.md`: instruções para Cline; `.clineignore`: exclusões de artefatos e segredos. Atenção: regras do Cline são instruções, não sandbox; **Auto Approve deverá ser conferido/desligado manualmente após o onboarding**.

## Testes sem acesso à produção
- Configuração OpenCode passou no parser JSON do PowerShell, verificadas as 21 regras e 4 perfis declarados.
- Primeira tentativa da suíte Workers falhou em 5 arquivos por `ERR_MODULE_NOT_FOUND`, pois a worktree não tinha dependências npm instaladas.
- Corrigido somente no laboratório: `npm.cmd ci --prefix workers/antifraud --ignore-scripts --no-audit --no-fund` a partir de `package-lock.json`, instalando 35 dependências.
- Reexecução: `npm.cmd test --prefix workers/antifraud` — **64/64 PASS, 0 FAIL** em 19/11/2026.
- Nenhuma mensagem real, pagamento, licenciamento, estoque ou dados de produção foram acessados ou alterados.
- OpenCode abriu; Cline iniciou no onboarding. Nenhuma chave/API foi fornecida ou configurada, nenhum agente com modelo foi executado, nenhuma compra foi realizada. Os testes são de código local.
- Limitação de RAM: manter somente um editor/IDE pesado aberto por vez no PC para evitar paginação excessiva e travamento.

## Próximos passos pessoais no PC
1. Criar uma chave própria no Google AI Studio para um projeto Gemini API **Free Tier**, sem Cloud Billing; a assinatura Google AI Pro é separada da API.
2. Inserir chave no provedor Google Gemini **dentro do OpenCode e do Cline**, nunca no chat, no Git ou em arquivos de texto; confirmar modelo com etiqueta gratuita, limites e ausência de cobrança.
3. Finalizar `Get started` do Cline e verificar que Auto Approve está desativado para terminal e edições.
4. Abrir worktree da branch no OpenCode/Cline, inspecionar Log Mestre, executar auditoria somente leitura; aprovar manualmente quaisquer alterações.
5. Não liberar deploy, dados de clientes, regras comerciais, licenças, operações de escrita Cloudflare ou pagamentos sem nova autorização.
