$p = 'd:\Desarrollo de aplicaciones Web avanzado\proyecto\scripts\spanish-accents.ps1'
$utf8 = [System.Text.Encoding]::UTF8
$text = [System.IO.File]::ReadAllText($p, $utf8)
$lines = $text -split "`n"
Write-Host '--- reemplazos con clave acentuada o e\u00f1e ---'
$matches = $lines | Where-Object { $_ -match '^  @\{k=.*Inform|Cancel|Confirm|Resena|Album|Sesion|Region|Atencion|Direccion|Contrasena|Telefono|Manana|Pequeno|Minimo|Compania|Diseno|Dueno|Puntuacion|Calificacion|Opinion|Anio|Tambien|Categoria|Boton|Numero|Reunion|Gestion|Peluqueria|Dia|Rapido|Ultimo|Galeria|Cumpleanos|Tamanio|Mision|Vision|Cortesia|Imagenes|Espanol|public|tipic|dific|facil|unic|maxim|sera|estara|podra|tendra|logic|periodo|practi|cuanto|cual|como|donde|cuando|quien|segun|rapid' }
foreach ($l in $matches) { Write-Host $l.Trim() }
