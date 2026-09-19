import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/theme/app_theme.dart';
import 'minerva_scaffold.dart';

/// Stand-in for modules not yet built (also the web's own "under construction" page).
class ModulePlaceholder extends StatelessWidget {
  const ModulePlaceholder(this.title, {super.key, this.message = 'This module is coming to the mobile app soon.'});

  final String title;
  final String message;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    return MinervaScaffold(
      title: title,
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Icon(LucideIcons.construction, size: 40, color: t.mutedForeground),
            const SizedBox(height: 12),
            Text(title, textAlign: TextAlign.center, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w600)),
            const SizedBox(height: 4),
            Text(message, textAlign: TextAlign.center, style: TextStyle(color: t.mutedForeground)),
          ]),
        ),
      ),
    );
  }
}
