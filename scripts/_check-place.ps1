$p = 'd:\Desarrollo de aplicaciones Web avanzado\proyecto\apps\web\app\(admin)\servicios\page.tsx'
$bytes = [System.IO.File]::ReadAllBytes($p)
$text = [System.Text.Encoding]::UTF8.GetString($bytes)
$lines = $text -split "`n"
$l = $lines[210]
Write-Host ('line 211: {0}' -f $l)
$lineBytes = [System.Text.Encoding]::UTF8.GetBytes($l)
$hex = ($lineBytes | ForEach-Object { $_.ToString('X2') }) -join ' '
Write-Host $hex
