import 'package:flutter/widgets.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

/// One page of the Home summary card: a module's headline number, built from the /dashboard payload.
class ModuleStat {
  const ModuleStat({
    required this.icon,
    required this.title,
    required this.value,
    required this.secondary,
    required this.path,
    required this.semantics,
  });

  final IconData icon;
  final String title;
  final String value;
  final String secondary;
  final String path;

  /// Read out by screen readers in place of the visible pieces.
  final String semantics;

  /// The pages this user can see, in order: tension, stock taking, finish earlier.
  /// A section the server left out or nulled (no permission, or an older server) is skipped.
  /// Users only appear for a role that can see nothing else, so an admin-only account keeps a summary.
  static List<ModuleStat> listFrom(Map<String, dynamic> d) {
    final pages = <ModuleStat>[];

    final tension = d['tension'];
    if (tension is Map) {
      final total = _int(tension['total']);
      final open = _int(tension['open_problems']);
      pages.add(ModuleStat(
        icon: LucideIcons.activity,
        title: 'Tension records',
        value: '$total',
        secondary: _plural(open, 'open problem', 'open problems'),
        path: '/tension-records',
        semantics: 'Tension records, ${_plural(total, 'record', 'records')}, ${_plural(open, 'open problem', 'open problems')}',
      ));
    }

    final stock = d['stockTake'];
    if (stock is Map) {
      final completion = _int(stock['completion']);
      final inProgress = _int(stock['in_progress']);
      pages.add(ModuleStat(
        icon: LucideIcons.clipboardList,
        title: 'Stock taking',
        value: '$completion%',
        secondary: 'complete · $inProgress in progress',
        path: '/stock-take-records',
        semantics: 'Stock taking, $completion percent complete, ${_plural(inProgress, 'session', 'sessions')} in progress',
      ));
    }

    final finish = d['finishEarlier'];
    if (finish is Map) {
      final week = _int(finish['this_week']);
      final total = _int(finish['total']);
      pages.add(ModuleStat(
        icon: LucideIcons.listChecks,
        title: 'Finish earlier',
        value: '$week',
        secondary: 'this week · $total total',
        path: '/finish-earlier',
        semantics: 'Finish earlier, ${_plural(week, 'record', 'records')} this week, $total in total',
      ));
    }

    final users = d['users'];
    if (pages.isEmpty && users is Map) {
      final total = _int(users['total']);
      final unassigned = _int(users['unassigned']);
      pages.add(ModuleStat(
        icon: LucideIcons.users,
        title: 'Users',
        value: '$total',
        secondary: '$unassigned without a role',
        path: '/users',
        semantics: 'Users, $total in total, $unassigned without a role',
      ));
    }
    return pages;
  }
}

int _int(Object? v) => v is num ? v.toInt() : int.tryParse('$v') ?? 0;

String _plural(int n, String one, String many) => n == 1 ? '1 $one' : '$n $many';
