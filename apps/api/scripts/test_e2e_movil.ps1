param(
  [string]$ApiBase = 'http://localhost:4000/api'
)

$ErrorActionPreference = 'Stop'

function Call-Api {
  param(
    [string]$Method,
    [string]$Path,
    [hashtable]$Body = $null,
    [string]$Token = $null
  )
  $headers = @{ 'Content-Type' = 'application/json' }
  if ($Token) { $headers['Authorization'] = "Bearer $Token" }
  $payload = if ($Body) { ($Body | ConvertTo-Json -Depth 8) } else { $null }
  try {
    $r = Invoke-RestMethod -Uri ($ApiBase + $Path) -Method $Method -Headers $headers -Body $payload
    return @{ ok = $true; data = $r }
  } catch {
    $code = $_.Exception.Response.StatusCode.Value__
    $stream = $_.Exception.Response.GetResponseStream()
    $reader = New-Object IO.StreamReader($stream)
    $errText = $reader.ReadToEnd()
    return @{ ok = $false; status = $code; error = $errText }
  }
}

# 1. Generar telefono unico (solo digitos, 9 para Peru)
$phone = '99' + (Get-Random -Min 1000000 -Max 9999999).ToString()
Write-Host "=== Phone: $phone"

# 2. Registrar cliente
Write-Host "`n=== POST /client-auth/register"
$reg = Call-Api -Method POST -Path '/client-auth/register' -Body @{
  name = 'Test Movil Cliente'
  phone = $phone
  password = 'TestMovil123!'
}
$reg | ConvertTo-Json -Depth 6

if (-not $reg.ok) { Write-Host "REGISTER FAILED"; exit 1 }

# 3. Login para obtener JWT
Write-Host "`n=== POST /client-auth/login"
$login = Call-Api -Method POST -Path '/client-auth/login' -Body @{
  identifier = $phone
  password = 'TestMovil123!'
}
$login | ConvertTo-Json -Depth 6
if (-not $login.ok) { Write-Host "LOGIN FAILED"; exit 1 }

$token = $login.data.token
Write-Host "Token: $($token.Substring(0,30))..."

# 4. Probar con body estilo Flutter (con zona -05:00) -- caso single-staff
Write-Host "`n=== POST /client-reservations (Flutter format with -05:00 offset)"
$resv = Call-Api -Method POST -Path '/client-reservations' -Token $token -Body @{
  channel = 'MOVIL'
  details = @(
    @{
      serviceId = 1
      staffId = 1
      start = '2026-06-16T09:00:00.000-05:00'
    }
  )
}
$resv | ConvertTo-Json -Depth 6
