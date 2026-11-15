# Integração Firebase do Potê Batata Pro

**Projeto:** PotoBatata — `potobatata-b71f3`
**Conta CLI autorizada:** `pixmcp@gmail.com`

## Confirmado e executado
- Firebase Web App criado: `Pote Batata Pro Web`.
- Firebase Authentication configurado via `firebase deploy --only auth` e provedor `google.com` verificado como habilitado.
- Domínios de autenticação: `potobatata-b71f3.firebaseapp.com`, `potobatata-b71f3.web.app`, `pixmcp-cloud.github.io`.
- Banco Firestore `(default)` criado na região `southamerica-east1` (São Paulo), Standard, `freeTier: true`, proteção contra exclusão ativa, PITR desativado.
- Regras Firestore implantadas com sucesso. Usuário verificado Google acessa apenas `users/{uid}` e suas subcoleções; a conta ADM `pixmcp@gmail.com` tem acesso administrativo por regras do servidor.
- Página `beta.html` gerada com login Google e sincronização de estado por usuário via `users/{uid}/appState/main`.
- A demonstração `index.html` foi preservada.

## Antes de migrar para produção
1. Testar em navegador real o login de `pixmcp@gmail.com`, conferir o painel ADM e gravar dados.
2. Testar uma conta Google diferente: FREE, sem leitura nem modificação dos dados de outra conta.
3. Fazer testes de sincronização entre dois dispositivos e backup/restauração.
4. Separar dados fictícios (seed V6) dos registros reais; preparar migração manual de backup antigo.
5. Implementar cobranças e plano PRO no servidor, com papéis/limites invioláveis pelo cliente.
6. Configurar `batata.livresom.com` após a validação do fluxo de autenticação.

**Nota de economia:** o Firestore confirmou `freeTier: true`; os recursos pagos não foram ativados. O Firebase limita o uso gratuito conforme as cotas do plano.
