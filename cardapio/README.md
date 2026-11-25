# Cardápio Digital Premium — V1 (prévia isolada)

Este módulo implementa a **prévia interativa** aprovada em 21/11/2026 para apresentação visual e testes. Mantém a identidade Potê Batata (preto e dourado), mas foi estruturado para futuramente receber logo, cores, fotos, categorias e catálogo de cada estabelecimento.

## Abrir a prévia
- Quando incorporado ao artefato do GitHub Pages: /cardapio/.
- Em desenvolvimento, servir os arquivos do repositório com um servidor HTTP estático (módulos JS ES não devem ser executados diretamente em file://).
- O pipeline copia este diretório para public/cardapio e mantém ../assets/ como caminho compartilhado.

## Funcionalidades efetivamente implementadas
- Vitrine responsiva mobile-first com hero, cards, categorias, busca, descrição e preços.
- Produto com quantidade, adicionais e observação.
- Sacola persistida em localStorage **somente no navegador**; cálculo por inteiros (centavos).
- Retirada/entrega e opções demonstrativas Pix, cartão e dinheiro.
- Cópia do resumo explicitamente demonstrativo, sem envio.
- Compartilhamento do link pelo mecanismo do navegador.
- Diálogos acessíveis, navegação por teclado e suporte a movimento reduzido.
- Testes: node test_cardapio_core.mjs e node test_cardapio_browser.cjs com Chrome/Puppeteer.

## Limites obrigatórios desta etapa
**Não é ainda um cardápio público operacional.** Produtos, preços e disponibilidades são fictícios e não refletem a conta do lojista. Imagens de exemplo não substituem as fotografias reais. A página não calcula frete, não solicita Pix, não cobra cartão, não emite pedido, não grava em Firestore, não reserva estoque e não altera o PDV. O resumo gerado é marcado como teste.

**Não remover esses avisos nem habilitar pedidos reais apenas pelo frontend.** Compartilhar dados do estado privado do PDV com usuários anônimos comprometeria o isolamento entre contas.

## Integração necessária para operação comercial
1. Criar cadastro de loja pública por proprietário (identidade, slug único, cidade, horário, cores, domínio, políticas de atendimento, fotos de produtos e meios de pagamento). Publicar **apenas** campos explicitamente autorizados pelo lojista. Não copiar documentos de estado privado do Firestore.
2. Implementar endpoint autenticado para publicação de catálogo filtrado, com validação de preços, disponibilidade e estoque. Expor catálogo público sanitizado com campos limitados; rever regras Firestore e testes de isolamento multi-tenant.
3. Implementar checkout público com proteção anti-spam, rate limiting, idempotência, cálculo de taxa de entrega no servidor e número de pedido; validar valor total no servidor contra catálogo atual e registrar pedido de forma transacional.
4. Fazer a entrada de pedidos reais no PDV pelo mesmo pipeline de reserva de estoque, concorrência, cancelamento e auditoria. Nenhum pedido pode nascer duplicado nem reduzir estoque indevidamente.
5. Habilitar pagamentos **opcionais** por integração segura com o provedor escolhido; credenciais somente no servidor, webhook com verificação de assinatura e status conciliado. Não declarar Pix/cartão recebido sem confirmação do provedor ou conferência manual adequada.
6. Testar autenticidade de origem, acessibilidade, responsividade, redes lentas e operações simultâneas antes de ativar links públicos para lojas.
7. Substituir imagens de demonstração pelas fotos reais autorizadas e testar otimização, compressão, cache e fallback.

## Diretriz de edição
O desenvolvimento permanece no **GitHub**. Sem atualização de Floot, APK ou domínio oficial por esta alteração. A branch de prévia não altera os dados operacionais.

## Fotos oficiais — V6
A prévia usa as fotos locais do estrogonofe de frango e dos quatro doces originais. Chocolate branco e preto são itens separados; os valores permanecem demonstrativos. Carne com cheddar, pizza e cachorro-quente ainda não têm fotos oficiais correspondentes na biblioteca. Na publicação voluntária da conta mestre Potê Batata, a biblioteca é associada por ID e nome exatos; outros estabelecimentos não herdam as fotos da marca. Fotos privadas e URLs com tokens continuam excluídas.

As três artes restantes foram recuperadas da biblioteca e dos arquivos enviados pelo proprietário: Carne com Cheddar, Pizza e Cachorro-Quente. A publicação inicial utiliza WebP 256×256 otimizado; os originais não foram alterados. Todos os oito sabores da prévia têm arte própria. Sem alteração nos preços.
