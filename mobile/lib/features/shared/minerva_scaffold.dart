import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../app/nav.dart';
import '../../core/auth/auth_controller.dart';
import '../../core/config/env.dart';
import '../../core/sync/sync_queue.dart';
import '../../core/theme/app_theme.dart';
import '../../core/ui/app_alert.dart';
import '../dashboard/widgets/minerva_bottom_nav.dart';

/// Page frame with the permission-filtered drawer (the web sidebar).
class MinervaScaffold extends ConsumerWidget {
  const MinervaScaffold({super.key, required this.title, required this.body, this.actions, this.fab, this.showDrawer = true, this.hideAppBar = false, this.bottomNav = false});

  final String title;
  final Widget body;
  final List<Widget>? actions;
  final Widget? fab;
  final bool showDrawer;

  /// Home draws its own header, so it drops the app bar (the drawer stays reachable via "All modules").
  final bool hideAppBar;

  /// Only the four top-level screens show the bottom bar; recording and edit screens keep the full height.
  final bool bottomNav;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      appBar: hideAppBar ? null : AppBar(title: Text(title), actions: [const _SyncChip(), ...?actions]),
      drawer: showDrawer ? const _MinervaDrawer() : null,
      floatingActionButton: fab,
      bottomNavigationBar: bottomNav ? const MinervaBottomNav() : null,
      body: SafeArea(top: !hideAppBar, child: body),
    );
  }
}

class _MinervaDrawer extends ConsumerWidget {
  const _MinervaDrawer();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(sessionProvider);
    final t = context.tokens;
    final current = GoRouterState.of(context).uri.path;

    return Drawer(
      child: SafeArea(
        child: Column(children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
            child: Row(children: [
              ClipRRect(borderRadius: BorderRadius.circular(Radii.md), child: Image.asset('assets/images/logo.png', width: 32, height: 32)),
              const SizedBox(width: 10),
              const Text('Minerva', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600)),
            ]),
          ),
          Expanded(
            child: ListView(padding: const EdgeInsets.symmetric(horizontal: 8), children: [
              for (final g in navGroups) ..._group(context, g, session, current),
              if (session.can('activity-log.view') || session.can('users.manage')) ...[
                const SizedBox(height: 8),
                _tile(context, 'Log Viewer', LucideIcons.scrollText, false, () async {
                  Navigator.pop(context);
                  await launchUrl(Uri.parse('$kApiBaseUrl/log-viewer'), mode: LaunchMode.externalApplication);
                }),
              ],
            ]),
          ),
          const Divider(),
          ListTile(
            leading: CircleAvatar(
              backgroundColor: t.muted,
              foregroundColor: t.foreground,
              child: Text(session.initials, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
            ),
            title: Text(session.name, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w500)),
            subtitle: Text(session.email, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(color: t.mutedForeground, fontSize: 12)),
            trailing: PopupMenuButton<String>(
              icon: const Icon(LucideIcons.ellipsisVertical, size: 18),
              onSelected: (v) async {
                if (v == 'settings') {
                  Navigator.pop(context);
                  context.go('/settings/profile');
                } else if (v == 'logout') {
                  if (await confirmDialog(context, title: 'Log out?', message: 'You will need to sign in again.', confirmLabel: 'Log out')) {
                    await ref.read(authProvider.notifier).logout();
                  }
                }
              },
              itemBuilder: (_) => const [
                PopupMenuItem(value: 'settings', child: Text('Settings')),
                PopupMenuItem(value: 'logout', child: Text('Log out')),
              ],
            ),
          ),
        ]),
      ),
    );
  }

  List<Widget> _group(BuildContext context, NavGroup g, session, String current) {
    final items = g.items.where((i) => i.permission == null || session.can(i.permission!)).toList();
    if (items.isEmpty) return const [];
    final t = context.tokens;
    return [
      if (g.label != null)
        Padding(
          padding: const EdgeInsets.fromLTRB(12, 16, 12, 4),
          child: Text(g.label!, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w500, color: t.mutedForeground)),
        ),
      for (final i in items)
        _tile(context, i.title, i.icon, current == i.path || (i.path != '/dashboard' && current.startsWith('${i.path}/') && !_hasMoreSpecific(i, items, current)), () {
          Navigator.pop(context);
          context.go(i.path);
        }),
    ];
  }

  /// `/finish-earlier` must not stay highlighted on `/finish-earlier/scan`.
  bool _hasMoreSpecific(NavItem item, List<NavItem> items, String current) =>
      items.any((o) => o.path != item.path && o.path.startsWith('${item.path}/') && (current == o.path || current.startsWith('${o.path}/')));

  Widget _tile(BuildContext context, String title, IconData icon, bool selected, VoidCallback onTap) {
    final t = context.tokens;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 1),
      child: ListTile(
        dense: true,
        minVerticalPadding: 10,
        selected: selected,
        selectedTileColor: t.sidebarAccent,
        selectedColor: t.sidebarAccentForeground,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(Radii.md)),
        leading: Icon(icon, size: 18),
        title: Text(title, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500)),
        onTap: onTap,
      ),
    );
  }
}

/// Shows up only while uploads are waiting (offline) or rejected; opens the queue.
class _SyncChip extends ConsumerWidget {
  const _SyncChip();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final s = ref.watch(syncQueueProvider);
    if (s.ops.isEmpty) return const SizedBox.shrink();
    return IconButton(
      tooltip: s.failed > 0 ? '${uploadsLabel(s.failed)} rejected by the server' : '${uploadsLabel(s.ops.length)} waiting',
      onPressed: () => context.push('/sync'),
      icon: Badge.count(
        count: s.ops.length,
        backgroundColor: s.failed > 0 ? context.tokens.destructive : null,
        child: Icon(s.failed > 0 ? LucideIcons.cloudAlert : LucideIcons.cloudOff),
      ),
    );
  }
}
