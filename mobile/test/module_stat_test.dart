import 'package:anufa_minerva_mobile/features/dashboard/widgets/module_stat.dart';
import 'package:flutter_test/flutter_test.dart';

const _tension = {'total': 12, 'twisting': 7, 'weaving': 5, 'open_problems': 3};
const _stock = {'total': 4, 'in_progress': 1, 'completed': 3, 'completion': 75};
const _finish = {'total': 12, 'this_week': 4};

void main() {
  test('pages come in a fixed order with the numbers each module should show', () {
    final pages = ModuleStat.listFrom({'tension': _tension, 'stockTake': _stock, 'finishEarlier': _finish, 'users': null});

    expect(pages.map((p) => p.title), ['Tension records', 'Stock taking', 'Finish earlier']);
    expect(pages.map((p) => p.value), ['12', '75%', '4']);
    expect(pages.map((p) => p.secondary), ['3 open problems', 'complete · 1 in progress', 'this week · 12 total']);
    expect(pages.map((p) => p.path), ['/tension-records', '/stock-take-records', '/finish-earlier']);
  });

  test('a section the server omits (older server) or nulls (no permission) is skipped', () {
    expect(ModuleStat.listFrom({'tension': _tension, 'stockTake': _stock}).map((p) => p.title), ['Tension records', 'Stock taking']);
    expect(ModuleStat.listFrom({'tension': null, 'stockTake': _stock, 'finishEarlier': null}).map((p) => p.title), ['Stock taking']);
    expect(ModuleStat.listFrom({}), isEmpty);
  });

  test('users only stand in when the role can see nothing else', () {
    const users = {'total': 9, 'unassigned': 1};
    expect(ModuleStat.listFrom({'users': users}).single.secondary, '1 without a role');
    expect(ModuleStat.listFrom({'tension': _tension, 'users': users}).map((p) => p.title), ['Tension records']);
  });

  test('singular counts are not pluralised, and screen readers get full sentences', () {
    final pages = ModuleStat.listFrom({
      'tension': {'total': 1, 'open_problems': 1},
      'stockTake': {'completion': 50, 'in_progress': 1},
      'finishEarlier': {'total': 1, 'this_week': 1},
    });
    expect(pages[0].secondary, '1 open problem');
    expect(pages[0].semantics, 'Tension records, 1 record, 1 open problem');
    expect(pages[1].semantics, 'Stock taking, 50 percent complete, 1 session in progress');
    expect(pages[2].semantics, 'Finish earlier, 1 record this week, 1 in total');
  });

  test('numbers that arrive as strings or are missing do not break the card', () {
    final page = ModuleStat.listFrom({
      'stockTake': {'completion': '75', 'in_progress': null},
    }).single;
    expect(page.value, '75%');
    expect(page.secondary, 'complete · 0 in progress');
  });
}
