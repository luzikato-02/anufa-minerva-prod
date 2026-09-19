import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../app/nav.dart';
import '../../core/auth/auth_controller.dart';
import '../../core/theme/app_theme.dart';
import '../../core/ui/app_alert.dart';
import '../shared/minerva_scaffold.dart';
import 'widgets/home_config.dart';
import 'widgets/module_tile.dart';

/// Landing screen behind a bottom-nav tab: the permitted modules of one [NavSection] as a tile grid.
class ModuleListScreen extends ConsumerWidget {
  const ModuleListScreen({
    super.key,
    required this.title,
    required this.section,
    this.showAccount = false,
  });

  final String title;
  final NavSection section;

  /// "More" also carries the account actions that used to live only in the drawer footer.
  final bool showAccount;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(sessionProvider);
    final items = itemsFor(section, session);
    return MinervaScaffold(
      title: title,
      bottomNav: true,
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (items.isEmpty)
            const EmptyPlaceholder('Nothing available for your role here.')
          else
            ModuleGrid(items: items),
          if (showAccount) ...[
            const SizedBox(height: 8),
            ListTile(
              minVerticalPadding: 12,
              leading: const Icon(LucideIcons.settings),
              title: const Text('Settings'),
              onTap: () => context.go('/settings/profile'),
            ),
            ListTile(
              minVerticalPadding: 12,
              leading: Icon(
                LucideIcons.logOut,
                color: context.tokens.destructive,
              ),
              title: const Text('Log out'),
              onTap: () async {
                if (await confirmDialog(
                  context,
                  title: 'Log out?',
                  message: 'You will need to sign in again.',
                  confirmLabel: 'Log out',
                )) {
                  await ref.read(authProvider.notifier).logout();
                }
              },
            ),
          ],
        ],
      ),
    );
  }
}

class EmptyPlaceholder extends StatelessWidget {
  const EmptyPlaceholder(this.message, {super.key});
  final String message;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 32),
    child: Center(
      child: Text(
        message,
        style: TextStyle(color: context.tokens.mutedForeground),
      ),
    ),
  );
}
