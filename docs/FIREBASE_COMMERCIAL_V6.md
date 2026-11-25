# PDV MULTIVERSAL — preparação Firebase V6
## Estado comprovado
- Worker de homologação checkout: versão 83ae4e6c-3de8-43b1-9964-d9e99c72b1e1; run 45606213409 aprovado, 16 rotas 423, CORS e flags fechadas.
- Run 45605647135: ciclo sintético HTTP/Firestore aprovado.
- Credenciais novas do serviço não disponíveis; não confundir OAuth Google do cliente com autorização IAM do servidor.
- A identidade antiga pote-batata-f05-worker não será reutilizada nem alterada. O projeto legado Firebase potobatata-b71f3 é identificador técnico, não marca comercial.
## Aprovação humana necessária
1. Acessar https://console.cloud.google.com/iam-admin/serviceaccounts?project=potobatata-b71f3 com conta autorizada. Confirmar projeto e plano, sem ativar faturamento.
2. Criar identidade dedicada multiversal-checkout. Não usar Owner, Editor, Firebase Admin nem a identidade antiga F05. Para operações transacionais, avaliar Cloud Datastore User (roles/datastore.user) com escopo mínimo viável; essa função autoriza dados do banco e não é limitada a uma coleção pelas regras Firebase. Preferir IAM condicionado ao banco quando suportado e homologação em projeto isolado antes do acesso comercial. Separar gestão de índices e regras da identidade de execução.
3. Preferir identidade federada/credencial curta quando suportada pela arquitetura. O código atual usa chave de serviço. Se necessária, armazenar diretamente no gerenciador de segredos do Worker dedicado, jamais em chat, Git, HTML, arquivo público ou log. Não gerar chave se a política da organização impedir; não desabilitar a proteção. Validar um mecanismo de credencial seguro antes da ativação.
4. Para diagnóstico automatizado separado, usar uma identidade autorizada de leitura com permissão de metadados e índices (não é necessário dar poder de escrita para verificar os índices); a rotina candidata exige o nome dedicado para não reutilizar contas antigas. Não copiar a chave do Worker para CI sem necessidade; executar o script local em ambiente autorizado, ou adaptar para credenciais federadas em próxima etapa. A saída não revela tokens ou documentos.
5. Conferir cinco índices definidos em firestore.checkout-v6.indexes.json na aba https://console.firebase.google.com/project/potobatata-b71f3/firestore/indexes. Não remover índices existentes. Não executar deploy --force ou importação destrutiva. Estados READY, CREATING, MISSING e UNKNOWN são distintos.
6. Preparar versão jurídica final com identificação do controlador, contato, política de rastreamento e bases legais. Não publicar a minuta.
7. Preparar backup verificável e plano de reversão, contas canário (lojista, cliente, motoboy), regras/índices revisados e homologação física. Só então autorizar ativação limitada.
## Comando de diagnóstico
Na pasta workers/antifraud, com dependências instaladas e variáveis GCP_CLIENT_EMAIL e GCP_PRIVATE_KEY configuradas com segurança, executar node scripts/firebase-commercial-preflight.mjs. O script só realiza GET no Firestore; a obtenção do token OAuth é separada. Sem credenciais, não consulta o banco. Não imprime dados pessoais, credenciais ou texto legal.
## Limites
Não foi realizada alteração IAM, chave, índice, regra, política, conta ou venda real nesta etapa. A conta de serviço e a eventual criação de índices exigem autorização efetiva no Google Cloud. Não há garantia de gratuidade para uso comercial acima das cotas do plano.

## C08 — instalação aditiva pelo administrador
Auditoria real 45613810691: conexão READABLE, cinco índices MISSING e política legal MISSING. O papel de execução datastore.user permite leitura de índices, não criação. Não ampliar IAM do Worker. O script scripts/install-checkout-v6-indexes.sh lista antes de criar, compara nomes/campos/escopo, solicita exclusivamente índices ausentes via gcloud e não altera documentos, regras, faturamento ou índices existentes. --check é somente leitura; --apply exige conta humana autorizada. As operações são assíncronas; confirmar READY pelo diagnóstico real. Comandos oficiais equivalentes (uma vez cada, se ausentes):

```bash
gcloud firestore indexes composite create --project=potobatata-b71f3 --database='(default)' --collection-group=recordsV5 --query-scope=collection --field-config=field-path=record.universe,order=ascending --field-config=field-path=record.group,order=ascending --field-config=field-path=record.id,order=ascending --async
gcloud firestore indexes composite create --project=potobatata-b71f3 --database='(default)' --collection-group=recordsV5 --query-scope=collection --field-config=field-path=record.universe,order=ascending --field-config=field-path=record.group,order=ascending --field-config=field-path=record.item.status,order=ascending --async
gcloud firestore indexes composite create --project=potobatata-b71f3 --database='(default)' --collection-group=recordsV5 --query-scope=collection --field-config=field-path=record.universe,order=ascending --field-config=field-path=record.group,order=ascending --field-config=field-path=record.rank,order=ascending --async
gcloud firestore indexes composite create --project=potobatata-b71f3 --database='(default)' --collection-group=recordsV5 --query-scope=collection --field-config=field-path=record.universe,order=ascending --field-config=field-path=record.group,order=ascending --field-config=field-path=record.item.orderNumber,order=descending --async
gcloud firestore indexes composite create --project=potobatata-b71f3 --database='(default)' --collection-group=publicOrderViews --query-scope=collection --field-config=field-path=buyerUid,order=ascending --field-config=field-path=createdAt,order=descending --async
```

## Gate de homologação comercial
1. Cinco índices READY, diagnóstico OAuth e Firestore aprovados.
2. Política legal publicada somente após revisão e identificação do controlador; confirmar texto e versão.
3. Backup verificável, regras Firestore e índices comparados antes de qualquer deploy; nenhuma remoção.
4. Contas canário de lojista, comprador e entregador distintas, com autorização explícita. Nenhum cliente real até aprovação.
5. Pedido de teste controlado com preço, cotação, estoque, caixa, código, localização e comprovante; cobrança somente simulada.
6. Testar falha de rede, concorrência, cancelamento, GPS, FREE/PRO e revogação. Revisar impressão física e notificações. Não ativar publicamente nem mudar DNS.
