# Voice Studio — Brasil Infláveis (preparação NÚCLEOBIT, 26/11/2026)

Estado: módulo de política puro, não conectado ao banco D1 nem à ElevenLabs. Branch isolada, sem implantação. O PDV MULTIVERSAL continua com suas rotas, autorização e carteira existentes.

## Tarifa proposta (pendente de homologação comercial)
| Faixa | Máximo de caracteres | Coin | Promo |
|---|---:|---:|---:|
| 15 s | 150 | 1 | 2 |
| 30 s | 300 | 2 | 4 |
| 45 s | 450 | 3 | 6 |
| 60 s | 600 | 4 | 8 |
| 75 s | 750 | 5 | 10 |

Duração é estimativa, não garantia. 1 Coin = 2 Promo em poder de compra; unidade inteira interna = 1 Promo. Pagamento misto explícito, sem conversão de saldo, sem troco, sem frações, sem transferência de Promo. A composição mista e tarifa são propostas técnicas; não habilitar comercialmente sem validar. Exemplo 30 s: 2 Coin, 1 Coin + 2 Promo ou 4 Promo. A escolha deve ser explícita; não descontar automaticamente outro saldo.

## Contrato de integração
- `availableTostaoPayments` enumera composições possíveis; `planTostaoVoice` calcula débito exato e saldos resultantes. Campos commercial/promo são nomes internos do adaptador; mapear ao esquema real da carteira após recuperar o código.
- `fundingGate` é uma proteção proposta: valores inteiros em milionésimos de real, custo conservador do provedor, receita líquida por Coin comercial e verba promocional efetivamente disponível. A parcela Promo precisa de verba real; a parcela paga deve cobrir pelo menos 2× seu custo direto. Não representa lucro líquido; parâmetros precisam de validação com preços reais e consumo de assinatura. Não considerar Promo como receita. Bloquear se verba ausente.
- Reutilizar UX, catálogo, favoritos, frases neutras em português, cache das prévias, nome de MP3 e clonagem ADM do PDV. A prévia sem cobrança ao usuário continua consumindo cota do provedor quando não há cache; limitar e deduplicar globalmente. Clonagem consentida, verificação de direitos e liberação explícita.
- Adaptar à sessão verificada pelo servidor do Brasil Infláveis, autorização por conta e papel, nunca confiar em saldo ou identidade enviados pelo navegador. Não aceitar Firebase do PDV como autenticação do Brasil Infláveis sem desenho autorizado.
- Manter um único segredo ElevenLabs em infraestrutura servidor NÚCLEOBIT. Serviço compartilhado deve autenticar cada aplicação, impor cotas isoladas por produto e limite global de assinatura, sem expor chave nem aceitar pedidos externos sem autenticação. O endpoint piloto ADM do PDV não é compartilhável diretamente. Não habilitar CORS indiscriminado.
- No D1, implementar reserva atômica do saldo comercial, promocional e da verba com condições de saldo suficientes, identificador único, ledger imutável e transição quoted → reserved → completed/reconcile. Validar cotação, texto, duração, voz, modelo, usuário e expiração no servidor. Não chamar o provedor antes da reserva. Operações ambíguas ficam em conciliação, sem retry automático nem estorno duplicado. Não gravar dados no PDV por operações do Brasil Infláveis.
- Homologação: concorrência, duplicidade, saldos insuficientes, segregação de contas/produtos, orçamento promocional, falhas de rede, cota global, autenticação, downloads e prévia. Somente após acesso ao repositório original, revisão do esquema e autorização de publicação.
- Sem contratação adicional. O saldo e as permissões da produção não foram alterados.

## Verificação
`node voice_backend/brasil_inflaveis/tostao_policy.test.mjs`

107 verificações executadas sobre as funções puras no ambiente JavaScript antes do commit. Testes de integração D1, worker, UI e provedor real ainda não executados. Este módulo não é um sistema de cobrança em produção.

## A07 — ampliação de testes (26/11/2026)
- Política de produção inalterada. Suite anterior: 107 verificações aprovadas novamente. Nova suite `node voice_backend/brasil_inflaveis/tostao_a07.test.mjs`: 9.801 verificações aprovadas, 5.180 de carteiras e tarifas, 4.480 financeiras, 122 entradas inválidas e 19 de simulação de reservas. Total somado 9.908 assertivas, não casos independentes. Executado no runtime JavaScript V8, carregando o conteúdo da política do GitHub (blob 4b36187c4501e38f68f75a8690393362af29ec58) e revalidando o teste versionado (commit 31c9ff1cfd7696a19f2a133b34b7fe85e066f24d); comandos Node são instruções reproduzíveis, não execução CI registrada.
- A simulação usa Map em memória e transições serializadas, apenas modelo de referência, não autenticação real, concorrência de banco, transação D1 ou gateway. Confirmou no modelo deduplicação, conflito de payload, segregação de escopo, limite global, falha ambígua, estorno e captura idempotentes, pagamento misto e reserva de verba Promo. O módulo puro não executa débitos, não impede sozinho duas requisições concorrentes e não autoriza transferências. Essas proteções reais precisam de integração em A09, conforme contrato A06.
- Sem cobrança, novos serviços, deploy ou alteração do código funcional. Preço e composição mista permanecem propostas; validar margem, verba promocional, custo real e schema D1 antes de comercializar.
