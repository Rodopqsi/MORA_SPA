import 'dart:io';

/// Resuelve la URL absoluta de un recurso de media (imagen) devuelto por la API.
///
/// Estrategia: la API puede devolver dos tipos de rutas:
///   * `/uploads/...`  -> servidas por el backend (mismo host que la API).
///   * `/assets/...`   -> servidas por el frontend web (Next.js en :3000).
/// Si la URL ya es absoluta (http/https/data) o está vacía, se devuelve tal cual.
String resolveMediaUrl(String raw) {
  final value = raw.trim();
  if (value.isEmpty) {
    return value;
  }
  if (value.startsWith('http://') || value.startsWith('https://') || value.startsWith('data:')) {
    return value;
  }
  if (value.startsWith('/uploads/')) {
    return '${AppConfig.uploadsBaseUrl}$value';
  }
  // Cualquier otra ruta relativa (incluyendo `/assets/...`) la sirve el frontend.
  return '${AppConfig.webBaseUrl}$value';
}

class AppConfig {
  static const String _apiFromDefine = String.fromEnvironment('API_URL', defaultValue: '');
  static const String _webFromDefine = String.fromEnvironment('WEB_URL', defaultValue: '');

  static String get apiBaseUrl {
    if (_apiFromDefine.isNotEmpty) {
      return _apiFromDefine;
    }

    if (Platform.isAndroid) {
      return 'http://10.0.2.2:4000/api';
    }

    return 'http://localhost:4000/api';
  }

  /// Base URL del frontend Next.js (puerto 3000). Se usa para resolver
  /// imágenes estáticas que la API referencia con rutas `/assets/...`.
  static String get webBaseUrl {
    if (_webFromDefine.isNotEmpty) {
      return _webFromDefine;
    }

    if (Platform.isAndroid) {
      return 'http://10.0.2.2:3000';
    }

    return 'http://localhost:3000';
  }

  static String get mediaBaseUrl {
    final base = apiBaseUrl;
    if (base.endsWith('/api')) {
      return base.substring(0, base.length - 4);
    }
    return base;
  }

  /// Base URL absoluta para los archivos subidos (`/uploads/...`).
  /// Como el backend expone `/uploads` en el mismo host que la API, lo
  /// derivamos a partir de [apiBaseUrl].
  static String get uploadsBaseUrl {
    final base = apiBaseUrl;
    if (base.endsWith('/api')) {
      return base.substring(0, base.length - 4);
    }
    if (base.endsWith('/')) {
      return base.substring(0, base.length - 1);
    }
    return base;
  }

  static String get culqiPublicKey {
    const fromEnv = String.fromEnvironment('CULQI_PUBLIC_KEY', defaultValue: '');
    if (fromEnv.isNotEmpty) return fromEnv;
    // Test key fallback
    return 'pk_test_njPMs7nqVsZ80xEl';
  }
}