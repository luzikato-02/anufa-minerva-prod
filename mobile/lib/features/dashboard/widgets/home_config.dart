import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../app/nav.dart';
import '../../../core/auth/session.dart';
import '../../../core/sync/sync_queue.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/theme/tokens.g.dart' show darkTokens, lightTokens;

/// Fill and icon colours for a module tile, taken from the theme tokens by category.
/// `general` modules (documents, admin, "All modules") stay neutral.
class TileTint {
  const TileTint._(this.background, this.icon);

  factory TileTint.of(BuildContext context, ModuleCategory category) {
    final semantic = context.semantic;
    final tint = switch (category) {
      ModuleCategory.process => semantic.moduleProcess,
      ModuleCategory.inventory => semantic.moduleInventory,
      ModuleCategory.loom => semantic.moduleLoom,
      ModuleCategory.general => ModuleTint(fill: context.tokens.muted, icon: context.tokens.foreground),
    };
    return TileTint._(tint.fill, tint.icon);
  }

  final Color background;
  final Color icon;
}

/// Most-used modules first on the home grid; anything not listed follows in nav order.
const homeTilePriority = [
  '/twisting-tension',
  '/weaving-tension',
  '/stock-taking',
  '/tension-records',
  '/finish-earlier/scan',
  '/stock-take-records',
  '/finish-earlier',
  '/document-intelligence',
  '/machine-maintenance',
];

/// Tiles that get the small dark badge (keep to 1-2).
const homeTileBadges = {'/stock-taking': 'Offline'};

class QuickActionConfig {
  const QuickActionConfig(
    this.label,
    this.icon,
    this.path,
    this.permission,
    this.syncPathContains, {
    this.syncLabelStartsWith,
  });
  final String label;
  final IconData icon;
  final String path;
  final String permission;

  /// Queued offline uploads whose API path contains this show as the action's badge.
  final String syncPathContains;

  /// Twisting and weaving both upload to `/tension-records`, so the path alone can't tell them apart;
  /// the queue label ("Twisting · …", "Weaving · …") does.
  final String? syncLabelStartsWith;

  bool matches(SyncOp op) =>
      op.path.contains(syncPathContains) &&
      (syncLabelStartsWith == null ||
          op.label.startsWith(syncLabelStartsWith!));
}

const quickActions = [
  QuickActionConfig(
    'Twisting',
    LucideIcons.activity,
    '/twisting-tension',
    'tension-records.create',
    'tension-records',
    syncLabelStartsWith: 'Twisting',
  ),
  QuickActionConfig(
    'Weaving',
    LucideIcons.chartLine,
    '/weaving-tension',
    'tension-records.create',
    'tension-records',
    syncLabelStartsWith: 'Weaving',
  ),
  QuickActionConfig(
    'Scan',
    LucideIcons.scanBarcode,
    '/stock-taking',
    'stock-take.create',
    'stock-take',
  ),
];

/// Module tiles for the home grid, permission filtered and ordered by [homeTilePriority].
List<NavItem> homeModules(Session session) {
  final all = [
    for (final g in navGroups)
      for (final i in g.items)
        if (i.section != NavSection.home &&
            (i.permission == null || session.can(i.permission!)))
          i,
  ];
  int rank(NavItem i) {
    final r = homeTilePriority.indexOf(i.path);
    return r == -1 ? homeTilePriority.length : r;
  }

  final ordered = [...all]
    ..sort(
      (a, b) => rank(a).compareTo(rank(b)),
    ); // stable, keeps nav order for ties
  return ordered;
}

/// Items for a bottom-nav landing screen.
List<NavItem> itemsFor(NavSection section, Session session) => [
  for (final g in navGroups)
    for (final i in g.items)
      if (i.section == section &&
          (i.permission == null || session.can(i.permission!)))
        i,
];

/// Short tile label: drops the "Record:" / "Display:" / "Scan:" prefix the drawer uses.
String tileLabel(String title) =>
    title.contains(': ') ? title.split(': ').last : title;

/// What the Home "Scan" button offers. Each option opens the screen that reads a photo or file.
class ScanOption {
  const ScanOption(this.title, this.description, this.icon, this.path, this.category, {this.permission});
  final String title;
  final String description;
  final IconData icon;
  final String path;
  final ModuleCategory category;
  final String? permission;
}

const scanOptions = [
  ScanOption('Document Intelligence', 'Extract text and tables from a PDF or photo', LucideIcons.fileSearch, '/document-intelligence', ModuleCategory.general),
  ScanOption('Finish Earlier Form', 'Extract data from a finish earlier form', LucideIcons.scanLine, '/finish-earlier/scan', ModuleCategory.loom, permission: 'finish-earlier.create'),
];

/// The scan options this user may open.
List<ScanOption> scanOptionsFor(Session session) => [
      for (final o in scanOptions)
        if (o.permission == null || session.can(o.permission!)) o,
    ];

/// The Home hero is dark in both themes (its texture and text are designed for a dark surface), so it uses fixed token
/// values instead of the current theme's `primary`, which turns near-white in dark mode.
class HeroColors {
  HeroColors._();
  static final background = lightTokens.primary; // #171717
  static final foreground = lightTokens.primaryForeground; // #FAFAFA
  static final muted = darkTokens.mutedForeground; // context line, KPI labels
  static final track = darkTokens.muted; // unfilled part of the shift bar
}

/// Accent for the hero's Z-strand texture and shift bar. The app theme is neutral, so this is the one added constant:
/// the blue of the "process" module colour, lightened to read on the dark hero.
const kHeroAccent = Color(0xFF6BA8F0);
