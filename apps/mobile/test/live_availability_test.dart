// Test E2E real: hit the local API and verify the model parses and slots
// are non-empty. Skips automatically if the API is not reachable.
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

import 'package:mora_mobile/core/models.dart';
import 'package:mora_mobile/core/network/api_client.dart';
import 'package:mora_mobile/repositories/mora_repository.dart';
import 'package:mora_mobile/state/app_state.dart';

void main() {
  test('live: client-availability returns slots for tomorrow', () async {
    final base = Platform.environment['MORA_API_URL'] ?? 'http://localhost:4000/api';
    // 1) Hit the public business-config to confirm reachability
    final health = await http
        .get(Uri.parse('$base/public/business-config'))
        .timeout(const Duration(seconds: 5));
    if (health.statusCode != 200) {
      markTestSkipped('API not healthy: ${health.statusCode}');
      return;
    }

    // 2) Use a pre-issued client JWT (valid 8h after creation; for a quick
    // live test we log in with the seeded credentials).
    final phone = '999000111';
    final login = await http.post(
      Uri.parse('$base/client-auth/login'),
      headers: {'Content-Type': 'application/json'},
      body: '{"phone":"$phone","password":"cliente123"}',
    );
    expect(login.statusCode, 200,
        reason: 'login failed: status=${login.statusCode} body=${login.body}');
    final t = _extractToken(login.body);
    expect(t, isNotNull, reason: 'login did not return a token: ${login.body}');

    // 3) Build repository with the live client token
    SharedPreferences.setMockInitialValues({});
    final appState = await AppState.bootstrap();
    appState.setClientSession(t!, ClientSession(
      id: 0,
      phone: phone,
      email: null,
      name: 'Test Bot',
    ));
    final repo = MoraRepository(appState: appState, apiClient: ApiClient(appState: appState));

    // 4) Fetch availability for tomorrow
    final tomorrow = DateTime.now().add(const Duration(days: 1));
    final iso = '${tomorrow.year.toString().padLeft(4, '0')}-'
        '${tomorrow.month.toString().padLeft(2, '0')}-'
        '${tomorrow.day.toString().padLeft(2, '0')}';
    final payload = await repo.fetchClientAvailability(
      date: iso,
      serviceIds: const [1],
    );

    expect(payload.data, isNotEmpty,
        reason: 'no slots returned by server. data.length=${payload.data.length}');
  });
}

String? _extractToken(String body) {
  try {
    final m = RegExp(r'"token":"([^"]+)"').firstMatch(body);
    return m?.group(1);
  } catch (_) {
    return null;
  }
}
