param(
  [string]$Token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjksInBob25lIjoiOTk1MjcxNjM3IiwiZW1haWwiOm51bGwsImtpbmQiOiJjbGllbnQiLCJpYXQiOjE3ODE1NTA2MzQsImV4cCI6MTc4MTU3OTQzNH0.OmOi6e4caUVTOG9krcMqmaZe6HrguS3DZS0Nt6sksF4'
)

$ErrorActionPreference = 'Stop'

function Call-Api {
  param(
    [string]$Method,
    [string]$Path,
    [string]$BodyJson = $null,
    [string]$Token = $null
  )
  $headers = @{ 'Content-Type' = 'application/json' }
  if ($Token) { $headers['Authorization'] = "Bearer $Token" }
  try {
    $r = Invoke-WebRequest -Uri ('http://localhost:4000/api' + $Path) -Method $Method -Headers $headers -Body $BodyJson -UseBasicParsing
    return @{ ok = $true; status = $r.StatusCode; data = ($r.Content | ConvertFrom-Json) }
  } catch {
    $code = $_.Exception.Response.StatusCode.Value__
    $stream = $_.Exception.Response.GetResponseStream()
    $reader = New-Object IO.StreamReader($stream)
    $errText = $reader.ReadToEnd()
    return @{ ok = $false; status = $code; error = $errText }
  }
}

# Caso 1: body estilo Flutter con offset -05:00 (formato toLocal().toIso8601String() en Lima)
Write-Host "=== Caso 1: Flutter style con offset -05:00"
$body1 = @'
{"channel":"MOVIL","details":[{"serviceId":1,"staffId":1,"start":"2026-06-16T09:00:00.000-05:00"}]}
'@
$r1 = Call-Api -Method POST -Path '/client-reservations' -BodyJson $body1 -Token $Token
$r1 | ConvertTo-Json -Depth 6

# Caso 2: mismo body sin offset (formato web con formatBusinessDateTime)
Write-Host "`n=== Caso 2: Web style sin offset (formato plano)"
$body2 = @'
{"channel":"WEB","details":[{"serviceId":1,"staffId":1,"start":"2026-06-16T09:00:00.000"}]}
'@
$r2 = Call-Api -Method POST -Path '/client-reservations' -BodyJson $body2 -Token $Token
$r2 | ConvertTo-Json -Depth 6

# Caso 3: otro horario (14:00 Lima) y 2 servicios
Write-Host "`n=== Caso 3: 14:00 con 1 servicio y notas"
$body3 = @'
{"channel":"MOVIL","notes":"Reserva desde curl","details":[{"serviceId":1,"staffId":1,"start":"2026-06-16T14:00:00.000-05:00"}]}
'@
$r3 = Call-Api -Method POST -Path '/client-reservations' -BodyJson $body3 -Token $Token
$r3 | ConvertTo-Json -Depth 6
