import 'package:anufa_minerva_mobile/core/sync/sync_queue.dart';
import 'package:flutter/material.dart' show MaterialApp;
import 'package:flutter_riverpod/flutter_riverpod.dart' show ProviderScope;
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'support/pump.dart';

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  test('uploadsLabel pluralises', () {
    expect(uploadsLabel(1), '1 upload');
    expect(uploadsLabel(3), '3 uploads');
  });

  testWidgets('a waiting upload says what happens next; an empty queue says where recordings appear', (tester) async {
    final adapter = await pumpSignedIn(tester, permissions: ['tension-records.create'], routes: const {}, path: '/sync');
    expect(find.text('Nothing waiting to upload. Recordings saved offline appear here.'), findsOneWidget);

    adapter.offline = true;
    final container = ProviderScope.containerOf(tester.element(find.byType(MaterialApp)));
    await tester.runAsync(() => container.read(syncQueueProvider.notifier).submit(method: 'POST', path: '/tension-records', data: {}, label: 'Twisting · ITM-1 · machine T-04'));
    await tester.pumpAndSettle();

    expect(find.text('Waiting'), findsOneWidget);
    expect(find.text('Uploads automatically when you are back online.'), findsOneWidget);
    expect(find.text('Nothing waiting to upload. Recordings saved offline appear here.'), findsNothing);
  });
}
