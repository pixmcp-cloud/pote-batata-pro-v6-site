param(
  [Parameter(Mandatory=$true)][string]$KeyFile
)
$ErrorActionPreference = 'Stop'
$workerDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$resolved = (Resolve-Path -LiteralPath $KeyFile).Path
if ([IO.Path]::GetExtension($resolved) -ne '.json') { throw 'Expected a Google service-account JSON file' }
$k = Get-Content -LiteralPath $resolved -Raw -Encoding UTF8 | ConvertFrom-Json
$expected = 'pote-batata-worker-qa@pote-batata-qa-worker.iam.gserviceaccount.com'
if ($k.type -ne 'service_account' -or $k.project_id -ne 'pote-batata-qa-worker' -or $k.client_email -ne $expected -or
    !$k.private_key.StartsWith('-----BEGIN PRIVATE KEY-----')) {
  throw 'Service account identity does not match the isolated QA project; no secrets uploaded'
}
function Set-WorkerSecret([string]$name,[string]$value) {
  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = 'cmd.exe'
  $psi.Arguments = "/d /s /c npx.cmd wrangler secret put $name --config wrangler.qa.toml"
  $psi.WorkingDirectory = $workerDir
  $psi.UseShellExecute = $false
  $psi.RedirectStandardInput = $true
  $psi.RedirectStandardOutput = $true
  $psi.RedirectStandardError = $true
  $psi.CreateNoWindow = $true
  $p = [System.Diagnostics.Process]::Start($psi)
  try {
    $p.StandardInput.WriteLine($value)
    $p.StandardInput.Close()
    $out = $p.StandardOutput.ReadToEnd()
    $err = $p.StandardError.ReadToEnd()
    $p.WaitForExit()
    if ($p.ExitCode -ne 0) { throw "Secret $name failed: $err" }
    Write-Output "Secret $name configured for isolated QA Worker"
  } finally { $p.Dispose() }
}
Set-WorkerSecret 'GCP_CLIENT_EMAIL' $k.client_email
Set-WorkerSecret 'GCP_PRIVATE_KEY' $k.private_key
Write-Output 'QA Worker secrets configured. Review/remove downloaded JSON key file securely.'
