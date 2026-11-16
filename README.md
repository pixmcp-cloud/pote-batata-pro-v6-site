# Potê Batata Pro — site oficial (pré-lançamento)

Hospedagem gratuita no GitHub Pages, com acesso por conta Google e sincronização de dados no Firebase/Firestore.

- URL pública: https://pixmcp-cloud.github.io/pote-batata-pro-v6-site/
- Entrada principal: `/index.html`, protegida por login Google.
- Compatibilidade: `/beta.html` usa a mesma tela de autenticação.
- Conta administradora: definida por identidade Google verificada e regras Firestore; o seletor ADM/FREE da demonstração não está exposto.
- Contato: contato@livresom.com · https://wa.me/5548999951729.
- Logo: recuperada do HTML da marca usado no protótipo anterior.

## Implantação e segurança
O workflow `.github/workflows/deploy.yml` constrói o site a partir de `source/pote_app_base.html` (armazenado no próprio repositório). Não depende mais de baixar o arquivo-fonte de hospedagem externa.

O frontend público contém apenas o código da aplicação, nunca dados privados de outros usuários. O Firebase Auth verifica a conta Google. As regras `firestore.rules` devem continuar publicadas no Firebase para isolar dados por UID; uma verificação de role apenas no JavaScript não substitui as regras do banco.

## Restrições do pré-lançamento
A autenticação precisa de teste presencial em navegador Chrome/Edge com a conta administradora e com outra conta. Navegadores internos de aplicativos podem bloquear o popup Google — a tela agora sinaliza e orienta a abrir o navegador externo.

Cobranças, assinaturas, licenças comerciais e concessão de plano PRO não estão implementadas ou autorizadas. Não oferecer assinaturas pagas até concluir validação e controles de servidor. Dados demonstrativos que venham da V6 não devem ser confundidos com registros reais.

## Atualização: fornecedores e GPS (piloto gratuito)
- No painel ADM, **Usar GPS** solicita autorização real do navegador via `navigator.geolocation` em HTTPS. Em WebViews do ChatGPT/WhatsApp pode falhar; use Chrome/Edge.
- **Pesquisar fornecedores** consulta apenas após clique e usa Photon (dados públicos do OpenStreetMap), com cache local de 24 horas e consultas limitadas. Endereços, horários, telefones e estoque devem ser confirmados.
- A consulta pública pode limitar requisições ou ficar indisponível. **Não é serviço com SLA de produção**; para escalar a uma base grande de assinantes, contratar ou hospedar um provedor com garantias.
- A versão FREE mantém o cadastro manual limitado a um fornecedor. Pesquisa externa está restrita ao painel ADM neste piloto.
- A interface móvel ajusta cabeçalho, menu horizontal e largura dos campos; logo original é usada também no cabeçalho.
- O teste `node test_suppliers.js` simula resposta de fornecedor, GPS e cadastro sem executar consultas externas na CI.

## Contas reais zeradas e painel de simulação (15/11/2026)

- **Conta Google nova:** inicia com 0 receitas cadastradas, 0 insumos, 0 em estoque, 0 vendas, 0 clientes, 0 fornecedores, 0 despesas, 0 compras e 0 produção. Identidade visual e configurações básicas são preservadas.
- **Conta FREE antiga criada com a V6:** ao fazer login, a versão nova compara todos os dados persistidos com os exemplos originais. Só elimina os dados fictícios quando a conta corresponde exatamente ao modelo intacto. Se houver qualquer modificação, não redefine automaticamente os dados.
- **Painel de simulação:** aberto pela Home, exibe gráficos e valores explicitamente fictícios, totalmente isolados dos pedidos, estoque, relatórios e do Firestore. Não realiza gravações.
- **Zerar minha conta (com backup):** disponível nas Configurações para o próprio titular. Exige confirmação e exporta backup JSON antes de limpar o estado operacional. O conteúdo limpo é sincronizado à conta.
- Contas ADM e FREE continuam sendo determinadas pela conta Google verificada; **a mudança visual ou de dados não ativa cobrança PRO**.
- As regras do Firestore devem continuar isolando documentos por UID. Esta publicação não faz alterações nas regras do servidor.
- Para auditoria: `node test_clean_accounts.js` verifica estado inicial, separação da simulação e bloqueio de migração destrutiva em contas personalizadas.

## Adaptação a múltiplos negócios (15/11/2026)

- O login e a identidade inicial usam **Gestão Pro** e uma ilustração genérica. A conta mestre Google `pixmcp@gmail.com` mantém sua marca Potê Batata e os dados já salvos.
- Um cartão **Negócio** na Home e uma entrada no menu permitem escolher **Batataria**, **Pizzaria**, **Hamburgueria** ou **Lancheria**.
- A seleção de **Batataria** copia para a conta, uma vez, 26 receitas e 45 ingredientes de referência. **Estoque inicial dos ingredientes é zero** e os preços do modelo precisam ser conferidos. Fotografias de receita e logotipo são ilustrações SVG genéricas diferentes das fotografias da conta mestre.
- Os outros três ramos começam sem fichas-modelo e permitem o cadastro das próprias receitas. O cliente pode alterar o ramo sem que receitas, pedidos ou estoque existentes sejam apagados; a tela informa isso.
- Contas antigas com a identidade original intacta recebem somente a neutralização da marca-padrão (preservando contatos e registros). As opções FREE/PRO e a sincronização Google permanecem.
- As ilustrações SVG não usam rede de terceiros nem geram cobrança de imagem por visualização.
- **Limitação de segurança:** o GitHub Pages é público e os antigos arquivos de imagem ainda são servidos estaticamente para a conta mestre. Embora o aplicativo não os mostre aos demais usuários, URLs estáticas não constituem proteção de acesso. Antes da venda comercial, mover esses arquivos para armazenamento com autorização por usuário e remover os originais do conteúdo público.
- **Floot:** a mesma função ainda precisa ser incorporada e validada quando o limite diário de desenvolvimento permitir.

## Rede de franquias Potê Batata — 15/11/2026

- A conta Google mestre pode selecionar outro usuário em **ADM · Gerenciar** e usar **Transformar em franquia**, com confirmação e registro de auditoria. Também pode revogar.
- O papel de franquia fica no perfil Firebase `users/{uid}.franchise`. Apenas a conta mestre Google verificada pode modificar esse campo; contas normais não podem se promover.
- Uma franquia ativa tem acesso PRO à marca e às fichas oficiais. A tela Meu Perfil mostra **FRANQUIA POTÊ BATATA**. A seção Negócio fica restrita a Batataria enquanto a franquia estiver ativa.
- A matriz publica automaticamente **somente** receitas, instruções, ingredientes usados e referências de fotos no documento compartilhado `franchiseCatalog/potebatata`. O catálogo não inclui valores de compras, estoque, pedidos, clientes, despesas ou fornecedores.
- Cada franquia acompanha o catálogo por `onSnapshot`: sabores novos aparecem, sabores removidos são bloqueados. O preço, margem, estoque e movimentações da franquia permanecem independentes.
- Na revogação, o acesso ao catálogo é retirado pelas regras do Firestore, o logotipo volta ao genérico, receitas oficiais ficam bloqueadas, mas registros comerciais históricos são preservados.
- **Limite do modelo atual:** os arquivos de imagens da marca continuam hospedados no GitHub Pages público e as fichas de Batataria ainda são distribuídas no HTML para a instalação de novos usuários. A interface e o Firestore restringem o uso da marca, mas não há proteção de acesso aos arquivos estáticos. Para exclusividade comercial, migrar imagens e conteúdo original para armazenamento privado com controle de acesso.
- A sincronização acontece com navegador conectado e sessão Google válida; não é um serviço de publicação em background independente dos logins.
- **Floot:** função pendente de replicação e testes na versão nativa após liberação do limite do workspace.

## Universos independentes de alimentação — 15/11/2026

- Cinco segmentos: **Batataria**, **Pizzaria**, **Hamburgueria**, **Hot Dog**, **Lancheria**.
- Receitas-modelo: Batataria 26, Pizzaria 30, Hamburgueria 30, Hot Dog 20 e Lancheria 0.
- Os cinco primeiros sabores de pizza seguem a preferência em pedidos relatada pelo iFood em 2026 (calabresa, frango com requeijão, marguerita, muçarela, portuguesa); para hambúrguer, clássicos como cheeseburger, X-Salada, X-Tudo e X-Bacon se destacam. Os demais modelos são curadoria de cardápio, não posição oficial em ranking de vendas.
- Cada receita-modelo inclui ingredientes, gramagens de referência e preparo passo a passo; **custo dos insumos e estoque iniciam em zero**, obrigando o cliente a informar as compras reais.
- A troca de universo arquiva as listas operacionais (receitas, insumos, clientes, pedidos, fornecedores, estoque, combos, despesas etc.) em `appState/main.data.businessUniverses` e carrega as listas exclusivas do ramo ativo. Voltar a um universo restaura os registros e customizações anteriores. Não duplica fichas na segunda seleção.
- Contas antigas que haviam selecionado Pizzaria/Hamburgueria enquanto as 26 receitas da Batataria ainda permaneciam visíveis passam por migração conservadora: as fichas-modelo de batata são movidas para o universo Batataria sem apagar pedidos anteriores.
- A conta administradora `pixmcp@gmail.com` permanece no universo Batataria, com sua logo e seu conteúdo próprio; unidades com franquia ativa ficam restritas à Batataria oficial. Na promoção de franquia, o ramo anterior é preservado no arquivo interno antes da ativação do catálogo oficial.
- O acesso FREE continua com as mesmas limitações de receitas; o catálogo completo é recurso PRO conforme licenciamento.
- **Atenção:** os modelos são pontos de partida, não fichas técnicas profissionalmente homologadas. Conferir gramagens, rendimento, alergênicos, cocção e custos reais antes da venda.
- **Floot:** adaptar os universos e a migração aos registros já existentes no projeto nativo, sem substituir os dados de produção.

## Estoque real e compras — 15/11/2026

- A tela **Estoque e compras** separa claramente três valores: **saldo físico atual**, **preço/quantidade da embalagem de referência**, e **rendimento aproveitável (%)**. Exemplo de modelo: R$ 90 por 25 kg (custo de referência), 90% (rendimento) e **estoque real independente**.
- **Nova compra:** informar ingrediente, quantidade de fato recebida, unidade (kg/g/L/ml/un), valor **total** pago e fornecedor opcional. A tela calcula saldo inicial + compra = novo saldo antes de confirmar. A gravação armazena a compra em `data.purchases`, o movimento em `data.stockMovements` e atualiza `ingredient.stock`; custo da última compra passa a ser referência de precificação.
- Exemplo validado: 3 kg no depósito + 20 kg comprados por R$ 180 = 23 kg; custo de referência passa a R$ 180/20 kg. O preço por quilo é R$ 9 e o rendimento continua registrado separadamente.
- **Conferir / ajustar saldo:** substitui o saldo pela contagem física informada e registra a diferença com motivo; não gera pedido de compra fictício.
- **Últimas compras:** registra horário, ingrediente, quantidade e valor pago. Quando a conta é franquia, ingredientes genéricos de Batataria importados antes da promoção não são exibidos na área principal, preservando os dados históricos.
- O formulário de custo de referência não aumenta nem diminui o estoque: preço e quantidade da embalagem **não** representam saldo físico. Ingrediente novo começa com estoque 0.
- O distintivo de usuário autenticado foi corrigido para **FRANQUIA • OFICIAL**, **PRO • LICENÇA ATIVA**, **FREE • PLANO GRATUITO** ou **ADM • ACESSO MESTRE**, conforme permissões reais; remover rótulos de acesso simulado das contas reais.
- **Pendente de validação operacional:** testar o cadastro de compra com conta Google real e a sincronização entre dois aparelhos. Edicões concorrentes do mesmo estoque em dois dispositivos ainda exigem estratégia de transação para evitar sobrescrita.
- **Floot:** aplicar o mesmo novo fluxo posteriormente, preservando o banco existente.

## Fluxo de pedidos, estoque crítico e navegação protegida — 15/11/2026

- **Pedidos e produção:** conferência de saldo **no cadastro**, levando em conta ingredientes do sabor, adicionais, embalagens, bebidas e saldos já comprometidos pelos pedidos recebidos ainda não produzidos. O mesmo estoque não pode ficar disponível para dois pedidos pendentes na mesma cópia sincronizada do estado. Produzir verifica novamente antes da baixa.
- **Pedidos recusados por estoque:** modal explícito com itens em falta e botão **Ver estoque**; o botão **Registrar pedido** é desativado conforme o usuário digita a quantidade ou seleciona outro sabor/combo/adicional.
- **Avisos de estoque crítico:** quando restam ingredientes para menos de **cinco unidades** do sabor escolhido, aparecem aviso no fluxo de venda, alerta em modal no momento da operação e resumo dos sabores críticos na tela Estoque.
- **Pós-venda:** registrar, produzir, finalizar e cancelar permanecem na seção **Pedidos** e destacam o pedido; não retornam à Home. A listagem inclui pedidos recebidos, em produção e finalizados.
- **Cardápio Digital:** venda via sacola também valida **toda a compra, agregada** antes de registrar/abrir WhatsApp. Aumentar quantidade ou adicionar item sem estoque não altera a sacola. Bebidas e adicionais extras são rateados corretamente por quantidade da receita no pedido; embalagem é contabilizada; só é possível fechar sacola com pelo menos um produto principal.
- **Saída:** botão Sair exige confirmação; Voltar em sessão Google tenta interceptar e exibir diálogo; beforeunload pede aviso nativo ao navegador. **Limitação:** Android e navegadores podem impedir o aviso quando o sistema encerra a aba/app.
- **Organização:** ingredientes, estoques e bebidas mostrados alfabeticamente por nome (ordenação visual pt-BR; sem mudar IDs ou registros).
- **Troca de ramo:** impede levar produtos de uma sacola não finalizada para outro universo; pede confirmação antes de limpá-la.
- **Auditoria automatizada:** 17 telas renderizadas, fluxo real integrado do caixa (registrar, reservar, produzir, concluir e bloquear excedente), sacola com adicional/bebida/embalagem, mais regressões de galeria, gráficos, licenças, franquias, universos, estoque e fornecedores.
- **Risco ainda aberto:** o aplicativo grava um documento completo de estado por usuário no Firestore. Dois aparelhos alterando o mesmo estoque quase simultaneamente ainda podem gerar conflitos; para garantir reserva atômica multiequipamento, implementar operação transacional no backend e testes com contas Google reais. Não declarar proteção absoluta sem essa etapa.
- **Floot:** mudanças do GitHub ainda devem ser replicadas na versão nativa.

## Pagamentos, bebidas, combos e organização do estoque — 15/11/2026

- **Pagamento no caixa e no Cardápio Digital:** Pix, cartão, dinheiro e outras formas. Para dinheiro, solicitar o valor recebido, validar que cobre o total (produtos + tele-entrega) e calcular o troco em centavos. Recibo do cliente registra forma escolhida, valor recebido e troco devolvido; a comanda da cozinha também apresenta o valor da tele-entrega.
- **Entrega:** opção explícita **Retirada** ou **Tele-entrega**, taxa personalizada por pedido e exigência de endereço de entrega. No Cardápio Digital, a taxa aparece junto ao total. Nenhuma taxa é inventada ao abrir um novo pedido.
- **Catálogo comercial da Batataria:** 11 opções cadastradas automaticamente, com preço de venda definido e **estoque/custo de compra zerados**. Água mineral 500 ml com gás R$ 5 e sem gás R$ 4; refrigerante Guaraná, Cola e Laranja em lata 350 ml R$ 7, garrafa 600 ml R$ 9, e versão 600 ml zero açúcar R$ 10. No estoque há um bloco separado com saldo, custo, vendas, registro de compra e conferência.
- **Combo inicial único:** 1 batata recheada + 1 refrigerante. Apenas Frango Cremoso (r01), Bacon & 3 Queijos (r03) e Cachorro-Quente (r21). Opções de bebida do catálogo de refrigerantes, incluindo tamanho e versão zero. **5% de desconto exatos** sobre os dois produtos, calculado em centavos sem novo arredondamento comercial. Escolhas disponíveis no caixa e no Cardápio Digital; no Free, respeitam desbloqueio das receitas.
- **Estoque:** ingredientes/perecíveis, embalagens/descartáveis e águas/refrigerantes são apresentados separadamente; há busca unificada. Ao cadastrar um ingrediente, o sistema impede nome + categoria + unidade de medida repetidos; ao cadastrar bebida, impede nome + volume repetidos.
- **Duplicados antigos:** aviso lista os grupos repetidos e oferece mesclagem **somente mediante confirmação do usuário**. Saldos somados, referências de receitas/pedidos/adicionais atualizadas, registro de mesclagem no histórico. Preserva compras antigas (não reescreve documentos fiscais ou registros de compras).
- **Não altera estoque real silenciosamente:** a inclusão dos modelos gera quantidades iguais a zero; a primeira entrada só aparece depois da compra/confirmação do cliente. Não coloca preços de compra, vendas, clientes ou mercadorias falsos.
- **Validação integrada:** tests `test_commerce_v2.js` e `test_app_routes.js` verificam opções/prazos, preço 5%, caixa, sacola, pagamento, troco, tele-entrega na comanda, compras/baixas de refrigerante e mesclagem de estoque duplicado.
- **Limitações a verificar antes da versão oficial:** concorrência de estoque em múltiplos aparelhos segue sem transações atômicas do backend; impressão térmica e fluxo de confirmação nativo no Android precisam de teste real; migrar a versão Floot sem sobrescrever registros.

## Notificações de atualização e reposição inteligente — 15/11/2026

- **Novidades por versão**: `release_news.js` mostra um modal após o login Google, com data, lista de melhorias e caixa **"✔ Não mostrar novamente esta notícia"**. Se marcada, salva a preferência com chave própria por **UID e ID de versão** no `localStorage`. Uma nova notícia com outro `RELEASE.id` reaparece automaticamente, independentemente da escolha anterior. Sem marcação, a notícia reaparece num próximo login. Para uma próxima publicação com novidades, atualizar o ID, data e notas.
- **Escopo da preferência**: armazenamento no navegador/dispositivo para evitar serviço de nuvem pago. A dispensa não é sincronizada automaticamente entre celulares.
- **Estoque tricolor**: `stock_status.js` calcula saldo físico menos reservas de pedidos recebidos e não produzidos. **Vermelho** = faltante (sem saldo disponível ou insuficiente para o pedido em edição); **laranja** = estoque baixo (mínimo cadastrado ou material para menos de 5 unidades); **verde** = saldo adequado. Os três estados aparecem nos cards de ingredientes, embalagens e bebidas; o saldo físico e o saldo disponível são separados.
- **Alerta de produção**: a janela de falta apresenta **cada item em vermelho** com quantidade faltante; itens baixos, mas ainda disponíveis, aparecem em laranja. Botão **"Repor estoque faltante"** abre a área Estoque diretamente na compra do primeiro insumo/bebida faltante. Os demais aparecem numa lista de reposição com botão por item.
- **Volta sem perder digitação**: durante a navegação para compra, o formulário de pedido em elaboração (quantidade, sabor/combo, atendimento, entrega, pagamento e observações) é preservado em memória para restauração ao selecionar **"Voltar ao pedido"**. Dados não são gravados como venda até o cliente confirmar.
- **Verificações automatizadas**: `test_stock_alert_release.js` cobre as três cores, reservas, destaque no pop-up, reposição direcionada, preservação do pedido e o comportamento de novidades por usuário e versão; `test_app_routes.js` e os demais testes de regressão cobrem as 17 telas e os fluxos comerciais anteriores.
- **Pendente**: testes visuais manuais com navegadores Android reais e concorrência de estoque em aparelhos distintos; a cópia Floot requer atualização separada, sem sobrescrever dados.

## Falta de pote após reposição, prioridade e lixeira — 15/11/2026

- **Correção do aviso persistente:** `stock_status.currentContext()` recalcula em tempo real as necessidades abertas do alerta a partir do saldo físico e das reservas dos pedidos recebidos. O aviso anterior desaparece após reposição suficiente; quando o saldo atende o pedido, mas continua abaixo do mínimo configurado, o item passa a **laranja**, não permanece falsamente **vermelho**.
- **Itens faltantes primeiro:** grupo vermelho aparece logo no início do estoque, antes das seções de compra e bebidas, com botão clicável por item que abre diretamente sua entrada. Dentro da lista de ingredientes e embalagens, a ordem é faltante → baixo → bom, alfabética em cada categoria de prioridade. As bebidas também são ordenadas por disponibilidade.
- **Repor exatamente o item:** clicar no nome de um ingrediente ou da bebida em falta, no pop-up, no grupo prioritário ou no cartão do estoque, seleciona aquele cadastro na tela de reposição. Depois de registrar uma compra, o mesmo item permanece selecionado.
- **Lixeira segura:** cada cartão de ingrediente/embalagem tem botão com ícone de lixeira. Item sem vínculos ativos pode ser arquivado, com histórico e estoque preservados, e restaurado na seção Lixeira. Com receitas ou adicionais ativos, o usuário pode escolher outra embalagem/insumo equivalente, transferir o saldo e substituir os vínculos; não é permitida substituição com pedidos abertos. Pedidos e compras históricos não são reescritos; a movimentação de transferência fica registrada.
- **Embalagens arquivadas:** não entram mais no cálculo automático de embalagem das receitas, nem no seletor de embalagens da precificação. O detector de duplicados ignora itens na Lixeira. Cadastro FREE arquivado libera a vaga do usuário.
- **Aviso por versão:** atualização específica `2026-11-15-reposicao-lixeira-e-prioridade-02`. Uma notícia nova aparece mesmo que o usuário tenha dispensado a anterior, com preferência separada por conta e navegador.
- **Verificações:** `test_stock_delete_priority.js` testa a reposição de pote reservado, resolução do alerta obsoleto, ordenação por prioridade, proteção de pedidos em aberto, substituição de duplicados sem alterar pedidos concluídos e restauração na lixeira. Os testes existentes continuam na regressão.
- **Limites:** não foi possível verificar os saldos reais de uma conta Google do usuário neste ambiente; a causa exata de uma conta individual dependerá do saldo físico, reservas e ID do cadastro. A nova tela expõe esses números. A mudança está no GitHub; Floot ainda exige atualização separada.

## Perdas e lucro estimado — atualização 15/11/2026

- **Nova aba Perdas** no menu, no painel inicial e em Gastos e despesas, acessível nas contas FREE e PRO sem obrigar a registrar um pedido. Os lançamentos de perdas ficam persistidos na conta por universo de negócio (`data.losses`), com histórico e razão.
- **Descarte físico:** motivo (vencimento/apodrecimento, queda, higiene, erro de preparo, deterioração, avaria ou outro), ingrediente, embalagem ou bebida, quantidade e unidade. Debita apenas o saldo físico existente, registra movimento negativo e calcula o prejuízo a partir do custo da compra cadastrada. Permite kg, g, L, ml ou unidade conforme item. Falta de referência de custo é sinalizada como custo incompleto, não assumida como custo zero confirmado.
- **Cancelamento após produção:** a ação explícita "Cancelar sem devolver · perda" preserva a baixa física que já ocorreu e cria uma única ocorrência de prejuízo com os custos dos insumos/embalagens/bebidas produzidos. Cancelamento antes de iniciar a produção libera a reserva e não credita nem debita o físico; cancelamento com devolução física não vira perda. Idempotência impede repetição.
- **Não pagamento:** pedido produzido pode ser sinalizado como `paymentStatus="nao_pago"`, excluído de receita/projeção de vendas. Calcula custo consumido separado do preço de venda não recebido. Permite registrar recebimento posterior com reversão explícita do lançamento financeiro, sem mexer no estoque físico. Eventos regularizados permanecem no histórico e saem dos totais ativos.
- **Contabilidade e resultados:** `totals()` subtrai apenas os custos estimados das perdas ativas do lucro estimado dos pedidos reconhecidos. O preço de venda não recebido aparece como dado informativo à parte, nunca descontado novamente do resultado. O dashboard separa `sobra após custos variáveis`, `lucro estimado após despesas fixas e perdas` e `vendas não recebidas` na aba Perdas e em Relatórios.
- **Teste:** `test_losses.js` valida descarte de batata em kg, bacon, embalagem, bebida, custo por base, limite físico, cancelamento produzido, não pagamento, regularização, duplicidades e persistência de linhas. `test_app_routes.js` exercita o fluxo registrar→produzir→cancelar com perda e indicadores financeiros. A suíte do GitHub Actions exige sucesso destes e dos testes anteriores antes da publicação.
- **Limitações:** os custos e lucros são estimados com base nos preços de compra e parâmetros cadastrados; não equivalem à apuração fiscal. Se o preço de compra estiver ausente, a perda tem valor incompleto e deve ser revisada. Eventos em múltiplos dispositivos ainda dependem de sincronização sem transação atômica de estoque; testar dispositivos e impressões reais continua necessário. Alterações da cópia Floot requerem publicação separada.

## Correção de unidades no registro de Perdas — 15/11/2026

- O formulário de perdas agora separa **Alimento / ingrediente**, **Embalagem / descartável** e **Bebida (garrafa/lata/água)**.
- A unidade é escolhida pelo **cadastro de estoque**, não pelo texto do produto. Sólidos: `kg/g`; líquidos registrados por volume (ex.: leite, molho): `L/ml`; embalagens: `un`; bebidas do catálogo (ex.: água mineral 500 ml, refrigerante lata ou 600 ml): **`un`**, pois o estoque físico desses itens é contado por recipiente.
- Ao trocar categoria ou produto, a lista de produtos e a unidade mudam e a quantidade digitada anteriormente é apagada para evitar baixa na unidade errada. Se a categoria não tiver cadastros, não aparece unidade fictícia e a entrada fica desabilitada.
- O erro de referência indefinida na prévia de perda foi eliminado. Agora a prévia mostra quantidade física, tamanho da bebida, baixa e custo estimado.
- Para itens de estoque unitário, quantidades fracionárias são bloqueadas (meia garrafa aberta e descartada deve ser registrada como **uma garrafa** se o recipiente inteiro sai do estoque; líquidos a granel podem ser cadastrados em ml/L).
- O cálculo de custo de bebidas com cadastro antigo sem `measureUnit` usa corretamente unidade, em vez de interpretar gramas; o histórico de baixas grava a unidade correta.
- Regressão em `test_losses.js`: troca entre alimentos sólidos, líquidos, embalagens e bebidas; água mineral 500 ml sem campo `measureUnit`; baixa de 1 garrafa e prejuízo proporcional; bloqueio para kg e frações em bebidas; categoria vazia; histórico e movimentações.


## Banco V2 de teste — 16/11/2026

O aplicativo autenticado inicia contas no armazenamento V2 (`users/{uid}/appState/v2` e `users/{uid}/records/*`), mantendo o documento legado `appState/main` inalterado. Por autorização expressa do proprietário, **pedidos, receitas e estoque antigos das contas de teste não são migrados**: a V2 começa vazia para essas contas.

Pedidos e inventário são salvos juntos em transações com controle de concorrência, que bloqueia uma sessão cujo saldo ficou desatualizado. A atualização remota pode requerer releitura de registros; esse desenho é adequado para piloto e precisa de otimização antes de uma grande base pagante.

Regra importante: confira a mensagem de sincronização após lançar pedidos, iniciar produção ou ajustar estoque. Se houver conflito, não continue operando em mais de um aparelho; exporte o backup local e atualize a sessão.

As regras de segurança V2 foram compiladas e publicadas em 16/11/2026. O custo foi mantido na camada gratuita, sem ativação de Firebase Storage ou Cloud Functions. A galeria permanece local. Testes automatizados simulam concorrência, mas **não substituem validação com dois navegadores Google reais**.

A auditoria detalhada e os itens ainda pendentes estão em `AUDIT_PROGRESS.md`.

## Franquias: estoque inicial e Lista de Compras (16/11/2026)

Ao sincronizar o catálogo da franquia pela primeira vez, a unidade inicia com quantidades calculadas para **5 porções de cada sabor oficial ativo**, considerando rendimentos das receitas, e **10 unidades de cada bebida** cadastrada (os modelos atuais incluem 11 tipos). Os valores são demonstrativos; **não correspondem a compras reais nem comprovam posse física**. Conferir o estoque antes de vender.

A inicialização ocorre uma única vez por universo comercial, preservando alterações e vendas posteriores. Novas receitas publicadas pela matriz não geram estoque novo automaticamente: o que faltar aparece na lista.

Para contas com franquia ativa, o botão fixo **Lista de Compras** acompanha a navegação no celular e no desktop. Ele compara o saldo livre (já subtraindo reservas de pedidos) com a meta de cada ingrediente e bebida, lista quanto comprar e oferece atalho para registrar a compra. Conta FREE comum não vê o botão.

## Preços de referência da franquia e custos simulados a 40% (16/11/2026)

Esta é uma tabela **DE TESTE**, com preços sugeridos para venda direta (sem entrega). Foi escolhida considerando referências públicas de batatas recheadas em Santa Catarina; não comprova preços praticados em Balneário Gaivota nem garante lucro real.

| Sabor | Venda de teste | Custo direto simulado (40%) |
|---|---:|---:|
| Frango Cremoso | R$ 29,90 | R$ 11,96 |
| Calabresa Acebolada | R$ 29,90 | R$ 11,96 |
| Bacon & 3 Queijos | R$ 34,90 | R$ 13,96 |
| Bolonhesa da Casa | R$ 32,90 | R$ 13,16 |
| Strogonoff de Frango | R$ 33,90 | R$ 13,56 |
| Strogonoff de Carne | R$ 37,90 | R$ 15,16 |
| Carne de Panela | R$ 37,90 | R$ 15,16 |
| Carne Seca & Requeijão | R$ 39,90 | R$ 15,96 |
| Costela BBQ | R$ 39,90 | R$ 15,96 |
| Quatro Queijos | R$ 35,90 | R$ 14,36 |
| Brócolis Cremoso | R$ 28,90 | R$ 11,56 |
| Palmito Gratinado | R$ 35,90 | R$ 14,36 |
| Milho & Bacon | R$ 29,90 | R$ 11,96 |
| Frango & Cheddar | R$ 31,90 | R$ 12,76 |
| Portuguesa | R$ 30,90 | R$ 12,36 |
| Camarão Cremoso | R$ 44,90 | R$ 17,96 |
| Frango BBQ | R$ 31,90 | R$ 12,76 |
| Linguiça Blumenau | R$ 34,90 | R$ 13,96 |
| Vegetariana da Horta | R$ 29,90 | R$ 11,96 |
| Frango ao Molho Rosé | R$ 32,90 | R$ 13,16 |
| Cachorro-Quente | R$ 27,90 | R$ 11,16 |
| Pizza | R$ 28,90 | R$ 11,56 |
| Ninho com Nutella | R$ 21,90 | R$ 8,76 |
| Brigadeiro | R$ 18,90 | R$ 7,56 |
| Chocolate Preto com Morango | R$ 20,90 | R$ 8,36 |
| Chocolate Branco com Morango | R$ 20,90 | R$ 8,36 |

Os 41 ingredientes que ainda não tinham custos recebem preços unitários aproximados, distribuídos usando as proporções da ficha de teste. As 11 bebidas mantêm seus preços-modelo (R$ 4,00 a R$ 10,00) e recebem custo simulado de 40%. Nada é registrado como compra real, nem altera o estoque físico.

**Regra de integridade financeira:** o custo de preparo por unidade é ancorado ao preço de referência; descontos, cupons e mudanças no preço cobrado **não reduzem o custo da batata ou das bebidas**. A simulação de preço no marketplace leva em conta a taxa maior da plataforma. Custos e preços reais lançados manualmente ou por compras posteriores prevalecem sobre valores fictícios.

Contas de franquia que já receberam a tabela estimada antiga de 60% são convertidas para 40% somente quando os valores ainda estiverem marcados como simulação e não tiverem sido alterados manualmente. Os registros históricos de vendas não são reescritos.

A margem de contribuição simulada no canal direto é próxima de 52% após os 40% de custo direto e 8% de taxas/impostos padrão do laboratório, **antes** de despesas fixas, mão de obra adicional, frete, perdas e impostos efetivos. Não confundir com lucro líquido. Cadastre custos reais antes de usar os preços em operação comercial.
