# Geoapify V6 — entrega em homologação (25/11/2026)
## Estado
Quatro APIs reais aprovadas em Caxias do Sul pelo workflow 45578540931, tentativa 2. Não equivale a checkout comercial ativo.
O novo Worker independente mantém o antifraude e o PDV intactos. Sem deploy, sem plano pago, sem credencial no repositório.
## Contrato
POST /v1/geo/config/get e /set: Google autenticado e proprietário do catálogo. Origem validada por reverse, tarifa inicial, tarifa por km, mínimo, limite de rota e modo de veículo; centavos e metros inteiros.
POST /v1/geo/geocode: consulta Brasil; proprietário pode localizar sua origem antes de habilitar. /autocomplete: sugestões próximas ao estabelecimento. /reverse: confirmação GPS. /quote: verifica proximidade, consulta endereço e rota, calcula valor no servidor e registra cotação isolada por identidade/loja/versão de configuração, com expiração de 10 min. Não cria pedidos nem cobra.
Apenas contas canário explícitas; origem HTTP permitida, autenticação Firebase Google; cota conservadora de 1800 créditos estimados/dia compartilhados, 50/usuário e 600/loja. Rota reservada como 2 créditos. Cache isolado por usuário/loja por 120 s em memória. Falhas resultam em indisponibilidade ou entrega fora da área, nunca taxa fictícia. Não presume que a cota controle outros projetos Geoapify ou custos Firebase/Cloudflare.
## Ativação
Build: cd workers/antifraud && npm ci && node --test test/geo_*.test.mjs && npx wrangler deploy --config wrangler.geoapify.toml --dry-run.
Publicar apenas após QA: usar identidade Cloudflare autorizada, plano gratuito e secret GEOAPIFY_API_KEY no Worker (não copiar para JS/Pages). O secret do GitHub Actions só habilita o smoke test, não o runtime Cloudflare. Restringir chave e rotacionar a credencial exposta antes de produção.
Manter ENABLE_GEO=false até teste com canários, depois usar configurações de staging específicas; sem ativar checkout real.
## Pendências
Interface de configuração da loja e checkout de cotação com login Google sob demanda implementados, mas desligados pela URL vazia em cardapio/geo-config.mjs. Pendente: publicação e teste real em navegador, cotação consumida atomicamente pelo checkout, cálculo do pedido e estoque autoritativos, pagamento, cronômetro/eventos e histórico dos dois lados, impressão, mapa e rastreamento consentido do motoboy, homologação mobile e deploy comercial. Não chamar nenhum desses itens de concluído antes de teste real.
