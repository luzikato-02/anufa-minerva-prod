import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'support/pump.dart';

final _types = [
  {'id': 1, 'type_name': 'Twister A', 'total_spindles': 120, 'rpm_min': 100, 'rpm_max': 900, 'min_runtime_hours': null, 'max_runtime_hours': null, 'description': null, 'machine_definitions_count': 2},
];
final _defs = [
  {'id': 5, 'machine_number': 'T-01', 'machine_type_id': 1, 'is_active': true, 'notes': null, 'machine_type': {'id': 1, 'type_name': 'Twister A', 'total_spindles': 120}},
];

void main() {
  testWidgets('viewers see types and machines but no management controls', (tester) async {
    await pumpSignedIn(tester, permissions: ['machine-maintenance.view'], path: '/machine-maintenance', routes: {
      'GET /machine-types': (_) => (status: 200, body: _types),
      'GET /machine-definitions': (_) => (status: 200, body: _defs),
    });

    expect(find.text('Twister A'), findsOneWidget);
    expect(find.text('120 spindles · 2 machines'), findsOneWidget);
    expect(find.text('RPM'), findsOneWidget);
    expect(find.byType(FloatingActionButton), findsNothing);

    await tester.tap(find.text('Machines'));
    await tester.pumpAndSettle();
    expect(find.text('Machine T-01'), findsOneWidget);
    expect(find.text('Active'), findsOneWidget);
  });

  testWidgets('managers can create a type and see server validation errors', (tester) async {
    var calls = 0;
    final adapter = await pumpSignedIn(tester, permissions: ['machine-maintenance.view', 'machine-maintenance.manage'], path: '/machine-maintenance', routes: {
      'GET /machine-types': (_) => (status: 200, body: _types),
      'GET /machine-definitions': (_) => (status: 200, body: _defs),
      'POST /machine-types': (_) => ++calls == 1
          ? (status: 422, body: {'message': 'x', 'errors': {'type_name': ['The type name has already been taken.']}})
          : (status: 201, body: _types.first),
    });

    await tester.tap(find.byType(FloatingActionButton));
    await tester.pumpAndSettle();
    await tester.enterText(find.widgetWithText(TextField, '').first, 'Twister A');
    await tester.tap(find.text('Save'));
    await tester.pumpAndSettle();
    expect(find.text('The type name has already been taken.'), findsOneWidget);

    await tester.tap(find.text('Save'));
    await tester.pumpAndSettle();
    expect(find.text('New machine type'), findsNothing); // sheet closed
    final post = adapter.requests.where((r) => r.method == 'POST' && r.path == '/machine-types').last;
    expect((post.data as Map)['type_name'], 'Twister A');
  });
}
