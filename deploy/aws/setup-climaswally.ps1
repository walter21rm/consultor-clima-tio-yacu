param(
  [string]$DuckDnsToken = $env:DUCKDNS_TOKEN,
  [string]$Domain = "climaswally"
)

$ErrorActionPreference = "Stop"
$StatePath = Join-Path $PSScriptRoot "instance-state.json"
$state = Get-Content $StatePath -Raw | ConvertFrom-Json
$ip = $state.elasticIp
if (-not $ip) { $ip = $state.publicIp }

if ($DuckDnsToken) {
  $url = "https://www.duckdns.org/update?domains=$Domain&token=$DuckDnsToken&ip=$ip"
  $result = Invoke-RestMethod -Uri $url
  if ($result -notmatch "OK") { throw "DuckDNS no aceptó la actualización: $result" }
  Write-Host "DuckDNS listo: http://$Domain.duckdns.org -> $ip"
} else {
  Write-Host "Sin DUCKDNS_TOKEN. Crea el dominio $Domain en https://www.duckdns.org"
  Write-Host "Luego ejecuta:"
  Write-Host "  `$env:DUCKDNS_TOKEN='tu_token'; .\deploy\aws\setup-climaswally.ps1"
}

$hosts = "$env:SystemRoot\System32\drivers\etc\hosts"
$line = "$ip`tclimaswally"
$current = Get-Content $hosts -ErrorAction SilentlyContinue
$filtered = $current | Where-Object { $_ -notmatch 'climaswally' }
try {
  ($filtered + $line) | Set-Content -Path $hosts -Encoding ascii
  Write-Host "Hosts local: http://climaswally -> $ip"
} catch {
  Write-Host "No se pudo editar hosts (hace falta Administrador). Agrega a mano:"
  Write-Host "  $line"
}
