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
