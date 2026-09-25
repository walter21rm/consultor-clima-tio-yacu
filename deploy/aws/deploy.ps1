param(
  [string]$Region = $(if ($env:AWS_REGION) { $env:AWS_REGION } else { "us-east-1" }),
  [string]$InstanceType = "t3.micro",
  [string]$Name = "consultor-clima"
)

$ErrorActionPreference = "Stop"

$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$EnvFile = Join-Path $ProjectRoot "backend\.env"
$KeyName = "$Name-key"
$SgName = "$Name-sg"
$KeyPath = Join-Path $PSScriptRoot "$KeyName.pem"
$StatePath = Join-Path $PSScriptRoot "instance-state.json"

function Assert-Aws {
  $aws = Get-Command aws -ErrorAction SilentlyContinue
  if (-not $aws) {
    throw "AWS CLI no está en PATH. Cierra y abre la terminal después de instalarlo."
  }
  aws sts get-caller-identity --region $Region --output json | Out-Null
  if ($LASTEXITCODE -ne 0) {
    throw "AWS no está autenticado. Ejecuta: aws configure"
  }
}

function Get-MyPublicIp {
  try {
    return (Invoke-RestMethod -Uri "https://checkip.amazonaws.com" -TimeoutSec 15).Trim()
  } catch {
    return "0.0.0.0/0"
  }
}

function Get-LatestAl2023Ami {
  $ami = aws ec2 describe-images `
    --region $Region `
    --owners amazon `
    --filters "Name=name,Values=al2023-ami-2023.*-x86_64" "Name=state,Values=available" `
    --query "sort_by(Images, &CreationDate)[-1].ImageId" `
    --output text
  if (-not $ami -or $ami -eq "None") { throw "No se encontró AMI de Amazon Linux 2023." }
  return $ami
}

function Read-DotEnv([string]$path) {
  $map = @{}
  if (-not (Test-Path $path)) { return $map }
  Get-Content $path | ForEach-Object {
    if ($_ -match '^\s*#' -or $_ -notmatch '=') { return }
    $parts = $_.Split('=', 2)
    $map[$parts[0].Trim()] = $parts[1].Trim()
  }
  return $map
}

function Invoke-AwsJson([string[]]$AwsArgs) {
  $prev = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  $out = & aws @AwsArgs 2>&1
  $code = $LASTEXITCODE
  $ErrorActionPreference = $prev
  $text = ($out | Out-String).Trim()
  return @{ Code = $code; Text = $text }
}

function Ensure-KeyPair {
  $lookup = Invoke-AwsJson @("ec2", "describe-key-pairs", "--region", $Region, "--key-names", $KeyName, "--query", "KeyPairs[0].KeyName", "--output", "text")
  $exists = $lookup.Code -eq 0 -and $lookup.Text -eq $KeyName
  if ($exists -and (Test-Path $KeyPath)) { return }
  if ($exists) {
    Invoke-AwsJson @("ec2", "delete-key-pair", "--region", $Region, "--key-name", $KeyName) | Out-Null
  }
  $created = Invoke-AwsJson @("ec2", "create-key-pair", "--region", $Region, "--key-name", $KeyName, "--query", "KeyMaterial", "--output", "text")
  if ($created.Code -ne 0 -or -not $created.Text) { throw "No se pudo crear el key pair. $($created.Text)" }
  if (Test-Path $KeyPath) {
    icacls $KeyPath /grant:r "$env:USERNAME`:F" | Out-Null
    Remove-Item $KeyPath -Force
  }
  Set-Content -Path $KeyPath -Value ($created.Text -replace "`r", "") -NoNewline -Encoding ascii
  icacls $KeyPath /inheritance:r /grant:r "$env:USERNAME`:R" | Out-Null
}

function Ensure-SecurityGroup {
  $lookup = Invoke-AwsJson @("ec2", "describe-security-groups", "--region", $Region, "--filters", "Name=group-name,Values=$SgName", "--query", "SecurityGroups[0].GroupId", "--output", "text")
  $sgId = $lookup.Text
  if ($lookup.Code -ne 0 -or -not $sgId -or $sgId -eq "None") {
    $created = Invoke-AwsJson @("ec2", "create-security-group", "--region", $Region, "--group-name", $SgName, "--description", "Consultor de Clima HTTP/SSH", "--query", "GroupId", "--output", "text")
    if ($created.Code -ne 0) { throw "No se pudo crear el security group. $($created.Text)" }
    $sgId = $created.Text
  }
  $myIp = Get-MyPublicIp
  if ($myIp -notmatch '/') { $myIp = "$myIp/32" }

  Invoke-AwsJson @("ec2", "authorize-security-group-ingress", "--region", $Region, "--group-id", $sgId, "--protocol", "tcp", "--port", "22", "--cidr", $myIp) | Out-Null
  Invoke-AwsJson @("ec2", "authorize-security-group-ingress", "--region", $Region, "--group-id", $sgId, "--protocol", "tcp", "--port", "80", "--cidr", "0.0.0.0/0") | Out-Null
  Invoke-AwsJson @("ec2", "authorize-security-group-ingress", "--region", $Region, "--group-id", $sgId, "--protocol", "tcp", "--port", "443", "--cidr", "0.0.0.0/0") | Out-Null
  return $sgId
}

function Wait-Ssh([string]$ip) {
  $deadline = (Get-Date).AddMinutes(8)
  while ((Get-Date) -lt $deadline) {
    $p = Start-Process -FilePath "ssh" -ArgumentList @(
      "-i", $KeyPath, "-o", "StrictHostKeyChecking=no", "-o", "ConnectTimeout=8",
      "-o", "BatchMode=yes", "ec2-user@$ip", "echo ready"
    ) -Wait -PassThru -NoNewWindow
    if ($p.ExitCode -eq 0) { return }
    Start-Sleep -Seconds 8
  }
  throw "No se pudo conectar por SSH a $ip"
}

function Invoke-Remote([string]$ip, [string]$command) {
  ssh -i $KeyPath -o StrictHostKeyChecking=no -o BatchMode=yes "ec2-user@$ip" $command
  if ($LASTEXITCODE -ne 0) { throw "Falló SSH: $command" }
}

Write-Host ">>> Comprobando AWS..."
Assert-Aws

$dotenv = Read-DotEnv $EnvFile
$weatherKey = $dotenv["WEATHER_API_KEY"]
if (-not $weatherKey -or $weatherKey -eq "tu_api_key_de_weatherapi") {
  throw "Falta WEATHER_API_KEY en backend\.env"
}
$jwt = -join ((1..48) | ForEach-Object { '{0:x}' -f (Get-Random -Max 16) })
$demoUser = if ($dotenv["DEMO_USER"]) { $dotenv["DEMO_USER"] } else { "admin" }
$demoPass = if ($dotenv["DEMO_PASSWORD"]) { $dotenv["DEMO_PASSWORD"] } else { "admin123" }

Write-Host ">>> Preparando clave SSH y security group en $Region..."
Ensure-KeyPair
$sgId = Ensure-SecurityGroup
$ami = Get-LatestAl2023Ami
$userDataPath = Join-Path $PSScriptRoot "user-data.sh"

Write-Host ">>> Lanzando EC2 $InstanceType ($ami)..."
$instanceId = aws ec2 run-instances `
  --region $Region `
  --image-id $ami `
  --instance-type $InstanceType `
  --key-name $KeyName `
  --security-group-ids $sgId `
  --user-data "file://$userDataPath" `
  --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=$Name}]" `
  --query "Instances[0].InstanceId" `
  --output text

if (-not $instanceId) { throw "No se pudo crear la instancia." }
Write-Host ">>> Instancia $instanceId creada. Esperando running..."
aws ec2 wait instance-running --region $Region --instance-ids $instanceId
aws ec2 wait instance-status-ok --region $Region --instance-ids $instanceId

$publicIp = aws ec2 describe-instances --region $Region --instance-ids $instanceId --query "Reservations[0].Instances[0].PublicIpAddress" --output text
Write-Host ">>> IP pública: $publicIp. Esperando SSH y bootstrap..."
Wait-Ssh $publicIp

$deadline = (Get-Date).AddMinutes(6)
do {
  ssh -i $KeyPath -o StrictHostKeyChecking=no -o BatchMode=yes "ec2-user@$publicIp" "test -f /var/lib/cloud/instance/consultor-bootstrap-ok"
  if ($LASTEXITCODE -eq 0) { break }
  Start-Sleep -Seconds 8
} while ((Get-Date) -lt $deadline)

Write-Host ">>> Empaquetando y copiando la app..."
$stage = Join-Path $env:TEMP "consultor-clima-deploy"
if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
New-Item -ItemType Directory -Path $stage | Out-Null
robocopy $ProjectRoot $stage /E /XD node_modules .git deploy .vscode /XF .env *.pem instance-state.json /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null
if ($LASTEXITCODE -ge 8) { throw "robocopy falló con código $LASTEXITCODE" }

$archive = Join-Path $env:TEMP "consultor-clima.tar"
if (Test-Path $archive) { Remove-Item $archive -Force }
Push-Location $stage
tar -cf $archive *
Pop-Location

scp -i $KeyPath -o StrictHostKeyChecking=no $archive "ec2-user@${publicIp}:/tmp/consultor-clima.tar"
Invoke-Remote $publicIp "rm -rf /opt/consultor-clima/* && tar -xf /tmp/consultor-clima.tar -C /opt/consultor-clima"

$remoteEnv = @"
PORT=3000
JWT_SECRET=$jwt
DEMO_USER=$demoUser
DEMO_PASSWORD=$demoPass
WEATHER_API_KEY=$weatherKey
"@
$remoteEnv | ssh -i $KeyPath -o StrictHostKeyChecking=no "ec2-user@$publicIp" "cat > /opt/consultor-clima/backend/.env"

Write-Host ">>> Instalando dependencias y arrancando el servicio..."
Invoke-Remote $publicIp "cd /opt/consultor-clima && npm run install:all --omit=dev"
Invoke-Remote $publicIp "sudo systemctl enable consultor-clima && sudo systemctl restart consultor-clima && sudo systemctl restart nginx"

$state = @{
  instanceId = $instanceId
  publicIp   = $publicIp
  region     = $Region
  keyPath    = $KeyPath
  sgId       = $sgId
  url        = "http://$publicIp"
}
$state | ConvertTo-Json | Set-Content -Path $StatePath -Encoding UTF8

Write-Host ""
Write-Host "Despliegue listo: http://$publicIp"
Write-Host "Usuario demo: $demoUser / $demoPass"
Write-Host "Para apagar y evitar cargos: .\deploy\aws\teardown.ps1"
