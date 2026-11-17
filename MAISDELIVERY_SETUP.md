# MaisDelivery no Potê Batata Pro — homologação econômica

Implementação inicial **somente sandbox**. Sem parceiros revendedores, assinaturas, token de produção ou alterações no estoque/financeiro local. Usa a API pública do MaisDelivery.

## Dados informados pela documentação
- Endpoint: `https://maisdeliveryapp.com.br/oapi/v2/controller/operacao_oapi_v2_publica.php`
- Empresa integrada no exemplo: `563`
- Origem: `11`; restaurante sandbox: `50451`
- Operação `9`: enviar produtos com nome/categoria/descrição/preço/estoque/ativo.
- Operação `10`: ativar/desativar item pelo `idCardapio`.
- Sempre `sandBox: true`. Não utilizar os dados de produção nesse painel.

## Por que existe o adaptador PHP?
Uma chamada CORS OPTIONS do origin do GitHub Pages, feita em 16/11/2026, recebeu HTTP 401 sem cabeçalhos Access-Control-Allow-Origin. Um site estático não consegue contornar essa restrição com JavaScript ou com mais permissões do usuário.

O arquivo `server/maisdelivery_proxy.php` é o menor adaptador possível para **sua própria hospedagem PHP existente**, sem adquirir uma API paga. Ele encaminha somente as operações `9` e `10` ao sandbox oficial, não persiste nem registra credenciais.

## Implantação sem servidor adicional
1. Usando a hospedagem que já mantém `livresom.com`, enviar `server/maisdelivery_proxy.php` a uma pasta PHP pública do domínio (por exemplo `public_html/api/maisdelivery_proxy.php`). O GitHub Pages **não executa PHP**.
2. Confirmar que a URL resultante abre em HTTPS. O script só permite POST (e OPTIONS para navegador). Não ativar outros tipos de operações.
3. Na conta administrativa do Potê Batata Pro, abrir **Hub de Delivery → MaisDelivery · API de teste** e preencher a URL do PHP.
4. Pegar no seu painel MaisDelivery o **Basic Auth** e o **Accesstoken de teste**. Digitar diretamente na tela; não colocar no código público. Revogar/renovar credenciais que tenham sido expostas em capturas.
5. Enviar um produto fictício pela operação 9; validar a resposta e guardar o `idCardapio` retornado, se houver.
6. Testar ativação/desativação pela operação 10 usando o ID devolvido pelo ambiente de testes.

Os campos de autenticação ficam apenas na interface temporariamente, não no Firestore, GitHub nem localStorage. Apenas a URL do adaptador é salva em sessionStorage. Reentrar credenciais após voltar à tela é comportamento esperado.

## Limitações
- Não há integração de pedidos, baixa automática de insumos, catálogo sincronizado nem mudança automática de status; exigem documentação específica dessas operações.
- Não fizemos nenhuma chamada de escrita à API, por falta de credenciais de sandbox seguras configuradas em uma hospedagem PHP.
- A extensão PHP cURL é necessária. `php -l server/maisdelivery_proxy.php` deve passar em ambiente com PHP instalado; o PC de desenvolvimento não dispõe do comando PHP.
- O painel é exclusivo da conta ADM. A API não é exibida para usuários FREE/PRO.
- A resposta de operação `10` não foi homologada; a relação 1/0 é baseada no exemplo fornecido.
