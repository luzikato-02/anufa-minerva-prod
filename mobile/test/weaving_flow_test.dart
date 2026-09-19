import 'package:anufa_minerva_mobile/core/sync/sync_queue.dart';
import 'package:anufa_minerva_mobile/features/tension/recording/weaving_controller.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'support/fakes.dart';
import 'support/pump.dart';

Future<void> _keys(WidgetTester t, String digits) async {
  for (final d in digits.split('')) {
    await t.tap(find.widgetWithText(InkWell, d).first);
    await t.pump();
  }
}

Future<FakeAdapter> _openSelect(WidgetTester t, Map<String, Handler> routes, {List<String> perms = const ['tension-records.create']}) =>
    pumpSignedIn(t, permissions: perms, path: '/weaving-tension', routes: routes);

Future<void> _create(WidgetTester t, String po) async {
  await t.enterText(find.byType(TextField).first, po);
  await t.tap(find.text('Create New Session'));
  await t.pumpAndSettle();
}

Future<void> _fillParamsAndStart(WidgetTester t) async {
  await t.enterText(find.byType(TextField).at(0), 'FAB-1'); // item
  await t.enterText(find.byType(TextField).at(6), '30'); // spec
  await t.enterText(find.byType(TextField).at(7), '3'); // ±
  await t.enterText(find.byType(TextField).at(8), 'W-3'); // machine
  await t.tap(find.text('Start Recording'));
  await t.pumpAndSettle();
}

final _session = {
  'id': 77,
  'record_type': 'weaving',
  'form_data': {'productionOrder': 'PO5', 'itemNumber': 'FAB-9', 'specTens': 30, 'tensPlus': 3, 'machineNumber': 'W-1'},
  'measurement_data': {'AI': {'A': {'1': {'max': 31, 'min': 29, 'updatedAt': '2026-09-01T00:00:00Z'}}}},
  'problems': [],
  'metadata': {'status': 'in_progress'},
};

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  testWidgets('a production order is required', (tester) async {
    await _openSelect(tester, {});
    await tester.tap(find.text('Create New Session'));
    await tester.pump();
    expect(find.text('Enter a production order number first.'), findsOneWidget);
  });

  testWidgets('Create New on an existing session offers to continue it and hydrates from the server', (tester) async {
    await _openSelect(tester, {
      'GET /tension-records/session/PO5': (_) => (status: 200, body: {'status': 'success', 'data': _session}),
    });
    await _create(tester, 'PO5');
    expect(find.text('Session already exists'), findsOneWidget);

    await tester.tap(find.text('Continue session'));
    await tester.pumpAndSettle();

    expect(find.text('Weaving Tension Recorder'), findsOneWidget);
    expect(find.widgetWithText(TextField, 'FAB-9'), findsOneWidget); // form came from the server
    expect(find.text('Resume Recording'), findsOneWidget); // grid has readings
  });

  testWidgets('Continue with no session shows an error', (tester) async {
    await _openSelect(tester, {
      'GET /tension-records/session/NOPE': (_) => (status: 404, body: {'status': 'error', 'message': 'No in-progress session found'}),
    });
    await tester.enterText(find.byType(TextField).first, 'NOPE');
    await tester.tap(find.text('Continue Session'));
    await tester.pumpAndSettle();
    expect(find.text('No in-progress session found for "NOPE".'), findsOneWidget);
  });

  testWidgets('new session: starts on the server, autosaves after entries, finishes with PUT status completed', (tester) async {
    final adapter = await _openSelect(tester, {
      'GET /tension-records/session/PO7': (_) => (status: 404, body: {'status': 'error'}),
      'POST /tension-records/start-session': (_) => (status: 201, body: {'status': 'success', 'data': {'id': 90}}),
      'PUT /tension-records/90': (_) => (status: 200, body: {'status': 'success', 'data': {'id': 90}}),
    });
    await _create(tester, 'PO7');
    await _fillParamsAndStart(tester);

    final start = adapter.requests.singleWhere((r) => r.path == '/tension-records/start-session').data as Map;
    expect((start['form_data'] as Map)['productionOrder'], 'PO7');
    expect(find.text('AI-A-Col1'), findsOneWidget);

    await _keys(tester, '36');
    await tester.tap(find.text('Submit Max'));
    await tester.pump();
    await tester.pump(WeavingController.autosaveDelay + const Duration(milliseconds: 50));
    await tester.pump();

    final auto = adapter.requests.where((r) => r.method == 'PUT').last.data as Map;
    expect(((auto['measurement_data'] as Map)['AI'] as Map)['A'], isNotEmpty);
    expect((auto['metadata'] as Map)['status'], 'in_progress');

    await tester.tap(find.text('Finish'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('No, keep data'));
    await tester.pumpAndSettle();

    expect(find.text('Saved'), findsOneWidget);
    final done = adapter.requests.where((r) => r.method == 'PUT').last.data as Map;
    expect((done['metadata'] as Map)['status'], 'completed');
    expect(done['client_uuid'], isNotEmpty);
  });

  testWidgets('navigating the creel and reporting a problem targets the right position', (tester) async {
    await _openSelect(tester, {
      'GET /tension-records/session/PO8': (_) => (status: 404, body: {}),
      'POST /tension-records/start-session': (_) => (status: 201, body: {'data': {'id': 91}}),
      'PUT /tension-records/91': (_) => (status: 200, body: {}),
    });
    await _create(tester, 'PO8');
    await _fillParamsAndStart(tester);

    await tester.tap(find.byTooltip('Next Side'));
    await tester.tap(find.byTooltip('Next Row'));
    await tester.pump();
    expect(find.text('BI-B-Col1'), findsOneWidget);

    await tester.tap(find.textContaining('Report problem for BI-B-Col1'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField).first, 'Yarn snapped');
    await tester.tap(find.text('Submit problem'));
    await tester.pumpAndSettle();

    final container = ProviderScope.containerOf(tester.element(find.byType(MaterialApp)));
    final p = container.read(weavingControllerProvider).problems.single;
    expect((p.position, p.description), ('BI-B-Col1', 'Yarn snapped'));
  });

  testWidgets('server unreachable at start: records offline, then finishing queues a completed POST', (tester) async {
    final adapter = await _openSelect(tester, {
      'POST /tension-records': (_) => (status: 201, body: {'status': 'success', 'data': {'id': 5}}),
    });
    adapter.offline = true;
    await _create(tester, 'PO9'); // existence check fails => treated as "no session"
    await _fillParamsAndStart(tester);
    expect(find.text('AI-A-Col1'), findsOneWidget); // still recording

    await _keys(tester, '36');
    await tester.tap(find.text('Submit Max'));
    await tester.pump();
    await tester.tap(find.text('Finish'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Yes, clear all'));
    await tester.pumpAndSettle();
    expect(find.text('Saved on this device'), findsOneWidget);

    final container = ProviderScope.containerOf(tester.element(find.byType(MaterialApp)));
    final op = container.read(syncQueueProvider).ops.single;
    expect((op.method, op.path), ('POST', '/tension-records'));
    expect((op.data['metadata'] as Map)['status'], 'completed'); // must not stay "resumable"
  });
}
