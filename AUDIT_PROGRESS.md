# Execução da auditoria técnica — Potê Batata Pro

Data: 2026-11-16. Este documento acompanha as 23 melhorias aprovadas.

## Ponto de retorno e limites
- Tag imutável do código anterior: `before-audit-20261116` (commit `181557c`).
- Backup offline Git Bundle validado em `../pote-batata-before-audit-20261116.bundle` na máquina de desenvolvimento.
- Firestore real: projeto `potobatata-b71f3`, base padrão na região `southamerica-east1`.
- **Nenhuma migração, exclusão ou exportação de dados de usuários do Firestore foi executada.**
- Um backup de Git não substitui cópia autenticada de clientes, pedidos e estoque no Firestore.
- O modelo V2 segue **somente em prévia**, sem migração de contas nem mudança de regras publicada.

## Implementado na primeira etapa (sujeito aos testes de publicação)
- [01] Bloqueio de sobrescrita concorrente com transação otimista em `firebase_integration.js`, mantendo o documento legado. Implementação inicial; não resolve a atomicidade de operações distintas.
- [04] Backup local pendente por UID, exportação manual completa, aviso de saída e proteção adicional ao reset da conta. **Não substitui backup de produção validado**.
- [13] Condições de clube separadas das datas, comparação aberta separada da condição de fidelidade.
- [19] Datas comerciais calculadas pelo fuso do navegador ou pela configuração explícita da empresa; instantes históricos seguem UTC.
- [03,07] `migration_preview.mjs`: plano V2 **puramente local e somente leitura**, detectando identificadores problemáticos. Migração real bloqueada até existir backup autenticado e restauração testada.
- [20] `sync_guard.mjs`: validador de formato e identificadores para uso futuro; a importação legada ainda não foi migrada para esse validador.

## Pendências antes da fase de transações e coleções V2
1. Fazer backup autenticado dos documentos Firestore de produção e testá-lo em ambiente separado.
2. Definir estratégia de coexistência e exclusão de clientes com versões antigas abertas.
3. Testar regras do Firestore no Emulator Suite e confirmar as regras realmente implantadas.
4. Introduzir coleções independentes, operações idempotentes e transações de estoque no servidor.
5. Medir custo em leituras/gravações e obter aprovação explícita antes de serviços pagos.

## Status consolidado das 23 sugestões
| Nº | Estado |
|---|---|
| 01 | Proteção inicial implementada; testes reais multi-dispositivo pendentes |
| 02 | Pendente: transações de estoque/pedidos |
| 03 | Apenas prévia de particionamento, sem migração |
| 04 | Proteção local e reset mais seguro; backup autenticado Firestore pendente |
| 05 | Pendente: motor financeiro centralizado |
| 06 | Pendente: movimentações de estoque unificadas |
| 07 | Prévia V2; arquivos atuais de universos mantidos |
| 08 | Pendente: utilitários compartilhados completos |
| 09 | Pendente: modularizar HTML monolítico |
| 10 | Pendente: contratos obrigatórios dos módulos |
| 11 | Pendente: separar render de persistência |
| 12 | Pendente: otimização/cache das buscas externas |
| 13 | Implementado: regras de clube e preço aberto |
| 14 | Pendente: verificação automática de evidências |
| 15 | Pendente: validar e implantar regras Firebase |
| 16 | Pendente: migrar ativos privados; arquivos públicos inalterados |
| 17 | Galeria cloud permanece desativada sem custos adicionais |
| 18 | Pendente: custo médio e custeio por lote |
| 19 | Implementado: datas comerciais por fuso |
| 20 | Validador em módulo isolado; integração completa pendente |
| 21 | Pendente: separar legado de demonstração |
| 22 | Novas funcionalidades não essenciais congeladas durante a auditoria |
| 23 | Pendente: padronização interna; URLs e identificadores preservados |

**Regra de segurança:** não habilitar migração V2 nem deletar `appState/main` sem backup real verificado e teste de restauração.
