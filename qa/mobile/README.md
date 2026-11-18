# Laboratório de celulares — Potê Batata Pro

A matriz emula **Chrome Android** (320, 360, 375, 390, 430 px, paisagem 844 px), tablet 768 px e desktop 1366 px, com tela sensível ao toque, DPR, arquivo de backup, PDV Pix/cartão/dinheiro, modo offline e gráficos de franquias. Não utiliza contas reais nem gera lançamentos no Firebase de produção.

**Executar no Windows (repo):** `python build_hosting.py`, depois `node qa/mobile/test_mobile_matrix.cjs` e `node qa/mobile/test_franchise_mobile.cjs`. O script `qa/mobile/run_everything.ps1` também aciona os testes existentes e os dois modos do Firebase Emulator. Chrome e Puppeteer são encontrados automaticamente; no CI use `npm ci --prefix qa/mobile --ignore-scripts`.

**CI:** executado automaticamente em cada push para `main`, antes de publicar a página. Os testes falham de forma bloqueante; resultados e capturas locais ficam em `qa/mobile/artifacts/` (não versionados).

**Limite técnico:** emulação de navegador não substitui Android OS, teclado IME, notificações nativas, drivers Bluetooth, APK nem medição real de bateria. O PC Windows não tem system image do Android SDK e reporta virtualização de hardware desabilitada. Para Android completo, habilitar VT-x/AMD-V no firmware e instalar system image/AVD; não ativamos serviços pagos. O Firebase Emulator testa autenticação simulada, concorrência e regras sem tocar produção.
