import 'dart:async';

import 'package:anufa_minerva_mobile/core/sync/online_state.dart';
import 'package:anufa_minerva_mobile/main.dart';
import 'package:anufa_minerva_mobile/features/dashboard/shifts.dart';
import 'package:anufa_minerva_mobile/features/dashboard/widgets/home_header.dart';
import 'package:anufa_minerva_mobile/features/dashboard/widgets/plied_cord_texture.dart';
import 'package:anufa_minerva_mobile/features/dashboard/widgets/summary_card.dart';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'support/fakes.dart';
import 'support/pump.dart';

const _perms = ['tension-records.view'];
final _dashboard = {
  'tension': {'total': 12, 'twisting': 7, 'weaving': 5, 'open_problems': 3},
  'stockTake': null,
  'users': null,
  'finishEarlier': null,
};

Future<FakeAdapter> _home(WidgetTester t, {DateTime? at, List<String> perms = _perms, Map<String, dynamic>? payload}) => pumpSignedIn(
      t,
      permissions: perms,
      routes: {'GET /dashboard': (_) => (status: 200, body: payload ?? _dashboard)},
      path: '/dashboard',
      overrides: [clockProvider.overrideWith((ref) => Stream.value(at ?? DateTime(2026, 9, 19, 9, 30)))],
    );

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  testWidgets('the hero shows the greeting with the shift line below it, and no progress bar or KPIs', (tester) async {
    await _home(tester, at: DateTime(2026, 9, 19, 9, 30));

    final greeting = find.text('Good morning, Ana');
    final shift = find.text('Sat, 19 Sep · Shift 2 · 08:00–16:00');
    expect(greeting, findsOneWidget);
    expect(shift, findsOneWidget);
    expect(tester.getTopLeft(shift).dy, greaterThan(tester.getBottomLeft(greeting).dy - 1)); // below the greeting
    expect(tester.getTopLeft(shift).dx, tester.getTopLeft(greeting).dx); // same leading edge

    expect(find.byKey(const Key('shift-bar-fill')), findsNothing);
    for (final label in ['records', 'open', 'rejected']) {
      expect(find.text(label), findsNothing);
    }
  });

  testWidgets('the hero carries no logo or app name, just the greeting and the shift line', (tester) async {
    await _home(tester);
    expect(find.descendant(of: find.byType(HomeHeader), matching: find.byType(Image)), findsNothing);
    expect(find.descendant(of: find.byType(HomeHeader), matching: find.text('Minerva')), findsNothing);
  });

  testWidgets('just after midnight it is shift 1 and still "night"', (tester) async {
    await _home(tester, at: DateTime(2026, 9, 19, 2, 0));
    expect(find.text('Good night, Ana'), findsOneWidget);
    expect(find.text('Sat, 19 Sep · Shift 1 · 00:00–08:00'), findsOneWidget);
  });

  testWidgets('in the late evening it is shift 3, which ends at 00:00', (tester) async {
    await _home(tester, at: DateTime(2026, 9, 19, 23, 30));
    expect(find.text('Good night, Ana'), findsOneWidget);
    expect(find.text('Sat, 19 Sep · Shift 3 · 16:00–00:00'), findsOneWidget);
  });

  testWidgets('the summary card still rides 40px over the hero edge on a 360dp phone at 1.4x text', (tester) async {
    tester.platformDispatcher.textScaleFactorTestValue = 1.4;
    addTearDown(tester.platformDispatcher.clearAllTestValues);
    await _home(tester);
    tester.view.physicalSize = const Size(720, 4800); // 360dp wide
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);

    final texture = tester.getRect(find.byType(PliedCordTexture)); // fills the hero
    final card = tester.getRect(find.byType(SummaryCard));
    expect(texture.bottom - card.top, closeTo(40, 0.5));
    expect(texture.width, 360);
  });

  testWidgets('the texture pauses while offline and animates when the connection returns', (tester) async {
    tester.view.physicalSize = const Size(800, 4800);
    tester.view.devicePixelRatio = 2;
    addTearDown(tester.view.reset);
    final net = StreamController<List<ConnectivityResult>>.broadcast();
    addTearDown(net.close);
    final adapter = FakeAdapter({
      'GET /auth/me': (_) => (status: 200, body: sessionJson(permissions: _perms)),
      'GET /dashboard': (_) => (status: 200, body: _dashboard),
    });
    await tester.pumpWidget(ProviderScope(
      overrides: [
        ...overridesFor(adapter, MemoryTokenStore('t'), net: net),
        connectivityCheckProvider.overrideWithValue(() async => [ConnectivityResult.wifi]),
      ],
      child: const MinervaApp(),
    ));
    for (var i = 0; i < 6; i++) {
      await tester.pump(const Duration(milliseconds: 250)); // sign-in and the first Home frames (no pumpAndSettle: it animates)
    }
    expect(find.byType(PliedCordTexture), findsOneWidget);
    expect(tester.binding.hasScheduledFrame, isTrue); // online: animating

    net.add([ConnectivityResult.none]);
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));
    expect(tester.binding.hasScheduledFrame, isFalse); // offline: held still

    net.add([ConnectivityResult.wifi]);
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));
    expect(tester.binding.hasScheduledFrame, isTrue);
  });
}
