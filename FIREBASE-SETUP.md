# Potê Batata Pro — configuração do Firebase
Projeto **Firebase real confirmado por imagem do Console**: `potobatata-b71f3`, nome exibido `PotoBatata`.
Conta CLI atualmente autenticada: `pixmcp@gmail.com`.

## Bloqueio de acesso
O comando `firebase projects:list --json` retorna lista vazia, e `firebase apps:list --project potobatata-b71f3 --json` recebe HTTP 403 PERMISSION_DENIED.
A conta proprietária do projeto no console deve conferir **Configurações do projeto > Usuários e permissões** e conceder acesso a `pixmcp@gmail.com` (papel Firebase Admin ou proprietário, conforme necessário).
Mudanças IAM podem levar alguns minutos.

## Preparação local, ainda não implantada
- `.firebaserc` vincula o repositório ao projeto real `potobatata-b71f3`.
- `firebase.json` aponta para `firestore.rules`; não configura provedores de autenticação.
- `firestore.rules` isola dados por UID e reconhece como ADM o usuário verificado via Google com e-mail `pixmcp@gmail.com`.

## Depois de conceder acesso
1. Testar `firebase projects:list` e `firebase apps:list --project potobatata-b71f3`.
2. Ativar Authentication > Provedores de login > Google no Console, cadastrar `contato@livresom.com` como suporte conforme opções disponíveis.
3. Criar Firestore na localização adequada no plano gratuito e implantar as regras restritivas.
4. Registrar aplicação Web, obter firebaseConfig (configuração pública), definir domínio de autenticação autorizado.
5. Substituir a demonstração por um fluxo real de login Google e operações reais no Firestore.
6. Testar isolamento de dados e ADM antes de atualizar produção.

O site público permanece no modo demonstração FREE e não é um sistema com login real.
