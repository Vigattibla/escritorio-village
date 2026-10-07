# Liga a ponte da IA do Gerente (deixe esta janela aberta; fechar = IA offline)
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
if (-not (Test-Path '.env.local')) {
  Write-Host 'Falta ponte/.env.local (copie de .env.example e cole a service_role do Supabase).' -ForegroundColor Red
  exit 1
}
while ($true) {
  node ia.mjs
  Write-Host 'Ponte caiu; religando em 5 s…' -ForegroundColor Yellow
  Start-Sleep -Seconds 5
}
