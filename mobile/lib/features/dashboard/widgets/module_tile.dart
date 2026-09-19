import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../app/nav.dart';
import '../../../core/theme/app_theme.dart';
import 'home_config.dart';

class ModuleTile extends StatelessWidget {
  const ModuleTile({
    super.key,
    required this.icon,
    required this.label,
    required this.category,
    required this.onTap,
    this.badge,
  });

  final IconData icon;
  final String label;
  final ModuleCategory category;
  final VoidCallback onTap;
  final String? badge;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final tint = TileTint.of(context, category);
    return Semantics(
      button: true,
      label: badge == null ? label : '$label, $badge',
      excludeSemantics: true,
      child: InkWell(
        borderRadius: BorderRadius.circular(20),
        onTap: onTap,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Stack(
              clipBehavior: Clip.none,
              children: [
                Container(
                  width: 72,
                  height: 72,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: tint.background,
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Icon(icon, size: 30, color: tint.icon),
                ),
                if (badge != null)
                  Positioned(
                    left: -2,
                    top: -4,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 6,
                        vertical: 2,
                      ),
                      decoration: BoxDecoration(
                        color: t.foreground,
                        borderRadius: BorderRadius.circular(999),
                      ),
                      child: Text(
                        badge!,
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: t.background,
                        ),
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              label,
              textAlign: TextAlign.center,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500),
            ),
          ],
        ),
      ),
    );
  }
}

/// Rows of four tiles. Rows are built by hand (not a GridView) so tile height can grow with text scale.
class ModuleGrid extends StatelessWidget {
  const ModuleGrid({
    super.key,
    required this.items,
    this.maxTiles,
    this.showAllModules = false,
  });

  final List<NavItem> items;

  /// Cap on real modules shown; the rest are reached through the "All modules" tile.
  final int? maxTiles;
  final bool showAllModules;

  @override
  Widget build(BuildContext context) {
    final shown = maxTiles == null
        ? items
        : items.take(showAllModules ? maxTiles! - 1 : maxTiles!).toList();
    final tiles = <Widget>[
      for (var i = 0; i < shown.length; i++)
        ModuleTile(
          icon: shown[i].icon,
          label: tileLabel(shown[i].title),
          category: shown[i].category,
          badge: homeTileBadges[shown[i].path],
          onTap: () => context.go(shown[i].path),
        ),
      if (showAllModules)
        ModuleTile(
          icon: LucideIcons.layoutGrid,
          label: 'All modules',
          category: ModuleCategory.general,
          onTap: () => Scaffold.of(context).openDrawer(),
        ),
    ];
    return Column(
      children: [
        for (var r = 0; r < tiles.length; r += 4)
          Padding(
            padding: const EdgeInsets.only(bottom: 16),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                for (var c = 0; c < 4; c++)
                  Expanded(
                    child: r + c < tiles.length
                        ? Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 4),
                            child: tiles[r + c],
                          )
                        : const SizedBox.shrink(),
                  ),
              ],
            ),
          ),
      ],
    );
  }
}
