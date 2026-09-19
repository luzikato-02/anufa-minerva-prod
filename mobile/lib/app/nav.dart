import 'package:flutter/widgets.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

/// One drawer entry. Mirrors `app-sidebar.tsx`: same titles, groups and permission gates.
class NavItem {
  const NavItem(this.title, this.path, this.icon, {this.permission});
  final String title;
  final String path;
  final IconData icon;
  final String? permission;
}

class NavGroup {
  const NavGroup(this.label, this.items);
  final String? label;
  final List<NavItem> items;
}

const navGroups = <NavGroup>[
  NavGroup(null, [
    NavItem('Home', '/dashboard', LucideIcons.house),
    NavItem('Document Intelligence', '/document-intelligence', LucideIcons.fileSearch),
  ]),
  NavGroup('Process Parameters', [
    NavItem('Record: Twisting Tension', '/twisting-tension', LucideIcons.activity, permission: 'tension-records.create'),
    NavItem('Record: Weaving Tension', '/weaving-tension', LucideIcons.activity, permission: 'tension-records.create'),
    NavItem('Display: Tension Records', '/tension-records', LucideIcons.table, permission: 'tension-records.view'),
    NavItem('Machine Maintenance', '/machine-maintenance', LucideIcons.wrench, permission: 'machine-maintenance.view'),
  ]),
  NavGroup('Inventory', [
    NavItem('Record: Batch Stock Taking', '/stock-taking', LucideIcons.scanBarcode, permission: 'stock-take.create'),
    NavItem('Display: Stock Take Records', '/stock-take-records', LucideIcons.clipboardList, permission: 'stock-take.view'),
    NavItem('Record: Liner Material I/O', '/under-construction', LucideIcons.construction),
    NavItem('Display: Liner Material I/O', '/under-construction', LucideIcons.construction),
  ]),
  NavGroup('Loom', [
    NavItem('Display: Finish Earlier Records', '/finish-earlier', LucideIcons.listChecks, permission: 'finish-earlier.view'),
    NavItem('Scan: Finish Earlier Form', '/finish-earlier/scan', LucideIcons.scanLine, permission: 'finish-earlier.create'),
  ]),
  NavGroup('Administration', [
    NavItem('User & Role Management', '/users', LucideIcons.users, permission: 'users.view'),
    NavItem('Activity Log', '/activity-log', LucideIcons.history, permission: 'activity-log.view'),
  ]),
];
