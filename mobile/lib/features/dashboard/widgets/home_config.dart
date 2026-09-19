import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../app/nav.dart';
import '../../../core/auth/session.dart';
import '../../../core/theme/app_theme.dart';

/// Base hues for the module tiles. Backgrounds and icon colours are derived per
/// theme in [TileTint], so nothing here is a literal pastel.
const _tintHues = [
  Color(0xFF3B82F6),
  Color(0xFF10B981),
  Color(0xFFF59E0B),
  Color(0xFF8B5CF6),
  Color(0xFFEC4899),
  Color(0xFF06B6D4),
];

class TileTint {
  const TileTint._(this.background, this.icon);

  factory TileTint.of(BuildContext context, int index) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final hue = _tintHues[index % _tintHues.length];
    final background = Color.alphaBlend(
      hue.withValues(alpha: dark ? 0.2 : 0.14),
      context.tokens.card,
    );
    final icon = HSLColor.fromColor(hue)
        .withLightness(dark ? 0.75 : 0.3)
        .toColor();
    return TileTint._(background, icon);
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
    this.syncPathContains,
  );
  final String label;
  final IconData icon;
  final String path;
  final String permission;

  /// Queued offline uploads whose API path contains this show as the action's badge.
  final String syncPathContains;
}

const quickActions = [
  QuickActionConfig(
    'Twisting',
    LucideIcons.activity,
    '/twisting-tension',
    'tension-records.create',
    'tension-records',
  ),
  QuickActionConfig(
    'Weaving',
    LucideIcons.chartLine,
    '/weaving-tension',
    'tension-records.create',
    'tension-records',
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
