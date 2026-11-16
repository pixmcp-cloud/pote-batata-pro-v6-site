# Auditoria e implementação — Potê Batata Pro, 16/11/2026

## Proteção e ponto de recuperação
- Código V1 preservado na tag GitHub `before-audit-20261116` (commit `181557c`).
- Bundle Git validado: `../pote-batata-before-audit-20261116.bundle`, na máquina autorizada.
- Firestore: projeto `potobatata-b71f3`, região `southamerica-east1`, camada gratuita na última consulta.
- O usuário confirmou explicitamente que contas e registros anteriores eram **apenas de teste e descartáveis**.
- A V2 cria um novo banco lógico `users/{uid}/appState/v2` e documentos `users/{uid}/records/{key}`.
- **V1 não foi apagado**: `users/{uid}/appState/main` permanece para recuperação técnica; a V2 inicia contas de teste vazias.
- As regras adicionais `/users/{uid}/records/{key}` foram compiladas e publicadas no Firebase. Regras de produção não foram testadas no Emulator Suite (Java indisponível).
- Nenhum Cloud Storage pago, Cloud Function ou outro recurso faturável foi habilitado.

## Arquitetura V2
- `v2_store_core.mjs`: normaliza registros por tipo de negócio e entidade e reconstrói estado em memória.
- `v2_storage.mjs`: grava somente entidades alteradas em transação, preserva alterações independentes e compara revisões.
- `appState/v2InventoryGuard`: protege transações sensíveis de pedidos, ingredientes, bebidas, compras, perdas e movimentações. Se dois dispositivos editarem em paralelo, um deve sincronizar novamente antes de prosseguir.
- `appState/v2Pulse`: avisa outros dispositivos. Limitação: atualmente a atualização remota relê a coleção para garantir consistência; otimizar leituras antes de muitos usuários.
- `firebase_integration.js`: usa V2 por padrão; fluxo V1 permanece isolado para recuperação técnica. Sincronização pendente oferece backup JSON por UID e bloqueia operações críticas.
- Os dados só são considerados persistidos quando a transação retorna sucesso. A interface ainda é otimista durante o tempo da requisição; conferir o status de sincronização.
- A sincronização real com múltiplos dispositivos e autenticação Google ainda exige teste de campo. Os testes automatizados usam Firebase simulado.

## Correções funcionais
- `finance_core.js`: custo unitário, cálculo de taxas, preço sugerido, lucro e contribuição centralizados.
- `stock_math.js`: custo médio ponderado conhecido e custo de reposição da última compra separados; não inventa custo médio sem histórico.
- `pricing_explainer.js`: seletor de critério de custo, contribuição antes de despesas fixas e lucro estimado depois do rateio.
- `garimpo.js`: preço de clube separado do preço aberto; validade verificada antes da condição, cache temporário de mercados, requisições limitadas, menor repetição de GPS e limpeza de localização ao trocar de conta.
- `source/pote_app_base.html`: fluxo único de cancelamento, bloqueio por falha de sincronização e datas comerciais locais.
- `module_health.js`: verifica os módulos essenciais após login e bloqueia operações se algum deles não carregar.
- Importação e redefinição de dados possuem validação, confirmações e exportação prévia.

## Matriz honesta das 23 melhorias
| Nº | Situação |
|---|---|
| 01 | **Implementado na V2; validação com dois dispositivos reais pendente** |
| 02 | **Gravação atômica em transações V2**; interface ainda otimista até confirmação |
| 03 | **Concluído**: entidades em documentos próprios, sem apagar legado |
| 04 | **Proteção local e backup JSON implementados**; sem backup gerenciado do Firestore |
| 05 | **Motor de cálculo centralizado** nas rotas principais; auditoria de relatórios ainda necessária |
| 06 | **Cancelamento unificado e transação V2**; outras rotinas internas ainda compartilham lógica legada |
| 07 | **Concluído no armazenamento V2**: registros por universo sem duplicação em documento |
| 08 | **Parcial**: custos/precificação unificados; outras funções utilitárias ainda repetidas |
| 09 | **Parcial**: módulos V2 e financeiro extraídos; HTML principal ainda é monolítico |
| 10 | **Concluído**: verificador de dependências operacionais |
| 11 | **Parcial**: não salva em navegação sem alteração; renderização global permanece |
| 12 | **Concluído**: cache efêmero e pesquisas externas em pares |
| 13 | **Concluído**: preços de clube e ofertas vencidas separados corretamente |
| 14 | **Parcial**: fontes manuais identificadas; validação automática da página externa indisponível |
| 15 | **Regras V2 publicadas e compiladas**; testes em emulador pendentes |
| 16 | **Pendente**: ativos exclusivos permanecem acessíveis por URLs públicas; precisa Storage protegido |
| 17 | **Mantido desativado**: galeria Cloud Storage exige infraestrutura e aprovação de custos |
| 18 | **Média ponderada e reposição concluídas**; custeio FIFO por lote não implementado |
| 19 | **Concluído**: datas comerciais por fuso |
| 20 | **Concluído para backup JSON atual**: validação, confirmação e prevenção de conflito |
| 21 | **Parcial**: simulação isolada de dados, mas arquivos legados ainda no HTML-base |
| 22 | **Suspensa expansão secundária**; funcionalidades existentes mantidas para não quebrar o uso |
| 23 | **Parcial**: interface Radar de Preço; IDs internos preservados por compatibilidade |

## Limitações para comercialização ampla
1. Provar o funcionamento com autenticação Google em dois dispositivos físicos, incluindo conflito e reconexão.
2. Validar regras no Emulator Suite e impor limites FREE/PRO de forma não burlável no servidor antes de cobrar.
3. Implementar dados realmente privados em Storage autorizado; não ativar serviço pago sem orçamento e autorização.
4. Otimizar reconsulta V2 da coleção em clientes com muitos pedidos e confirmar despesas do Firestore.
5. Completar modularização do HTML, remoção de código legado e verificação de relatórios.
6. As imagens da galeria que existem somente no dispositivo não migram entre aparelhos.

## Testes e publicação
- Execução local em 16/11/2026: conjunto de testes `test_*.js`/`test_*.mjs`, sem falhas na última bateria (ver GitHub Actions para CI).
- `firebase deploy --only firestore:rules --project potobatata-b71f3`: regras publicadas com sucesso.
- Nenhum dado Firestore de contas foi apagado pela execução; a primeira entrada na V2 usa novo espaço lógico vazio.
- Retornar o site para a tag V1 não recupera automaticamente dados criados na V2.
