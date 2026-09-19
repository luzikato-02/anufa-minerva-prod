import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/theme/theme_mode_provider.dart';
import '../../core/ui/app_card.dart';
import 'settings_shell.dart';

class AppearancePage extends ConsumerWidget {
  const AppearancePage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final mode = ref.watch(themeModeProvider);
    return SettingsShell(
      current: 'appearance',
      child: AppCard(
        title: 'Appearance settings',
        description: "Update your account's appearance settings",
        child: SegmentedButton<ThemeMode>(
          showSelectedIcon: false,
          selected: {mode},
          onSelectionChanged: (s) => ref.read(themeModeProvider.notifier).set(s.first),
          segments: const [
            ButtonSegment(value: ThemeMode.light, icon: Icon(LucideIcons.sun, size: 16), label: Text('Light')),
            ButtonSegment(value: ThemeMode.dark, icon: Icon(LucideIcons.moon, size: 16), label: Text('Dark')),
            ButtonSegment(value: ThemeMode.system, icon: Icon(LucideIcons.monitor, size: 16), label: Text('System')),
          ],
        ),
      ),
    );
  }
}
