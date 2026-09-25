$ErrorActionPreference = "Stop"
$StatePath = Join-Path $PSScriptRoot "instance-state.json"
if (-not (Test-Path $StatePath)) { throw "No hay instance-state.json. ¿Ya se desplegó?" }

$state = Get-Content $StatePath -Raw | ConvertFrom-Json
$region = $state.region
$instanceId = $state.instanceId

Write-Host ">>> Terminando $instanceId en $region..."
aws ec2 terminate-instances --region $region --instance-ids $instanceId | Out-Null
aws ec2 wait instance-terminated --region $region --instance-ids $instanceId
if ($state.allocationId) {
  Write-Host ">>> Liberando Elastic IP $($state.allocationId)..."
  aws ec2 release-address --region $region --allocation-id $state.allocationId | Out-Null
}
Write-Host "Instancia y Elastic IP liberadas."
Write-Host "URL anterior: $($state.url)"
