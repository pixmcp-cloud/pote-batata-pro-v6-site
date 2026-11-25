# Cardápio digital integrado à V6
- Central de Operações: card Cardápio à direita de Hub de Delivery; rota vitrine já existente.
- Menu lateral: entrada Cardápio; gerenciador com publicação explícita e seleção de produtos, link por loja, cópia e retirada do ar.
- Corrigida dependência de snapshot.tab (snapshot operacional não contém navegação).
- Estado do diálogo é descartado na troca de usuário; operações assíncronas verificam sessão.
- Catálogo publicado continua limitado ao esquema publicMenus existente, sem pedidos, pagamentos ou estoque público.
- Próxima etapa: homologar regras Firestore em produção, checkout público transacional, integração PDV, frete, adicionais/combos, personalização e fotos autorizadas.
- Sem mudanças no Floot, sem nova versão ou banco e sem serviços pagos.
