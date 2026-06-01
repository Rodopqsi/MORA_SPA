import 'dart:io';

class AppConfig {
  static const String _apiFromDefine = String.fromEnvironment('API_URL', defaultValue: '');

  static String get apiBaseUrl {
    if (_apiFromDefine.isNotEmpty) {
      return _apiFromDefine;
    }

    if (Platform.isAndroid) {
      return 'http://10.0.2.2:4000/api';
    }

    return 'http://localhost:4000/api';
  }

  static String get mediaBaseUrl {
    final base = apiBaseUrl;
    if (base.endsWith('/api')) {
      return base.substring(0, base.length - 4);
    }
    return base;
  }
}