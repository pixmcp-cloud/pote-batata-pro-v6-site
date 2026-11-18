param([switch]$SkipBuild,[switch]$SkipFirebase)
$ErrorActionPreference="Stop"
$repo=(Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
Push-Location $repo
try {
  $env:POTE_QA_CHROME="C:\Program Files\Google\Chrome\Application\chrome.exe"
  $env:JAVA_HOME="C:\Program Files\Android\Android Studio\jbr"
  if(Test-Path "$env:JAVA_HOME\bin"){$env:PATH="$env:JAVA_HOME\bin;$env:PATH"}
  $env:NODE_PATH="C:\Users\LIVRESOM\Documents\GitHub\_POTE_OFFLINE_TEST_TOOLS\node_modules"
  $results=@()
  function Check($name){
    if($LASTEXITCODE -ne 0){throw "$name falhou (exit $LASTEXITCODE). O site não deve ser publicado."}
    Write-Output "PASSO_QA_OK $name"
  }
  if(-not $SkipBuild){
    & python build_hosting.py
    Check "build"
  }
  if(-not (Test-Path "qa\mobile\node_modules\puppeteer-core")){
    & npm.cmd ci --prefix qa/mobile --ignore-scripts --no-audit --no-fund
    Check "npm Puppeteer"
  }
  $nodeTests=@(
    "test_franchise_financial_report.mjs","test_legacy_migration.mjs",
    "test_operation_integrity.mjs","test_inventory_integrity.mjs",
    "test_v2_storage.mjs","test_hardening_concurrent_clients.mjs",
    "test_pdv_auto_sale_completion.mjs","test_cancel_order_audit.js",
    "test_admin_claim_contract.mjs","test_auth_v2_integration.js"
  )
  foreach($test in $nodeTests){
    & node $test
    Check $test
  }
  $browserTests=@(
    "qa/mobile/test_mobile_matrix.cjs","qa/mobile/test_franchise_mobile.cjs",
    "test_hardening_mobile_browser.cjs","test_calc_shopping_browser.cjs",
    "test_pdv_auto_sale_browser.cjs","test_pdv_guided_browser.cjs",
    "test_pdv_visible_browser.cjs","test_bell_browser.cjs",
    "test_creative_browser.cjs","test_notification_inline_browser.cjs"
  )
  foreach($test in $browserTests){
    & node $test
    Check $test
  }
  if(-not $SkipFirebase){
    $refTests="node --test --test-concurrency=1 test_firestore_rules_emulator.cjs test_firestore_stock_nonnegative.cjs test_firestore_f02_atomic_guard.cjs test_firestore_f02_multistock.cjs test_firestore_v2_live_concurrency.cjs test_firestore_v2_backup_restore.cjs test_firestore_cash_event_fields.cjs test_firestore_f10_migration.cjs test_firestore_franchise_report.cjs test_firestore_f06_bulk.cjs"
    $env:POTE_HARDENED_RULES="0"
    & firebase.cmd emulators:exec --only firestore --project demo-pote-hardening --config firebase.emulator.qa.json $refTests
    Check "Firestore Emulator referência"
    $env:POTE_HARDENED_RULES="1"
    & firebase.cmd emulators:exec --only firestore --project demo-pote-hardening --config firebase.hardened.qa.json $refTests
    Check "Firestore Emulator candidato"
  }
  if($SkipFirebase){ Write-Output "QA_LABORATORY_COMPLETED: Chrome, PDV, finanças, backup e sincronização aprovados; Firestore Emulator não executado (-SkipFirebase)." }
  else { Write-Output "QA_LABORATORY_COMPLETED: Chrome, PDV, finanças, backup, sincronização e Firestore Emulator aprovados nas duas configurações." }
} finally {Pop-Location}
