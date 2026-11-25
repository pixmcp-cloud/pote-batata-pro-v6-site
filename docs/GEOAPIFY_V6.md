# Geoapify V6 — entrega em homologação (25/11/2026)
## Estado
Quatro APIs reais aprovadas em Caxias do Sul pelo workflow 45578540931, tentativa 2. Não equivale a checkout comercial ativo.
O novo Worker independente mantém o antifraude e o PDV intactos. Sem deploy, sem plano pago, sem credencial no repositório.
## Contrato
POST /v1/geo/config/get e /set: Google autenticado e proprietário do catálogo. Origem validada por reverse, tarifa inicial, tarifa por km, mínimo, limite de rota e modo de veículo; centavos e metros inteiros.
POST /v1/geo/geocode: consulta Brasil; proprietário pode localizar sua origem antes de habilitar. /autocomplete: sugestões próximas ao estabelecimento. /reverse: confirmação GPS. /quote: verifica proximidade, consulta endereço e rota, calcula valor no servidor e registra cotação isolada por identidade/loja/versão de configuração, com expiração de 10 min. Não cria pedidos nem cobra.
Apenas contas canário explícitas; origem HTTP permitida, autenticação Firebase Google; cota conservadora de 2500 créditos estimados/dia (reserva nominal de 500 sobre a franquia de 3000) compartilhados, 50/usuário e 600/loja. Rota reservada como 2 créditos. Cache isolado por usuário/loja por 120 s em memória. Falhas resultam em indisponibilidade ou entrega fora da área, nunca taxa fictícia. Não presume que a cota controle outros projetos Geoapify ou custos Firebase/Cloudflare.
## Ativação
Build: cd workers/antifraud && npm ci && node --test test/geo_*.test.mjs && npx wrangler deploy --config wrangler.geoapify.toml --dry-run.
Publicar apenas após QA: usar identidade Cloudflare autorizada, plano gratuito e secret GEOAPIFY_API_KEY no Worker (não copiar para JS/Pages). O secret do GitHub Actions só habilita o smoke test, não o runtime Cloudflare. Restringir chave e rotacionar a credencial exposta antes de produção.
Manter ENABLE_GEO=false até teste com canários, depois usar configurações de staging específicas; sem ativar checkout real.
## Pendências
Interface de configuração da loja e checkout de cotação com login Google sob demanda implementados, mas desligados pela URL vazia em cardapio/geo-config.mjs. Pendente: publicação e teste real em navegador, cotação consumida atomicamente pelo checkout, cálculo do pedido e estoque autoritativos, pagamento, cronômetro/eventos e histórico dos dois lados, impressão, mapa e rastreamento consentido do motoboy, homologação mobile e deploy comercial. Não chamar nenhum desses itens de concluído antes de teste real.

## Checkout e cronômetro
Núcleo puro de planejamento de pedido público e cronômetro adicionado: preço em centavos lido do catálogo publicado, cotação vinculada ao comprador e à loja, receitas e bebidas privadas, rendimento, embalagem, pedidos já reservados, sequência e pagamento inicialmente pendente. Máquina de estados de entrega com autorização de lojista/entregador, tempo monotônico e encerramento definitivo do cronômetro. Não está ligado à persistência: o adaptador Firestore multi-item, leitura transacional de todos os pedidos pendentes, guard/pulse, consumo de cotação/idempotência, histórico privado e recibo ainda precisam ser concluídos e homologados. Nenhum pedido real é aceito.

25/11/2026 — limite global preventivo elevado para 2500 por decisão do proprietário. Mantidos limites por usuário (50) e loja (600); a reserva de 500 pressupõe que outros consumidores da chave e a contagem real do provedor não excedam essa margem. Sem deploy.

## 25/11/2026 — implantação inicial de homologação confirmada
- Workflow 45588831805, job 139117320645, commit ac7bf374908af6a0c4f4f5c265160d347906ca15: publicação efetiva aprovada do novo Worker `pote-batata-geo-staging`, sem sobrescrever os Workers existentes.
- Endpoint: https://pote-batata-geo-staging.pixmcp.workers.dev/health. Teste HTTPS confirmou status ok, enabled=false, checkoutEnabled=false; POST quote retorna 423, origem não autorizada retorna 403 e criação de pedido retorna 404.
- Secret GEOAPIFY_API_KEY instalado no Worker e confirmado na listagem de nomes, sem expor valores. Nenhuma alteração de plano, DNS, produção, Floot ou Firestore comercial. A chave real foi testada previamente pelo GitHub; ainda não houve cotação autenticada de ponta a ponta no Worker publicado.
- Próximo passo: preparar canário autenticado, testar configuração de loja, consulta e cotação reais no Worker com limites ativos e manter checkout comercial desligado. Em paralelo, concluir persistência Firestore transacional com idempotência, reservas e pagamento pendente, histórico, GPS de entrega e política FREE/PRO antes de promover produção.
