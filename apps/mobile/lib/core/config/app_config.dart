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

  static String get culqiPublicKey {
    const fromEnv = String.fromEnvironment('CULQI_PUBLIC_KEY', defaultValue: '');
    if (fromEnv.isNotEmpty) return fromEnv;
    // Test key fallback
    return 'pk_test_njPMs7nqVsZ80xEl';
  }
}