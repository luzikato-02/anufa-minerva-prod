import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'support/pump.dart';

Map<String, dynamic> page(List rows, {int current = 1, int last = 1}) => {'data': rows, 'current_page': current, 'last_page': last, 'total': rows.length};

final _user = {'id': 2, 'name': 'Budi Santoso', 'username': 'budi', 'email': 'budi@anufa.my.id', 'status': 'active', 'roles': [{'id': 1, 'name': 'supervisor'}]};

void main() {
  testWidgets('users list shows roles, stats and only offers actions to managers', (tester) async {
    await pumpSignedIn(tester, permissions: ['users.view'], path: '/users', routes: {
      'GET /users': (_) => (status: 200, body: page([_user])),
      'GET /user-management-statistics': (_) => (status: 200, body: {'total_users': 9, 'total_roles': 3, 'total_permissions': 22, 'unassigned_users': 1}),
    });

    expect(find.text('Budi Santoso'), findsOneWidget);
    expect(find.text('supervisor'), findsOneWidget);
    expect(find.text('22'), findsOneWidget);
    expect(find.byType(FloatingActionButton), findsNothing);
    expect(find.byType(PopupMenuButton<String>), findsNothing);
    expect(find.byType(TabBar), findsNothing); // roles tab needs roles.manage
  });

  testWidgets('manager can deactivate a user after confirming; request hits the status endpoint', (tester) async {
    final adapter = await pumpSignedIn(tester, permissions: ['users.view', 'users.manage'], path: '/users', routes: {
      'GET /users': (_) => (status: 200, body: page([_user])),
      'GET /user-management-statistics': (_) => (status: 200, body: {'total_users': 1, 'total_roles': 1, 'total_permissions': 1, 'unassigned_users': 0}),
      'PATCH /users/2/status': (_) => (status: 200, body: {..._user, 'status': 'inactive'}),
    });

    await tester.tap(find.byType(PopupMenuButton<String>));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Deactivate'));
    await tester.pumpAndSettle();
    expect(find.text('Deactivate Budi Santoso?'), findsOneWidget);
    await tester.tap(find.text('Deactivate').last);
    await tester.pumpAndSettle();

    final req = adapter.requests.singleWhere((r) => r.method == 'PATCH');
    expect(req.data, {'status': 'inactive'});
  });

  testWidgets('users list pages in more results on scroll', (tester) async {
    final rows = [for (var i = 0; i < 15; i++) {..._user, 'id': 100 + i, 'name': 'User $i'}];
    final adapter = await pumpSignedIn(tester, permissions: ['users.view'], path: '/users', routes: {
      'GET /users': (o) => o.queryParameters['page'] == 1
          ? (status: 200, body: page(rows, current: 1, last: 2))
          : (status: 200, body: page([{..._user, 'id': 999, 'name': 'Last One'}], current: 2, last: 2)),
      'GET /user-management-statistics': (_) => (status: 200, body: {'total_users': 16, 'total_roles': 1, 'total_permissions': 1, 'unassigned_users': 0}),
    });

    await tester.drag(find.byType(Scrollable).last, const Offset(0, -3000));
    await tester.pumpAndSettle();

    expect(adapter.requests.where((r) => r.path == '/users').map((r) => r.queryParameters['page']), [1, 2]);
    expect(find.text('Last One'), findsOneWidget);
  });

  testWidgets('activity log renders entries with causer and event', (tester) async {
    await pumpSignedIn(tester, permissions: ['activity-log.view'], path: '/activity-log', routes: {
      'GET /activity-log': (_) => (status: 200, body: page([
            {'id': 1, 'event': 'role_assignment', 'description': "Roles updated for user 'Budi'", 'created_at': '2026-09-18T03:00:00.000000Z', 'causer': {'id': 1, 'name': 'Ana Operator'}},
            {'id': 2, 'event': 'login', 'description': 'User logged in', 'created_at': '2026-09-18T02:00:00.000000Z', 'causer': null},
          ])),
    });

    expect(find.text("Roles updated for user 'Budi'"), findsOneWidget);
    expect(find.text('by Ana Operator'), findsOneWidget);
    expect(find.text('by System'), findsOneWidget);
    expect(find.text('role assignment'), findsOneWidget);
  });
}
