import 'package:anufa_minerva_mobile/app/router.dart';
import 'package:anufa_minerva_mobile/main.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';

import 'fakes.dart';

/// Boots the app signed in (stored token) with the given fake API and opens [path].
Future<FakeAdapter> pumpSignedIn(
  WidgetTester tester, {
  required List<String> permissions,
  required Map<String, Handler> routes,
  required String path,
  List<Override> overrides = const [],
}) async {
  tester.view.physicalSize = const Size(800, 4800);
  tester.view.devicePixelRatio = 2;
  addTearDown(tester.view.reset);
  final adapter = FakeAdapter({
    'GET /auth/me': (_) => (status: 200, body: sessionJson(permissions: permissions)),
    'GET /dashboard': (_) => (status: 200, body: {'tension': null, 'stockTake': null, 'users': null}),
    ...routes,
  });
  await tester.pumpWidget(ProviderScope(overrides: [...overridesFor(adapter, MemoryTokenStore('t')), ...overrides], child: const MinervaApp()));
  await tester.pumpAndSettle();
  ProviderScope.containerOf(tester.element(find.byType(MaterialApp))).read(routerProvider).go(path);
  await tester.pumpAndSettle();
  return adapter;
}
