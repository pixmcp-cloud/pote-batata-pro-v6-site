# V3 — Estoque por cozinha, Catálogo de Insumos e Central Motoboy

Data: 16/11/2026. Ramificação: `feature/shared-kitchen-motoboy-20261116`.

## Mudanças
- A Central de Operações apresenta **Fornecedores & Compras** como card único: agenda de fornecedores, busca GPS e Radar de Preços permanecem disponíveis dentro dele. O card liberado foi substituído por **MOTOBOY** (ícone ilustrado no mesmo layout).
- Central Motoboy por conta: nome, celular/WhatsApp, chave PIX, observações, viagens agrupando pedidos de quaisquer universos, distância real ou só ida+volta, modelos fixo por entrega, por km, diária ou híbrido; demonstrativo de valores devidos/pagos; acerto somente informativo. O módulo não efetua Pix.
- Estoque por cozinha privado da conta Google: modo compartilhado ou separado; não há compartilhamento de saldo entre UIDs distintos. Ingredientes equivalentes são reconhecidos por nome normalizado e mesma unidade de medida.
- Novas contas começam compartilhadas com **saldo físico zero**. Contas V2 existentes sem configuração de cozinha permanecem separadas até que o titular solicite a união. Para habilitar, o sistema bloqueia conflitos com dois ou mais saldos positivos do mesmo ingrediente. Não soma quantidades automaticamente.
- A volta ao modo separado é bloqueada quando a cozinha tem saldo positivo, para não duplicar estoque por ramo. O operador deve reconciliar as quantidades previamente.
- Catálogo mestre de ingredientes: seleção múltipla, importação sem preços/quantidades inventados, simulação de uma unidade sem movimentar estoque real. FREE: uma importação por conta; limites operacionais para universos extras passam a valer no conjunto desses ramos.
- Dados comerciais e históricos de pedidos continuam separados por universo, inclusive quando o estoque físico é compartilhado.

## Validação
- Backup Firestore por leitura com SHA-256 verificado antes das mudanças.
- 57 testes automatizados locais aprovados antes da publicação.
- Testes específicos confirmam estoque de múltiplos universos, bloqueio de duplicidade, viagens com múltiplos pedidos, taxas diferentes, rateio financeiro único e limites FREE.
- Não há migração destrutiva ou ativação de APIs pagas.

## Limitações
- A associação automática de estoque utiliza **nome normalizado + unidade iguais**. Insumos com nomes distintos mas fisicamente equivalentes não são unidos automaticamente; revisá-los na conciliação.
- Distâncias de motoboy são informadas manualmente; não há custo de APIs de roteamento.
- Acertos e chaves PIX servem ao controle do operador; nenhum valor é transferido automaticamente.
- Na homologação inicial, confirmar no navegador autenticado os componentes, o carregamento dos módulos e os dados reais.

## Rollback
Reverter o commit de funcionalidade no GitHub para restaurar a interface anterior, **sem apagar registros do Firebase**. Caso tenha havido uso real do novo módulo, preservar backup e os dados atuais antes de qualquer rollback. Nunca substituir todo o estado de conta por snapshots antigos.
