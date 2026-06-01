import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../core/network/api_client.dart';
import '../repositories/mora_repository.dart';
import '../screens/root_screen.dart';
import '../state/app_state.dart';
import 'theme.dart';

class MoraApp extends StatelessWidget {
  const MoraApp({super.key});

  @override
  Widget build(BuildContext context) {
    return Consumer<AppState>(
      builder: (context, appState, _) {
        final repository = MoraRepository(
          apiClient: ApiClient(appState: appState),
          appState: appState,
        );

        return MaterialApp(
          title: 'Mora Mobile',
          debugShowCheckedModeBanner: false,
          theme: buildMoraTheme(),
          home: RootScreen(repository: repository),
        );
      },
    );
  }
}