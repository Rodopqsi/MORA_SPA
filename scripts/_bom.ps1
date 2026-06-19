$p = 'd:\Desarrollo de aplicaciones Web avanzado\proyecto\scripts\spanish-accents.ps1'
$utf8Bom = New-Object System.Text.UTF8Encoding($true)
$text = [System.IO.File]::ReadAllText($p, [System.Text.Encoding]::UTF8)
[System.IO.File]::WriteAllText($p, $text, $utf8Bom)
Write-Host 'BOM agregado'
