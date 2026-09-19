import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/theme/app_theme.dart';

/// Dismissible full-width notice. Only used for things the user can act on.
class NoticeBanner extends StatelessWidget {
  const NoticeBanner({
    super.key,
    required this.title,
    required this.message,
    required this.onTap,
    required this.onDismiss,
  });

  final String title;
  final String message;
  final VoidCallback onTap;
  final VoidCallback onDismiss;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    // White text on the destructive gradient; the light token keeps >= 4.5:1.
    final base = HSLColor.fromColor(t.destructive)
        .withLightness(0.36)
        .toColor();
    final end = HSLColor.fromColor(t.destructive).withLightness(0.28).toColor();
    const fg = Colors.white;
    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        gradient: LinearGradient(colors: [base, end]),
      ),
      child: Row(
        children: [
          Expanded(
            child: InkWell(
              borderRadius: BorderRadius.circular(16),
              onTap: onTap,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 12, 0, 12),
                child: Row(
                  children: [
                    const Icon(LucideIcons.cloudAlert, color: fg),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            title,
                            style: const TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w600,
                              color: fg,
                            ),
                          ),
                          Text(
                            message,
                            style: const TextStyle(fontSize: 13, color: fg),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          IconButton(
            tooltip: 'Dismiss',
            onPressed: onDismiss,
            icon: const Icon(LucideIcons.x, size: 18, color: fg),
          ),
        ],
      ),
    );
  }
}
