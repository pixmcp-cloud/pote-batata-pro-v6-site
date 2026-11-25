# Locução IA premium — PDV MULTIVERSAL V6

## Regras comerciais
- FREE, PRO e ADM começam bloqueados. Franquias oficiais ativas recebem acesso automático e cota coletiva máxima de 20% dos créditos totais do provedor por ciclo, dividida igualmente entre todas as franquias oficiais ativas (sem desconto); o ADM Google verificado pode bloquear ou liberar individualmente via accessPolicy.voiceAiEnabled. Bloqueio explícito prevalece.
- A autorização é global por conta, independente do segmento e do plano PRO; a franquia oficial ativa é a exceção padrão. Não equivale à licença comercial.
- Plano gratuito da ElevenLabs é pessoal/não comercial: nunca gerar criativos comerciais com ele.
- Orçamento em créditos IA = teto de (2 × custo efetivo do provedor em reais / valor monetário de um crédito IA), mínimo de 1 crédito. Configuração exclusivamente no servidor. Não confundir markup de 100% com margem líquida.
- Limite piloto: 777 caracteres, cotação válida por 5 minutos, voz de catálogo previamente autorizada. Não há clonagem no PDV.
- Saldo e orçamento não são aceitos do navegador; reserva Firestore atômica, cotação de uso único. Se houver falha incerta após reserva, registrar estado reconcile para conciliação manual, sem nova síntese nem estorno automático. Áudio retornado ao cliente, sem arquivo persistente no servidor nesta versão.

## Configuração ainda necessária (não ativada)
- Licença comercial ElevenLabs e confirmação de planos autorizados. Desativar cobrança excedente.
- Backend privado Node.js 20+ com Firebase Admin/credencial de serviço em ambiente seguro e proxy HTTPS. Nunca publicar esta pasta no Hosting.
- ELEVENLABS_API_KEY, VOICE_COMMERCIAL_APPROVED, VOICE_LICENSED_TIERS, VOICE_PROVIDER_MICRO_BRL_PER_1000, AI_CREDIT_MICRO_BRL, VOICE_ALLOWED_IDS; valores de preço devem ser apurados com o custo real contratado, câmbio e tributos. Micro BRL = R$ 0,000001.
- A pesquisa no código da V6 não encontrou uma carteira IA já homologada; o contrato proposto usa users/{uid}/aiWallet/main.balance. Validar compatibilidade com a carteira oficial antes de provisionar ou migrar saldos. Não cria créditos fictícios. A cota das franquias é reservada atomicamente em voiceAiFranchiseQuota/{resetUnix}, com limite de 20% da cota do provedor; subcoleção members/{uid} guarda consumo individual por ciclo. A quantidade de franquias oficiais ativas é consultada do cadastro na transação de reserva. O limite individual é floor(floor(cotaTotal/5)/N); sobras indivisíveis ficam livres, sem favorecimento. Entradas/saídas recalculam a divisão; consumo e reservas existentes permanecem contabilizados. Se a franquia já tiver ultrapassado o novo limite, fica bloqueada até ter saldo novamente. Franquias ativas bloqueadas pelo ADM continuam no denominador. Não é permitido reaproveitar consumo de franquia desativada no mesmo ciclo. Contadores antigos sem identificação individual exigem conciliação antes de ativar. Falhas incertas mantêm a reserva até conciliação. Escritas de carteira/ordens são exclusivas do servidor, regras existentes negam caminhos não autorizados.
- Implementar rotina administrativa de conciliação, recuperação de áudio e limites agregados de consumo antes de liberar comercialmente.
- Configurar endpoint HTTPS fixo e confiável em voice_ai.js apenas após homologação; atualmente null e geração fail-closed.
- Testar integração com Firebase real, concorrência, revogação e erros de rede; revisar contrato do provedor e UI em navegador.
- Não contratar ou publicar automaticamente.

## Testes
Testes unitários atualizados para divisão igualitária, mudança de número de franquias, teto coletivo e limites individuais; execução desta revisão ainda não confirmada. Testes de integração e publicação não executados. Nenhum consumo ElevenLabs.
