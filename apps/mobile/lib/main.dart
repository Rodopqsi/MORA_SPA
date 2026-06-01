import 'package:flutter/widgets.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import 'app/app.dart';
import 'state/app_state.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await initializeDateFormatting('es_PE');
  Intl.defaultLocale = 'es_PE';
  final appState = await AppState.bootstrap();

  runApp(
    ChangeNotifierProvider<AppState>.value(
      value: appState,
      child: const MoraApp(),
    ),
  );
}
