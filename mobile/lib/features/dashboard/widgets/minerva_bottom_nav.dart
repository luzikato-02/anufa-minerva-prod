import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/sync/sync_queue.dart';
import '../../../core/theme/app_theme.dart';

class _Tab {
  const _Tab(this.label, this.path, this.icon, this.activeIcon);
  final String label;
  final String path;
  final IconData icon;
  final IconData activeIcon;
}

const _tabs = [
  _Tab('Home', '/dashboard', Icons.home_outlined, Icons.home_rounded),
  _Tab('Record', '/record', Icons.edit_note_outlined, Icons.edit_note_rounded),
  _Tab('Records', '/records', Icons.list_alt_outlined, Icons.list_alt_rounded),
  _Tab('More', '/more', Icons.menu_rounded, Icons.menu_open_rounded),
];

/// Fixed bottom bar for the four top-level screens only (never on recording/edit screens).
class MinervaBottomNav extends ConsumerWidget {
  const MinervaBottomNav({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.tokens;
    final current = GoRouterState.of(context).uri.path;
    final rejected = ref.watch(syncQueueProvider).failed > 0;
    return Material(
      color: t.card,
      elevation: 0,
      child: DecoratedBox(
        decoration: BoxDecoration(
          border: Border(top: BorderSide(color: t.border)),
        ),
        child: SafeArea(
          top: false,
          child: Row(
            children: [
              for (final tab in _tabs)
                Expanded(
                  child: _NavItem(
                    tab: tab,
                    active: current == tab.path,
                    dot: tab.path == '/more' && rejected,
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _NavItem extends StatelessWidget {
  const _NavItem({required this.tab, required this.active, required this.dot});
  final _Tab tab;
  final bool active;
  final bool dot;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final color = active ? t.primary : t.mutedForeground;
    return Semantics(
      button: true,
      selected: active,
      label: dot ? '${tab.label}, sync items need attention' : tab.label,
      excludeSemantics: true,
      child: InkWell(
        onTap: active ? null : () => context.go(tab.path),
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 60),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              AnimatedContainer(
                duration: const Duration(milliseconds: 150),
                height: 3,
                width: active ? 32 : 0,
                decoration: BoxDecoration(
                  color: t.primary,
                  borderRadius: const BorderRadius.vertical(
                    bottom: Radius.circular(3),
                  ),
                ),
              ),
              const SizedBox(height: 8),
              Badge(
                isLabelVisible: dot,
                smallSize: 10,
                backgroundColor: t.destructive,
                child: Icon(
                  active ? tab.activeIcon : tab.icon,
                  size: 26,
                  color: color,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                tab.label,
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: active ? FontWeight.w600 : FontWeight.w500,
                  color: color,
                ),
              ),
              const SizedBox(height: 4),
            ],
          ),
        ),
      ),
    );
  }
}
