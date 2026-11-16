# Potê Batata Pro — Hub de Delivery (16/11/2026)

## Estado de implantação
- **Hub de Delivery** navegável na Central de Operações, com card SVG exclusivo e menu, 12 canais de API documentada.
- **Não existem integrações ativas com parceiros.** Nenhuma credencial, token, webhook, assinatura ou conexão automática foi instalada.
- Recurso operacional imediato: importar manualmente um JSON de pedidos obtido legitimamente da loja e revisá-lo na caixa de entrada; associar um item a uma ficha de qualquer universo e registrar pelo fluxo de Pedidos existente.
- O simples importador **não cria venda, não altera estoque, não efetua pagamento e não muda status no parceiro**.

## Canais e credenciamento
1. Mais Delivery — https://maisdeliveryapp.com.br/institucional/api/cadastro/ (cadastro necessário para documentação/credenciais)
2. iFood — https://developer.ifood.com.br/pt-BR/ (CNPJ e homologação)
3. 99Food — https://developer-food.99app.com/ (certificação e autorização)
4. aiqfome/Magalu Delivery — https://developer.aiqfome.com/docs/api/v2 (vínculo OAuth por loja)
5. Rappi — https://dev-portal.rappi.com/pt/ (parceria)
6. Delivery Much — https://developer.deliverymuch.com.br/ (OAuth e homologação)
7. Goomer — https://partner-api.goomer.app/opendelivery/docs.html (Open Delivery)
8. Delivery Direto — https://developers.deliverydireto.com.br/open-delivery-api/docs/ (credenciais)
9. Cardapio.ai — https://cardapio.ai/integracao/ (webhook configurado no painel ou API autorizada)
10. OlaClick — https://developers.olaclick.app/pt-BR/docs/ (API key e webhook HMAC)
11. BeeFood — https://docs.beefood.app/ (OAuth, sandbox e webhooks)
12. Keeta — https://api-docs.mykeeta.com/apis/opendelivery/section/general-info (parceria, OAuth, assinatura)

### Adaptadores já executáveis (somente importação manual)
- Cardapio.ai: `numeroPedido`, `produtos`, `nomeCliente`, `valorCompra`, `endereco`, `adicionais`.
- OlaClick: envelope `data` de webhooks ou exportações de pedidos com `id`, `items`, `total`.
- Open Delivery (projeção JSON de pedido com `id`, `items`, `total`); não é implementação integral do padrão, nem substitui o servidor OAuth/Discovery/eventos.
- aiqfome: objetos de pedidos V2 exportados com `data.id`, `items`, `user`.
- Os demais canais aparecem com documentação para credenciamento e importação JSON genérica **somente se** contiver campos compatíveis. Nenhum parser específico é considerado homologado sem amostras oficiais e credenciais.

## Regras de segurança e finanças
- Os registros ficam em `state.data.deliveryHub`, que acompanha a conta Google, fora dos campos de ramos restaurados por `universe_core`. Não compartilhar entre UIDs.
- O identificador de deduplicação é `canal/loja/idPedido`. Também há proteção contra registrar duas vezes o mesmo item vinculado.
- Importar um pedido mantém status e valores originais para conferência. É exigida ação humana para selecionar universo/receita e salvar a venda local.
- A baixa de estoque ocorre exclusivamente pelo fluxo **Produzir** existente depois do pedido registrado, não pelo importador.
- Em pedidos multissabor, cada item é lançado separadamente, com identificadores de origem e a taxa de entrega atribuída apenas ao primeiro. Isso exige revisão de adicionais, pagamento e conciliação do total do pedido.
- Pedidos cancelados na origem não são enviados para registro pela caixa de entrada; **não** há cancelamento automático de pedidos locais.
- Exemplo DEMO nunca cria pedidos. JSON pode conter dados pessoais; não usar arquivos de terceiros sem autorização.
- Apenas ID/alias da loja é digitado na UI. Credenciais NÃO são salvas no navegador nem enviadas por API.
- Não ativar APIs pagas ou serviço Firebase Blaze sem consentimento.

## Trabalho futuro para integração automática real
1. Servidor HTTPS com autenticação de conta+loja, credenciais criptografadas em Secret Manager, acesso por funções estritas.
2. OAuth por loja ou API Key com escopos mínimos, revogação, refresh e rotação de segredos.
3. Webhooks autenticados (por ex., HMAC OlaClick), reconsulta do pedido completo na fonte, validação da loja e deduplicação transacional global, com logs sem PII.
4. Módulo Open Delivery **V1 estável** para integrações compatíveis; V2 ainda é release candidate. Testar polling/ACK, status e retries.
5. Integração com produção: mapeamento de combos/adicionais, diferentes métodos de pagamento, taxas, estornos, cancelamentos e perdas; conciliação de total.
6. Homologação iFood/99Food/aiqfome/Keeta e autorização individual de estabelecimentos.
7. Regras de autorização SERVER-SIDE para limites FREE/PRO antes de lançar conectores pagos.

## Testes e rollback
- Executar `node test_delivery_hub_core.mjs`, `node test_delivery_hub_persistence.mjs` e `node test_delivery_hub_ui.mjs`.
- Bateria geral: 60 testes locais aprovados antes da publicação.
- Backup Firestore de leitura antes da alteração, SHA-256 `cd0aedc3e903b2c0213c9a2f97b791365122f41ec00166446a5b9d25303fd528` (local do PC autorizado).
- Rollback por reversão do commit, nunca por substituição de documentos no Firestore.
