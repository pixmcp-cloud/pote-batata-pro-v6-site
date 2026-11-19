# Log infláveis — Planejamento mestre

**Versão:** 1.0  
**Criado:** 19 de novembro de 2026  
**Situação atual (atualizada em 19/11/2026):** protótipo local v0.2 implementado e testado, com histórico detalhado nas seções 13–16. Hospedagem e domínio adquiridos pelo usuário; site ainda NÃO publicado e backend real NÃO implementado. O enunciado original da pesquisa permanece documentado nas seções iniciais.  
**Objetivo:** desenvolver uma plataforma de aluguel de brinquedos infláveis e recreativos com recorrência SaaS, operação rentável e opção de marketplace.

## 1. Origem da ideia
O usuário solicitou pesquisa sobre sistemas e sites que locadores de infláveis contratam, quais funções têm, como cobram e o que falta para construir produto superior. Citou informalmente o valor de cerca de R$ 80 por mês. Esse preço NÃO é uma média estatística confirmada: a pesquisa preliminar identificou diversos níveis, inclusive menos de R$ 30.

## 2. Competidores da pesquisa inicial
Preços anunciados em pesquisa de 19/11/2026, sujeitos a alterações, planos, limites e condições. Conferir novamente antes de usar comercialmente.

| Plataforma | Preço mensal mencionado | Referência | Observação |
|---|---:|---|---|
| InflaPro | R$ 20 | https://inflapro.com.br/ | Mini-site e agendamento |
| BrinqueFlow | R$ 19,90 a R$ 67,90 | https://brinqueflow.com.br/ | Vitrine, entregas e pedidos |
| FesFlow | R$ 44,90 | https://fesflow.com.br/ | Agenda |
| Cortex Agenda | R$ 54,90 | https://cortexagenda.com.br/ | Contratos e financeiro |
| LocAgenda | R$ 59,90 | https://locagenda.com.br/ | WhatsApp, rotas |
| Central de Locações | R$ 99,90 a R$ 199,90 | https://centraldelocacoes.com.br/brinquedos | Gestão |
| MSLocações | Desde R$ 108 | https://mslocacoes.com/sistema-locacao-de-brinquedos/ | Gestão empresarial |
| Entretem | R$ 99; desconto Pix relatado | https://entretemoficial.com.br/app-prestadores-servico/ | Marketplace |
| Locadores de Brinquedos do Brasil | A verificar | https://locadoresdebrinquedos.com.br/ | Diretório e contatos |
| BrinkUp | R$ 150 / R$ 275 / R$ 750 em pesquisa preliminar | Pesquisar condições atuais | IA comercial e gestão |

Soluções internacionais como TWICE e Renttix também merecem comparação. Diferenciais isolados como IA, contratos, rotas, manutenção e frete já existem em concorrentes: não declarar ineditismo.

## 3. Modelos de negócios
**SaaS:** cada locador recebe catálogo/mini-site próprio, agenda, orçamentos, contratos, financeiro e ferramentas de gestão; paga assinatura fixa.

**Marketplace:** empresas podem aderir a uma vitrine regional/nacional onde clientes encontram brinquedos por categoria, cidade, data e preço; monetização por assinatura, destaque e eventualmente comissões transparentes.

**Tese proposta:** combinar SaaS multiempresa + marketplace opcional, começando por SaaS que resolve dores reais e construindo marketplace somente quando houver oferta suficiente.

## 4. Funções básicas exigidas
- Cadastro de locadoras e papéis de equipe; dados separados entre empresas.
- Inventário de brinquedos, fotos, categorias, medidas, capacidade/idade conforme fabricante e acessórios.
- Agenda real com bloqueio por intervalos de evento, transporte, montagem/desmontagem e higienização.
- Orçamentos, propostas, contrato, sinal, saldo, status, histórico de clientes.
- Loja própria mobile-first, links WhatsApp e páginas para localidades atendidas.
- Painel financeiro: entradas por Pix/cartão/dinheiro, custos, despesas, margem de contribuição e lucro líquido distinguidos.
- Prevenção de dupla reserva e confirmação por pagamento verificado quando configurada.

## 5. Diferenciais candidatos (a validar; não aprovados ainda)
1. **Venda assistida:** automação de cotação, disponibilidade e combos; IA limitada a dados verificados, sem confirmar reservas por conta própria sem critérios.
2. **Lucro por brinquedo e por evento:** custo de aquisição, aluguel acumulado, payback, depreciação estimada, custos de combustível/equipe/manutenção.
3. **Ficha e QR Code por brinquedo:** foto de saída e retorno, limpeza, avarias, inspeções, histórico e bloqueio de itens sem liberação de segurança.
4. **Logística financeira:** distância, combustível, pedágio, tempo, rotas, equipe e preço mínimo para compensar a entrega.
5. **Previsão meteorológica e gestão de risco:** alertas úteis, políticas de remarcação e checklists, respeitando o fabricante e a inspeção física; nunca apresentar previsão como autorização de operação.
6. **Rede de parceiros:** disponibilidade compartilhada voluntariamente, repasse e sublocação transparente, com autorização e termos.
7. **Marketing que converte:** recuperação consentida de orçamentos, SEO regional, avaliações verificadas, campanhas e indicação.
8. **Assistente para expansão:** ocupação, margem, taxa de conversão, compras de equipamentos e sugestões de promoções com piso de rentabilidade.

## 6. Jornada sugerida
Pesquisa de brinquedos por cidade/data → comparação → endereço e duração → disponibilidade real incluindo logística → orçamento e adicionais → aceite de termos → pagamento de sinal (integração verificada) → confirmação de reserva → tarefas de equipe e checklist → entrega/montagem e retirada → fechamento financeiro e avaliação.

## 7. Planos de preço propostos, NÃO aprovados
- Grátis R$ 0: perfil e poucos brinquedos, contato via WhatsApp.
- Essencial R$ 29,90/mês: agenda, reservas, orçamentos e controle básico.
- Pro R$ 79,90/mês: site, financeiro avançado, contratos, logística, manutenção e indicadores.
- Empresarial R$ 149,90/mês: equipes, unidades, mais automações e IA com limite de uso.

Exemplo **hipotético**: 100 assinantes a R$ 79,90 = R$ 7.990/mês de faturamento bruto. A R$ 15 de custo variável por conta, restariam R$ 6.490 **antes** de custos fixos, impostos, aquisição, atendimento e desenvolvimento. Não chamar esse valor de lucro líquido.

## 8. Plano de execução econômico
**Etapa 0 — Validação:** entrevistar 5–10 locadores, confirmar valor pago e a dor que justificaria migração, testar concorrentes por demonstração.

**Etapa 1 — MVP:** autenticação e isolamento de contas, catálogo, agenda, bloqueios, orçamento, contrato, sinal/saldo, financeiro essencial e página pública.

**Etapa 2 — Diferenciação:** ficha de ativos, checklist/avarias, logística com lucro por evento, manutenção, indicadores e alertas.

**Etapa 3 — Crescimento:** marketplace, rede de parceiros, avaliações, campanhas e IA sujeita a limites de custo.

**Critérios técnicos:** controle de acesso real no backend, teste de dupla reserva, backups restauráveis, auditoria, privacidade e LGPD, webhook idempotente, monitoramento, testes mobile. Serviços pagos apenas com autorização.

## 9. Principais riscos
- Preços baixos dos concorrentes e aquisição de clientes cara.
- Custos de IA, mapas, WhatsApp e pagamentos reduzindo margem.
- Reserva simultânea equivocada; frete subestimado; manutenção negligenciada.
- Segurança física dos infláveis e necessidade de instruções do fabricante, regras locais e acompanhamento adequado.
- Proteção de dados pessoais, inclusive informações e imagens de crianças em eventos.
- Regras jurídicas de cancelamento, reembolso, contrato, sinal e responsabilidade.

## 10. Estado e decisões
- **Confirmado:** pesquisa de mercado e interesse em construir produto superior.
- **Confirmado:** o documento deve se chamar **Log infláveis**.
- **Pendente:** nome comercial, marca, preços finais, seleção de stack, domínio, equipe e início de implementação.
- **Proposta, não aprovada:** plataforma SaaS + marketplace e as 3 fases de construção.
- **Não executar sem aprovação:** contratação de serviços pagos, migração de dados, publicação em produção, alterações no projeto Potê Batata.

## 11. Pendência de integração GitHub (19/11/2026)
A conexão GitHub autenticou como `pixmcp-cloud` e leu `README.md` do repositório `pixmcp-cloud/pote-batata-pro-v6-site`, mas a tentativa de criar o arquivo `docs/LOG_INFLAVEIS.md` falhou com HTTP **403 Resource not accessible by integration**. As funções de listagem de instalações retornaram zero resultados. É necessário instalar/ajustar autorização do GitHub App com acesso ao repositório e permissão de escrita em **Contents** antes da publicação via conector. A propriedade pessoal do repositório permitir `push` não comprova autorização da integração.

**Destino pretendido:** um repositório próprio do projeto. Enquanto isso, este arquivo pode ser usado como log mestre em Markdown e migrado ao GitHub após corrigir a autorização.

## 12. Como retomar em outro chat
Diga: **"Abra o Log infláveis e continue o planejamento do sistema de aluguel de brinquedos infláveis. Confira pendências, opções de mercado, hipóteses versus decisões e atualize o log ao concluir qualquer etapa."**

## 13. Atualização de execução — 19/11/2026 — Primeira versão no PC
**Novo estado:** o conector GitHub foi corrigido após a instalação da GitHub App; listagem, leitura e escrita agora funcionam. A pendência histórica registrada na seção 11 foi superada.

**Autorização recebida:** o usuário pediu explicitamente iniciar a criação local usando Desktop Commander e ferramentas existentes no PC.

**Dispositivo:** DESKTOP-9481JM1 (Windows), conectado via Remote Desktop Commander.

**Projeto local separado:** `C:\Users\LIVRESOM\Projects\inflaveis-pro` — NÃO é o projeto Potê Batata e não tem banco, deploy ou git remoto compartilhado com ele.

**Stack instalada e testada:** Node.js 24, npm, React 19, TypeScript, Vite 8, Lucide React, Playwright para testes com Chrome instalado. Git inicializado localmente no novo diretório.

**Entregas da v0.1:**
- Vitrine responsiva pública com identidade visual provisória "Infláveis Pro", quatro fotos ilustrativas locais (Pexels), busca por cidade/data/categoria, filtros e favoritos no navegador.
- Simulador de orçamento com 4/6/8 horas, frete fictício, monitor adicional, total/sinal e cópia de proposta de teste.
- Dashboard local para locador: indicadores demonstrativos, agenda/orçamentos, criação de reserva de teste, verificação conservadora de duplicidade por unidade/dia, mudança de status, catálogo, painel financeiro informativo, seção de clientes e configurações.
- Persistência apenas em localStorage do navegador. Dados e preços fictícios, nenhum pagamento, autenticação ou reserva real.
- Documentação local `README.md` e `docs/PRD.md`; teste automatizado `tests/smoke.mjs` e capturas desktop/mobile em `.previews/` (ignorado pelo Git).
- Build de produção e lint passaram, com 0 warnings/erros. Testes E2E passaram para catálogo, filtro, orçamento, painel, agenda, persistência e ausência de rolagem horizontal mobile.
- Servidor de desenvolvimento local iniciado em `http://127.0.0.1:5174/` (porta dinâmica: verificar se continua em execução).
- Ponto de restauração inicial: commit **c4e5e7b** na branch `main` do repositório Git LOCAL. **Ainda não foi enviado ao GitHub.** Commit adicional **44f40a2** para favicon/identidade provisória e remoção de assets padrão. Build local validado e site aberto no navegador do PC com HTTP 200.

**Pendências críticas antes de qualquer operação real:** repositório GitHub próprio, autenticação, tenants, banco PostgreSQL, transações de disponibilidade, contratos, integração de pagamento, equipe e equipamentos compartilhados, definição de preços/frete reais, LGPD e checklists de segurança. Sem autorização de contratação de serviços pagos e sem publicação pública.

**Próxima etapa recomendada:** criar repositório GitHub separado para `inflaveis-pro`, conectar ao projeto local, planejar backend multi-tenant com reservas transacionais, implementar autenticação e catálogo cadastrado por locador; validar em emuladores e Android real. Priorizar retorno financeiro e baixo custo.


## 14. Infraestrutura adquirida para Brasil Infláveis — 19/11/2026

**Confirmações comerciais verificadas em comprovantes da Hostinger enviados ao proprietário (não arquivar faturas, e-mail pessoal, identificadores ou dados de pagamento neste repositório público):**
- Domínio comprado: **brasilinflaveis.com** — período contratado de 19/11/2026 a 19/11/2027.
- Plano comprado: **Hostinger Unlimited Web Hosting**, período de 19/11/2026 a 19/11/2027.
- Backup diário incluído no pedido.
- A renovação é automática salvo desativação na conta; conferir custo de renovação, que não consta na confirmação consultada.
- Domínio e plano já foram adquiridos. Não pressupor que o site esteja publicado ou com SSL funcional.

**Verificação pública via PC (19/11/2026):**
- DNS NS de brasilinflaveis.com: nova.dns-parking.com / cosmos.dns-parking.com.
- Registro A observado: 2.57.91.91. Isso não comprova que uma aplicação esteja implantada no domínio.
- Requisição HTTPS ao endereço raiz expirou no teste; checar propagação, associação do domínio à hospedagem e SSL antes de divulgar.
- O acesso direto autenticado ao hPanel não foi verificado por este procedimento; existência de recursos específicos deve ser confirmada na tela Detalhes do plano.

**Limites publicados pela Hostinger para Unlimited Web Hosting (documentação atual, sujeitos a versão e configuração):**
- Até 5 websites Node.js (contagem de sites web em geral anunciada como ilimitada, observados recursos).
- 2 núcleos CPU, 3 GB RAM, 50 GB disco, 150 bancos MySQL, 3 GB por banco.
- Node.js web hospedado não aceita conexões WebSocket de entrada nem workers persistentes; observar limites de execução.
- Fonte oficial: https://www.hostinger.com/support/6976044-parameters-and-limits-of-hosting-plans-in-hostinger/
- Fonte Node.js: https://www.hostinger.com/support/hostinger-node-js-limits-for-web-and-cloud-plans/

**Decisão de arquitetura recomendada, ainda não aprovada como implementação:** começar com build Vite/React hospedado no plano já pago e avaliar backend Node.js/MySQL simples e seguro no próprio plano, desde que os limites e isolamento multiempresa sejam adequados. Evitar pagar Cloud/VPS prematuramente. Plataforma ainda em protótipo; não publicar reservas/pagamentos reais sem homologação. Aproveitar o domínio como marca/portal "Brasil Infláveis" e nome do SaaS a validar.

## 15. Identidade visual Brasil Infláveis v2 — 19/11/2026
**Pedido do usuário:** área de cliente final muito colorida, divertida, inspirada na energia do universo infantil de espetáculos (sem copiar personagens de terceiros); área do locador sóbria/executiva com cores do Brasil.

**Execução confirmada pelo Desktop Commander no PC:**
- Pasta: `C:\Users\LIVRESOM\Projects\inflaveis-pro`.
- Backup intacto: `backup/pre-sites-merge-20261119` no commit `44f40a2`.
- Branch de design: `design/universo-colorido-20261119`.
- Commit desta etapa: **`b9e850a`**.
- Cliente final: paleta azul-céu, rosa, amarelo, laranja e verde; título expressivo, balões e decorações CSS, botões festivos, cartões coloridos; marca provisória Brasil Infláveis.
- Locador: azul-marinho, verde e amarelo ouro em doses discretas, menu executivo e gráficos de gestão; marca provisória Brasil Infláveis Pro.
- CSS isolado em `src/visual-v2.css`; especificação em `docs/DESIGN-V2.md`.
- Testes: `npm run build`, `npm run lint` (0 erros/avisos), `node tests/smoke.mjs` (identidade, vitrine, filtro, cotação, painel, reservas simuladas, persistência e mobile passaram); screenshots locais em `.previews/`.
- Nenhuma API paga, domínio público ou publicação real ativada. Backend, disponibilidade real e contratos seguem pendentes.

**IMPORTANTE — integração com Site do GPT Work ainda não concluída:** o usuário relata que `https://parque-inflavel-br.nerdflix.chatgpt.site` deriva do protótipo e recebeu melhorias no Work. Leituras externas resultaram em HTTP 401; o código-fonte vinculado ao Sites não está acessível por este link, o repositório Git local não tem remote e a API GitHub conectada não lista esse projeto. Precisamos do repositório ou exportação de código do Work para comparação/merge seguro (com várias locadoras, consulta de data, medidas, monitores opcionais, minuta, painel). Não confundir o redesign local com a integração solicitada.


## 16. Desenvolvimento local — Marketplace multi-locadora demonstrativo v0.2 — 19/11/2026

**Pedido-base:** ler o Log infláveis e retomar o trabalho. O usuário já determinou preservar a versão local e o histórico Git, não sobrescrever melhorias do GPT Work e não publicar antes da validação.

**Verificação antes da edição:** o computador DESKTOP-9481JM1 estava online via Desktop Commander; pasta C:\Users\LIVRESOM\Projects\inflaveis-pro continha a branch design/universo-colorido-20261119 no commit b9e850a, árvore Git limpa, sem remote. O repositório-fonte do site GPT Work/Sites segue INACESSÍVEL nesta sessão. Nenhum conteúdo da prévia protegida por HTTP 401 foi transferido ou mesclado.

**Nova branch local criada:** feature/marketplace-multilocadoras-20261119, baseada em b9e850a. A branch de segurança backup/pre-sites-merge-20261119 e a branch main permanecem preservadas.

**Commit final desta etapa:** **1c781c6** — feat: marketplace demo com locadoras, filtros, monitores e minuta. Git local limpo após o commit.

**Implementações verificadas (somente front-end demonstrativo):**
- Catálogo com QUATRO brinquedos vinculados explicitamente a TRÊS LOCADORAS FICTÍCIAS independentes, cada uma identificada por nome e cidade. As fotos existentes foram preservadas.
- Busca funcional NO CONJUNTO DE EXEMPLO por categoria, cidade atendida, data e dimensões máximas disponíveis (largura, profundidade e altura). Equipamento com reserva confirmada na data da amostra é ocultado. A disponibilidade é conservadora por dia e NÃO é tempo real nem garante espaço/supervisão.
- Simulador de orçamento: duração (4/6/8 h), entrega fictícia, até 3 monitores opcionais R$ 90/unidade na simulação, total e sinal indicativo de 30%.
- Geração de minuta preliminar de locação em HTML, baixável e imprimível como PDF pelo navegador, com identificação fictícia da locadora, solicitante opcional, data, cidade, equipamento, frete e valores indicativos. O texto do solicitante é escapado contra injeção HTML. Documento não assinado/não vinculante.
- Painel com seleção de locadora demonstrativa que FILTRA SOMENTE NA INTERFACE os equipamentos, reservas, métricas, clientes e opções do novo orçamento. Isto **NÃO constitui login, isolamento multi-tenant, RLS ou proteção entre contas**.
- Aprimoramento de fontes alternativas para o site continuar legível mesmo sem carregar Google Fonts.
- Arquivos novos: src/marketplace.ts, src/marketplace.css, src/minuta.ts, tests/marketplace.mjs; src/App.tsx, package.json e README.md atualizados.

**Validação local:** npm run build OK; npm run lint OK, 0 warnings/erros; npm run test:smoke OK; npm run test:marketplace OK. O teste adicional confirma 3 empresas independentes, exclusão por data com reserva confirmada, dimensões e cobertura local fictícias, cálculo de 2 monitores/frete/horas, download de minuta e proteção HTML, visualização por empresa no painel e ausência de rolagem horizontal no celular.

**Pendências antes de produção:** acesso ao código-fonte do Sites no GPT Work para comparação/merge; GitHub remoto exclusivo deste produto; backend autenticado com isolamento por locadora; inventário físico e disponibilidade por INTERVALO com transações contra corridas; rateio de recursos compartilhados; transporte/frete e agenda reais; contratos jurídicos revisados; Pix/cartão com webhooks verificados; LGPD, manutenção, segurança de fabricante, hospedagem/SSL e testes operacionais. Não contratar APIs adicionais nem publicar em brasilinflaveis.com sem aprovação.

**Como retomar:** abrir este log, verificar PC e branch feature/marketplace-multilocadoras-20261119, commit 1c781c6, e obter o repo/exportação Sites antes de mesclar a versão mais avançada do GPT Work.

## 17. Comparativo preliminar Work versus PC e aprimoramentos locais — 19/11/2026

**Informação fornecida pelo usuário da conversa original do GPT Work (relatada, não confirmada por inspeção de código):**
- Versão do Sites contém capa SUPER FESTA!, multi-locadoras, busca, orçamento, minuta, agenda conectada ao Cloudflare D1, decoradores e Pula-pula.
- Login Google/e-mail ainda aguarda configuração; agenda D1 publicada precisa de teste com conta autenticada.
- Código Work pertence ao repositório de origem vinculado ao Sites, não à prévia pública.

**Busca pelo código do Sites nesta sessão:**
- GitHub conectado exibe só pixmcp-cloud/livresomcom e pixmcp-cloud/pote-batata-pro-v6-site. Nenhum repositório Sites encontrado.
- Downloads, Desktop, Documents e Projects no PC pesquisados; nenhum código exportado do Work encontrado.
- Git local inflaveis-pro não tem remote; URL da prévia retornou 401.
- Portanto NÃO houve git diff entre Work e PC, transferência de código, merge de repositórios ou teste contra banco D1.

**Melhorias independentes executadas via Desktop Commander:**
- Pasta C:\Users\LIVRESOM\Projects\inflaveis-pro.
- Backup extra backup/pre-ui-areas-20261119 criado em 1c781c6.
- Branch feature/pulapula-decoradores-20261119, commit a56dca5.
- Pula-pula adicionado imediatamente após Aquáticos, com um brinquedo fictício ilustrativo.
- Área independente Decoradores com dois perfis inteiramente fictícios, serviços expansíveis e filtragem por cidade.
- Categoria em linha única com rolagem interna para impedir quebra feia no mobile.
- Documento docs/COMPARATIVO-WORK.md registra tabela de recursos relatados versus verificações reais e protocolo de transferência.
- Build, lint, smoke e marketplace E2E aprovados. Teste de ausência de rolagem horizontal em 320, 390, 768 e 1024 px. Git limpo.
- Nenhum serviço pago foi ativado; nenhuma versão publicada; dados, medidas, preços e fotos seguem fictícios.

**Próximo acesso necessário:** pela conversa GPT Work/Sites, salvar fonte COMPLETA com histórico Git na pasta isolada C:\Users\LIVRESOM\Projects\brasil-inflaveis-sites-import, ou disponibilizar repositório privado próprio da plataforma no GitHub conectado. NÃO sobrescrever inflaveis-pro. Não compartilhar segredos, .env, tokens, cookies ou dados de clientes; usar .env.example sanitizado. Depois comparar código, migrações D1, interface, login, isolamento por locadora e testes antes de integração/produção.

## 18. Protocolo de sincronização entre GPT Work/Sites e PC — 19/11/2026

**Decisão do usuário:** manter a conversa do GPT Work e esta sessão do Desktop Commander alinhadas no mesmo Log infláveis, com desenvolvimento contínuo, preservando o projeto mais avançado do Sites e melhorias locais.

**Log central no GitHub:** https://github.com/pixmcp-cloud/pote-batata-pro-v6-site/blob/main/docs/LOG_INFLAVEIS.md

**Limitação de acesso:** o código-fonte do Sites do GPT Work está em um repositório separado que esta sessão ainda não consegue consultar. O Work relatou manter um log próprio no Sites. Este protocolo NÃO representa comunicação automática com outra sessão nem comprova sincronização com o repositório do Work.

### Protocolo para as duas sessões
1. Sempre ler a versão completa e mais recente deste log antes de agir. Identificar entradas [WORK/SITES], [PC/COMMANDER], [AUTOMAÇÃO] e [GITHUB/LOG]. Não inventar confirmações.
2. Registrar data, fonte, repositório/caminho, branch, commit, o que foi alterado, testes executados, falhas, riscos e próximos passos após cada etapa real.
3. Para atualizar este arquivo, reler o conteúdo e SHA mais recentes, aplicar alteração sem destruir histórico e enviar usando o SHA atual; se houver conflito, reler e conciliar. Não sobrescrever entradas de outra sessão.
4. Não declarar merge entre Work e PC sem acesso aos dois códigos-fonte e git diff verificável. Preservar Git e os recursos exclusivos de cada versão.
5. Não transferir tokens, senhas, cookies, chaves ou .env com segredos. Não executar migrações D1, alterar banco de produção, abrir painel administrativo nem publicar em brasilinflaveis.com sem homologação.
6. Preferir recursos gratuitos e a Hostinger já contratada; não ativar APIs pagas. Priorizar conversão, reservas sem conflito, custos de entrega, margens e lucro real por brinquedo.
7. O responsável por uma ação marca sua origem, comunica bloqueios e evita executar em paralelo mudanças na mesma branch/arquivo que outra sessão possa editar.

### Ponto de sincronização verificado nesta sessão
- [PC/COMMANDER] Projeto: C:\Users\LIVRESOM\Projects\inflaveis-pro.
- [PC/COMMANDER] Branch ativa: feature/pulapula-decoradores-20261119; commit a56dca5; árvore limpa, verificada em 19/11/2026.
- [PC/COMMANDER] Backups: backup/pre-sites-merge-20261119 e backup/pre-ui-areas-20261119.
- [PC/COMMANDER] Builds e testes do marketplace e mobile passaram; 5 ofertas e 3 locadoras fictícias, decoradores, categorias, filtros simulados, monitores, minuta HTML e painel demonstrativo.
- [WORK/SITES, RELATADO PELO USUÁRIO] Capa SUPER FESTA!, busca, orçamentos, minuta, agenda conectada ao Cloudflare D1, decoradores e Pula-pula. Login Google/e-mail ainda aguarda configuração e agenda autenticada carece de testes.
- [ACESSO PENDENTE] O repositório Sites não aparece no GitHub conectado; a exportação na pasta C:\Users\LIVRESOM\Projects\brasil-inflaveis-sites-import não existe.

### Handoff solicitado à conversa GPT Work/Sites
Quando possível, ler este log pelo link canônico. Registrar uma seção [WORK/SITES] com seu commit e status real; exportar o repositório Sites com histórico para C:\Users\LIVRESOM\Projects\brasil-inflaveis-sites-import pelo Desktop Commander, ou para GitHub privado separado acessível. Não sobrescrever o diretório inflaveis-pro. Enviar .env.example sem segredos em vez de .env. Se não tiver escrita no GitHub, gerar LOG_WORK_HANDOFF.md junto à exportação; a sessão PC concilia no log central.

### Ação da sessão PC enquanto o código Sites não chega
Realizar QA de responsividade, acessibilidade, contratos demonstrativos e testes; melhorar apenas itens independentes em branch protegida. Não redesenhar nem substituir componentes/agenda D1 da versão Sites com base apenas em relatos. Registrar cada commit e teste no mesmo log.

## 19. Continuidade automatizada e auditor de importação — 19/11/2026

**Solicitação do proprietário:** alinhar a sessão GPT Work/Sites e o trabalho via Desktop Commander no mesmo Log infláveis, continuando de forma autônoma, com prioridade para economia, confiabilidade e não perder funcionalidades de qualquer versão.

**[GITHUB/LOG] Protocolo de coordenação:** seção 18 define este arquivo como referência central e exige entradas com origem, commit, testes e bloqueios. Isso não significa comunicação direta entre sessões. A versão do Work precisa consultar este arquivo ou exportar handoff e código para a pasta de importação.

**[AUTOMAÇÃO] Tarefa criada e habilitada:** Desenvolvimento Brasil Infláveis; recorrência flexível a cada 3 horas, fuso America/Sao_Paulo. Regras: ler log antes, verificar conexão/branches/backup, detectar exportação Sites, avançar somente mudanças locais seguras e independentes se o código Work continuar inacessível, executar testes, registrar resultados; não publicar, migrar D1, pagar serviços ou alterar o Potê Batata sem autorização.

**[PC/COMMANDER] Auditoria segura preparada:**
- Pasta do PC: C:\Users\LIVRESOM\Projects\inflaveis-pro.
- Nova branch: tooling/work-sync-audit-20261119.
- Commit: **571ea54**; árvore Git limpa após commit.
- Branch de segurança: backup/pre-work-sync-20261119, preservando a HEAD a56dca5 anterior.
- Script: scripts/auditar-work.ps1. Compara inventários de arquivos de código com SHA256; não copia, executa nem mescla arquivos, não usa credenciais, não abre banco D1.
- Relatório local: .work-audit/RELATORIO.md, excluído do Git.
- Manual: docs/SINCRONIZACAO-WORK.md, com o link canônico do log e instruções seguras para a versão Work.
- Testes do script: executado com fixture sintética de uma exportação e detectou IMPORT_STATUS=FOUND, diferenças e arquivos exclusivos; após remover a fixture, detectou IMPORT_STATUS=ABSENT. Nenhuma cópia foi confundida com a versão Sites real.
- Execução do PowerShell usa -NoProfile -ExecutionPolicy Bypass apenas no processo, porque a política do Windows bloqueava scripts locais; não foi alterada a política permanente.
- Estado real verificado: C:\Users\LIVRESOM\Projects\brasil-inflaveis-sites-import **não existe**. Sem merge real ou comparação do código do Work.

**Pendência bloqueante:** exportar repositório de origem do Sites com histórico para a pasta separada, ou disponibilizar repo privado acessível. Depois rodar script, fazer diff real, preservar agenda D1/migrações e testar login antes de homologar. Não tomar a prévia protegida como fonte de código.

## 20. [PC/COMMANDER] Simulador de rentabilidade e ajuste mobile — 19/11/2026

**Origem:** desenvolvimento local realizado nesta sessão, após leitura integral do Log infláveis e confirmação de que o Work/Sites ainda não foi exportado para o PC.

**Repositório local:** C:\Users\LIVRESOM\Projects\inflaveis-pro.
**Branch:** feature/rentabilidade-locadoras-20261119.
**Commit verificado:** 87d550a (feat: simulador de rentabilidade por locadora e correção do menu mobile).
**Branch backup anterior:** backup/pre-rentabilidade-20261119, em 571ea54; árvore Git limpa após o commit.

**Funcionalidade adicionada sem backend:**
- Nova aba Rentabilidade no painel executivo. Cada brinquedo da locadora demonstrativa selecionada tem um cenário editável de preços e custos, gravado SOMENTE no localStorage do navegador em chave composta por locadora/equipamento.
- Entradas: aluguel, frete cobrado, adicionais cobrados, combustível/entrega, equipe, higienização, provisão de desgaste, taxa de pagamento %, tributos estimados %, custos fixos mensais, volume esperado de locações/mês, meta de resultado.
- Saídas: receita simulada, custos diretos, taxa de recebimento e tributos estimados, custos variáveis, margem de contribuição, rateio dos custos fixos, resultado líquido ESTIMADO, margem %, ponto de equilíbrio hipotético, preço-base mínimo para meta de resultado.
- Zero locações mensais ou soma de percentuais de 100% tornam valores dependentes do rateio/preço mínimo indefinidos; contribuição não positiva não produz ponto de equilíbrio atingível.
- Nenhum valor é classificado como dinheiro recebido ou lucro realizado. Os defaults são fictícios, não tributação oficial; o mesmo navegador pode expor dados a outro usuário do dispositivo. Não inserir dados reais sensíveis.
- Corrigido cartão do painel que contava reservas confirmadas de todas as locadoras em vez da locadora selecionada.
- Corrigida a navegação mobile: sidebar oculta quando fechada, com botão de menu e fechamento tocando fora. O teste visual identificou o overlay durante transição de breakpoint; problema corrigido e revalidado.
- Motor puro em src/rentabilidade.ts, interface src/RentabilidadePanel.tsx, CSS src/rentabilidade.css, especificação docs/RENTABILIDADE.md, testes tests/rentabilidade.mjs.

**Testes executados e aprovados:** npm run build; npm run lint (0 erros e 0 avisos); npm run test:smoke; npm run test:marketplace; npm run test:rentabilidade. Testes do novo módulo cobrem matemática com cenário fechado (R$ 500 de receita, R$ 265 de contribuição, R$ 205 de resultado estimado, 41% de margem, 3 locações para equilíbrio e R$ 265,59 de preço-base mínimo), casos negativos/indefinidos, persistência local, reset, troca de locadora, menu mobile e ausência de rolagem horizontal em 320/390/768/1024/1440 px.

**Status de integração:** o repositório de origem do GPT Work/Sites CONTINUA inacessível nesta sessão; nenhuma exportação de código, merge ou alteração D1 foi realizada. Nenhum deploy foi feito no domínio brasilinflaveis.com. Nenhum serviço pago novo contratado. Não confundir simulador com backend financeiro.

**Próximo passo:** aguardar acesso/extração do código Work, executar scripts/auditar-work.ps1 com a fonte e comparar Git, contratos, esquema de agenda D1, autenticação e funcionalidades antes de qualquer merge/publicação. Na ausência de fonte, continuar QA/a11y/motores independentes em branches protegidas.

## 21. [PC/COMMANDER] Publicação no domínio e hospedagem Hostinger — 19/11/2026

**Autorização explícita do proprietário:** publicar uma versão acompanhável no domínio brasilinflaveis.com usando a hospedagem Hostinger Web Ilimitada já paga. Versão publicada é a prévia React LOCAL comprovada, não o código GPT Work/Sites que continua inacessível nesta sessão.

**[PC/COMMANDER] Deploy efetuado pelo hPanel autenticado no computador DESKTOP-9481JM1:**
- A conta Hostinger existente exibiu plano Hospedagem Web Ilimitada, com término em 2027-11-19. Domínio adquirido brasilinflaveis.com selecionado no assistente PHP/HTML, com servidor regional South America (Brazil).
- Hospedagem configurada via hPanel > Sites > PHP/HTML > Carregar arquivos do site. ZIP enviado diretamente pelo seletor do Windows, com upload 100%; hPanel confirmou "Seu site está pronto".
- Pacote gerado da pasta dist do Vite: .previews/brasil-inflaveis-preview-20261119.zip (aprox. 1,05 MB), 9 arquivos: index.html, CSS, JS, quatro imagens ilustrativas, favicon.svg e robots.txt. Os caminhos internos ZIP usam separadores POSIX e não contêm .env, chaves, .git, source ou banco de dados.
- Site já responde com HTTP 200 em https://brasilinflaveis.com e https://www.brasilinflaveis.com; HTTP redireciona a HTTPS. Painel de hospedagem mostra SSL e CDN ativos. Nenhum serviço pago novo comprado; livresom.com e Potê Batata não alterados.
- O domínio exigia verificação de e-mail do registrante até 2026-12-03. Foi reenviado e-mail pelo hPanel à conta registrada, acessada no Chrome já autorizado do computador. Após clicar na mensagem RECENTE do remetente oficial, domains.hostinger.com mostrou "Seu e-mail foi verificado". A página do hPanel em seguida passou a mostrar domínio **Ativo** e notificação de verificação concluída. Nenhuma chave/link privado foi arquivado.

**[PC/COMMANDER] Git/local:**
- Pasta C:\Users\LIVRESOM\Projects\inflaveis-pro.
- Branch de release: release/hostinger-preview-20261119.
- Commit: **a4049f0** (chore: publica previa Hostinger com noindex e QA em producao), árvore Git limpa.
- Backup: backup/pre-hostinger-preview-20261119 no commit 87d550a.
- Documentação local: docs/DEPLOY-HOSTINGER.md; script de QA online: tests/live-hostinger.mjs; comando npm run test:live.
- Proteção contra indexação durante a validação: meta robots noindex,nofollow,noarchive e public/robots.txt Disallow: /. Essas diretivas NÃO exigem autenticação; a prévia está publicamente acessível para quem tiver o link.

**Teste real no domínio publicado:**
- Build e lint sem erros; testes locais smoke, marketplace e rentabilidade aprovados antes do upload.
- Playwright/Chrome acessou URL HTTPS publicada e confirmou: HTTP 200, título Brasil Infláveis, 5 brinquedos fictícios vinculados a 3 locadoras fictícias, 2 decoradores fictícios, CSS e seis imagens carregadas, painel/Rentabilidade em funcionamento e seleção entre empresas de demonstração, nenhum erro JS ou recurso crítico ausente, sem rolagem horizontal em 320/390/768/1440 px, robots.txt, favicon e imagem HTTP 200, WWW HTTPS HTTP 200.
- npm run test:live reexecutado após publicação e aprovado; checagem final da raiz HTTP 200 após commit.

**Escopo e riscos:** ambiente de DEMONSTRAÇÃO público; não é SaaS de produção, não tem autenticação verdadeira, autorização multi-tenant, banco D1 integrado, agenda transacional, checkout ou contratos vinculantes. Dados fictícios e persistência apenas localStorage do visitante; nunca usar informações sensíveis nesta versão. O código original GPT Work/Sites permanece sem comparação/merge. Repositório local segue sem remote; não confundir atualizar este log com publicar código-fonte no GitHub.

**Próximas melhorias:** validar visual diretamente pelo celular do proprietário no domínio; preparar método incremental/seguro de atualização na Hostinger com backup e QA após deploy; obter repositório do GPT Work/Sites para integração por diff. Não abrir inscrições, pagamentos reais nem removê-lo do modo noindex antes de autenticação, segurança, LGPD e homologação.

## 22. [PC/COMMANDER] Hotfix de visibilidade Android e cache Hostinger - 19/11/2026

**Incidente:** proprietario relatou que https://brasilinflaveis.com abria com tela preta em seu celular Android, apos a primeira publicacao Hostinger.
**Diagnostico honesto:** URL, HTML e assets retornavam HTTP 200; emulacoes Android Chrome Pixel 7 e Android 16 WebView renderizavam o site sem erros JS. O defeito NO APARELHO REAL ainda nao foi reproduzido, portanto a causa raiz permanece desconhecida. DNS/CDN/cache ou navegador embutido sao hipoteses, nao conclusoes.

**Correcoes implementadas (git local):**
- Branch backup: backup/pre-android-black-screen-20261119, commit a4049f0.
- Branch hotfix: hotfix/visibilidade-android-20261119, commit **5cf35d8**; working tree Git limpo.
- Novo index.html com HTML ASCII/entidades, fundo claro, meta color-scheme light e tela inicial estatica com recarregar se JS nao carregar. O HTML antigo de 779 bytes tinha bytes invalidos de UTF-8 no titulo/descricao.
- React com AppErrorBoundary para erros de renderizacao. Arquivos novos src/AppErrorBoundary.tsx e docs/HOTFIX-ANDROID-20261119.md.
- Testes novos tests/mobile-fallback.mjs e tests/android-live.mjs, scripts npm run test:mobile-fallback e npm run test:android-live.

**Deploy Hostinger comprovado:**
- Upload do novo bundle dist/assets/index-CHa452u1.js diretamente a public_html/assets; upload do novo dist/index.html a public_html com confirmacao de substituir arquivo existente.
- Backup do antigo HTML publicado salvo no PC em .previews/index-live-before-android-hotfix-20261119.html. ZIP tecnico temporario sem segredos na raiz public_html/android-hotfix-upload-20261119.zip; limpeza posterior recomendada.
- HPanel de brasilinflaveis.com: comando Limpar cache executado; toast oficial 'Cache limpo com sucesso'. Nenhuma mudanca em outros dominios ou D1.
- HTTP 200 confirmado nos dois hosts brasilinflaveis.com e www.brasilinflaveis.com; novo HTML contem initial-fallback e asset hash index-CHa452u1.js.

**Validacao:** npm run build, lint, smoke, marketplace, rentabilidade, mobile-fallback, android-live e test:live aprovados. Teste via URL PUBLICADA com JavaScript ativado: React e 5 cards funcionam no Pixel 7, 0 erros JS, 0 requests falhas. Com JavaScript DESATIVADO: fallback claro e botao de recarregar visiveis. Responsive 320/390/768/1440 px e area Rentabilidade seguem aprovados.

**Pendencia decisiva:** solicitar teste pelo proprietario no mesmo aparelho Android, preferencialmente Chrome externo e link atualizado com querystring para evitar cache. Se ainda ficar preta, pedir captura, navegador/app e rede; nao declarar falha especifica resolvida sem reproduzir. Versao GPT Work/Sites nao foi mesclada; sitio segue demonstracao com noindex e sem autenticacao real.

## 23. [PC/COMMANDER] Icone B castelo oficial e publicacao Hostinger - 19/11/2026

**Origem da identidade:** proprietário enviou uma imagem PNG transparente de uma bolha de vidro envolvendo a letra B azul em formato de castelo com coroa amarela e bandeiras verdes e escreveu 'ícone'. A imagem foi usada como ativo visual para o projeto, sem alterar seu conceito.

**Git local (implementação e histórico):**
- Pasta: C:\Users\LIVRESOM\Projects\inflaveis-pro.
- Branch: feature/icone-b-20261119; commit **19de490**; working tree limpa.
- Backup: backup/pre-icon-b-20261119 no commit 5cf35d8.
- Ícone otimizado e derivativos PNG transparentes em public/icon-brasil-inflaveis.png e public/icons/brasil-{32,48,192,512}.png. A imagem original de 1634 px pertence ao envio da conversa; cópia local é derivativo otimizado 128 px; não afirmar preservação dos bytes originais no repositório.
- index.html passou a apontar para favicons PNG com parâmetro v=2, apple-touch-icon e manifest.webmanifest; o manifesto não adiciona suporte offline ou autenticação.
- Cabeçalho público e logo do painel executivo exibem o B/bolha sem confete; CSS responsivo evita distorção da imagem circular.
- Teste automatizado tests/site-icon.mjs e comando npm run test:icon, além de documentação docs/ICON-B-20261119.md.

**Publicação Hostinger comprovada:**
- Pasta do domínio brasilinflaveis.com/public_html: enviados diretório icons com 4 PNG, manifest.webmanifest, novos assets Vite assets/index-CxTb0StZ.js e assets/index-AtQKKGFI.css; index.html enviado por último e substituído explicitamente.
- Checagem externa HTTP 200 confirmou os quatro ícones, manifesto, CSS e JS; brasilinflaveis.com e www.brasilinflaveis.com entregam novo HTML com links para os assets e favicon.
- Cache da hospedagem do domínio limpo pelo hPanel, com aviso 'Cache limpo com sucesso'.
- Outros projetos, banco D1, autenticação e cobranças NÃO alterados; zero gastos novos.

**Testes verificáveis:**
- Build, lint, smoke, marketplace e rentabilidade: OK.
- npm run test:icon executado no localhost e no domínio HTTPS, em Chrome desktop e emulação Pixel 7: OK para header, painel, favicon, manifesto e imagens.
- npm run test:live após deploy: HTTP 200, 5 brinquedos, 2 decoradores, 7 imagens carregadas, layouts 320/390/768/1440 e zero erros JS/requisições críticas.

**Limitações:** site ainda em modo demonstração noindex. A versão de código de GPT Work/Sites permanece separada. Favicon cacheado pode demorar a atualizar na aba já aberta; links novos usam v=2.
