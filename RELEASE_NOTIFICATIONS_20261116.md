# Hub com logos oficiais, sininho e comunicados ADM — 16/11/2026

## Escopo aprovado
- Cards do Hub de Delivery com 12 ícones de identidade obtidos em sites e domínios das próprias marcas, apresentados com nome, status **não conectado**, link oficial de documentação e sem sugerir parceria/homologação.
- Sininho global após autenticação Google em todas as telas, contador até 99+, animação suave somente com notificações não lidas, opções de marcar individualmente/todas e abrir o Hub.
- A fonte "pedidos" se limita a pedidos externos **realmente importados** no Hub da própria conta, nunca a pedidos simulados ou webhook não autenticado; importações não causam baixas ou vendas.
- Fonte de comunicados: coleção global `announcements`, observada via Firestore `onSnapshot` por conta autenticada. O conteúdo só é publicado ou desativado pelo ADM Google verificado `pixmcp@gmail.com`, protegido por regras de segurança no servidor.
- Central ADM: título, texto, tipo (informação/promoção/urgência), link HTTPS opcional, data de validade opcional, confirmação prévia, histórico, desativação. Nenhuma mensagem de marketing é enviada automaticamente.
- Estado de leitura de notificações fica no V2 `state.data.notificationCenter` da conta Google; não compartilha entre e-mails; a fila de pedidos permanece no `state.data.deliveryHub`.
- Nenhuma mudança destrutiva, não apaga receitas, estoque, vendas ou clientes. Não solicita chaves de APIs de delivery, não ativa Cloud Functions ou serviços pagos.
- Mensagens em tempo real funcionam **enquanto o app está aberto e autenticado**. Não são push de dispositivo ou notificações do Android com app fechado, e os parceiros de delivery ainda não são conectados automaticamente.

## Fontes de ícones e proveniência
Ícones foram obtidos como favicons ou ícones de aplicativo disponibilizados em URLs ligadas aos domínios oficiais das marcas; são usados exclusivamente para identificação no Hub. Titularidade dos logotipos permanece com cada marca. O Hub exibe aviso de que não implica parceria.

- Mais Delivery: `https://origin-web.maisdeliveryweb.com.br/h/img/favicon.png`
- iFood: ícone de favicon do domínio `www.ifood.com.br` via Google favicon service; não é material de marca licenciado à plataforma
- 99Food: `https://img0.didiglobal.com/static/gstar/img/44jNTMtjaN1545446385429.ico` encontrado por `https://www.99food.com/`
- aiqfome: `https://aiqfome.com/favicon.ico`
- Rappi: `https://www.rappi.com.br/pwa-icons/192x192.png`
- Delivery Much: `https://www.deliverymuch.com.br/favicon.ico`
- Goomer: `https://goomer.com.br/front-assets/v2/images/favicon/apple-touch-icon.png`
- Delivery Direto: `https://site.deliverydireto.com.br/favicon.png`
- Cardapio.ai: `https://cardapio.ai/cardapio.ai/img/favicon/apple-touch-icon.png`
- OlaClick: `https://olaclick.com/icon.png`
- BeeFood: `https://beefood.com.br/wp-content/uploads/2022/05/cropped-Favicon-192x192.png`
- Keeta (delivery oficial Meituan): `https://img-ap-hongkong.mykeeta.net/sailorfempcpublic/favicon.ico` encontrado em `https://www.keeta-global.com/BR/pt-BR`, não confundir com site brasileiro de pets.

## Regras de acesso
- Firestore `announcements/{id}`: leitura somente com conta Google verificada, criação apenas pelo ADM, imutável exceto desativação pelo ADM, nenhuma exclusão permitida.
- Conteúdo destinado a todas as contas: não há comunicações segmentadas nem dados pessoais nos comunicados.
- O cliente não pode enviar comunicados por conta própria nem definir um remetente privilegiado.
- O sininho não faz polling de API de terceiros e não contém credenciais.

## Validação/rollback
- Backup somente leitura: `C:\Users\LIVRESOM\Documents\PoteBatataBackups\firestore-emergency-2026-11-16T23-34-31-366Z.json` SHA256 `21f215ec2fcc0fe68ed5ea05a568c2665d334de5229dd001a6bf894c08b0a6d6`.
- Testes: `test_notification_core.mjs`, `test_notifications_ui.mjs`, `test_admin_broadcast_ui.mjs`, `test_notification_integration.js`, `test_hub_official_logos.js`, além de toda a suíte.
- Reverter apenas o commit de código se necessário; preserve o conteúdo da coleção global `announcements` e os dados de cada conta. Regras do Firestore podem ser restauradas separadamente via arquivo anterior, sem migração de dados.
