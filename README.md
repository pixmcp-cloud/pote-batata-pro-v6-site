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
