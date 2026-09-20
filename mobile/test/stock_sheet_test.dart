import 'package:anufa_minerva_mobile/core/sync/sync_queue.dart';
import 'package:anufa_minerva_mobile/core/ui/app_text_field.dart';
import 'package:anufa_minerva_mobile/features/stock/barcode_scanner.dart';
import 'package:anufa_minerva_mobile/features/stock_sheet/stock_sheet_models.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'support/fakes.dart';
import 'support/pump.dart';

const _perms = ['stock-take.create', 'stock-take.view'];

Map<String, Handler> get _routes => {
      'POST /stock-sheets/rows': (_) => (status: 201, body: {'success': true}),
      'PATCH /stock-sheets/rows/:id': (_) => (status: 200, body: {'status': 'success'}),
    };

Future<FakeAdapter> _open(WidgetTester t, {Map<String, Handler>? routes, List<Override> overrides = const []}) =>
    pumpSignedIn(t, permissions: _perms, path: '/stock-sheet', routes: routes ?? _routes, overrides: overrides);

Finder _byLabel(String label) => find.descendant(of: find.widgetWithText(AppTextField, label), matching: find.byType(TextField));

/// The field whose current text is [value].
Finder _field(String value) => find.widgetWithText(TextField, value);

Future<void> _fill(WidgetTester t, {String material = 'TY022002756', String batch = 'TA0092565', String? color, String? chs, String? weight, String? position, String? remark}) async {
  Future<void> type(String hint, String? v) async {
    if (v == null) return;
    await t.enterText(find.byWidgetPredicate((w) => w is TextField && w.decoration?.hintText == hint), v);
  }

  await type('e.g. TY022002756', material);
  await type('Batch number, or a note like "kupasan"', batch);
  await type('e.g. White orange green', color);
  final labelled = {'Cheeses': chs, 'Weight (kg)': weight, 'Position': position};
  for (final e in labelled.entries) {
    if (e.value != null) await t.enterText(_byLabel(e.key), e.value!);
  }
  await type('e.g. ex WV, limit', remark);
  await t.pump();
}

Future<void> _add(WidgetTester t) async {
  await t.ensureVisible(find.text('Add row').last);
  await t.tap(find.text('Add row').last);
  await t.pumpAndSettle();
}

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  test('a row keeps the sheet columns and round-trips through the device copy', () {
    final row = SheetRow(uuid: 'u1', color: 'Pink blue yellow', materialCode: 'TY0220004540', batch: 'kupasan', prodDate: DateTime(2026, 8, 14), chs: 20, weight: 76, position: 44, remark: 'ex WV');
    expect(row.toFields(), {'color': 'Pink blue yellow', 'material_code': 'TY0220004540', 'batch': 'kupasan', 'prod_date': '2026-08-14', 'chs': 20, 'actual_weight': 76.0, 'position': 44, 'remark': 'ex WV'});
    final back = SheetRow.fromJson(row.toJson());
    expect((back.batch, back.chs, back.weight, back.position, back.prodDate), ('kupasan', 20, 76.0, 44, DateTime(2026, 8, 14)));
    expect(SheetRow(uuid: 'u2', materialCode: 'M', batch: 'B').toFields()['remark'], isNull); // blanks are sent as null
  });

  testWidgets('adding a row uploads it with the sheet uuid and an idempotency key, then clears the form', (tester) async {
    final adapter = await _open(tester);
    await _fill(tester, color: 'White orange green', chs: '28', weight: '146.8', position: '30', remark: 'ex WV');
    await _add(tester);

    final body = adapter.requests.singleWhere((r) => r.method == 'POST' && r.path.endsWith('/stock-sheets/rows')).data as Map;
    expect(body['material_code'], 'TY022002756');
    expect(body['batch'], 'TA0092565');
    expect(body['color'], 'White orange green');
    expect((body['chs'], body['actual_weight'], body['position'], body['remark']), (28, 146.8, 30, 'ex WV'));
    expect(body['sheet_client_uuid'], isNotEmpty);
    expect(body['client_uuid'], isNotEmpty);
    expect(find.text('TA0092565'), findsOneWidget); // now in the Rows list
    expect(find.textContaining('1 rows · 28 cheeses · 146.8 kg'), findsOneWidget);
    expect(find.text('Add row 2'), findsOneWidget);
    expect(find.widgetWithText(TextField, 'TA0092565'), findsNothing); // batch cleared
  });

  testWidgets('position and remark carry over to the next row; everything else is cleared', (tester) async {
    await _open(tester);
    await _fill(tester, color: 'Grey', chs: '5', weight: '2', position: '41', remark: 'limit');
    await _add(tester);
    expect(find.widgetWithText(TextField, '41'), findsOneWidget);
    expect(find.widgetWithText(TextField, 'limit'), findsOneWidget);
    expect(find.widgetWithText(TextField, 'Grey'), findsNothing);
    expect(find.widgetWithText(TextField, '5'), findsNothing);
  });

  testWidgets('material code and batch are required, and numbers are checked before anything is sent', (tester) async {
    final adapter = await _open(tester);
    await _fill(tester, material: '', batch: 'B');
    await _add(tester);
    expect(find.text('Enter the material code.'), findsOneWidget);
    await _fill(tester, material: 'M', batch: '');
    await _add(tester);
    expect(find.text('Enter the batch.'), findsOneWidget);
    await _fill(tester, material: 'M', batch: 'B', weight: 'heavy');
    await _add(tester);
    expect(find.text('Weight must be a number, like 146.8.'), findsOneWidget);
    await _fill(tester, weight: '', position: '1000');
    await _add(tester);
    expect(find.text('Position must be a number from 0 to 999.'), findsOneWidget);
    expect(adapter.requests.where((r) => r.method == 'POST'), isEmpty);
  });

  testWidgets('offline, the row is kept on the device, queued once and marked Waiting', (tester) async {
    final adapter = await _open(tester);
    adapter.offline = true;
    await _fill(tester, chs: '3', weight: '1.5');
    await _add(tester);

    final container = ProviderScope.containerOf(tester.element(find.byType(MaterialApp)));
    final op = container.read(syncQueueProvider).ops.single;
    expect(op.path, '/stock-sheets/rows');
    expect(op.label, 'Stock sheet · row 1');
    expect(op.data['batch'], 'TA0092565');
    expect(find.text('Waiting'), findsOneWidget);
    expect(find.text('TA0092565'), findsOneWidget);
  });

  testWidgets('a server rejection is shown and the row does not stay on the sheet', (tester) async {
    await _open(tester, routes: {'POST /stock-sheets/rows': (_) => (status: 422, body: {'message': 'The batch field is required.'})});
    await _fill(tester);
    await _add(tester);
    expect(find.textContaining('batch field is required'), findsOneWidget);
    expect(find.text('Rows you add appear here.'), findsOneWidget);
  });

  testWidgets('the sheet saved on the device is restored when the screen opens', (tester) async {
    SharedPreferences.setMockInitialValues({'stock-sheet-active': '{"uuid":"s1","date":"2026-09-19","leader":"Ana","rows":[{"uuid":"r1","material_code":"M","batch":"TA9","chs":2}]}'});
    await _open(tester);
    expect(find.text('TA9'), findsOneWidget);
    expect(find.textContaining('1 rows · 2 cheeses'), findsOneWidget);
    expect(find.text('Add row 2'), findsOneWidget);
  });

  testWidgets('every row added is saved to the device as it is added', (tester) async {
    await _open(tester);
    await _fill(tester, batch: 'TA1', chs: '4');
    await _add(tester);
    expect((await SharedPreferences.getInstance()).getString('stock-sheet-active'), contains('"batch":"TA1"'));
  });

  testWidgets('editing a row that is still waiting swaps its queued upload instead of adding a second', (tester) async {
    final adapter = await _open(tester);
    adapter.offline = true;
    await _fill(tester, batch: 'TA1', weight: '1');
    await _add(tester);
    await tester.tap(find.text('TA1'));
    await tester.pumpAndSettle();
    expect(find.text('Edit row 1'), findsOneWidget);
    expect(_field('1'), findsWidgets); // weight shows as typed, not "1.0"
    await tester.enterText(_byLabel('Weight (kg)'), '2.5');
    await tester.ensureVisible(find.text('Save changes'));
    await tester.tap(find.text('Save changes'));
    await tester.pumpAndSettle();

    final container = ProviderScope.containerOf(tester.element(find.byType(MaterialApp)));
    final ops = container.read(syncQueueProvider).ops;
    expect(ops.length, 1);
    expect(ops.single.data['actual_weight'], 2.5);
  });

  testWidgets('deleting a waiting row drops it from the queue; deleting an uploaded one sends a DELETE', (tester) async {
    final adapter = await _open(tester, routes: {..._routes, 'DELETE /stock-sheets/rows/:id': (_) => (status: 200, body: {'status': 'success'})});
    final container = ProviderScope.containerOf(tester.element(find.byType(MaterialApp)));

    adapter.offline = true;
    await _fill(tester, batch: 'WAIT');
    await _add(tester);
    adapter.offline = false;
    await tester.tap(find.text('WAIT'));
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.text('Delete row').last);
    await tester.tap(find.text('Delete row').last);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Delete row').last); // confirm dialog
    await tester.pumpAndSettle();
    expect(container.read(syncQueueProvider).ops, isEmpty);
    expect(adapter.requests.where((r) => r.method == 'DELETE'), isEmpty);

    await _fill(tester, batch: 'SENT');
    await _add(tester);
    await tester.tap(find.text('SENT'));
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.text('Delete row').last);
    await tester.tap(find.text('Delete row').last);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Delete row').last);
    await tester.pumpAndSettle();
    expect(adapter.requests.where((r) => r.method == 'DELETE').length, 1);
    expect(find.text('SENT'), findsNothing);
  });

  testWidgets('scan buttons fill the material code and batch', (tester) async {
    await _open(tester, overrides: [barcodeScanProvider.overrideWithValue((_) async => 'TA555')]);
    await tester.tap(find.byTooltip('Scan batch'));
    await tester.pumpAndSettle();
    expect(find.widgetWithText(TextField, 'TA555'), findsOneWidget);
    await tester.tap(find.byTooltip('Scan material code'));
    await tester.pumpAndSettle();
    expect(find.widgetWithText(TextField, 'TA555'), findsNWidgets(2));
  });

  testWidgets('the form fits 320 wide with the largest text the app allows', (tester) async {
    tester.platformDispatcher.textScaleFactorTestValue = 1.4;
    addTearDown(tester.platformDispatcher.clearAllTestValues);
    await _open(tester);
    tester.view.physicalSize = const Size(640, 4800);
    await tester.pumpAndSettle();
    await _fill(tester, color: 'White orange green', chs: '28', weight: '146.8', position: '30', remark: 'ex WV');
    await _add(tester);
    expect(tester.takeException(), isNull);
  });
}
