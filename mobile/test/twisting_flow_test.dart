import 'package:anufa_minerva_mobile/core/sync/sync_queue.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'support/pump.dart';

Future<void> _keys(WidgetTester t, String digits) async {
  for (final d in digits.split('')) {
    await t.tap(find.widgetWithText(InkWell, d).first);
    await t.pump();
  }
}

Future<void> _startRecording(WidgetTester t) async {
  await t.enterText(find.byType(TextField).at(0), 'Ana');
  await t.enterText(find.byType(TextField).at(1), 'ITM-9');
  await t.enterText(find.byType(TextField).at(3), 'T-07');
  await t.enterText(find.byType(TextField).at(7), '40'); // spec
  await t.enterText(find.byType(TextField).at(8), '5'); // ±
  await t.tap(find.text('Start Recording'));
  await t.pumpAndSettle();
}

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  testWidgets('recording flags out-of-spec readings and advances after max+min', (tester) async {
    await pumpSignedIn(tester, permissions: ['tension-records.create'], path: '/twisting-tension', routes: {});
    await _startRecording(tester);

    expect(find.textContaining('35.0 – 45.0'), findsOneWidget);
    await _keys(tester, '50');
    await tester.tap(find.text('Submit Max'));
    await tester.pump();
    expect(find.text('Range 35.0–45.0'), findsOneWidget); // 50 is out of spec

    await _keys(tester, '38');
    await tester.tap(find.text('Submit Min'));
    await tester.pump();
    expect(find.text('Spd No.'), findsOneWidget);
    expect(find.text('2'), findsWidgets); // moved on to spindle 2
  });

  testWidgets('finish uploads the exact record with an idempotency key', (tester) async {
    final adapter = await pumpSignedIn(tester, permissions: ['tension-records.create'], path: '/twisting-tension', routes: {
      'POST /tension-records': (_) => (status: 201, body: {'status': 'success', 'data': {'id': 55}}),
    });
    await _startRecording(tester);
    await _keys(tester, '44');
    await tester.tap(find.text('Submit Max'));
    await _keys(tester, '38');
    await tester.tap(find.text('Submit Min'));
    await tester.pump();

    await tester.tap(find.text('Finish'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('No, keep data'));
    await tester.pumpAndSettle();

    expect(find.text('Saved'), findsOneWidget);
    final body = adapter.requests.singleWhere((r) => r.method == 'POST').data as Map;
    expect(body['record_type'], 'twisting');
    expect(body['measurement_data'], {'1': {'max': 44.0, 'min': 38.0}});
    expect((body['metadata'] as Map)['machine_number'], 'T-07');
    expect(body['client_uuid'], isNotEmpty);
    expect(body['csv_data'], contains('1,44,38'));
  });

  testWidgets('finishing offline stores the record on the device and uploads it on reconnect', (tester) async {
    final adapter = await pumpSignedIn(tester, permissions: ['tension-records.create'], path: '/twisting-tension', routes: {
      'POST /tension-records': (_) => (status: 201, body: {'status': 'success', 'data': {'id': 56}}),
    });
    await _startRecording(tester);
    await _keys(tester, '44');
    await tester.tap(find.text('Submit Max'));
    await tester.pump();
    adapter.offline = true;

    await tester.tap(find.text('Finish'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Yes, clear all'));
    await tester.pumpAndSettle();

    expect(find.text('Saved on this device'), findsOneWidget);
    final container = ProviderScope.containerOf(tester.element(find.byType(MaterialApp)));
    expect(container.read(syncQueueProvider).pending, 1);

    adapter.offline = false;
    await tester.tap(find.text('OK'));
    await tester.pumpAndSettle();
    await tester.runAsync(() => container.read(syncQueueProvider.notifier).flush());
    await tester.pump();
    expect(container.read(syncQueueProvider).ops, isEmpty);
    expect(adapter.requests.where((r) => r.method == 'POST' && !r.path.contains('auth')).length, 2); // failed attempt + retry
    expect(find.text('Start Recording'), findsOneWidget); // cleared and back at the form
  });

  testWidgets('finish refuses an empty session; a server rejection is shown with retry', (tester) async {
    await pumpSignedIn(tester, permissions: ['tension-records.create'], path: '/twisting-tension', routes: {
      'POST /tension-records': (_) => (status: 422, body: {'message': 'x', 'errors': {'metadata.operator': ['The operator is invalid.']}}),
    });
    await _startRecording(tester);
    await tester.tap(find.text('Finish'));
    await tester.pump();
    expect(find.text('Record at least one measurement first.'), findsOneWidget);

    await _keys(tester, '44');
    await tester.tap(find.text('Submit Max'));
    await tester.pump();
    await tester.tap(find.text('Finish'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('No, keep data'));
    await tester.pumpAndSettle();
    expect(find.text('Could not save'), findsOneWidget);
    expect(find.text('The operator is invalid.'), findsOneWidget);
    expect(find.text('Retry'), findsOneWidget);
  });

  testWidgets('an unfinished session is restored after the app restarts', (tester) async {
    SharedPreferences.setMockInitialValues({
      'twisting-draft-v1': '{"form":{"operator":"Ana","specTens":"40"},"readings":{"3":{"max":41.0,"min":null}},"problems":[],"display":"0","spindle":3,"isMax":false}',
    });
    await pumpSignedIn(tester, permissions: ['tension-records.create'], path: '/twisting-tension', routes: {});
    expect(find.text('Resume Recording'), findsOneWidget);
    expect(find.widgetWithText(TextField, 'Ana'), findsOneWidget);
  });
}
