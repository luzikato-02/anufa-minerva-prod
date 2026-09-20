import 'package:flutter/widgets.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

/// Which bottom-nav landing an item belongs to (`more` = the catch-all).
enum NavSection { home, record, records, more }

/// Which colour a module tile takes on Home. `general` is neutral; the rest map to module tokens in [AppTokens].
enum ModuleCategory { process, inventory, loom, general }

/// One drawer entry. Mirrors `app-sidebar.tsx`: same titles, groups and permission gates.
class NavItem {
  const NavItem(this.title, this.path, this.icon, {this.permission, this.section = NavSection.more, this.category = ModuleCategory.general});
  final String title;
  final String path;
  final IconData icon;
  final String? permission;
  final NavSection section;
  final ModuleCategory category;
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
    NavItem('Record: Twisting Tension', '/twisting-tension', LucideIcons.activity, permission: 'tension-records.create', section: NavSection.record, category: ModuleCategory.process),
    NavItem('Record: Weaving Tension', '/weaving-tension', LucideIcons.activity, permission: 'tension-records.create', section: NavSection.record, category: ModuleCategory.process),
    NavItem('Display: Tension Records', '/tension-records', LucideIcons.table, permission: 'tension-records.view', section: NavSection.records, category: ModuleCategory.process),
    NavItem('Machine Maintenance', '/machine-maintenance', LucideIcons.wrench, permission: 'machine-maintenance.view', category: ModuleCategory.process),
  ]),
  NavGroup('Inventory', [
    NavItem('Record: Batch Stock Taking', '/stock-taking', LucideIcons.scanBarcode, permission: 'stock-take.create', section: NavSection.record, category: ModuleCategory.inventory),
    NavItem('Display: Stock Take Records', '/stock-take-records', LucideIcons.clipboardList, permission: 'stock-take.view', section: NavSection.records, category: ModuleCategory.inventory),
    NavItem('Record: Stock Sheet', '/stock-sheet', LucideIcons.clipboardPenLine, permission: 'stock-take.create', section: NavSection.record, category: ModuleCategory.inventory),
    NavItem('Record: Liner Material I/O', '/liner-material-io/record', LucideIcons.construction, section: NavSection.record, category: ModuleCategory.inventory),
    NavItem('Display: Liner Material I/O', '/liner-material-io/display', LucideIcons.construction, section: NavSection.records, category: ModuleCategory.inventory),
  ]),
  NavGroup('Loom', [
    NavItem('Display: Finish Earlier Records', '/finish-earlier', LucideIcons.listChecks, permission: 'finish-earlier.view', section: NavSection.records, category: ModuleCategory.loom),
    NavItem('Scan: Finish Earlier Form', '/finish-earlier/scan', LucideIcons.scanLine, permission: 'finish-earlier.create', section: NavSection.record, category: ModuleCategory.loom),
  ]),
  NavGroup('Administration', [
    NavItem('User & Role Management', '/users', LucideIcons.users, permission: 'users.view'),
    NavItem('Activity Log', '/activity-log', LucideIcons.history, permission: 'activity-log.view'),
  ]),
];
