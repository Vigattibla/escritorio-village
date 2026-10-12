# Grava a chave do Gemini como secret da função relatorio-ia no Supabase.
# A chave é pedida escondida e não fica salva em arquivo nem no histórico do terminal.
$ref = 'dfqcdyjovwncpvdwvioo'
$seg = Read-Host 'Cole a chave do Gemini (não aparece na tela)' -AsSecureString
$k = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($seg))
if (-not $k.Trim()) { Write-Host 'Nenhuma chave colada.'; exit 1 }
$tmp = New-TemporaryFile
try {
  Set-Content -Path $tmp -Value "GEMINI_API_KEY=$($k.Trim())" -NoNewline -Encoding ascii
  npx --yes supabase secrets set --env-file $tmp --project-ref $ref
  if ($LASTEXITCODE -ne 0) { Write-Host 'Falhou. Rode "npx supabase login" e tente de novo.'; exit 1 }
  Write-Host 'Chave gravada no Supabase.'
} finally {
  Remove-Item $tmp -Force
  $k = $null
}
