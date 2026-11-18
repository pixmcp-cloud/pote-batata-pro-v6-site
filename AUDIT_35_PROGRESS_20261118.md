# Potê Batata Pro — execução das 35 melhorias: evidências e pendências

**Data:** 18/11/2026. **Branch não publicada:** \`feat/f35-completion-audit-20261118\`. **Base:** \`4cf0622\`. **Produção pública:** preservada; nenhuma migração real, credencial ou cobrança nova ativada.

## Progresso executado neste corte

| Frente | Alteração verificada | Testes |
| --- | --- | --- |
| F03/F09 | Normalização pt-BR de números com agrupamento por milhar no Finance Core, consistente com Estoque e PDV | \`test_numeric_parser_consistency.cjs\`, \`test_finance_core.js\` |
| F07/F15 | Contratos versionados de métodos obrigatórios; módulos parciais não autorizam operações críticas | \`test_module_health.js\` |
| F08 | Beta autenticada sem funções do gerador criativo legado; módulo moderno assume a interface. A demonstração V6 offline permanece intacta | build Firebase, \`test_creative_studio.cjs\`, \`test_creative_browser.cjs\` |
| F21/F35 | Inventário determinístico SHA-256 dos ativos estáticos, detecção de caminhos ausentes, arquivos sensíveis e symlinks | \`qa/test_release_asset_inventory.mjs\`, \`qa/release_asset_inventory.mjs public\` |
| F02/F05/F20 | Dupla trava de ativação do Worker para projetos reais (\`ENABLE_WRITES\` **e** \`PRODUCTION_CUTOVER_APPROVED\`), ambas desativadas por padrão | 20/20 testes unitários do Worker; testes SDK Worker com Firebase Emulator padrão e reforçado |
| Publicação | Auditoria de ativos e parsers registrada no workflow de publicação, antes do envio do pacote | \`build_hosting.py\`, QA local |

### Evidências do laboratório

- \`qa/mobile/run_everything.ps1\`: conclusão com código 0; perfis Chrome 320, 360, 375, 390, 430, paisagem, tablet e desktop aprovados.
- 5 vendas simuladas no PDV; Pix, cartão, dinheiro e pendência de pagamento na entrega; não há segundo clique obrigatório.
- 8 verificações dos gráficos de franquia nos modos semanal/mensal e diferentes larguras.
- Firestore Emulator: **10/10 referência** e **10/10 regras candidatas**, todos aprovados, incluindo dados isolados e concorrência.
- Worker: **20/20 testes unitários**, mais testes de produção, cancelamento, idempotência e concorrência usando adaptador SDK real do Emulator nas duas configurações de regras.
- F08: exportações PNG em 9:16, 1:1, 4:5 e 16:9 testadas, com valores exatos e sem overflow.
- Inventário após simplificação F08: **216 arquivos**, **7.740.025 bytes**, **0 referências locais ausentes**, **0 arquivos sinalizados como secretos**.

Essas evidências são **de homologação local automatizada**, não de Android OS/APK nativo, Firebase REST real ou venda bancária confirmada.

## Matriz das 35 frentes — estado após este corte

| ID | Estado | Próximo critério de aceite |
| --- | --- | --- |
| F01 | Implementado/testado | Confirmar conciliação com meio bancário em testes reais |
| F02 | Parcial — transações protegidas, backend desativado | Serviço Firestore confiável + bloquear escrita direta nas Rules no corte autorizado |
| F03 | Parcial — moeda e estoque consistentes nas rotas testadas | Normalizar formulários remanescentes e casos-limite |
| F04 | Implementado/testado | Homologação comercial |
| F05 | Parcial — cancelamento/idempotência emulado | Testes REST reais e operação multiaparelho |
| F06 | Parcial — lote não financeiro seguro | Backend atômico para operações financeiras e estoque acima do limite |
| F07 | Implementado/testado — contratos reforçados | Teste de indisponibilidade real de módulo |
| F08 | Concluído na beta candidata — demonstração offline preservada | Smoke test da beta autenticada em Android físico |
| F09 | Parcial — parser alinhado | Remover funções duplicadas remanescentes |
| F10 | Implementação e retomada testadas | Exportar/conferir/validar contas V1 reais individualmente |
| F11 | Parcial | Contrato de autorização único, cliente e servidor |
| F12 | Parcial | Desmontar gradualmente substituições do monólito, mantendo build idêntico |
| F13 | Implementado/testado | Medir Firestore ao vivo |
| F14 | Implementado/testado | Medir atualização em dispositivos de baixa memória |
| F15 | Parcial — contratos críticos versionados | Remover dependências globais informais restantes |
| F16 | Testado | Aceite com dados de escala real |
| F17 | Parcial — 8 perfis emulados | Android OS/APK físico; acessibilidade e memória |
| F18 | Regras publicadas e testadas | Homologação de conta Free real |
| F19 | Cotas publicadas e testadas | Conta Free/Pro/Pro vencido real e fluxos alternativos |
| F20 | Parcial — rastreio/idempotência testados | Conciliar Pix/cartão e verificar origem dos reembolsos por servidor |
| F21 | Parcial — inventário de ativos concluído | Definir hospedagem comercial, domínio, política de rollout |
| F22 | Implementado/testado | Aceite gerencial |
| F23 | Parcial — backup JSON emulado | IndexedDB e restauração Android físico |
| F24 | Claim administrativa implementada/testada | Smoke test ADM Android com recuperação |
| F25 | Implementado/testado | Validar estados externos reais |
| F26 | Implementado/testado | Galeria local e política de 42 horas aceitas |
| F27 | Parcial — offline/3G emulados | Perfil CPU/memória e consumo de leituras Firestore |
| F28 | Testado no navegador | Conta nova real, sem dados de terceiros |
| F29 | Regras e pipeline testados | Revisão humana e homologação em conta de teste real |
| F30 | Implementado/testado | Smoke test de troca de contas |
| F31 | Contratos MaisDelivery locais | Credenciais sandbox e teste ponta a ponta |
| F32 | Adiado por decisão de custo | Não ativar galeria em nuvem sem autorização |
| F33 | Concorrência emulada | Dois aparelhos reais e franquias compartilhadas |
| F34 | Testado localmente | Validar fornecedores/preços externos ao vivo |
| F35 | Parcial — scanner e testes adicionados | CDN/auth fallback integral e homologação de rede real |

## Trava de publicação e custos

1. **Não ativar** \`CLOUD_WORKER_ACTIVE\`, \`ENABLE_WRITES\` ou \`PRODUCTION_CUTOVER_APPROVED\` em produção por decisão unilateral.
2. Não colocar contas de serviço, tokens ou chaves privadas no GitHub, navegador ou histórico de conversa.
3. Criar **projeto Firestore de testes isolado** com identidade Google de menor privilégio; credenciais apenas como Cloudflare secrets; testar REST real, estoque, cancelamento, concorrência e idempotência.
4. Ensaiar simultaneamente cliente com Worker e Firestore Rules que negam escrita direta ao cliente; rollback de código, Rules e dados sintéticos preparado.
5. Homologar Android físico, licenças, franquías, backup V1 e recebimentos por meio de pagamento antes do rollout comercial.
6. Nenhum serviço pago ou migração destrutiva sem autorização específica. Firebase e Workers continuam sujeitos às franquias/cotas do plano existente.

**Estado oficial deste corte:** a branch tem melhorias implementadas e laboratório automatizado aprovado, mas **não está liberada para publicação comercial**; os riscos de credenciais, transações REST reais, regras de segurança e testes físicos permanecem explicitamente abertos.
