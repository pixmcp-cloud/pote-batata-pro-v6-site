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
