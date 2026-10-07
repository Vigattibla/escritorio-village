# Liga a ponte da IA em segundo plano (o atalho na Inicializacao do Windows chama este arquivo).
# Religa se cair; para se o login for perdido (codigo 2). Log em %LOCALAPPDATA%\EscritorioVillage\ponte.log
Set-Location $PSScriptRoot
$log = Join-Path $env:LOCALAPPDATA 'EscritorioVillage\ponte.log'
while ($true) {
  if ((Test-Path $log) -and (Get-Item $log).Length -gt 1MB) { Remove-Item $log -Force }
  node ia.mjs *>> $log
  if ($LASTEXITCODE -eq 2 -or $LASTEXITCODE -eq 3) { break }
  Start-Sleep -Seconds 10
}
