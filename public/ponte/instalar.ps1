# Liga a IA do Escritorio Village neste PC (rode no PowerShell da propria pessoa):
#   irm https://vigattibla.github.io/escritorio-village/ponte/instalar.ps1 | iex
# Usa o Claude Code ja logado neste PC e entra no Escritorio com o usuario da pessoa.
$ErrorActionPreference = 'Stop'
$base = if ($env:EV_BASE) { $env:EV_BASE } else { 'https://vigattibla.github.io/escritorio-village/ponte/' }
$casa = Join-Path $env:LOCALAPPDATA 'EscritorioVillage'
$dir = Join-Path $casa 'ponte'

Write-Host '== IA do Escritorio Village ==' -ForegroundColor Cyan
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node -or [int]((node -v) -replace '^v(\d+).*', '$1') -lt 18) {
  Write-Host 'Falta o Node.js (18 ou mais novo). Instale com:' -ForegroundColor Red
  Write-Host '  winget install OpenJS.NodeJS.LTS'
  Write-Host 'Feche e abra o PowerShell e rode este comando de novo.'
  return
}

Write-Host '1/4 Baixando a ponte...'
New-Item -ItemType Directory -Force $dir | Out-Null
foreach ($f in 'ia.mjs', 'distribuidor.md', 'iniciar.ps1', 'config.json') {
  Invoke-WebRequest -UseBasicParsing ($base + $f) -OutFile (Join-Path $dir $f)
}

Write-Host '2/4 Procurando o Claude Code...'
$claude = node (Join-Path $dir 'ia.mjs') --onde-claude
if ($LASTEXITCODE -ne 0) {
  Write-Host 'Claude Code nao encontrado. Instale e entre com a sua conta Claude:' -ForegroundColor Red
  Write-Host '  irm https://claude.ai/install.ps1 | iex'
  Write-Host '  claude        (faca o login e feche)'
  Write-Host 'Depois rode este comando de novo.'
  return
}
Write-Host "    $claude"

Write-Host '3/4 Entrar com o seu usuario do Escritorio'
$env:EV_LOGIN = Read-Host '    Usuario'
$sec = Read-Host '    Senha' -AsSecureString
$env:EV_SENHA = [Runtime.InteropServices.Marshal]::PtrToStringBSTR([Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec))
node (Join-Path $dir 'ia.mjs') --entrar
$ok = $LASTEXITCODE -eq 0
Remove-Item Env:EV_LOGIN, Env:EV_SENHA -ErrorAction SilentlyContinue
if (-not $ok) { Write-Host 'Rode o comando de novo e confira usuario e senha.' -ForegroundColor Red; return }

Write-Host '4/4 Ligando (e deixando ligar sozinha quando o Windows iniciar)...'
Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*EscritorioVillage*ponte*' -and $_.ProcessId -ne $PID } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
$ps = Join-Path $env:WINDIR 'System32\WindowsPowerShell\v1.0\powershell.exe'
$argsPonte = '-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "' + (Join-Path $dir 'iniciar.ps1') + '"'
$lnk = (New-Object -ComObject WScript.Shell).CreateShortcut((Join-Path ([Environment]::GetFolderPath('Startup')) 'Escritorio Village IA.lnk'))
$lnk.TargetPath = $ps; $lnk.Arguments = $argsPonte; $lnk.WorkingDirectory = $dir; $lnk.WindowStyle = 7; $lnk.Save()
Start-Process $ps -ArgumentList $argsPonte -WindowStyle Hidden

Write-Host ''
Write-Host 'Pronto! Em ate 30 s o Escritorio mostra "IA online".' -ForegroundColor Green
Write-Host 'Para desligar: apague o atalho "Escritorio Village IA" da Inicializacao (Win+R, shell:startup).'
