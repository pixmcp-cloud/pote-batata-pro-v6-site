# Cloudflare Workers — Potê Batata Pro

**Estado: STAGING / DESATIVADO.** O sistema público continua no Firebase. O Worker exige login Cloudflare e credenciais secretas antes de funcionar com dados reais.

## O que foi implementado
- GET /health: responde estado sem dados de clientes.
- POST /v1/orders/produce: inicia produção, verifica receita registrada, insumos e bebidas existentes, estoque suficiente, e grava pedido/estoque/movimentos em uma única transação de Firestore.
- POST /v1/orders/cancel: cancela pedido, devolvendo ingredientes e bebidas ou registrando a perda material, sem duplo estorno.
- Firebase ID token assinado (RS256, projeto, assinatura, emissor, expiração, provedor Google e email_verified); UID obtido exclusivamente do token, nunca do corpo enviado pelo celular.
- Licença Pro/franquia verificada no servidor. Clientes Free e unidades bloqueadas não podem usar esta API.
- Chave de idempotência por operação e histórico privado no Firestore para evitar cobranças/consumos duplicados. Dois clientes concorrentes não devem conseguir consumir o mesmo saldo.
- A operação produz um pulso V2 e avança revisão de estoque, como o aplicativo existente espera para se sincronizar.

## Configuração
A configuração wrangler.toml inicia com ENABLE_WRITES = "false". Portanto, mesmo publicada, a rota de escrita devolve HTTP 423 e não altera dados. As credenciais da conta de serviço Google precisam ficar em Secrets da Cloudflare (GCP_CLIENT_EMAIL, GCP_PRIVATE_KEY), e nunca em arquivos no GitHub ou no JavaScript do site. O arquivo .dev.vars está ignorado pelo Git.

O Worker não confirma pagamento bancário Pix. O cliente só deve enviar universo, ID do pedido e UUID de operação; nunca enviar quantidade, valor, dados de outros clientes ou UID. Para cancelamento, acrescentar decision=return ou decision=loss.

## Repetir testes no PC
Abra a pasta workers/antifraud e execute:
1. npm ci --ignore-scripts --no-audit
2. npm run check
3. npm test
4. npx wrangler dev --local --port 8788
5. npx wrangler deploy --dry-run --outdir .wrangler/dry-run

O runtime local responde HTTP 200 em /health e HTTP 423 nas operações enquanto desativado. Os testes cobrem JWT assinado, tenant isolado, geração de movimentos, estoque negativo, reembolso físico, perdas, corrida entre dois clientes, idempotência e transações REST.

## Conclusão da ativação — exige a conta do proprietário
1. Conectar Cloudflare Free no PC com npx wrangler login (ação explícita no navegador).
2. Criar conta de serviço Google de menor privilégio possível para Firestore e registrar GCP_CLIENT_EMAIL / GCP_PRIVATE_KEY via wrangler secret put, nunca em conversa nem arquivo versionado.
3. Publicar ainda com ENABLE_WRITES=false; conferir URL e quotas.
4. Fazer homologação em conta sintética com acesso a Firestore de testes; em seguida testar um canário Pro real com autorização expressa.
5. Alterar o app para chamar a API com getIdToken() e UUID estável, sem aplicar uma segunda baixa local. Manter a confirmação e a sincronização via V2.
6. Só após homologação completa, passar ENABLE_WRITES=true e fechar nas Firestore Rules a escrita direta dos campos críticos (pedidos, estoque e movimentos). Manter rollback dos dois lados.

**Limitação importante:** enquanto o navegador ainda pode escrever diretamente por Firebase SDK, este Worker não é uma barreira antifraude obrigatória. Não ativar regras de bloqueio antes da migração do cliente. O Google service account tem acesso elevado e exige segredo seguro e rotação. O plano gratuito Workers tem limites; transações Firestore continuam consumindo cotas Firebase. Nenhum serviço pago foi ativado aqui.
