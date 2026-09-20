import 'dart:ui' show Size;

import 'package:anufa_minerva_mobile/features/dashboard/home_data.dart';
import 'package:anufa_minerva_mobile/features/dashboard/widgets/daily_bar_chart.dart';
import 'package:anufa_minerva_mobile/features/dashboard/widgets/module_tile.dart';
import 'package:anufa_minerva_mobile/features/dashboard/widgets/notice_banner.dart';
import 'package:anufa_minerva_mobile/features/dashboard/widgets/problems_carousel.dart';
import 'package:anufa_minerva_mobile/main.dart';
import 'package:flutter/material.dart' show BoxConstraints, Container, Image, InkWell, Offset, Text, Scrollable;
import 'package:flutter_riverpod/flutter_riverpod.dart' show ProviderScope;
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'support/fakes.dart';
import 'support/pump.dart';

const _perms = ['tension-records.view', 'stock-take.view', 'finish-earlier.view', 'users.view'];

Map<String, dynamic> _problem(int i, {String type = 'twisting', int? spindle = 2, String? position}) => {
      'record_id': 7 + i,
      'problem_id': 'p$i',
      'record_type': type,
      'spindle_number': spindle,
      'position': position,
      'description': 'Problem number $i',
      'item_number': 'ITM-$i',
      'machine_number': 'T-0$i',
      'status': 'open',
      'timestamp': '2026-09-17T0$i:10:00Z',
    };

Map<String, dynamic> _page(List rows) => {'data': rows, 'current_page': 1, 'last_page': 1, 'total': rows.length};

Map<String, dynamic> _trend(String type, {int days = 14}) => {
      'status': 'success',
      'data': {
        'type': type,
        'days': [
          for (var i = 0; i < days; i++) {'date': '2026-09-${(4 + i).toString().padLeft(2, '0')}', 'problems': i % 3, 'measurements': 10 * i},
        ],
      },
    };

final _dashboard = {
  'tension': {'total': 12, 'twisting': 7, 'weaving': 5, 'open_problems': 3},
  'stockTake': null,
  'users': null,
  'finishEarlier': null,
};

Map<String, Handler> _routes({List<Map<String, dynamic>>? problems, Handler? trends}) => {
      'GET /dashboard': (_) => (status: 200, body: _dashboard),
      'GET /tension-problems': (_) => (status: 200, body: _page(problems ?? [for (var i = 1; i <= 5; i++) _problem(i)])),
      'GET /tension-trends': trends ?? (o) => (status: 200, body: _trend('${o.queryParameters['type']}')),
      'GET /tension-records/8': (_) => (status: 200, body: {'status': 'success', 'data': {'id': 8, 'record_type': 'twisting', 'created_at': '2026-09-17T03:00:00.000000Z', 'form_data': {}, 'metadata': {'operator': 'Ana'}, 'measurement_data': <String, dynamic>{}, 'problems': []}}),
      'GET /tension-statistics': (_) => (status: 200, body: {'data': {'total_records': 1, 'twisting_records': 1, 'weaving_records': 0, 'twisting_problems': 0, 'weaving_problems': 0}}),
      'GET /tension-records': (_) => (status: 200, body: _page([])),
    };

Future<FakeAdapter> _home(WidgetTester t, {Map<String, Handler>? routes, List<String> perms = _perms}) =>
    pumpSignedIn(t, permissions: perms, routes: routes ?? _routes(), path: '/dashboard');

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  group('carousel grouping', () {
    List<ReportedProblem> list(int n) => [for (var i = 1; i <= n; i++) ReportedProblem.fromJson(_problem(i))];

    test('after the big first card, problems come two to a section', () {
      final rest = list(6).skip(1).toList();
      expect(pairUp(rest).map((p) => p.length), [2, 2, 1]);
      expect(pairUp([]), isEmpty);
    });

    test('a problem says where it happened, with its record context', () {
      final p = ReportedProblem.fromJson(_problem(1));
      expect(p.where, 'Spindle 2');
      expect(p.context, 'Twisting · ITM-1 · Machine T-01');
      expect(ReportedProblem.fromJson(_problem(2, type: 'weaving', spindle: null, position: 'AI-A-Col3')).where, 'AI-A-Col3');
    });
  });

  test('the y axis tops out at a clean number and never below the minimum', () {
    expect(axisFor(0).max, 4);
    expect(axisFor(3).max, 4);
    expect(axisFor(5, minTop: 4), (max: 6.0, interval: 2.0));
    expect(axisFor(300, minTop: 10), (max: 300.0, interval: 100.0));
    expect(axisFor(1180).max, 1500); // four steps of 500 would top out at 2000; three fit
  });

  testWidgets('Home lists the newest open problems: one big card, then compact ones', (tester) async {
    await _home(tester);
    expect(find.text('Reported problems'), findsOneWidget);
    expect(find.text('Open'), findsOneWidget); // the big card's badge
    expect(find.text('Problem number 1'), findsOneWidget);
    expect(find.text('Spindle 2 · Twisting'), findsWidgets); // compact cards
    await tester.tap(find.text('Problem number 1'));
    await tester.pumpAndSettle();
    expect(find.text('Details'), findsOneWidget); // the record's detail screen
  });

  testWidgets('with no open problems it says so; a failed load can be retried', (tester) async {
    await _home(tester, routes: _routes(problems: []));
    expect(find.text('No open problems'), findsOneWidget);
  });

  testWidgets('View all opens Tension Records on the Problems tab', (tester) async {
    await _home(tester);
    await tester.tap(find.text('View all'));
    await tester.pumpAndSettle();
    expect(find.text('Search description, machine, item'), findsOneWidget);
  });

  testWidgets('trends: twisting first, the Weaving tab loads that type, and a table view lists every day', (tester) async {
    final adapter = await _home(tester);
    expect(find.text('Reported problems per day'), findsOneWidget);
    expect(find.text('Measurements per day'), findsOneWidget);
    expect(adapter.requests.where((r) => r.path == '/tension-trends').single.queryParameters['type'], 'twisting');
    expect(adapter.requests.firstWhere((r) => r.path == '/tension-trends').queryParameters['days'], 14);

    await tester.tap(find.widgetWithText(InkWell, 'Weaving').last);
    await tester.pumpAndSettle();
    expect(adapter.requests.where((r) => r.path == '/tension-trends').map((r) => r.queryParameters['type']), ['twisting', 'weaving']);

    await tester.ensureVisible(find.text('View as table').first);
    await tester.tap(find.text('View as table').first);
    await tester.pumpAndSettle();
    expect(find.text('Hide table'), findsOneWidget);
    expect(find.text('Thu 17 Sep'), findsWidgets); // the newest of the 14 days
  });

  testWidgets('an older server without the trends endpoint just leaves the section out', (tester) async {
    await _home(tester, routes: _routes(trends: (_) => (status: 404, body: {'message': 'Not Found'})));
    expect(find.text('Trends'), findsNothing);
    expect(find.text('Reported problems'), findsOneWidget); // the rest of Home is unaffected
  });

  testWidgets('without tension access neither section is requested', (tester) async {
    final adapter = await _home(tester, perms: const ['stock-take.view'], routes: _routes());
    expect(find.text('Reported problems'), findsNothing);
    expect(adapter.requests.where((r) => r.path == '/tension-problems' || r.path == '/tension-trends'), isEmpty);
  });

  testWidgets('module icons are 64dp tiles', (tester) async {
    await _home(tester);
    final iconBox = find.descendant(
      of: find.byType(ModuleTile).first,
      matching: find.byWidgetPredicate((w) => w is Container && w.constraints == BoxConstraints.tightFor(width: 64, height: 64)),
    );
    expect(iconBox, findsOneWidget);
    expect(find.byType(NoticeBanner), findsNothing); // nothing to act on, so no alert
  });

  testWidgets('a rejected upload shows the alert above the module tiles', (tester) async {
    tester.view.physicalSize = const Size(800, 4800);
    tester.view.devicePixelRatio = 2;
    addTearDown(tester.view.reset);
    tester.platformDispatcher.accessibilityFeaturesTestValue = const FakeAccessibilityFeatures(disableAnimations: true);
    addTearDown(tester.platformDispatcher.clearAccessibilityFeaturesTestValue);
    final adapter = FakeAdapter({'GET /auth/me': (_) => (status: 200, body: sessionJson(permissions: _perms)), ..._routes()});
    final rejected = {'id': 'r1', 'method': 'POST', 'path': '/tension-records', 'data': <String, dynamic>{}, 'label': 'Twisting · ITM-1', 'createdAt': '2026-09-17T09:00:00', 'attempts': 1, 'error': 'Rejected', 'failed': true};
    await tester.pumpWidget(ProviderScope(overrides: overridesFor(adapter, MemoryTokenStore('t'), queue: MemoryQueueStorage([rejected])), child: const MinervaApp()));
    await tester.pumpAndSettle();

    expect(find.byType(NoticeBanner), findsOneWidget);
    expect(tester.getRect(find.byType(NoticeBanner)).bottom, lessThan(tester.getRect(find.byType(ModuleTile).first).top));
  });

  testWidgets('All modules opens a sheet from below with the logo centred, not the drawer', (tester) async {
    await _home(tester, perms: const ['tension-records.view', 'stock-take.view', 'finish-earlier.view', 'finish-earlier.create']);
    await tester.tap(find.widgetWithText(InkWell, 'All modules'));
    await tester.pumpAndSettle();

    final logo = find.byWidgetPredicate((w) => w is Image && w.semanticLabel == 'Minerva logo');
    expect(logo, findsOneWidget);
    final screen = tester.view.physicalSize.width / tester.view.devicePixelRatio;
    expect(tester.getCenter(logo).dx, closeTo(screen / 2, 1));
    expect(find.text('Record: Twisting Tension'), findsNothing); // needs tension-records.create
    expect(find.text('Display: Tension Records'), findsOneWidget);
    expect(find.text('Scan: Finish Earlier Form'), findsOneWidget);
    expect(find.text('User & Role Management'), findsNothing); // no permission
    expect(find.byType(Scrollable), findsWidgets);

    await tester.tap(find.text('Display: Tension Records'));
    await tester.pumpAndSettle();
    expect(find.text('Search description, machine, item'), findsNothing); // on the Twisting tab, not Problems
    expect(find.text('Tension Records'), findsWidgets);
  });

  testWidgets('module tiles hold four columns on a normal phone and drop to three on a very narrow one', (tester) async {
    await _home(tester);
    Iterable<double> rowsOfFirstFour() => [for (var i = 0; i < 5; i++) tester.getTopLeft(find.byType(ModuleTile).at(i)).dy];
    final wide = rowsOfFirstFour().toList();
    expect(wide[3], wide[0]); // 400dp: the fourth tile is on the first row
    tester.view.physicalSize = const Size(720, 4800); // 360dp, the most common Android width
    await tester.pumpAndSettle();
    final common = rowsOfFirstFour().toList();
    expect(common[3], common[0]);
    tester.view.physicalSize = const Size(600, 4800); // 300dp
    await tester.pumpAndSettle();
    final narrow = rowsOfFirstFour().toList();
    expect(narrow[2], narrow[0]);
    expect(narrow[3], greaterThan(narrow[0])); // the fourth wraps to a second row
  });

  testWidgets('the new sections fit at 320 wide with the largest text the app allows', (tester) async {
    tester.platformDispatcher.textScaleFactorTestValue = 1.4;
    addTearDown(tester.platformDispatcher.clearAllTestValues);
    await _home(tester);
    tester.view.physicalSize = const Size(640, 4800);
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
    expect(find.byType(Text), findsWidgets);
    expect(tester.getSize(find.byType(ProblemsSection)).width, 320);
    await tester.drag(find.byType(Scrollable).first, const Offset(0, -300));
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
  });
}
