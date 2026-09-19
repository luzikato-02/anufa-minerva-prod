import 'dart:ui' show Size;

import 'package:anufa_minerva_mobile/features/dashboard/widgets/stat_pager.dart';
import 'package:flutter/material.dart' show AnimatedContainer, Offset, Text;
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'support/fakes.dart';
import 'support/pump.dart';

const _all = ['tension-records.view', 'stock-take.view', 'finish-earlier.view'];

Map<String, dynamic> _payload({bool finish = true}) => {
      'tension': {'total': 12, 'twisting': 7, 'weaving': 5, 'open_problems': 3},
      'stockTake': {'total': 4, 'in_progress': 1, 'completed': 3, 'completion': 75},
      'users': null,
      if (finish) 'finishEarlier': {'total': 12, 'this_week': 4},
    };

Future<FakeAdapter> _home(WidgetTester t, {List<String> perms = _all, Map<String, dynamic>? payload}) =>
    pumpSignedIn(t, permissions: perms, routes: {'GET /dashboard': (_) => (status: 200, body: payload ?? _payload())}, path: '/dashboard');

Future<void> _swipe(WidgetTester t) async {
  await t.drag(find.byType(StatPager), const Offset(-200, 0));
  await t.pumpAndSettle();
}

Finder get _dots => find.descendant(of: find.byType(StatPager), matching: find.byType(AnimatedContainer));

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  testWidgets('swiping the summary card moves through the modules the user can see', (tester) async {
    await _home(tester);
    expect(find.text('Tension records'), findsOneWidget);
    expect(find.text('12'), findsOneWidget);
    expect(_dots, findsNWidgets(3));

    await _swipe(tester);
    expect(find.text('Stock taking'), findsOneWidget);
    expect(find.text('75%'), findsOneWidget);
    expect(find.text('complete · 1 in progress'), findsOneWidget);

    await _swipe(tester);
    expect(find.text('Finish earlier'), findsOneWidget);
    expect(find.text('this week · 12 total'), findsOneWidget);
  });

  testWidgets('tapping a dot jumps to that page', (tester) async {
    await _home(tester);
    await tester.tap(_dots.at(2));
    await tester.pumpAndSettle();
    expect(find.text('Finish earlier'), findsOneWidget);
    await tester.tap(_dots.at(1));
    await tester.pumpAndSettle();
    expect(find.text('Stock taking'), findsOneWidget);
  });

  testWidgets('tapping the stat opens that module', (tester) async {
    await _home(tester);
    await _swipe(tester);
    await tester.tap(find.text('75%'));
    await tester.pumpAndSettle();
    expect(find.text('Stock Take Records'), findsWidgets); // the screen's app bar title
  });

  testWidgets('one module means no dots and nothing to swipe', (tester) async {
    await _home(tester, perms: ['tension-records.view'], payload: {'tension': _payload()['tension'], 'stockTake': null, 'users': null, 'finishEarlier': null});
    expect(find.text('Tension records'), findsOneWidget);
    expect(_dots, findsNothing);
  });

  testWidgets('an older server without finishEarlier still shows the other two pages', (tester) async {
    await _home(tester, payload: _payload(finish: false));
    expect(_dots, findsNWidgets(2));
    await _swipe(tester);
    expect(find.text('Stock taking'), findsOneWidget);
  });

  testWidgets('screen readers hear the module, its numbers and the position, and can move on', (tester) async {
    final semantics = tester.ensureSemantics();
    await _home(tester);
    expect(find.bySemanticsLabel(RegExp('Tension records, 12 records, 3 open problems, 1 of 3')), findsOneWidget);
    expect(tester.getSemantics(find.byType(StatPager)).getSemanticsData().customSemanticsActionIds, hasLength(2)); // next and previous stat

    await _swipe(tester);
    expect(find.bySemanticsLabel(RegExp('Stock taking, 75 percent complete, 1 session in progress, 2 of 3')), findsOneWidget);
    semantics.dispose();
  });

  testWidgets('three pages fit at 320 wide with the largest text the app allows', (tester) async {
    tester.platformDispatcher.textScaleFactorTestValue = 1.4;
    addTearDown(tester.platformDispatcher.clearAllTestValues);
    await _home(tester);
    tester.view.physicalSize = const Size(640, 4800); // 320dp wide
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
    await _swipe(tester);
    await _swipe(tester);
    expect(tester.takeException(), isNull);
    expect(find.text('Finish earlier'), findsOneWidget);
    expect(find.byType(Text), findsWidgets);
  });
}
