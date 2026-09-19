import 'package:flutter/widgets.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

/// Which bottom-nav landing an item belongs to (`more` = the catch-all).
enum NavSection { home, record, records, more }

/// One drawer entry. Mirrors `app-sidebar.tsx`: same titles, groups and permission gates.
class NavItem {
  const NavItem(this.title, this.path, this.icon, {this.permission, this.section = NavSection.more});
  final String title;
  final String path;
  final IconData icon;
  final String? permission;
  final NavSection section;
}

class NavGroup {
  const NavGroup(this.label, this.items);
  final String? label;
  final List<NavItem> items;
}

const navGroups = <NavGroup>[
  NavGroup(null, [
    NavItem('Home', '/dashboard', LucideIcons.house, section: NavSection.home),
    NavItem('Document Intelligence', '/document-intelligence', LucideIcons.fileSearch, section: NavSection.record),
  ]),
  NavGroup('Process Parameters', [
    NavItem('Record: Twisting Tension', '/twisting-tension', LucideIcons.activity, permission: 'tension-records.create', section: NavSection.record),
    NavItem('Record: Weaving Tension', '/weaving-tension', LucideIcons.activity, permission: 'tension-records.create', section: NavSection.record),
    NavItem('Display: Tension Records', '/tension-records', LucideIcons.table, permission: 'tension-records.view', section: NavSection.records),
    NavItem('Machine Maintenance', '/machine-maintenance', LucideIcons.wrench, permission: 'machine-maintenance.view'),
  ]),
  NavGroup('Inventory', [
    NavItem('Record: Batch Stock Taking', '/stock-taking', LucideIcons.scanBarcode, permission: 'stock-take.create', section: NavSection.record),
    NavItem('Display: Stock Take Records', '/stock-take-records', LucideIcons.clipboardList, permission: 'stock-take.view', section: NavSection.records),
    NavItem('Record: Liner Material I/O', '/liner-material-io/record', LucideIcons.construction, section: NavSection.record),
    NavItem('Display: Liner Material I/O', '/liner-material-io/display', LucideIcons.construction, section: NavSection.records),
  ]),
  NavGroup('Loom', [
    NavItem('Display: Finish Earlier Records', '/finish-earlier', LucideIcons.listChecks, permission: 'finish-earlier.view', section: NavSection.records),
    NavItem('Scan: Finish Earlier Form', '/finish-earlier/scan', LucideIcons.scanLine, permission: 'finish-earlier.create', section: NavSection.record),
  ]),
  NavGroup('Administration', [
    NavItem('User & Role Management', '/users', LucideIcons.users, permission: 'users.view'),
    NavItem('Activity Log', '/activity-log', LucideIcons.history, permission: 'activity-log.view'),
  ]),
];
