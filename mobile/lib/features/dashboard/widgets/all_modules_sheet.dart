import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../app/nav.dart';
import '../../../core/auth/auth_controller.dart';
import '../../../core/theme/app_theme.dart';
import 'home_config.dart';

/// Home "All modules" tile: every module the user can open, in a sheet from below with the logo centred.
/// (Module screens keep their drawer; only Home swaps it for this sheet.)
Future<void> openAllModules(BuildContext context) async {
  final path = await showModalBottomSheet<String>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    useSafeArea: true,
    builder: (_) => const _AllModulesSheet(),
  );
  if (path != null && context.mounted) context.go(path);
}

class _AllModulesSheet extends ConsumerWidget {
  const _AllModulesSheet();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(sessionProvider);
    final t = context.tokens;
    final dark = Theme.of(context).brightness == Brightness.dark;
    final groups = [
      for (final g in navGroups)
        (
          g.label,
          [
            for (final i in g.items)
              if (i.section != NavSection.home &&
                  (i.permission == null || session.can(i.permission!)))
                i,
          ],
        ),
    ].where((g) => g.$2.isNotEmpty);

    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Center(
            child: DecoratedBox(
              // A 1px outline in pure black (light) or white (dark) at 10% keeps the dark logo tile visible on either surface.
              position: DecorationPosition.foreground,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(Radii.lg),
                border: Border.all(
                  color: (dark ? Colors.white : Colors.black).withValues(
                    alpha: 0.1,
                  ),
                ),
              ),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(Radii.lg),
                child: Image.asset(
                  'assets/images/logo.png',
                  width: 56,
                  height: 56,
                  semanticLabel: 'Minerva logo',
                ),
              ),
            ),
          ),
          const SizedBox(height: 12),
          const Text(
            'Minerva',
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
          ),
          Text(
            'All modules',
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 13, color: t.mutedForeground),
          ),
          const SizedBox(height: 16),
          for (final (label, items) in groups) ...[
            if (label != null)
              Padding(
                padding: const EdgeInsets.fromLTRB(4, 16, 4, 4),
                child: Text(
                  label,
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w500,
                    color: t.mutedForeground,
                  ),
                ),
              ),
            for (final item in items) _ModuleRow(item: item),
          ],
        ],
      ),
    );
  }
}

class _ModuleRow extends StatelessWidget {
  const _ModuleRow({required this.item});
  final NavItem item;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final tint = TileTint.of(context, item.category);
    return Semantics(
      button: true,
      label: item.title,
      excludeSemantics: true,
      child: InkWell(
        borderRadius: BorderRadius.circular(Radii.lg),
        onTap: () => Navigator.pop(context, item.path),
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 56),
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 4),
            child: Row(
              children: [
                Container(
                  width: 40,
                  height: 40,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: tint.background,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(item.icon, size: 20, color: tint.icon),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    item.title,
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ),
                Icon(
                  LucideIcons.chevronRight,
                  size: 18,
                  color: t.mutedForeground,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
