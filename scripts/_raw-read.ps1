$p = 'd:\Desarrollo de aplicaciones Web avanzado\proyecto\scripts\spanish-accents.ps1'
$bytes = [System.IO.File]::ReadAllBytes($p)
Write-Host ('primeros 4 bytes (hex): {0:X2} {1:X2} {2:X2} {3:X2}' -f $bytes[0], $bytes[1], $bytes[2], $bytes[3])
# Lee la línea 268 (zero-indexed 267)
$text = [System.IO.File]::ReadAllText($p, [System.Text.Encoding]::UTF8)
$lines = $text -split "`n"
$line268 = $lines[267]
Write-Host '--- linea 268 (decoded UTF8) ---'
Write-Host $line268
