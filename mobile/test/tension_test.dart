import 'package:anufa_minerva_mobile/core/files/file_opener.dart';
import 'package:anufa_minerva_mobile/features/tension/tension_models.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import 'support/pump.dart';

Map<String, dynamic> page(List rows) => {'data': rows, 'current_page': 1, 'last_page': 1, 'total': rows.length};

final _twisting = {
  'id': 7,
  'record_type': 'twisting',
  'created_at': '2026-09-17T03:00:00.000000Z',
  'form_data': {'machineNumber': 'T-01', 'dtexNumber': '1100', 'specTens': 40, 'tensPlus': 5},
  'metadata': {'operator': 'Ana', 'item_number': 'ITM-1', 'yarn_code': 'Y9', 'completed_measurements': 2, 'total_measurements': 2, 'progress_percentage': 100},
  'measurement_data': {'2': {'max': 44, 'min': 38}, '1': {'max': 41, 'min': 39}},
  'problems': [
    {'id': 'p1', 'spindleNumber': 2, 'description': 'Loose thread', 'status': 'open', 'timestamp': '2026-09-17T03:10:00Z'},
  ],
};

final _weaving = {
  'id': 9,
  'record_type': 'weaving',
  'created_at': '2026-09-17T03:00:00.000000Z',
  'form_data': {'machineNumber': 'W-3', 'productionOrder': 'PO123', 'specTens': 30, 'tensPlus': 3},
  'metadata': {'operator': 'Budi', 'item_number': 'FAB-1', 'status': 'in_progress', 'completed_measurements': 1, 'total_measurements': 4, 'progress_percentage': 25},
  'measurement_data': {
    'AI': {'A': {'1': {'max': 31, 'min': 29}}},
  },
  'problems': [],
};

void main() {
  test('model reads twisting spindles in numeric order and links problems', () {
    final pts = TensionRecord(Map<String, dynamic>.from(_twisting)).points;
    expect(pts.map((p) => p.label), ['1', '2']);
    expect(pts[1].problemStatus, 'open');
    expect(pts[0].problemStatus, isNull);
  });

  test('model flattens weaving side/row/column and survives PHP empty-array encoding', () {
    final pts = TensionRecord(Map<String, dynamic>.from(_weaving)).points;
    expect(pts.single.label, 'AI-A-Col1');
    expect(pts.single.key, ['AI', 'A', '1']);
    final empty = TensionRecord({'id': 1, 'record_type': 'weaving', 'measurement_data': [], 'form_data': [], 'metadata': [], 'problems': []});
    expect(empty.points, isEmpty);
    expect(empty.progress, 0);
  });

  testWidgets('list shows stats, cards and opens detail with chart, measurements and problems', (tester) async {
    await pumpSignedIn(tester, permissions: ['tension-records.view'], path: '/tension-records', routes: {
      'GET /tension-statistics': (_) => (status: 200, body: {'status': 'success', 'data': {'total_records': 5, 'twisting_records': 3, 'weaving_records': 2, 'twisting_problems': 1, 'weaving_problems': 0}}),
      'GET /tension-records': (o) => (status: 200, body: page(o.queryParameters['type'] == 'twisting' ? [_twisting] : [_weaving])),
      'GET /tension-records/7': (_) => (status: 200, body: {'status': 'success', 'data': _twisting}),
    });

    expect(find.text('ITM-1'), findsOneWidget);
    expect(find.text('1 open'), findsOneWidget);
    expect(find.text('2/2'), findsOneWidget);

    await tester.tap(find.text('ITM-1'));
    await tester.pumpAndSettle();
    expect(find.text('Twisting #7'), findsOneWidget);
    expect(find.text('Loose thread'), findsOneWidget);
    expect(find.text('Tension chart'), findsOneWidget);
    expect(find.text('Mark resolved'), findsNothing); // view-only user
  });

  testWidgets('editor can resolve a problem; request carries action and readings', (tester) async {
    final adapter = await pumpSignedIn(tester, permissions: ['tension-records.view', 'tension-records.edit'], path: '/tension-records/7', routes: {
      'GET /tension-records/7': (_) => (status: 200, body: {'status': 'success', 'data': _twisting}),
      'PATCH /tension-records/7/problems/p1/resolve': (_) => (status: 200, body: {'status': 'success'}),
    });

    await tester.tap(find.text('Mark resolved'));
    await tester.pumpAndSettle();
    await tester.enterText(find.widgetWithText(TextField, '').first, 'Replaced guide');
    await tester.tap(find.text('Mark resolved').last);
    await tester.pumpAndSettle();

    final req = adapter.requests.singleWhere((r) => r.method == 'PATCH');
    expect((req.data as Map)['action'], 'Replaced guide');
  });

  testWidgets('csv download goes through the file opener', (tester) async {
    final opener = _RecordingOpener();
    await pumpSignedIn(
      tester,
      permissions: ['tension-records.view'],
      path: '/tension-records/7',
      overrides: [fileOpenerProvider.overrideWithValue(opener)],
      routes: {
        'GET /tension-records/7': (_) => (status: 200, body: {'status': 'success', 'data': _twisting}),
        'GET /tension-records/7/download': (_) => (status: 200, body: 'a,b'),
      },
    );
    await tester.tap(find.byType(PopupMenuButton<String>));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Download CSV'));
    await tester.pumpAndSettle();
    expect(opener.names, ['tension-7.csv']);
  });

  testWidgets('weaving edit writes readings back into the nested side/row/column structure', (tester) async {
    final adapter = await pumpSignedIn(tester, permissions: ['tension-records.view', 'tension-records.edit'], path: '/tension-records/9/edit', routes: {
      'GET /tension-records/9': (_) => (status: 200, body: {'status': 'success', 'data': _weaving}),
      'PATCH /tension-records/9': (_) => (status: 200, body: {'status': 'success'}),
    });

    await tester.enterText(find.widgetWithText(TextField, '31').first, '33.5');
    await tester.scrollUntilVisible(find.text('Save changes'), 300, scrollable: find.byType(Scrollable).first);
    await tester.tap(find.text('Save changes'));
    await tester.pumpAndSettle();

    final sent = adapter.requests.singleWhere((r) => r.method == 'PATCH').data as Map;
    expect(sent['measurement_data'], {'AI': {'A': {'1': {'max': 33.5, 'min': 29}}}});
    expect((sent['metadata'] as Map)['status'], 'in_progress'); // untouched keys preserved
    expect((sent['form_data'] as Map)['specTens'], 30);
  });

  testWidgets('Back on the edit form asks before discarding changes, and not when nothing changed', (tester) async {
    await pumpSignedIn(tester, permissions: ['tension-records.view', 'tension-records.edit'], path: '/tension-records/9', routes: {
      'GET /tension-records/9': (_) => (status: 200, body: {'status': 'success', 'data': _weaving}),
    });
    GoRouter router() => GoRouter.of(tester.element(find.byType(Scaffold).first));
    Future<void> back() async {
      await tester.binding.handlePopRoute();
      await tester.pumpAndSettle();
    }

    router().push('/tension-records/9/edit');
    await tester.pumpAndSettle();
    await back(); // untouched: leaves straight away
    expect(router().state.uri.path, '/tension-records/9');

    router().push('/tension-records/9/edit');
    await tester.pumpAndSettle();
    await tester.enterText(find.widgetWithText(TextField, '31').first, '33.5');
    await back();
    expect(find.text('Discard changes?'), findsOneWidget);
    await tester.tap(find.text('Cancel'));
    await tester.pumpAndSettle();
    expect(router().state.uri.path, '/tension-records/9/edit'); // still editing
    await back();
    await tester.tap(find.text('Discard'));
    await tester.pumpAndSettle();
    expect(router().state.uri.path, '/tension-records/9');
  });

  testWidgets('edit route is blocked without the edit permission', (tester) async {
    await pumpSignedIn(tester, permissions: ['tension-records.view'], path: '/tension-records/7/edit', routes: {
      'GET /tension-records/7': (_) => (status: 200, body: {'status': 'success', 'data': _twisting}),
    });
    expect(find.text('Access denied'), findsWidgets);
  });
}

class _RecordingOpener implements FileOpener {
  final names = <String>[];
  @override
  Future<void> open(String filename, List<int> bytes) async => names.add(filename);
}
