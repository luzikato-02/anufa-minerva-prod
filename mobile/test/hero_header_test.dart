import 'dart:async';

import 'package:anufa_minerva_mobile/core/sync/online_state.dart';
import 'package:anufa_minerva_mobile/main.dart';
import 'package:anufa_minerva_mobile/features/dashboard/shifts.dart';
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

/// Reads the value printed above a KPI label in the hero.
String _kpi(WidgetTester t, String label) {
  final column = find.ancestor(of: find.text(label), matching: find.byType(Column)).first;
  return t.widget<Text>(find.descendant(of: column, matching: find.byType(Text)).first).data!;
}

Future<FakeAdapter> _home(WidgetTester t, {DateTime? at, List<String> perms = _perms, Map<String, dynamic>? payload}) => pumpSignedIn(
      t,
      permissions: perms,
      routes: {'GET /dashboard': (_) => (status: 200, body: payload ?? _dashboard)},
      path: '/dashboard',
      overrides: [clockProvider.overrideWith((ref) => Stream.value(at ?? DateTime(2026, 9, 19, 9, 30)))],
    );

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  testWidgets('the hero shows the date, shift, a time-aware greeting and the shift progress', (tester) async {
    final semantics = tester.ensureSemantics();
    await _home(tester, at: DateTime(2026, 9, 19, 9, 30));

    expect(find.text('Sat, 19 Sep · Shift A · 07:00–15:00'), findsOneWidget);
    expect(find.text('Good morning, Ana'), findsOneWidget);
    expect(find.bySemanticsLabel(RegExp('Shift A progress')), findsOneWidget); // 2.5h of 8h
    expect(tester.getSemantics(find.bySemanticsLabel(RegExp('Shift A progress'))).value, '31 percent');
    semantics.dispose();
  });

  testWidgets('the shift bar fills that share of a full-width track, 4px tall', (tester) async {
    await _home(tester, at: DateTime(2026, 9, 19, 11, 0)); // 4h of 8h
    final fill = tester.getRect(find.byKey(const Key('shift-bar-fill')));
    final track = tester.getRect(find.ancestor(of: find.byKey(const Key('shift-bar-fill')), matching: find.byType(ClipRRect)).first);
    expect(fill.height, 4);
    expect(fill.width / track.width, closeTo(0.5, 0.001));
  });

  testWidgets('the greeting and shift follow the clock, including the overnight shift', (tester) async {
    await _home(tester, at: DateTime(2026, 9, 19, 23, 30));
    expect(find.text('Good night, Ana'), findsOneWidget);
    expect(find.text('Sat, 19 Sep · Shift C · 23:00–07:00'), findsOneWidget);
  });

  testWidgets('KPIs come from the dashboard and the sync queue; a section the user cannot see shows a dash', (tester) async {
    await _home(tester);
    expect(_kpi(tester, 'records'), '12');
    expect(_kpi(tester, 'open'), '3');
    expect(_kpi(tester, 'rejected'), '0');
  });

  testWidgets('without tension access the tension KPIs are dashes', (tester) async {
    await _home(tester, perms: const [], payload: {'tension': null, 'stockTake': null, 'users': null});
    expect(_kpi(tester, 'records'), '–');
    expect(_kpi(tester, 'open'), '–');
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
