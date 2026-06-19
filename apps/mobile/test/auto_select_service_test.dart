// Test de regresion: el BookingTab debe auto-seleccionar el primer servicio
// del catalogo y disparar la busqueda en cuanto llega el catalogo (si hay
// sesion). Asi el usuario ve horarios sin tener que tocar el chip.

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:mora_mobile/app/theme.dart';
import 'package:mora_mobile/core/models.dart';
import 'package:mora_mobile/core/network/api_client.dart';
import 'package:mora_mobile/repositories/mora_repository.dart';
import 'package:mora_mobile/screens/root_screen.dart';
import 'package:mora_mobile/state/app_state.dart';

void main() {
  setUpAll(() async {
    await initializeDateFormatting('es_PE');
    Intl.defaultLocale = 'es_PE';
  });

  testWidgets(
    'Al cargar el catalogo, el primer servicio se auto-selecciona y se busca',
    (tester) async {
      SharedPreferences.setMockInitialValues({
        'mora.clientToken': 'fake-jwt',
        'mora.clientSession':
            '{"id":1,"name":"Demo","phone":"999000111","email":null}',
      });
      final appState = await AppState.bootstrap();
      expect(appState.isClientAuthenticated, isTrue);

      int availabilityCalls = 0;

      final mockClient = MockClient((req) async {
        if (req.url.path.endsWith('/public/services')) {
          return http.Response(
            '{"data":['
            '{"id":1,"name":"Bano basico","description":"Bano","priceBase":40,"durationMin":60,"active":true,"staffIds":[1]},'
            '{"id":2,"name":"Corte","description":"Corte","priceBase":30,"durationMin":45,"active":true,"staffIds":[1]}'
            ']}',
            200,
            headers: {'content-type': 'application/json'},
          );
        }
        if (req.url.path.endsWith('/public/staff')) {
          return http.Response(
            '{"data":[{"id":1,"name":"Gisela","active":true,"services":[1,2]}]}',
            200,
            headers: {'content-type': 'application/json'},
          );
        }
        if (req.url.path.endsWith('/client-availability')) {
          availabilityCalls++;
          return http.Response(
            '{"data":[{"staffId":1,"label":"Gisela","mode":"single_staff","slots":['
            '{"id":"s-1","start":"2026-06-15T16:00:00.000","end":"2026-06-15T17:00:00.000","assignments":[]}'
            ']}],"meta":{"mode":"single_staff","reason":"SLOTS_FOUND","totalDurationMin":60}}',
            200,
            headers: {'content-type': 'application/json'},
          );
        }
        return http.Response('{}', 200);
      });

      final apiClient = ApiClient(
        appState: appState,
        httpClient: mockClient,
        requestTimeout: const Duration(seconds: 5),
      );
      final repo = MoraRepository(appState: appState, apiClient: apiClient);

      await tester.pumpWidget(
        MultiProvider(
          providers: [
            ChangeNotifierProvider<AppState>.value(value: appState),
          ],
          child: MaterialApp(
            theme: buildMoraTheme(),
            home: Scaffold(
              body: BookingTab(
                repository: repo,
                onNavigate: (_) {},
              ),
            ),
          ),
        ),
      );

      // Dejar que el catalogo llegue
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 50));
      // Dejar que el post-frame callback dispare la busqueda
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 200));

      // La disponibilidad debe haber sido consultada sin que el usuario
      // tocara nada.
      expect(availabilityCalls, greaterThanOrEqualTo(1),
          reason:
              'El BookingTab debe auto-seleccionar el primer servicio y '
              'disparar la consulta de disponibilidad al cargar el catalogo.');
    },
  );
}
