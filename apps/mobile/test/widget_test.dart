import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:mora_mobile/app/theme.dart';

void main() {
  testWidgets('Mora theme renders a sample shell', (WidgetTester tester) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: buildMoraTheme(),
        home: const Scaffold(
          body: Center(
            child: Text('Mora Mobile'),
          ),
        ),
      ),
    );

    expect(find.text('Mora Mobile'), findsOneWidget);
  });
}
