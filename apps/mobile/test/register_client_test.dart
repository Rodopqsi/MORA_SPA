// Test de regresion: el registro de clientes debe iniciar sesion
// automaticamente con el token que ahora devuelve `/client-auth/register`
// en la misma respuesta (data.token + data.client). Antes, la app tenia que
// hacer una segunda llamada a `/client-auth/login` y, si el password
// tuviera espacios al inicio/fin, podia fallar. Ademas se valida que el
// cliente persistido en AppState ya tenga token y datos de sesion.

import 'dart:async';
import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:mora_mobile/core/network/api_client.dart';
import 'package:mora_mobile/repositories/mora_repository.dart';
import 'package:mora_mobile/state/app_state.dart';

void main() {
  setUpAll(() async {
    SharedPreferences.setMockInitialValues({});
  });

  test(
    'registerClient persiste token y ClientSession en AppState (sin llamar a login)',
    () async {
      final hitPaths = <String>[];
      final mock = MockClient((http.Request request) async {
        hitPaths.add(request.url.path);
        return http.Response(
          jsonEncode({
            'data': {
              'id': 42,
              'token': 'jwt_test_token_xyz',
              'client': {
                'id': 42,
                'name': 'Maria Lopez',
                'phone': '999888777',
                'email': 'maria@example.com',
              },
            },
          }),
          201,
          headers: {'content-type': 'application/json'},
        );
      });

      final appState = await AppState.bootstrap();
      final apiClient = ApiClient(appState: appState, httpClient: mock);
      final repo = MoraRepository(apiClient: apiClient, appState: appState);

      final session = await repo.registerClient(
        name: 'Maria Lopez',
        phone: '999888777',
        password: 'secreto123',
        email: 'maria@example.com',
      );

      expect(session.id, equals(42));
      expect(session.name, equals('Maria Lopez'));
      expect(appState.clientToken, equals('jwt_test_token_xyz'));
      expect(appState.clientSession?.id, equals(42));

      // Solo debe haber pegado al endpoint de register, nunca al de login.
      expect(hitPaths, equals(['/api/client-auth/register']));
    },
  );

  test(
    'registerClient omite los campos opcionales vacios (no envia string vacio al backend)',
    () async {
      Map<String, dynamic>? hitBody;
      final mock = MockClient((http.Request request) async {
        hitBody = jsonDecode(request.body) as Map<String, dynamic>;
        return http.Response(
          jsonEncode({
            'data': {
              'id': 43,
              'token': 'jwt_test_43',
              'client': {'id': 43, 'name': 'Ana Diaz', 'phone': '999777666'},
            },
          }),
          201,
          headers: {'content-type': 'application/json'},
        );
      });

      final appState = await AppState.bootstrap();
      final apiClient = ApiClient(appState: appState, httpClient: mock);
      final repo = MoraRepository(apiClient: apiClient, appState: appState);

      await repo.registerClient(
        name: 'Ana Diaz',
        phone: '999777666',
        password: 'secreto123',
        email: '',
        birthDate: '',
        whatsapp: '',
      );

      expect(hitBody, isNotNull);
      expect(hitBody!.containsKey('email'), isFalse);
      expect(hitBody!.containsKey('birthDate'), isFalse);
      expect(hitBody!.containsKey('whatsapp'), isFalse);
      expect(hitBody!['name'], equals('Ana Diaz'));
      expect(hitBody!['phone'], equals('999777666'));
    },
  );

  test(
    'registerClient propaga ApiException con mensaje legible cuando el backend responde 400',
    () async {
      final mock = MockClient((http.Request request) async {
        return http.Response(
          jsonEncode({
            'error': {
              'code': 'validation_error',
              'message': 'La fecha de nacimiento debe tener formato YYYY-MM-DD',
            },
          }),
          400,
          headers: {'content-type': 'application/json'},
        );
      });

      final appState = await AppState.bootstrap();
      final apiClient = ApiClient(appState: appState, httpClient: mock);
      final repo = MoraRepository(apiClient: apiClient, appState: appState);

      await expectLater(
        () => repo.registerClient(
          name: 'Pedro',
          phone: '999666555',
          password: 'secreto123',
          birthDate: 'ayer',
        ),
        throwsA(
          isA<ApiException>().having(
            (e) => e.message,
            'message',
            contains('YYYY-MM-DD'),
          ),
        ),
      );
    },
  );
}
