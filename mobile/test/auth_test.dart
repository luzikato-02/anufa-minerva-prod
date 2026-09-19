import 'package:anufa_minerva_mobile/app/router.dart';
import 'package:anufa_minerva_mobile/core/theme/app_theme.dart';
import 'package:anufa_minerva_mobile/main.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'support/fakes.dart';

const _dashboard = {
  'tension': {'total': 12, 'twisting': 7, 'weaving': 5, 'open_problems': 3},
  'stockTake': null,
  'users': null,
};

Future<void> pumpApp(WidgetTester tester, FakeAdapter adapter, MemoryTokenStore store) async {
  tester.view.physicalSize = const Size(800, 1600);
  tester.view.devicePixelRatio = 2;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(ProviderScope(overrides: overridesFor(adapter, store), child: const MinervaApp()));
  await tester.pumpAndSettle();
}

void main() {
  test('tokens match the web neutral palette', () {
    expect(AppTokens.light.t.primary, const Color(0xFF171717));
    expect(AppTokens.dark.t.background, const Color(0xFF0A0A0A));
  });

  testWidgets('signed-out users land on login; wrong password shows the server error', (tester) async {
    final adapter = FakeAdapter({
      'POST /auth/login': (_) => (status: 422, body: {'message': 'x', 'errors': {'login': ['These credentials do not match our records.']}}),
    });
    await pumpApp(tester, adapter, MemoryTokenStore());

    expect(find.text('Log in to your account'), findsOneWidget);
    await tester.enterText(find.byType(TextField).first, 'ana');
    await tester.enterText(find.byType(TextField).last, 'bad');
    await tester.tap(find.text('Log in').last);
    await tester.pumpAndSettle();

    expect(find.text('These credentials do not match our records.'), findsOneWidget);
  });

  testWidgets('login with 2FA completes and shows only permitted dashboard + drawer items', (tester) async {
    final adapter = FakeAdapter({
      'POST /auth/login': (_) => (status: 200, body: {'two_factor': true, 'challenge': 'abc'}),
      'POST /auth/two-factor-challenge': (o) => (
            status: (o.data as Map)['code'] == '123456' ? 200 : 422,
            body: (o.data as Map)['code'] == '123456'
                ? sessionJson(permissions: ['tension-records.view'], token: 'tok')
                : {'message': 'bad', 'errors': {'code': ['The provided two factor authentication code was invalid.']}},
          ),
      'GET /dashboard': (_) => (status: 200, body: _dashboard),
    });
    final store = MemoryTokenStore();
    await pumpApp(tester, adapter, store);

    await tester.enterText(find.byType(TextField).first, 'ana');
    await tester.enterText(find.byType(TextField).last, 'pw');
    await tester.tap(find.text('Log in').last);
    await tester.pumpAndSettle();
    expect(find.text('Authentication code'), findsOneWidget);

    await tester.enterText(find.byType(TextField), '000000');
    await tester.tap(find.text('Continue'));
    await tester.pumpAndSettle();
    expect(find.text('The provided two factor authentication code was invalid.'), findsOneWidget);

    await tester.enterText(find.byType(TextField), '123456');
    await tester.tap(find.text('Continue'));
    await tester.pumpAndSettle();

    expect(store.token, 'tok');
    expect(find.text('Welcome back, Ana'), findsOneWidget);
    expect(find.text('Tension records'), findsOneWidget);
    expect(find.text('Stock taking'), findsNothing);

    await tester.tap(find.byTooltip('Open navigation menu'));
    await tester.pumpAndSettle();
    expect(find.text('Display: Tension Records'), findsOneWidget);
    expect(find.text('Record: Twisting Tension'), findsNothing); // needs tension-records.create
    expect(find.text('User & Role Management'), findsNothing);
  });

  testWidgets('a stored token restores the session; a rejected one falls back to login', (tester) async {
    final ok = FakeAdapter({
      'GET /auth/me': (_) => (status: 200, body: sessionJson()),
      'GET /dashboard': (_) => (status: 200, body: {'tension': null, 'stockTake': null, 'users': null}),
    });
    await pumpApp(tester, ok, MemoryTokenStore('good'));
    expect(find.text('Welcome back, Ana'), findsOneWidget);
    expect(find.text('No dashboard sections are available for your role.'), findsOneWidget);
  });

  testWidgets('revoked token is cleared and user is sent to login', (tester) async {
    final bad = FakeAdapter({'GET /auth/me': (_) => (status: 401, body: {'message': 'Unauthenticated.'})});
    final store = MemoryTokenStore('stale');
    await pumpApp(tester, bad, store);
    expect(find.text('Log in to your account'), findsOneWidget);
    expect(store.token, isNull);
  });

  testWidgets('routes are permission-guarded', (tester) async {
    final adapter = FakeAdapter({
      'GET /auth/me': (_) => (status: 200, body: sessionJson()),
      'GET /dashboard': (_) => (status: 200, body: {'tension': null, 'stockTake': null, 'users': null}),
    });
    await pumpApp(tester, adapter, MemoryTokenStore('t'));
    final container = ProviderScope.containerOf(tester.element(find.byType(MaterialApp)));
    container.read(routerProvider).go('/users');
    await tester.pumpAndSettle();
    expect(find.text('Access denied'), findsWidgets);
  });
}
