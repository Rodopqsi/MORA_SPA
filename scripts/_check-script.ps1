$p = 'd:\Desarrollo de aplicaciones Web avanzado\proyecto\scripts\spanish-accents.ps1'
$utf8 = [System.Text.Encoding]::UTF8
$text = [System.IO.File]::ReadAllText($p, $utf8)
Write-Host ('len: {0}' -f $text.Length)
Write-Host '--- primeras lineas ---'
$lines = $text -split "`n"
$take = $lines[0..14]
foreach ($l in $take) { Write-Host $l }
Write-Host '--- muestra de reemplazos (k=...) ---'
$matches = $lines | Where-Object { $_ -match '^  @\{k=' } | Select-Object -First 12
foreach ($l in $matches) { Write-Host $l.Trim() }
