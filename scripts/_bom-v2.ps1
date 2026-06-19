$p = 'd:\Desarrollo de aplicaciones Web avanzado\proyecto\scripts\spanish-accents-v2.ps1'
$enc = New-Object System.Text.UTF8Encoding($true)
$text = [System.IO.File]::ReadAllText($p, [System.Text.Encoding]::UTF8)
[System.IO.File]::WriteAllText($p, $text, $enc)
Write-Host "BOM added"
