// Test de regresion: la app movil debe tokenizar tarjetas a traves del proxy
// backend (`/api/public/culqi/token`) y NUNCA llamar directo a
// `secure.culqi.com`. Antes la pantalla de checkout llamaba directo a Culqi,
// lo cual fallaba en silencio (CORS, cleartext, etc.) y la orden quedaba
// como PENDIENTE_ADELANTO sin cargo.

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
    'tokenizeCulqi llama al proxy backend y devuelve el id del token',
    () async {
      String? hitPath;
      Map<String, dynamic>? hitBody;

      final mock = MockClient((http.Request request) async {
        hitPath = request.url.path;
        hitBody = jsonDecode(request.body) as Map<String, dynamic>;
        return http.Response(
          jsonEncode({
            'id': 'tkn_test_LGEKpYe3HUGK5e2J',
            'object': 'token',
            'type': 'card',
            'email': 'demo@moraspa.pe',
            'card_number': '411111******1111',
            'brand': 'Visa',
          }),
          200,
          headers: {'content-type': 'application/json'},
        );
      });

      final appState = await AppState.bootstrap();
      final apiClient = ApiClient(
        appState: appState,
        httpClient: mock,
      );
      final repo = MoraRepository(apiClient: apiClient, appState: appState);

      final token = await repo.tokenizeCulqi(
        cardNumber: '4111 1111 1111 1111',
        cvv: '123',
        expirationMonth: '12',
        expirationYear: '2030',
        email: 'demo@moraspa.pe',
      );

      expect(token, equals('tkn_test_LGEKpYe3HUGK5e2J'));
      expect(hitPath, equals('/api/public/culqi/token'));
      expect(hitBody, isNotNull);
      expect(hitBody!['card_number'], equals('4111111111111111'));
      expect(hitBody!['cvv'], equals('123'));
      expect(hitBody!['expiration_month'], equals('12'));
      expect(hitBody!['expiration_year'], equals('2030'));
      expect(hitBody!['email'], equals('demo@moraspa.pe'));
    },
  );

  test(
    'tokenizeCulqi propaga ApiException si el backend rechaza con 400',
    () async {
      final mock = MockClient((http.Request request) async {
        return http.Response(
          jsonEncode({
            'error': {
              'code': 'culqi_token_failed',
              'message': 'La tarjeta fue rechazada por el procesador.',
            },
          }),
          400,
          headers: {'content-type': 'application/json'},
        );
      });

      final appState = await AppState.bootstrap();
      final apiClient = ApiClient(
        appState: appState,
        httpClient: mock,
      );
      final repo = MoraRepository(apiClient: apiClient, appState: appState);

      await expectLater(
        () => repo.tokenizeCulqi(
          cardNumber: '4111111111111112',
          cvv: '123',
          expirationMonth: '12',
          expirationYear: '2030',
        ),
        throwsA(isA<ApiException>()),
      );
    },
  );

  test(
    'tokenizeCulqi omite email si el usuario no lo proporciono',
    () async {
      Map<String, dynamic>? hitBody;

      final mock = MockClient((http.Request request) async {
        hitBody = jsonDecode(request.body) as Map<String, dynamic>;
        return http.Response(
          jsonEncode({'id': 'tkn_test_no_email'}),
          200,
          headers: {'content-type': 'application/json'},
        );
      });

      final appState = await AppState.bootstrap();
      final apiClient = ApiClient(
        appState: appState,
        httpClient: mock,
      );
      final repo = MoraRepository(apiClient: apiClient, appState: appState);

      final token = await repo.tokenizeCulqi(
        cardNumber: '4111111111111111',
        cvv: '123',
        expirationMonth: '12',
        expirationYear: '2030',
      );

      expect(token, equals('tkn_test_no_email'));
      expect(hitBody!.containsKey('email'), isFalse);
    },
  );
}
