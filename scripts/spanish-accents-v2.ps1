$ErrorActionPreference = 'Stop'
$root = 'd:\Desarrollo de aplicaciones Web avanzado\proyecto'
Set-Location $root

# Palabras (key en cualquier caso; el script preserva la capitalización del match)
# Formato: @{ k = 'palabra'; v = 'palabraAcentuada' }
$pairs = @(
  @{k='Informacion';v='Información'}
  @{k='Cancelaciones';v='Cancelaciones'}
  @{k='Cancelacion';v='Cancelación'}
  @{k='Cancelado';v='Cancelado'}
  @{k='Cancelar';v='Cancelar'}
  @{k='Confirmaciones';v='Confirmaciones'}
  @{k='Confirmacion';v='Confirmación'}
  @{k='Confirmado';v='Confirmado'}
  @{k='Confirmar';v='Confirmar'}
  @{k='Resenas';v='Reseñas'}
  @{k='Resena';v='Reseña'}
  @{k='Albumes';v='Álbumes'}
  @{k='Album';v='Álbum'}
  @{k='Sesion';v='Sesión'}
  @{k='Region';v='Región'}
  @{k='Atencion';v='Atención'}
  @{k='Direccion';v='Dirección'}
  @{k='Contrasena';v='Contraseña'}
  @{k='Telefono';v='Teléfono'}
  @{k='Manana';v='Mañana'}
  @{k='Pequeno';v='Pequeño'}
  @{k='Pequena';v='Pequeña'}
  @{k='Compania';v='Compañía'}
  @{k='Diseno';v='Diseño'}
  @{k='Dueno';v='Dueño'}
  @{k='Puntuacion';v='Puntuación'}
  @{k='Calificacion';v='Calificación'}
  @{k='Opinion';v='Opinión'}
  @{k='Anio';v='Año'}
  @{k='Anios';v='Años'}
  @{k='Tambien';v='También'}
  @{k='Categoria';v='Categoría'}
  @{k='Categorias';v='Categorías'}
  @{k='Boton';v='Botón'}
  @{k='Numero';v='Número'}
  @{k='Numeros';v='Números'}
  @{k='Reunion';v='Reunión'}
  @{k='Gestion';v='Gestión'}
  @{k='Peluqueria';v='Peluquería'}
  @{k='Peluquero';v='Peluquero'}
  @{k='Dia';v='Día'}
  @{k='Dias';v='Días'}
  @{k='Rapido';v='Rápido'}
  @{k='Rapida';v='Rápida'}
  @{k='Ultimo';v='Último'}
  @{k='Ultima';v='Última'}
  @{k='Galeria';v='Galería'}
  @{k='Cumpleanos';v='Cumpleaños'}
  @{k='Tamanio';v='Tamaño'}
  @{k='Mision';v='Misión'}
  @{k='Vision';v='Visión'}
  @{k='Cortesia';v='Cortesía'}
  @{k='Imagenes';v='Imágenes'}
  @{k='Imagen';v='Imagen'}
  @{k='Espanol';v='Español'}
  @{k='Publica';v='Pública'}
  @{k='Publico';v='Público'}
  @{k='Publicos';v='Públicos'}
  @{k='Publicadas';v='Publicadas'}
  @{k='Tipica';v='Típica'}
  @{k='Dificil';v='Difícil'}
  @{k='Facil';v='Fácil'}
  @{k='Unica';v='Única'}
  @{k='Unico';v='Único'}
  @{k='Maxima';v='Máxima'}
  @{k='Maximo';v='Máximo'}
  @{k='Maximos';v='Máximos'}
  @{k='Minima';v='Mínima'}
  @{k='Minimo';v='Mínimo'}
  @{k='Minimos';v='Mínimos'}
  @{k='Sera';v='Será'}
  @{k='Estara';v='Estará'}
  @{k='Podra';v='Podrá'}
  @{k='Logica';v='Lógica'}
  @{k='Periodo';v='Período'}
  @{k='Practica';v='Práctica'}
  @{k='Cuanto';v='Cuánto'}
  @{k='Cual';v='Cuál'}
  @{k='Como';v='Cómo'}
  @{k='Donde';v='Dónde'}
  @{k='Cuando';v='Cuándo'}
  @{k='Quien';v='Quién'}
  @{k='Segun';v='Según'}
  @{k='Mas';v='Más'}
  @{k='Aun';v='Aún'}
  @{k='Accion';v='Acción'}
  @{k='Acciones';v='Acciones'}
  @{k='Quitada';v='Quitada'}
  @{k='Quitara';v='Quitará'}
  @{k='Anade';v='Añade'}
  @{k='Expiro';v='Expiró'}
  @{k='Adjuntala';v='Adjúntala'}
  @{k='Recibiras';v='Recibirás'}
  @{k='Saldra';v='Saldrá'}
  @{k='Aparecera';v='Aparecerá'}
  @{k='Ademas';v='Además'}
  @{k='Tambien';v='También'}
  @{k='Caracteristicas';v='Características'}
  @{k='Promocion';v='Promoción'}
  @{k='Promociones';v='Promociones'}
  @{k='Ubicacion';v='Ubicación'}
  @{k='Descripcion';v='Descripción'}
  @{k='Descripciones';v='Descripciones'}
  @{k='Operacion';v='Operación'}
  @{k='Operaciones';v='Operaciones'}
  @{k='Notificacion';v='Notificación'}
  @{k='Notificaciones';v='Notificaciones'}
  @{k='Validacion';v='Validación'}
  @{k='Configuracion';v='Configuración'}
  @{k='Aplicacion';v='Aplicación'}
  @{k='Publicacion';v='Publicación'}
  @{k='Edicion';v='Edición'}
  @{k='Seleccion';v='Selección'}
  @{k='Proteccion';v='Protección'}
  @{k='Inspeccion';v='Inspección'}
  @{k='Conexion';v='Conexión'}
  @{k='Sesiones';v='Sesiones'}
  @{k='Opciones';v='Opciones'}
  @{k='Vehiculo';v='Vehículo'}
  @{k='Vehiculos';v='Vehículos'}
  @{k='Articulo';v='Artículo'}
  @{k='Articulos';v='Artículos'}
  @{k='Capitulo';v='Capítulo'}
  @{k='Capitulos';v='Capítulos'}
  @{k='Servicio';v='Servicio'}
  @{k='Servicios';v='Servicios'}
  @{k='Tienda';v='Tienda'}
  @{k='Tiendas';v='Tiendas'}
  @{k='Pedido';v='Pedido'}
  @{k='Pedidos';v='Pedidos'}
  @{k='Reserva';v='Reserva'}
  @{k='Reservas';v='Reservas'}
  @{k='Cliente';v='Cliente'}
  @{k='Clientes';v='Clientes'}
  @{k='Agenda';v='Agenda'}
  @{k='Agendar';v='Agendar'}
  @{k='Agendada';v='Agendada'}
  @{k='Agendadas';v='Agendadas'}
  @{k='Agendado';v='Agendado'}
  @{k='Agendados';v='Agendados'}
  @{k='Historial';v='Historial'}
  @{k='Cuenta';v='Cuenta'}
  @{k='Cuentas';v='Cuentas'}
  @{k='SesionIniciada';v='SesiónIniciada'}
  @{k='Comprobante';v='Comprobante'}
  @{k='Comprobantes';v='Comprobantes'}
  @{k='Adelanto';v='Adelanto'}
  @{k='Adelantos';v='Adelantos'}
  @{k='Anticipo';v='Anticipo'}
  @{k='Anticipos';v='Anticipos'}
  @{k='Reembolso';v='Reembolso'}
  @{k='Reembolsos';v='Reembolsos'}
  @{k='Subtotal';v='Subtotal'}
  @{k='Total';v='Total'}
  @{k='Impuesto';v='Impuesto'}
  @{k='Impuestos';v='Impuestos'}
  @{k='Descuento';v='Descuento'}
  @{k='Descuentos';v='Descuentos'}
  @{k='PromocionAplicada';v='PromociónAplicada'}
)

# Construir pares case-insensitive: para cada key, generar variante en minúscula también
# Si la acentuación no cambia, sólo dejar una entrada
$compiled = New-Object 'System.Collections.Generic.Dictionary[string,string]' ([System.StringComparer]::OrdinalIgnoreCase)
foreach ($p in $pairs) {
  if ($p.k -ne $p.v) {
    $compiled[$p.k] = $p.v
  }
}
Write-Host ('[info] {0} pares cargados' -f $compiled.Count)

$utf8 = [System.Text.Encoding]::UTF8
$targets = Get-ChildItem -Path 'apps\web' -Recurse -Include *.ts,*.tsx,*.css,*.html -File |
  Where-Object { $_.FullName -notmatch 'node_modules' -and $_.FullName -notmatch '\\.next\\' -and $_.FullName -notmatch '\\dist\\' }

$totalHits = 0
$totalFiles = 0
foreach ($file in $targets) {
  $orig = [System.IO.File]::ReadAllText($file.FullName, $utf8)
  $next = $orig
  $fileHits = 0
  foreach ($k in $compiled.Keys) {
    $v = $compiled[$k]
    # Word boundary: NO ASCII letter (incluye may/min acentuadas y ñ/ü) inmediatamente antes/después
    $pattern = '(?<![A-Za-zÁÉÍÓÚáéíóúÑñÜü])' + [regex]::Escape($k) + '(?![A-Za-zÁÉÍÓÚáéíóúÑñÜü])'
    $matches = [regex]::Matches($next, $pattern)
    if ($matches.Count -gt 0) {
      # Reemplazo preservando la capitalización
      $next = [regex]::Replace($next, $pattern, {
        param($m)
        $src = $m.Value
        $target = $v
        if ($src -cmatch '^[A-ZÁÉÍÓÚÑÜ]+$') {
          return $target.ToUpper()
        } elseif ($src[0] -cmatch '[A-ZÁÉÍÓÚÑÜ]') {
          return ([char]::ToUpper($target[0]) + $target.Substring(1))
        } else {
          return $target.ToLower()
        }
      })
      $fileHits += $matches.Count
    }
  }
  if ($fileHits -gt 0) {
    [System.IO.File]::WriteAllText($file.FullName, $next, $utf8)
    Write-Host ('[ok] {0}  -> {1} sustituciones' -f $file.FullName, $fileHits)
    $totalHits += $fileHits
    $totalFiles++
  }
}
Write-Host ('[done] {0} sustituciones en {1} archivos' -f $totalHits, $totalFiles)
