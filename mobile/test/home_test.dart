import 'dart:ui' show Size;

import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:anufa_minerva_mobile/core/sync/sync_queue.dart';
import 'package:flutter/material.dart' show Badge, InkWell, MaterialApp, Text;
import 'package:flutter_riverpod/flutter_riverpod.dart' show ProviderScope;

import 'support/pump.dart';

const _perms = ['tension-records.create', 'tension-records.view', 'stock-take.create', 'stock-take.view'];

const _dashboard = {
  'tension': {'total': 12, 'twisting': 7, 'weaving': 5, 'open_problems': 3},
  'stockTake': null,
  'users': null,
};

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  testWidgets('home shows the summary, permitted modules, quick actions and bottom nav', (tester) async {
    await pumpSignedIn(
      tester,
      permissions: _perms,
      routes: {'GET /dashboard': (_) => (status: 200, body: _dashboard)},
      path: '/dashboard',
    );

    expect(find.textContaining(', Ana'), findsOneWidget); // "Good <part of day>, Ana"
    expect(find.text('12'), findsOneWidget); // the summary card
    expect(find.text('3 open problems'), findsOneWidget);
    expect(find.text('Twisting Tension'), findsOneWidget); // module tile, "Record:" prefix dropped
    expect(find.text('All modules'), findsOneWidget);
    expect(find.text('Machine Maintenance'), findsNothing); // no permission
    for (final tab in ['Home', 'Record', 'Records', 'More']) {
      expect(find.text(tab), findsOneWidget);
    }
  });

  testWidgets('bottom nav switches landings and is absent on recording screens', (tester) async {
    await pumpSignedIn(
      tester,
      permissions: _perms,
      routes: {'GET /dashboard': (_) => (status: 200, body: _dashboard)},
      path: '/dashboard',
    );

    await tester.tap(find.text('Records'));
    await tester.pumpAndSettle();
    expect(find.text('Tension Records'), findsOneWidget);
    expect(find.text('Twisting Tension'), findsNothing); // a Record item, not on this landing

    await tester.tap(find.text('More'));
    await tester.pumpAndSettle();
    expect(find.text('Log out'), findsOneWidget);
  });

  testWidgets('a role with no summary section still renders the home screen', (tester) async {
    await pumpSignedIn(tester, permissions: const [], routes: const {}, path: '/dashboard');
    expect(find.text('No summary for your role.'), findsOneWidget);
    expect(find.text('All modules'), findsOneWidget);
  });

  testWidgets('home does not overflow at the maximum text scale on a narrow phone', (tester) async {
    tester.platformDispatcher.textScaleFactorTestValue = 1.4;
    addTearDown(tester.platformDispatcher.clearAllTestValues);
    await pumpSignedIn(
      tester,
      permissions: _perms,
      routes: {'GET /dashboard': (_) => (status: 200, body: _dashboard)},
      path: '/dashboard',
    );
    tester.view.physicalSize = const Size(720, 4800); // 360dp wide
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
    expect(find.text('All modules'), findsOneWidget);
  });

  testWidgets('a queued weaving upload badges Weaving only, not Twisting (both post to /tension-records)', (tester) async {
    final semantics = tester.ensureSemantics();
    final adapter = await pumpSignedIn(
      tester,
      permissions: _perms,
      routes: {'GET /dashboard': (_) => (status: 200, body: _dashboard)},
      path: '/dashboard',
    );
    adapter.offline = true; // an offline submit is what lands in the queue
    final container = ProviderScope.containerOf(tester.element(find.byType(MaterialApp)));
    await tester.runAsync(() => container.read(syncQueueProvider.notifier).submit(method: 'POST', path: '/tension-records', data: {}, label: 'Weaving · PO 5 · machine W-3'));
    await tester.pumpAndSettle();

    final visible = [for (final b in tester.widgetList<Badge>(find.byType(Badge))) if (b.isLabelVisible && b.label is Text) (b.label! as Text).data];
    expect(visible.where((t) => t == '1'), hasLength(1)); // the Weaving action; Twisting and Scan show none
    expect(find.bySemanticsLabel(RegExp('Weaving, 1 waiting to upload')), findsOneWidget);
    expect(find.bySemanticsLabel(RegExp('Twisting, \\d+ waiting')), findsNothing);
    semantics.dispose();
  });

  testWidgets('the Scan button offers document intelligence and the finish earlier form, and opens the one you choose', (tester) async {
    await pumpSignedIn(
      tester,
      permissions: [..._perms, 'finish-earlier.create'],
      routes: {'GET /dashboard': (_) => (status: 200, body: _dashboard)},
      path: '/dashboard',
    );

    await tester.tap(find.widgetWithText(InkWell, 'Scan').first); // the header button; the summary card has a stock "Scan" action too
    await tester.pumpAndSettle();
    expect(find.text('Choose what to scan'), findsOneWidget);
    expect(find.text('Document Intelligence'), findsWidgets); // the option (and its tile behind the sheet)
    expect(find.text('Finish Earlier Form'), findsWidgets); // the option (and the tile behind the sheet)

    await tester.tap(find.text('Extract data from a finish earlier form'));
    await tester.pumpAndSettle();
    expect(find.text('Scan Finish Earlier Form'), findsOneWidget);
    expect(find.text('Choose what to scan'), findsNothing);
  });

  testWidgets('without permission for the finish earlier form, Scan goes straight to document intelligence', (tester) async {
    await pumpSignedIn(
      tester,
      permissions: _perms,
      routes: {'GET /dashboard': (_) => (status: 200, body: _dashboard)},
      path: '/dashboard',
    );

    await tester.tap(find.widgetWithText(InkWell, 'Scan').first);
    await tester.pumpAndSettle();
    expect(find.text('Choose what to scan'), findsNothing);
    expect(find.text('Extract text from a document'), findsOneWidget);
  });
}
