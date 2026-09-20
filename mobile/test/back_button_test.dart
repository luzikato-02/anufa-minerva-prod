import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'support/pump.dart';

Future<void> _back(WidgetTester t) async {
  await t.binding.handlePopRoute();
  await t.pumpAndSettle();
}

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  testWidgets('Back from a module opened with go returns Home instead of leaving the app', (tester) async {
    await pumpSignedIn(tester, permissions: const ['tension-records.view', 'tension-records.create'], routes: const {}, path: '/dashboard');
    GoRouter router() => GoRouter.of(tester.element(find.byType(Scaffold).first));
    router().go('/twisting-tension');
    await tester.pumpAndSettle();
    await _back(tester);
    expect(router().state.uri.path, '/dashboard');
  });

  testWidgets('Back on Home is left to the system', (tester) async {
    await pumpSignedIn(tester, permissions: const [], routes: const {}, path: '/dashboard');
    var exited = false;
    tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(SystemChannels.platform, (call) async {
      if (call.method == 'SystemNavigator.pop') exited = true;
      return null;
    });
    addTearDown(() => tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(SystemChannels.platform, null));
    await _back(tester);
    expect(exited, isTrue);
  });
}
