import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/auth/auth_controller.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/ui/app_alert.dart';
import 'sync_pill.dart';

/// Content of the hero block: sync pill, scan shortcut, profile menu and greeting.
/// Sits on a `primary` surface, so it only uses `primaryForeground` for text and icons.
class HomeHeader extends ConsumerWidget {
  const HomeHeader({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.tokens;
    final session = ref.watch(sessionProvider);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  const SyncPill(),
                  if (session.can('stock-take.create'))
                    Semantics(
                      button: true,
                      label: 'Scan stock',
                      child: Material(
                        color: t.primaryForeground,
                        shape: const StadiumBorder(),
                        child: InkWell(
                          customBorder: const StadiumBorder(),
                          onTap: () => context.go('/stock-taking'),
                          child: ConstrainedBox(
                            constraints: const BoxConstraints(minHeight: 44),
                            child: Padding(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 14,
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(
                                    LucideIcons.scanBarcode,
                                    size: 18,
                                    color: t.primary,
                                  ),
                                  const SizedBox(width: 8),
                                  Text(
                                    'Scan',
                                    style: TextStyle(
                                      fontSize: 13,
                                      fontWeight: FontWeight.w600,
                                      color: t.primary,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            _ProfileMenu(initials: session.initials),
          ],
        ),
        const SizedBox(height: 20),
        Text(
          'Welcome back,',
          style: TextStyle(
            fontSize: 14,
            color: t.primaryForeground.withValues(alpha: 0.8),
          ),
        ),
        const SizedBox(height: 2),
        Text(
          session.name.split(' ').first,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(
            fontSize: 20,
            fontWeight: FontWeight.w700,
            color: t.primaryForeground,
          ),
        ),
      ],
    );
  }
}

class _ProfileMenu extends ConsumerWidget {
  const _ProfileMenu({required this.initials});
  final String initials;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.tokens;
    return PopupMenuButton<String>(
      tooltip: 'Profile menu',
      onSelected: (v) async {
        if (v == 'settings') {
          context.go('/settings/profile');
        } else if (v == 'logout') {
          if (await confirmDialog(
            context,
            title: 'Log out?',
            message: 'You will need to sign in again.',
            confirmLabel: 'Log out',
          )) {
            await ref.read(authProvider.notifier).logout();
          }
        }
      },
      itemBuilder: (_) => const [
        PopupMenuItem(value: 'settings', child: Text('Settings')),
        PopupMenuItem(value: 'logout', child: Text('Log out')),
      ],
      child: Container(
        width: 44,
        height: 44,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: t.primaryForeground.withValues(alpha: 0.16),
        ),
        child: Text(
          initials,
          style: TextStyle(
            fontWeight: FontWeight.w600,
            fontSize: 14,
            color: t.primaryForeground,
          ),
        ),
      ),
    );
  }
}
