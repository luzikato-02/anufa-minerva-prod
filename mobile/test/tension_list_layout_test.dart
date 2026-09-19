import 'package:anufa_minerva_mobile/core/ui/app_card.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'support/pump.dart';

Map<String, dynamic> _page(List rows) => {'data': rows, 'current_page': 1, 'last_page': 1, 'total': rows.length};

final _rec = {
  'id': 7,
  'record_type': 'twisting',
  'created_at': '2026-09-17T03:00:00.000000Z',
  'form_data': {'machineNumber': 'T-01', 'specTens': 40, 'tensPlus': 5},
  'metadata': {'operator': 'Ana', 'item_number': 'ITM-1', 'completed_measurements': 2, 'total_measurements': 2, 'progress_percentage': 100},
  'measurement_data': <String, dynamic>{},
  'problems': [],
};

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  testWidgets('the search field has room under the tab bar and sits as close to the list as it is to the tabs', (tester) async {
    await pumpSignedIn(tester, permissions: ['tension-records.view'], path: '/tension-records', routes: {
      'GET /tension-statistics': (_) => (status: 200, body: {'data': {'total_records': 5, 'twisting_records': 3, 'weaving_records': 2, 'twisting_problems': 1, 'weaving_problems': 0}}),
      'GET /tension-records': (_) => (status: 200, body: _page([_rec])),
      'GET /tension-problems': (_) => (status: 200, body: _page([])),
    });

    final tab = tester.getRect(find.byType(TabBar));
    final field = tester.getRect(find.byType(TextField).first);
    final firstRecord = tester.getRect(find.byType(AppCard).at(1)); // the first card is the stats card
    expect(field.top - tab.bottom, greaterThanOrEqualTo(12), reason: 'the search box must not touch the tab bar');
    expect(firstRecord.top - field.bottom, lessThanOrEqualTo(field.top - tab.bottom), reason: 'the search box belongs to the list below it');
  });
}
