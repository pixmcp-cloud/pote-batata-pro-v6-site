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
