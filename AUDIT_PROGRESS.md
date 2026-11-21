# Auditoria e implementação — Potê Batata Pro, 16/11/2026

## Proteção e ponto de recuperação
- Código V1 preservado na tag GitHub `before-audit-20261116` (commit `181557c`).
- Bundle Git validado: `../pote-batata-before-audit-20261116.bundle`, na máquina autorizada.
- Firestore: projeto `potobatata-b71f3`, região `southamerica-east1`, camada gratuita na última consulta.
- O usuário confirmou explicitamente que contas e registros anteriores eram **apenas de teste e descartáveis**.
- A V2 cria um novo banco lógico `users/{uid}/appState/v2` e documentos `users/{uid}/records/{key}`.
- **V1 não foi apagado**: `users/{uid}/appState/main` permanece para recuperação técnica; a V2 inicia contas de teste vazias.
- As regras adicionais `/users/{uid}/records/{key}` foram compiladas e publicadas no Firebase. Regras de produção não foram testadas no Emulator Suite (Java indisponível).
- Nenhum Cloud Storage pago, Cloud Function ou outro recurso faturável foi habilitado.

## Arquitetura V2
- `v2_store_core.mjs`: normaliza registros por tipo de negócio e entidade e reconstrói estado em memória.
- `v2_storage.mjs`: grava somente entidades alteradas em transação, preserva alterações independentes e compara revisões.
- `appState/v2InventoryGuard`: protege transações sensíveis de pedidos, ingredientes, bebidas, compras, perdas e movimentações. Se dois dispositivos editarem em paralelo, um deve sincronizar novamente antes de prosseguir.
- `appState/v2Pulse`: avisa outros dispositivos. Limitação: atualmente a atualização remota relê a coleção para garantir consistência; otimizar leituras antes de muitos usuários.
- `firebase_integration.js`: usa V2 por padrão; fluxo V1 permanece isolado para recuperação técnica. Sincronização pendente oferece backup JSON por UID e bloqueia operações críticas.
- Os dados só são considerados persistidos quando a transação retorna sucesso. A interface ainda é otimista durante o tempo da requisição; conferir o status de sincronização.
- A sincronização real com múltiplos dispositivos e autenticação Google ainda exige teste de campo. Os testes automatizados usam Firebase simulado.

## Correções funcionais
- `finance_core.js`: custo unitário, cálculo de taxas, preço sugerido, lucro e contribuição centralizados.
- `stock_math.js`: custo médio ponderado conhecido e custo de reposição da última compra separados; não inventa custo médio sem histórico.
- `pricing_explainer.js`: seletor de critério de custo, contribuição antes de despesas fixas e lucro estimado depois do rateio.
- `garimpo.js`: preço de clube separado do preço aberto; validade verificada antes da condição, cache temporário de mercados, requisições limitadas, menor repetição de GPS e limpeza de localização ao trocar de conta.
- `source/pote_app_base.html`: fluxo único de cancelamento, bloqueio por falha de sincronização e datas comerciais locais.
- `module_health.js`: verifica os módulos essenciais após login e bloqueia operações se algum deles não carregar.
- Importação e redefinição de dados possuem validação, confirmações e exportação prévia.
- Conflitos agora oferecem botão de recuperação: exportação do JSON pendente, confirmação explícita de descarte local e recarga do estado remoto.
- Smoke test com Chrome headless da candidata: HTML de login e módulos carregados, saída do navegador sem erros detectados.

## Matriz honesta das 23 melhorias
| Nº | Situação |
|---|---|
| 01 | **Implementado na V2; validação com dois dispositivos reais pendente** |
| 02 | **Gravação atômica em transações V2**; interface ainda otimista até confirmação |
| 03 | **Concluído**: entidades em documentos próprios, sem apagar legado |
| 04 | **Proteção local e backup JSON implementados**; sem backup gerenciado do Firestore |
| 05 | **Motor de cálculo centralizado** nas rotas principais; auditoria de relatórios ainda necessária |
| 06 | **Cancelamento unificado e transação V2**; outras rotinas internas ainda compartilham lógica legada |
| 07 | **Concluído no armazenamento V2**: registros por universo sem duplicação em documento |
| 08 | **Parcial**: custos/precificação unificados; outras funções utilitárias ainda repetidas |
| 09 | **Parcial**: módulos V2 e financeiro extraídos; HTML principal ainda é monolítico |
| 10 | **Concluído**: verificador de dependências operacionais |
| 11 | **Parcial**: não salva em navegação sem alteração; renderização global permanece |
| 12 | **Concluído**: cache efêmero e pesquisas externas em pares |
| 13 | **Concluído**: preços de clube e ofertas vencidas separados corretamente |
| 14 | **Parcial**: fontes manuais identificadas; validação automática da página externa indisponível |
| 15 | **Regras V2 publicadas e compiladas**; testes em emulador pendentes |
| 16 | **Pendente**: ativos exclusivos permanecem acessíveis por URLs públicas; precisa Storage protegido |
| 17 | **Mantido desativado**: galeria Cloud Storage exige infraestrutura e aprovação de custos |
| 18 | **Média ponderada e reposição concluídas**; custeio FIFO por lote não implementado |
| 19 | **Concluído**: datas comerciais por fuso |
| 20 | **Concluído para backup JSON atual**: validação, confirmação e prevenção de conflito |
| 21 | **Parcial**: simulação isolada de dados, mas arquivos legados ainda no HTML-base |
| 22 | **Suspensa expansão secundária**; funcionalidades existentes mantidas para não quebrar o uso |
| 23 | **Parcial**: interface Radar de Preço; IDs internos preservados por compatibilidade |

## Limitações para comercialização ampla
1. Provar o funcionamento com autenticação Google em dois dispositivos físicos, incluindo conflito e reconexão.
2. Validar regras no Emulator Suite e impor limites FREE/PRO de forma não burlável no servidor antes de cobrar.
3. Implementar dados realmente privados em Storage autorizado; não ativar serviço pago sem orçamento e autorização.
4. Otimizar reconsulta V2 da coleção em clientes com muitos pedidos e confirmar despesas do Firestore.
5. Completar modularização do HTML, remoção de código legado e verificação de relatórios.
6. As imagens da galeria que existem somente no dispositivo não migram entre aparelhos.

## Testes e publicação
- Execução local em 16/11/2026: conjunto de testes `test_*.js`/`test_*.mjs`, sem falhas na última bateria (ver GitHub Actions para CI).
- `firebase deploy --only firestore:rules --project potobatata-b71f3`: regras publicadas com sucesso.
- Nenhum dado Firestore de contas foi apagado pela execução; a primeira entrada na V2 usa novo espaço lógico vazio.
- Retornar o site para a tag V1 não recupera automaticamente dados criados na V2.

## Atualização adicional — estoque inicial de franquia e compras
- `franchise_stock_core.mjs` introduz saldo inicial demonstrativo, uma única vez, para cinco porções de cada receita oficial e dez unidades de cada bebida.
- Insumos são somados entre receitas (compartilhados) e rendimentos de preparo considerados; preços e histórico de compras não são inventados.
- `franchise_shopping_list.mjs` e CSS exibem botão fixo **Lista de Compras** em todas as telas da franquia, com meta, saldo disponível, reservas e quantidade faltante.
- Não há reabastecimento automático após vendas nem reaplicação dos saldos iniciais em novas sessões; catálogo futuro altera a meta de compra, não o estoque físico.
- Testes: `test_franchise_stock.mjs` e `test_franchise_shopping_ui.mjs`.

## Preços de referência da franquia e custos simulados a 40% (16/11/2026)

Esta é uma tabela **DE TESTE**, com preços sugeridos para venda direta (sem entrega). Foi escolhida considerando referências públicas de batatas recheadas em Santa Catarina; não comprova preços praticados em Balneário Gaivota nem garante lucro real.

| Sabor | Venda de teste | Custo direto simulado (40%) |
|---|---:|---:|
| Frango Cremoso | R$ 29,90 | R$ 11,96 |
| Calabresa Acebolada | R$ 29,90 | R$ 11,96 |
| Bacon & 3 Queijos | R$ 34,90 | R$ 13,96 |
| Bolonhesa da Casa | R$ 32,90 | R$ 13,16 |
| Strogonoff de Frango | R$ 33,90 | R$ 13,56 |
| Strogonoff de Carne | R$ 37,90 | R$ 15,16 |
| Carne de Panela | R$ 37,90 | R$ 15,16 |
| Carne Seca & Requeijão | R$ 39,90 | R$ 15,96 |
| Costela BBQ | R$ 39,90 | R$ 15,96 |
| Quatro Queijos | R$ 35,90 | R$ 14,36 |
| Brócolis Cremoso | R$ 28,90 | R$ 11,56 |
| Palmito Gratinado | R$ 35,90 | R$ 14,36 |
| Milho & Bacon | R$ 29,90 | R$ 11,96 |
| Frango & Cheddar | R$ 31,90 | R$ 12,76 |
| Portuguesa | R$ 30,90 | R$ 12,36 |
| Camarão Cremoso | R$ 44,90 | R$ 17,96 |
| Frango BBQ | R$ 31,90 | R$ 12,76 |
| Linguiça Blumenau | R$ 34,90 | R$ 13,96 |
| Vegetariana da Horta | R$ 29,90 | R$ 11,96 |
| Frango ao Molho Rosé | R$ 32,90 | R$ 13,16 |
| Cachorro-Quente | R$ 27,90 | R$ 11,16 |
| Pizza | R$ 28,90 | R$ 11,56 |
| Ninho com Nutella | R$ 21,90 | R$ 8,76 |
| Brigadeiro | R$ 18,90 | R$ 7,56 |
| Chocolate Preto com Morango | R$ 20,90 | R$ 8,36 |
| Chocolate Branco com Morango | R$ 20,90 | R$ 8,36 |

Os 41 ingredientes que ainda não tinham custos recebem preços unitários aproximados, distribuídos usando as proporções da ficha de teste. As 11 bebidas mantêm seus preços-modelo (R$ 4,00 a R$ 10,00) e recebem custo simulado de 40%. Nada é registrado como compra real, nem altera o estoque físico.

**Regra de integridade financeira:** o custo de preparo por unidade é ancorado ao preço de referência; descontos, cupons e mudanças no preço cobrado **não reduzem o custo da batata ou das bebidas**. A simulação de preço no marketplace leva em conta a taxa maior da plataforma. Custos e preços reais lançados manualmente ou por compras posteriores prevalecem sobre valores fictícios.

Contas de franquia que já receberam a tabela estimada antiga de 60% são convertidas para 40% somente quando os valores ainda estiverem marcados como simulação e não tiverem sido alterados manualmente. Os registros históricos de vendas não são reescritos.

A margem de contribuição simulada no canal direto é próxima de 52% após os 40% de custo direto e 8% de taxas/impostos padrão do laboratório, **antes** de despesas fixas, mão de obra adicional, frete, perdas e impostos efetivos. Não confundir com lucro líquido. Cadastre custos reais antes de usar os preços em operação comercial.

## Caixa PDV operacional — 16/11/2026

A versão **Gestão + PDV** introduz módulo de caixa visível em contas PRO, ADMIN e franquias licenciadas. O botão fixo **Caixa PDV** permite:

- Abrir um turno com fundo de troco e operador, impedindo dois turnos abertos na mesma conta/universo.
- Vincular automaticamente novos pedidos do balcão e da vitrine ao turno aberto.
- Registrar sangrias e suprimentos com justificativa; bloquear saídas superiores ao dinheiro registrado.
- Separar dinheiro, Pix, cartão e demais métodos. Pix e cartão informados no pedido não são considerados recebidos até conferência manual do comprovante.
- Registrar pagamento na entrega após conferência; nenhum pagamento eletrônico é realizado pelo aplicativo.
- Registrar reembolso físico de pedido cancelado pago em dinheiro uma única vez.
- Conferir o dinheiro contado, diferença e histórico do fechamento de cada turno.
- Imprimir pelo navegador **comanda de cozinha** ou **recibo comercial não fiscal**, em layout de 80 mm. A impressora depende do diálogo de impressão e dos drivers instalados.

**Persistência**: os dados ficam em `cashSessions` e `cashMovements`, grupos separados da V2. A gravação dos movimentos usa o bloqueio de concorrência da mesma transação do estoque/pedido. O caixa é operacional e não é um livro-caixa contábil inviolável nem substitui a conciliação financeira bancária. Vendas feitas fora de um turno não são atribuídas retroativamente. Cancelamentos e devoluções entre turnos devem ser revisados; chargebacks, reembolso Pix/cartão e múltiplos terminais ainda não possuem integração automatizada.

**Fiscal Santa Catarina**: o PDV **NÃO emite NFC-e/NF-e** e a comanda/recibo gerada indica expressamente que não é documento fiscal. A SEF/SC exige o credenciamento de fornecedor de PAF-NFC-e conforme Ato DIAT 54/2026. A [Nota Fiscal Fácil para MEI](https://www.sef.sc.gov.br/orientacoes/nff-nota-fiscal-facil-mei-microempreendedor-individual) é alternativa oficial sem mensalidade para MEI com IE em SC e Gov.br nível prata/ouro, quando elegível. Eventual integração com PAF credenciado ou adquirente dependerá de documentação, acesso autorizado, homologação e possíveis custos; não foi ativada.

**Validação**: `test_pdv_cash_core.mjs`, `test_pdv_cash_ui.mjs` e `test_pdv_v2_storage.mjs` e teste manual automatizado no Chrome em ambiente isolado, além da suíte geral. Não foram testadas credenciais bancárias, emissão fiscal real, impressora física ou autenticação Google em dois caixas simultâneos.

## 21/11/2026 — Cardápio Digital Premium V1 publicado no site oficial (prévia)

**Status:** PUBLICADO COMO PRÉVIA DEMONSTRATIVA, sem vendas reais. Origem: PR #20 (branch `feat/cardapio-digital-premium-v1`), integrada à `main` no commit `eb3c6a06e2910022434a63139e24d8bf861dc41b`.

- **URL oficial confirmada:** https://pdv.livresom.com/cardapio/
- **URL GitHub Pages confirmada:** https://pixmcp-cloud.github.io/pote-batata-pro-v6-site/cardapio/
- **Infraestrutura:** Firebase Hosting do projeto `potobatata-b71f3`; o subdomínio `pdv.livresom.com` aponta para `potobatata-b71f3.web.app`.
- **Publicação:** 21/11/2026, 20:09:24 UTC, release `sites/potobatata-b71f3/releases/1795291764874000`, versão `sites/potobatata-b71f3/versions/50d0f67ce4e22d3a`.
- **Proteção do sistema:** a versão anterior `sites/potobatata-b71f3/versions/858193a266591150` tinha 218 arquivos. Comparação dos hashes SHA identificou ZERO diferenças nos 218 arquivos existentes; foram adicionados exclusivamente `/cardapio/index.html`, `/cardapio/cardapio.css`, `/cardapio/cardapio.js`, `/cardapio/cardapio-core.mjs`. Total publicado: 222 arquivos. O hash de `/index.html` permaneceu inalterado. A ordem das propriedades da configuração retornada pela API variava, mas sua equivalência semântica foi verificada.
- **Retorno seguro:** release anterior `sites/potobatata-b71f3/releases/1795239846256000`, versão `858193a266591150`, disponível como referência de rollback.
- **Validação:** workflow de publicação do GitHub Actions concluído com sucesso, incluindo regressões de Chrome/mobile e demais testes; prévia testada em larguras 320, 375, 430, 834 e 1366 px. A URL oficial do cardápio, seu arquivo JS e a página principal do PDV responderam corretamente às consultas externas após o deploy.
- **O que inclui:** layout preto e dourado, categorias, busca, imagens ilustrativas, ficha informativa do produto (formato e categoria; alergênicos a confirmar), adicionais, quantidades, observações, sacola local, opção retirada/entrega e cópia do resumo demonstrativo.
- **Limites:** catálogo, preços e imagens são demonstrativos. Ainda não há envio de pedido real, cobrança Pix/cartão, cálculo de entrega, reserva/baixa de estoque, integração com banco/PDV nem personalização por loja nesta rota. Não divulgar como checkout funcional.
- **Próximos passos:** catálogo público por estabelecimento com publicação controlada, backend com validação de preço e disponibilidade, pedidos transacionais/idempotentes, integração de estoque e caixa, pagamentos opcionais seguros, fotos próprias e homologação em aparelhos reais.
- **Regra de edição:** somente GitHub; Floot/APK apenas por solicitação expressa; nenhuma ativação de serviço pago sem autorização.

Registro solicitado pelo proprietário em 21/11/2026.

## 21/11/2026 — Cardápio Digital V2: publicação pública por estabelecimento

**Status: PUBLICADO no site oficial e TESTADO, com checkout real ainda DESATIVADO.**

- **Código:** PR #21 integrado à branch `main`, merge `d4e86b84798c0c3aefbf534c7c0b2c7300cf7b44`.
- **Funcionalidade:** botão para publicar na seção Cardápio Digital do PDV autenticado, selecionar quais receitas/bebidas serão públicas, obter preços calculados a partir da própria loja, gerar endereço por slug, atualizar e despublicar.
- **Consulta pública:** `https://pdv.livresom.com/cardapio/?loja=<slug>`; loja inexistente, indisponível ou não publicada não recebe catálogo de demonstração ou de outra empresa.
- **Isolamento:** Firestore coleção `publicMenus/{slug}` com somente campos comerciais autorizados; criação/atualização por titular Google verificado e leitura anônima somente de catálogo publicado; proibição de listagem irrestrita; regras publicadas com `firebase deploy --only firestore:rules --project potobatata-b71f3` após aprovação no emulador e comparação prévia da versão publicada com GitHub.
- **Implantação Hosting:** release `sites/potobatata-b71f3/releases/1795293169453000`, versão `sites/potobatata-b71f3/versions/515b40b180039507`, em 21/11/2026 às 20:32:49 UTC. Versão anterior para rollback: `sites/potobatata-b71f3/versions/50d0f67ce4e22d3a`, release `sites/potobatata-b71f3/releases/1795291764874000`.
- **Integridade:** dos 222 arquivos originais, 220 hashes preservados, só `/firebase_integration.js` e `/cardapio/cardapio.js` alterados, e 3 novos (`/public_menu_core.mjs`, `/public_menu_admin.mjs`, `/public_menu_admin.css`). 225 arquivos no total; configuração de cabeçalhos da hospedagem idêntica à anterior.
- **QA:** testes de unidade `test_public_menu_core.mjs` aprovados, incluindo proteção contra custos/clientes/URLs de foto privada. Firestore Emulator, inclusive testes pré-existentes de concorrência e F05, aprovado na execução do GitHub Actions `44946345005` (branch de preparação); QA de perfis aprovado. Teste real Chrome mobile em `pdv.livresom.com`: página inicial 200, cardápio 200 com 10 itens de demonstração, modal/ficha abre, slug inexistente exibe indisponibilidade e 0 itens, script `POTE_PUBLIC_MENU` carregado e 0 erros de execução JavaScript.
- **Ainda não realizado:** pedido público real, validação transacional de preço e saldo, reserva de estoque, aceite/cancelamento no PDV, baixa do caixa, integração Pix/cartão e configurações avançadas de marca/fotos. Não chamar esta etapa de checkout online concluído. O Worker atual permanece em STAGING e escritas críticas desativadas.
- **Próximas prioridades:** backend autenticado da loja/checkout público com precificação no servidor, idempotência e proteção contra spam; entrada no mesmo pipeline V5 de reserva de estoque/pedidos; conciliação de pagamento e PDV; habilitar só após testes multitenant, duas contas simultâneas e homologação de canário. Avaliar bloqueio automático de publicação quando licença PRO expirar.
- **Custos e limites:** nenhum serviço pago novo habilitado; usar cotas gratuitas e acompanhar leitura do Firestore conforme expansão.
- **Desenvolvimento:** apenas GitHub; Floot e APK não foram modificados.
