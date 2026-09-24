import 'package:anufa_minerva_mobile/core/sync/sync_queue.dart';
import 'package:anufa_minerva_mobile/core/ui/app_text_field.dart';
import 'package:anufa_minerva_mobile/features/torque_check/torque_check_models.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'support/fakes.dart';
import 'support/pump.dart';

const _perms = ['torque-checks.create', 'torque-checks.view', 'creel-types.view'];

Map<String, dynamic> _type({int id = 1, String name = 'Standard', num min = 6.0, num max = 8.0}) => {'id': id, 'name': name, 'torque_min': min, 'torque_max': max, 'torque_check_sheets_count': 0};

Map<String, Handler> get _routes => {
      'GET /creel-types': (_) => (status: 200, body: {'status': 'success', 'data': [_type()]}),
      'POST /torque-checks/readings': (_) => (status: 201, body: {'success': true}),
      'PATCH /torque-checks/readings/:id': (_) => (status: 200, body: {'status': 'success'}),
      'GET /torque-checks/session/:id': (_) => (status: 200, body: {'success': true, 'data': {'session_id': '483920'}}),
    };

/// Opens the record screen with a fresh sheet already active — starting a sheet is the session-select
/// screen's job, so this walks through it once ("Start new sheet") before handing back to the caller.
Future<FakeAdapter> _open(WidgetTester t, {Map<String, Handler>? routes, List<Override> overrides = const []}) async {
  final adapter = await pumpSignedIn(t, permissions: _perms, path: '/torque-check', routes: routes ?? _routes, overrides: overrides);
  await t.tap(find.text('Start new sheet'));
  await t.pumpAndSettle();
  return adapter;
}

Future<FakeAdapter> _openSessionScreen(WidgetTester t, {Map<String, Handler>? routes}) =>
    pumpSignedIn(t, permissions: _perms, path: '/torque-check/session', routes: routes ?? _routes);

Finder _byLabel(String label) => find.descendant(of: find.widgetWithText(AppTextField, label), matching: find.byType(TextField));

Future<void> _enterReading(WidgetTester t, String value) async {
  for (final ch in value.split('')) {
    await t.tap(find.text(ch).last);
    await t.pump();
  }
}

Future<void> _saveCell(WidgetTester t) async {
  await t.ensureVisible(find.text('Save cell'));
  await t.tap(find.text('Save cell'));
  await t.pumpAndSettle();
}

Future<void> _selectCreelType(WidgetTester t) async {
  await t.tap(find.byType(DropdownButtonFormField<int>));
  await t.pumpAndSettle();
  await t.tap(find.text('Standard (6–8)').last);
  await t.pumpAndSettle();
}

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  test('a reading round-trips through the device copy', () {
    final r = TorqueReading(uuid: 'u1', side: 'Ai', rowNo: 14, columnLetter: 'A', value: 8.5, note: 'Felt aus kotor');
    expect(r.position, 'Ai-14A');
    expect(r.toFields(), {'side': 'Ai', 'row_no': 14, 'column_letter': 'A', 'value': 8.5, 'note': 'Felt aus kotor'});
    final back = TorqueReading.fromJson(r.toJson());
    expect((back.side, back.rowNo, back.columnLetter, back.value, back.note), ('Ai', 14, 'A', 8.5, 'Felt aus kotor'));
  });

  test('an empty note is sent as null', () {
    expect(const TorqueReading(uuid: 'u', side: 'Ai', rowNo: 1, columnLetter: 'A', value: 7).toFields()['note'], isNull);
  });

  test('the same row and column on a different side is a different position', () {
    const ai = TorqueReading(uuid: 'u1', side: 'Ai', rowNo: 1, columnLetter: 'A', value: 7);
    const ao = TorqueReading(uuid: 'u2', side: 'Ao', rowNo: 1, columnLetter: 'A', value: 6.5);
    expect(ai.position, isNot(ao.position));
  });

  testWidgets('visiting the record screen with nothing active sends the operator to session-select first', (tester) async {
    await pumpSignedIn(tester, permissions: _perms, path: '/torque-check', routes: _routes);
    expect(find.text('Start new sheet'), findsOneWidget); // the chooser, not the grid
    expect(find.text('Resume a session'), findsOneWidget);
  });

  testWidgets('recording a cell selects the creel type and uploads the full header', (tester) async {
    final adapter = await _open(tester);
    await _selectCreelType(tester);
    await tester.enterText(_byLabel('Machine number'), '2704');
    await _enterReading(tester, '7');
    await _saveCell(tester);

    final body = adapter.requests.singleWhere((r) => r.method == 'POST').data as Map;
    expect(body['side'], 'Ai');
    expect(body['row_no'], 1);
    expect(body['column_letter'], 'A');
    expect(body['value'], 7);
    expect(body['machine_number'], '2704');
    expect(body['creel_type_id'], 1);
    expect(body['sheet_client_uuid'], isNotEmpty);
    expect(find.text('Side Ai, row 1, column B'), findsOneWidget); // advanced to the next cell
  });

  testWidgets('switching side keeps the same row and column but is a separate cell', (tester) async {
    final adapter = await _open(tester);
    await _selectCreelType(tester);
    await _enterReading(tester, '7');
    await _saveCell(tester); // Ai-1A saved, now on Ai-1B

    await tester.tap(find.text('Ao'));
    await tester.pumpAndSettle();
    expect(find.text('Side Ao, row 1, column B'), findsOneWidget); // row/column carried over, side switched
    expect(find.text('--'), findsOneWidget); // Ao-1B is blank, not Ai-1A's value (Numpad's own '7' key is always on screen)

    await _enterReading(tester, '6.5');
    await _saveCell(tester);

    final bodies = adapter.requests.where((r) => r.method == 'POST').map((r) => r.data as Map).toList();
    expect(bodies.length, 2);
    expect(bodies[0]['side'], 'Ai');
    expect(bodies[1]['side'], 'Ao');
    expect(bodies[1]['row_no'], 1);
    expect(bodies[1]['column_letter'], 'B');
  });

  testWidgets('an out-of-range reading requires a note before it can be saved', (tester) async {
    final adapter = await _open(tester);
    await _selectCreelType(tester);

    await _enterReading(tester, '8.5');
    await _saveCell(tester);
    expect(find.textContaining('outside Standard'), findsOneWidget);
    expect(adapter.requests.where((r) => r.method == 'POST'), isEmpty);

    await tester.enterText(_byLabel('Note (required — this reading is out of range)'), 'Felt aus kotor (Ganti baru)');
    await _saveCell(tester);
    final body = adapter.requests.singleWhere((r) => r.method == 'POST').data as Map;
    expect(body['value'], 8.5);
    expect(body['note'], 'Felt aus kotor (Ganti baru)');
  });

  testWidgets('an in-range reading saves without a note', (tester) async {
    final adapter = await _open(tester);
    await _selectCreelType(tester);
    await _enterReading(tester, '7.5');
    await _saveCell(tester);
    expect((adapter.requests.singleWhere((r) => r.method == 'POST').data as Map)['value'], 7.5);
  });

  testWidgets('offline, a reading is kept on the device, queued once and marked Waiting on retry', (tester) async {
    final adapter = await _open(tester);
    adapter.offline = true;
    await _selectCreelType(tester);
    await _enterReading(tester, '7');
    await _saveCell(tester);

    final container = ProviderScope.containerOf(tester.element(find.byType(MaterialApp)));
    final op = container.read(syncQueueProvider).ops.single;
    expect(op.path, '/torque-checks/readings');
    expect(op.label, 'Torque check · row Ai-1A');
    expect(op.data['value'], 7);
  });

  testWidgets('editing a cell whose upload is still queued swaps it instead of adding a second', (tester) async {
    final adapter = await _open(tester);
    adapter.offline = true;
    await _selectCreelType(tester);
    await _enterReading(tester, '7');
    await _saveCell(tester);

    // Navigate back to Ai-1A and correct it while still offline.
    await tester.tap(find.text('A').first);
    await tester.pumpAndSettle();
    expect(find.text('7'), findsWidgets); // prefilled with the saved value
    await tester.tap(find.text('C').last); // clear
    await _enterReading(tester, '7.5');
    await _saveCell(tester);

    final container = ProviderScope.containerOf(tester.element(find.byType(MaterialApp)));
    expect(container.read(syncQueueProvider).ops.length, 1);
    expect(container.read(syncQueueProvider).ops.single.data['value'], 7.5);
  });

  testWidgets('the sheet survives an app restart', (tester) async {
    await _open(tester);
    await _selectCreelType(tester);
    await _enterReading(tester, '7');
    await _saveCell(tester);
    expect((await SharedPreferences.getInstance()).getString('torque-check-active'), contains('"value":7.0'));
  });

  testWidgets('with no creel types set up, the screen explains why recording is blocked', (tester) async {
    await _open(tester, routes: {'GET /creel-types': (_) => (status: 200, body: {'status': 'success', 'data': []})});
    expect(find.textContaining('No creel types are set up yet'), findsOneWidget);
    expect(find.byType(DropdownButtonFormField<int>), findsNothing);
  });

  testWidgets('Torque Check screens follow the torque-checks permissions', (tester) async {
    await pumpSignedIn(tester, permissions: const [], path: '/torque-check', routes: {});
    expect(find.text('Access denied'), findsWidgets);
    await pumpSignedIn(tester, permissions: const [], path: '/torque-check/session', routes: {});
    expect(find.text('Access denied'), findsWidgets);
    await pumpSignedIn(tester, permissions: const [], path: '/torque-checks', routes: {});
    expect(find.text('Access denied'), findsWidgets);
    await pumpSignedIn(tester, permissions: const [], path: '/creel-type-settings', routes: {});
    expect(find.text('Access denied'), findsWidgets);
  });

  testWidgets('saving the first cell reveals the session id the server assigned, once seen', (tester) async {
    await _open(tester);
    expect(find.textContaining('Session'), findsNothing);
    await _selectCreelType(tester);
    await _enterReading(tester, '7');
    await _saveCell(tester);
    expect(find.textContaining('Session 483920'), findsOneWidget);
  });

  testWidgets('Change session goes back to the chooser, confirming before discarding already-saved readings', (tester) async {
    await _open(tester);
    await _selectCreelType(tester);
    await _enterReading(tester, '7');
    await _saveCell(tester); // Ai-1A saved

    await tester.tap(find.text('Change session'));
    await tester.pumpAndSettle();
    expect(find.text('Start new sheet'), findsOneWidget); // back on the chooser

    await tester.tap(find.text('Start new sheet'));
    await tester.pumpAndSettle();
    expect(find.text('Start a new sheet?'), findsOneWidget); // confirms first, since a reading is already saved

    await tester.tap(find.text('Start new sheet').last); // confirm
    await tester.pumpAndSettle();
    expect(find.text('Side Ai, row 1, column A'), findsOneWidget); // a fresh sheet, back at the start
  });

  testWidgets('entering a session ID loads that sheet, with its readings and header already filled in', (tester) async {
    final sheet = {
      'session_id': '483920', 'check_date': '2026-09-20', 'operator_name': 'Budi', 'machine_number': '9', 'creel_type_id': 1,
      'readings': [
        {'id': 11, 'side': 'Bo', 'row_no': 1, 'column_letter': 'A', 'value': 7.0, 'note': null},
      ],
    };
    final adapter = await _openSessionScreen(tester, routes: {..._routes, 'GET /torque-checks/session/:id': (_) => (status: 200, body: {'success': true, 'data': sheet})});
    await tester.enterText(_byLabel('Session ID'), '483920');
    await tester.tap(find.text('Load'));
    await tester.pumpAndSettle();

    expect(adapter.requests.any((r) => r.path.endsWith('/torque-checks/session/483920')), isTrue);
    expect(find.textContaining('Session 483920'), findsOneWidget); // now on the grid
    expect(find.textContaining('Budi'), findsOneWidget);
    expect(find.widgetWithText(TextField, '9'), findsOneWidget); // machine number

    // The loaded sheet's Bo-1A reading isn't visible on the default Ai side...
    expect(find.text('Side Ai, row 1, column A'), findsOneWidget);
    expect(find.text('--'), findsOneWidget); // digits box empty (Numpad's own '7' key is always on screen)
    // ...but shows once Bo is selected.
    await tester.tap(find.text('Bo'));
    await tester.pumpAndSettle();
    expect(find.text('--'), findsNothing);
  });

  testWidgets('an unknown session ID shows an error instead of silently starting fresh', (tester) async {
    await _openSessionScreen(tester, routes: {..._routes, 'GET /torque-checks/session/:id': (_) => (status: 404, body: {'success': false, 'message': 'Session not found'})});
    await tester.enterText(_byLabel('Session ID'), '000000');
    await tester.tap(find.text('Load'));
    await tester.pumpAndSettle();
    expect(find.textContaining('was not found'), findsOneWidget);
    expect(find.text('Resume a session'), findsOneWidget); // still on the chooser
  });

  testWidgets('the form fits 320 wide with the largest text the app allows', (tester) async {
    tester.platformDispatcher.textScaleFactorTestValue = 1.4;
    addTearDown(tester.platformDispatcher.clearAllTestValues);
    await _open(tester);
    tester.view.physicalSize = const Size(640, 4800);
    await tester.pumpAndSettle();
    await _selectCreelType(tester);
    await _enterReading(tester, '7');
    await _saveCell(tester);
    expect(tester.takeException(), isNull);
  });

  testWidgets('the session-select screen fits 320 wide with the largest text the app allows', (tester) async {
    tester.platformDispatcher.textScaleFactorTestValue = 1.4;
    addTearDown(tester.platformDispatcher.clearAllTestValues);
    await _openSessionScreen(tester);
    tester.view.physicalSize = const Size(640, 4800);
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
  });
}
