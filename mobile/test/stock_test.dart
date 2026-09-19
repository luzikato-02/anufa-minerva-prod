import 'dart:convert';
import 'dart:typed_data';

import 'package:anufa_minerva_mobile/core/csv_parse.dart';
import 'package:anufa_minerva_mobile/core/files/file_opener.dart';
import 'package:anufa_minerva_mobile/core/files/file_pick.dart';
import 'package:anufa_minerva_mobile/core/sync/sync_queue.dart';
import 'package:anufa_minerva_mobile/features/stock/barcode_scanner.dart';
import 'package:anufa_minerva_mobile/features/stock/stock_detail_screen.dart';
import 'package:anufa_minerva_mobile/features/stock/stock_models.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'support/fakes.dart';
import 'support/pump.dart';

final _sessionBody = {
  'success': true,
  'data': {
    'id': 4,
    'session_id': '123456',
    'indv_batch_data': [
      {'batch_number': 'B1', 'material_code': 'M1', 'material_description': 'Yarn', 'weight': '12.5', 'bobbin_qty': '4'},
      {'Batch Number': 'B2', 'Material Code': 'M2', 'Material Desciption': 'Tape'},
    ],
    'recorded_batches': [],
    'metadata': {'total_batches': 2, 'total_checked_batches': 0, 'total_materials': 2, 'session_leader': 'Ana', 'session_status': 'In Progress'},
  },
};

Handler _check(Map<String, Map<String, dynamic>> byBatch) => (o) {
      final r = byBatch[o.queryParameters['batch']];
      return r == null ? (status: 200, body: {'exists': false, 'message': 'Batch not found in this session'}) : (status: 200, body: r);
    };

Future<void> _load(WidgetTester t, {String id = '123456'}) async {
  await t.enterText(find.byType(TextField).first, id);
  await t.tap(find.text('Load session'));
  await t.pumpAndSettle();
}

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));
  recordsTests();

  group('csv', () {
    test('quoted commas, escaped quotes and short rows', () {
      expect(parseCsvLine('a,"b,c","say ""hi""",d'), ['a', 'b,c', 'say "hi"', 'd']);
      final rows = parseCsvRecords('﻿batch_number,material_code,material_description\r\nB1,M1,"Yarn, 1100"\r\n\r\nB2,M2\r\n');
      expect(rows, [
        {'batch_number': 'B1', 'material_code': 'M1', 'material_description': 'Yarn, 1100'},
        {'batch_number': 'B2', 'material_code': 'M2', 'material_description': ''},
      ]);
      expect(parseCsvRecords('   '), isEmpty);
    });

    test('escape only when needed', () {
      expect(csvEscape('plain'), 'plain');
      expect(csvEscape('a,b'), '"a,b"');
      expect(csvEscape('say "x"'), '"say ""x"""');
      expect(csvEscape(null), '');
    });
  });

  group('models', () {
    test('batches accept snake_case and spreadsheet-style headers', () {
      final s = StockSession(Map<String, dynamic>.from(_sessionBody['data'] as Map));
      expect(s.batches.map((b) => b.batchNumber), ['B1', 'B2']);
      expect(s.batches[1].materialDescription, 'Tape');
      expect(s.batches[0].weight, '12.5');
      expect(s.batches[1].weight, isNull);
    });

    test('new session payload counts unique materials under either header style', () {
      final p = newSessionPayload(rows: [
        {'Batch Number': 'B1', 'Material Code': 'M1'},
        {'Batch Number': 'B2', 'Material Code': 'M1'},
        {'batch_number': 'B3', 'material_code': 'M2'},
      ], leader: 'Ana');
      final m = p['metadata'] as Map;
      expect(m['total_batches'], 3);
      expect(m['total_materials'], 2);
      expect(m['session_status'], 'In Progress');
      expect(m['total_checked_batches'], 0);
    });
  });

  Map<String, Handler> routes({bool already = false}) => {
        'GET /stock-take-records/session/123456': (_) => (status: 200, body: _sessionBody),
        'GET /stock-take-records/check-batch': _check({
          'B1': {'exists': true, 'already_recorded': already, 'message': already ? 'Batch already found. Move to the next batch.' : 'Batch is valid', 'batch_data': (_sessionBody['data'] as Map)['indv_batch_data'][0]},
        }),
        'POST /stock-take-records/record-batch': (_) => (status: 201, body: {'success': true}),
      };

  testWidgets('scan → prefilled form → record posts the exact payload with an idempotency key', (tester) async {
    final adapter = await pumpSignedIn(tester, permissions: ['stock-take.create'], path: '/stock-taking', overrides: [barcodeScanProvider.overrideWithValue((_) async => 'B1')], routes: routes());
    await _load(tester);
    expect(find.text('Session 123456'), findsOneWidget);
    expect(find.text('0 of 2 batches found'), findsOneWidget);

    await tester.tap(find.byTooltip('Scan barcode'));
    await tester.pumpAndSettle();
    expect(find.text('Record batch'), findsWidgets);
    expect(find.widgetWithText(TextField, '12.5'), findsOneWidget); // weight prefilled from CSV
    expect(find.widgetWithText(TextField, '4'), findsOneWidget); // bobbins prefilled

    await tester.enterText(find.widgetWithText(TextField, '12.5'), '13.2');
    await tester.tap(find.widgetWithText(InkWell, 'Record batch').last);
    await tester.pumpAndSettle();

    final body = adapter.requests.singleWhere((r) => r.method == 'POST').data as Map;
    expect(body['session_id'], '123456');
    expect(body['batch_number'], 'B1');
    expect(body['actual_weight'], 13.2);
    expect(body['total_bobbins'], 4);
    expect(body['found_by'], 'Ana Operator');
    expect(body['client_uuid'], isNotEmpty);
    expect(find.text('Batch recorded successfully!'), findsOneWidget);
    expect(find.text('1 of 2 batches found'), findsOneWidget);
  });

  testWidgets('already-recorded and unknown batches are reported without opening the form', (tester) async {
    await pumpSignedIn(tester, permissions: ['stock-take.create'], path: '/stock-taking', routes: routes(already: true));
    await _load(tester);

    await tester.enterText(find.widgetWithText(TextField, '').last, 'B1');
    await tester.tap(find.text('Check batch'));
    await tester.pumpAndSettle();
    expect(find.text('Batch already found. Move to the next batch.'), findsOneWidget);
    expect(find.text('Record batch'), findsNothing);

    await tester.enterText(find.widgetWithText(TextField, '').last, 'NOPE');
    await tester.tap(find.text('Check batch'));
    await tester.pumpAndSettle();
    expect(find.text('Batch not found in this session'), findsOneWidget);
  });

  testWidgets('form validates weight and bobbins like the web', (tester) async {
    await pumpSignedIn(tester, permissions: ['stock-take.create'], path: '/stock-taking', overrides: [barcodeScanProvider.overrideWithValue((_) async => 'B2')], routes: {
      ...routes(),
      'GET /stock-take-records/check-batch': _check({
        'B2': {'exists': true, 'already_recorded': false, 'message': 'ok', 'batch_data': (_sessionBody['data'] as Map)['indv_batch_data'][1]},
      }),
    });
    await _load(tester);
    await tester.tap(find.byTooltip('Scan barcode'));
    await tester.pumpAndSettle();

    await tester.tap(find.widgetWithText(InkWell, 'Record batch').last);
    await tester.pump();
    expect(find.text('Please enter actual weight'), findsOneWidget);

    final sheetFields = find.descendant(of: find.byType(BottomSheet), matching: find.byType(TextField));
    await tester.enterText(sheetFields.at(0), '-3'); // weight
    await tester.enterText(sheetFields.at(1), '5'); // bobbins
    await tester.tap(find.widgetWithText(InkWell, 'Record batch').last);
    await tester.pump();
    expect(find.text('Actual weight must be a valid positive number'), findsOneWidget);
  });

  testWidgets('a missing session shows the server message', (tester) async {
    await pumpSignedIn(tester, permissions: ['stock-take.create'], path: '/stock-taking', routes: {
      'GET /stock-take-records/session/999': (_) => (status: 404, body: {'success': false, 'message': 'Session not found'}),
    });
    await _load(tester, id: '999');
    expect(find.text('Session "999" was not found.'), findsOneWidget);
  });

  testWidgets('offline: uses the device copy, queues the recording, and blocks a second scan of the same batch', (tester) async {
    final adapter = await pumpSignedIn(tester, permissions: ['stock-take.create'], path: '/stock-taking', overrides: [barcodeScanProvider.overrideWithValue((_) async => 'B1')], routes: routes());
    await _load(tester); // caches the batch list on the device
    adapter.offline = true;

    await tester.tap(find.byTooltip('Scan barcode'));
    await tester.pumpAndSettle();
    expect(find.text('Record batch'), findsWidgets);
    await tester.tap(find.widgetWithText(InkWell, 'Record batch').last);
    await tester.pumpAndSettle();
    expect(find.textContaining('Saved on this device'), findsOneWidget);

    final container = ProviderScope.containerOf(tester.element(find.byType(MaterialApp)));
    final op = container.read(syncQueueProvider).ops.single;
    expect(op.path, '/stock-take-records/record-batch');
    expect(op.data['batch_number'], 'B1');

    await tester.tap(find.byTooltip('Scan barcode'));
    await tester.pumpAndSettle();
    expect(find.textContaining('Batch already found'), findsOneWidget);
    expect(container.read(syncQueueProvider).ops.length, 1); // no duplicate queued
  });

  testWidgets('a session opened before can be reopened with no connection', (tester) async {
    SharedPreferences.setMockInitialValues({
      'stock-session-123456': '{"batches":[{"batch_number":"B1","material_code":"M1","material_description":"Yarn"}],"recorded":["B1"]}',
    });
    final adapter = await pumpSignedIn(tester, permissions: ['stock-take.create'], path: '/stock-taking', routes: {});
    adapter.offline = true;
    await _load(tester);
    expect(find.text('Offline copy'), findsOneWidget);
    expect(find.text('1 of 1 batches found'), findsOneWidget);

    await tester.tap(find.text('Change session'));
    await tester.pumpAndSettle();
    await _load(tester, id: 'never-opened');
    expect(find.textContaining('has not been opened on this device'), findsOneWidget);
  });
}

// ── Records screens ───────────────────────────────────────────────────────────

Map<String, dynamic> _page(List rows) => {'data': rows, 'current_page': 1, 'last_page': 1, 'total': rows.length};

final _detail = {
  ..._sessionBody['data'] as Map<String, dynamic>,
  'created_at': '2026-09-18T03:00:00.000000Z',
  'metadata': {'total_batches': 2, 'total_checked_batches': 1, 'total_materials': 2, 'session_leader': 'Ana', 'session_status': 'In Progress'},
  'stock_take_summary': [
    {'batch_number': 'B1', 'material_code': 'M1', 'material_description': 'Yarn, fine', 'is_recorded': true, 'actual_weight': 12.5, 'total_bobbins': 4, 'line_position': 3, 'row_position': 'A', 'timestamp_found': '2026-09-18T04:00:00Z', 'user_found': 'Ana', 'explanation': 'moved'},
    {'batch_number': 'B2', 'material_code': 'M2', 'material_description': 'Tape', 'is_recorded': false},
  ],
};

class _RecordingOpener implements FileOpener {
  final files = <String, String>{};
  @override
  Future<void> open(String filename, List<int> bytes) async => files[filename] = utf8.decode(bytes);
}

void recordsTests() {
  test('summary csv quotes fields and keeps every column', () {
    final csv = summaryToCsv([
      {'batch_number': 'B1', 'material_description': 'Yarn, fine', 'explanation': 'say "hi"', 'actual_weight': null},
    ]);
    expect(csv, 'batch_number,material_description,explanation,actual_weight\nB1,"Yarn, fine","say ""hi""",');
    expect(summaryToCsv([]), '');
  });

  testWidgets('list shows stats and sessions; viewers cannot create', (tester) async {
    await pumpSignedIn(tester, permissions: ['stock-take.view'], path: '/stock-take-records', routes: {
      'GET /stock-take-statistics': (_) => (status: 200, body: {'status': 'success', 'data': {'total_sessions': 3, 'in_progress_sessions': 1, 'completed_sessions': 2, 'total_batches': 40, 'total_checked_batches': 30, 'overall_completion': 75}}),
      'GET /stock-take-records': (_) => (status: 200, body: _page([_detail])),
    });
    expect(find.text('Session 123456'), findsOneWidget);
    expect(find.text('75%'), findsOneWidget);
    expect(find.text('30/40'), findsOneWidget);
    expect(find.text('In Progress'), findsWidgets);
    expect(find.byType(FloatingActionButton), findsNothing);
  });

  testWidgets('creating a session parses the CSV and posts the same payload as the web', (tester) async {
    final adapter = await pumpSignedIn(
      tester,
      permissions: ['stock-take.view', 'stock-take.create'],
      path: '/stock-take-records',
      overrides: [
        pickFileProvider.overrideWithValue((_) async => PickedFile('batches.csv', Uint8List.fromList(utf8.encode('Batch Number,Material Code,Material Desciption\nB1,M1,"Yarn, fine"\nB2,M1,Tape\nB3,M2,Rope\n')))),
      ],
      routes: {
        'GET /stock-take-statistics': (_) => (status: 200, body: {'data': {}}),
        'GET /stock-take-records': (_) => (status: 200, body: _page([])),
        'POST /stock-take-records': (_) => (status: 201, body: {'status': 'success', 'data': {'id': 9}}),
      },
    );
    await tester.tap(find.byType(FloatingActionButton));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Choose CSV file'));
    await tester.pumpAndSettle();
    expect(find.text('3 batches · 2 materials ready to upload'), findsOneWidget);

    await tester.tap(find.widgetWithText(InkWell, 'Create session').last);
    await tester.pumpAndSettle();

    final body = adapter.requests.singleWhere((r) => r.method == 'POST' && r.path == '/stock-take-records').data as Map;
    expect((body['metadata'] as Map)['session_leader'], 'Ana Operator');
    expect((body['metadata'] as Map)['total_batches'], 3);
    expect((body['metadata'] as Map)['session_status'], 'In Progress');
    expect((body['indv_batch_data'] as List).first, {'Batch Number': 'B1', 'Material Code': 'M1', 'Material Desciption': 'Yarn, fine'});
  });

  testWidgets('detail lists batches, filters by found, downloads CSV, changes status', (tester) async {
    final opener = _RecordingOpener();
    final adapter = await pumpSignedIn(
      tester,
      permissions: ['stock-take.view', 'stock-take.edit'],
      path: '/stock-take-records/4',
      overrides: [fileOpenerProvider.overrideWithValue(opener)],
      routes: {
        'GET /stock-take-records/4': (_) => (status: 200, body: {'status': 'success', 'data': _detail}),
        'GET /stock-take-records/4/download': (_) => (status: 200, body: {'success': true, 'summary': _detail['stock_take_summary']}),
        'PATCH /stock-take-records/4/status': (_) => (status: 200, body: {'success': true}),
      },
    );
    expect(find.text('Session 123456'), findsOneWidget);
    expect(find.text('2 of 2 batches · 1 found'), findsOneWidget);
    expect(find.text('Weight 12.5'), findsOneWidget);
    expect(find.text('“moved”'), findsOneWidget);

    await tester.tap(find.text('Not found').first);
    await tester.pumpAndSettle();
    expect(find.text('1 of 2 batches · 1 found'), findsOneWidget);
    expect(find.text('Weight 12.5'), findsNothing);

    await tester.tap(find.byType(PopupMenuButton<String>));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Download CSV'));
    await tester.pumpAndSettle();
    expect(opener.files['stock_take_summary_123456.csv'], contains('B1,M1,"Yarn, fine",true,12.5,4,3,A'));

    await tester.tap(find.byType(PopupMenuButton<String>));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Change status'));
    await tester.pumpAndSettle();
    await tester.tap(find.byType(DropdownButtonFormField<String>));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Completed').last);
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(InkWell, 'Save').last);
    await tester.pumpAndSettle();
    expect(adapter.requests.singleWhere((r) => r.method == 'PATCH').data, {'session_status': 'Completed'});
  });

  testWidgets('delete needs the delete permission and confirms first', (tester) async {
    final adapter = await pumpSignedIn(tester, permissions: ['stock-take.view', 'stock-take.delete'], path: '/stock-take-records/4', routes: {
      'GET /stock-take-records/4': (_) => (status: 200, body: {'data': _detail}),
      'DELETE /stock-take-records/4': (_) => (status: 200, body: {'status': 'success'}),
      'GET /stock-take-statistics': (_) => (status: 200, body: {'data': {}}),
      'GET /stock-take-records': (_) => (status: 200, body: _page([])),
    });
    await tester.tap(find.byType(PopupMenuButton<String>));
    await tester.pumpAndSettle();
    expect(find.text('Change status'), findsNothing);
    await tester.tap(find.text('Delete'));
    await tester.pumpAndSettle();
    expect(find.text('Delete session 123456?'), findsOneWidget);
    await tester.tap(find.text('Delete').last);
    await tester.pumpAndSettle();
    expect(adapter.requests.any((r) => r.method == 'DELETE'), isTrue);
  });
}
