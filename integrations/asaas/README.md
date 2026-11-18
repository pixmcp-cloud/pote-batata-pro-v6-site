# Asaas para o Potê Batata Pro — API / piloto de 10 estabelecimentos

**Estado (18/11/2026):** preparação apenas na branch de homologação.
Não há API Key no repositório, nenhuma cobrança emitida, nenhum webhook
publicado e nenhuma licença ativada por eventos de pagamento.

## Como gerar a chave

1. Abra a interface web do Asaas, como **administrador**.
2. Acesse **Menu do usuário > Integrações > Chaves de API**.
3. Para TESTES, use uma conta separada em https://sandbox.asaas.com .
   Chaves da conta Asaas real NÃO funcionam no Sandbox.
4. Crie uma chave apenas para o Potê Batata Pro. Sandbox começa
   com \`$aact_hmlg_\` e produção com \`$aact_prod_\`.
5. A chave aparece apenas uma vez. Guarde-a em um cofre de segredos.
   NUNCA coloque em WhatsApp, ChatGPT, frontend, GitHub, logs ou prints.

## Onde inserir a chave no projeto

Arquitetura recomendada: navegador PDV -> Firebase Auth -> Cloudflare Worker
privado -> Asaas; webhooks Asaas -> Worker -> Firestore -> licença.
Somente o servidor deve acessar \`access_token\`.

No painel Cloudflare, selecione o Worker **de homologação**, entre em
**Settings > Variables and Secrets > Add** e crie um Secret chamado
\`ASAAS_SANDBOX_API_KEY\`. Não publique ou ative esse Worker antes
da homologação. Se usar Wrangler, \`wrangler secret put\` pode criar uma
nova versão e implantá-la: não executar sem aprovação para implantação.

Use \`ASAAS_WEBHOOK_TOKEN\` para o token do webhook, separado da API Key.
No site Asaas Sandbox: **Menu do usuário > Integrações > Webhooks**,
configure um endpoint HTTPS do Worker após ele existir. O cabeçalho
de origem enviado pelo Asaas é \`asaas-access-token\` e deve coincidir
com o token específico do webhook, não com a API Key.

## Fluxo das mensalidades

1. Identificar o estabelecimento autenticado no Firebase.
2. Consultar seu \`asaasCustomerId\`; cadastrar no Asaas somente se ausente.
3. Criar assinatura \`PIX\`, \`MONTHLY\`, armazenar
   \`asaasSubscriptionId\` por cliente. \`DISABLED\` evita oferta de Pix
   Automático; a cobrança mensal ainda deve ser paga pelo cliente.
4. Registrar eventos de webhook com idempotência e autenticação.
5. Confirmar assinatura, valor, ID do pagamento e identidade do cliente
   no backend antes de conceder ou renovar PRO em uma transação.
6. Não ativar PRO por \`PAYMENT_CREATED\`, screenshot, URL de checkout,
   status declarado pelo navegador ou webhook sem conciliação.

O guard deste protótipo **sempre devolve** \`eligibleToGrant:false\`.
Uma futura rotina transacional precisa ser desenvolvida e homologada.

## Rodar o único teste direcionado (sem chave e sem cobrar)

\`node --test integrations/asaas/sandbox.test.mjs\`

O teste injeta um transporte fictício: não faz chamadas externas. Ele
verifica a criação simulada de cliente e assinatura e impede API Key
de produção e concessão automática de licença.

## Economia e riscos

A conta Asaas permite criar cobranças sem tarifa, porém o recebimento
pode gerar taxa. O limite de até 100 Pix gratuitos/mês divulgado para
Pix por chave ou QR Code estático não se aplica automaticamente a
cobranças dinâmicas. Antes de ativar cobrança automática para os 10
clientes, comparar custo efetivo com o Pix manual já funcional.

Documentação:
- https://docs.asaas.com/docs/chaves-de-api
- https://docs.asaas.com/docs/faq-sandbox
- https://docs.asaas.com/docs/autentica%C3%A7%C3%A3o-1
- https://docs.asaas.com/docs/criando-um-cliente
- https://docs.asaas.com/reference/criar-nova-assinatura
- https://docs.asaas.com/docs/criar-novo-webhook-pela-aplicacao-web
- https://developers.cloudflare.com/workers/configuration/secrets/
