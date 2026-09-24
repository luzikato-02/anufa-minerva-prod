import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/theme/app_theme.dart';

/// A single-code chip used for the side, row and column selectors: filled state shown by a checkmark, not
/// color alone. Shared by the recording screen and the detail grid so "pick a side" looks the same everywhere.
class PositionChip extends StatelessWidget {
  const PositionChip({super.key, required this.label, required this.selected, required this.filled, required this.onTap});

  final String label;
  final bool selected;
  final bool filled;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    return Material(
      color: selected ? t.primary : (filled ? t.accent : t.background),
      borderRadius: BorderRadius.circular(Radii.md),
      child: InkWell(
        borderRadius: BorderRadius.circular(Radii.md),
        onTap: onTap,
        child: Container(
          height: 44,
          alignment: Alignment.center,
          padding: const EdgeInsets.symmetric(horizontal: 2),
          decoration: BoxDecoration(border: Border.all(color: selected ? t.primary : t.input), borderRadius: BorderRadius.circular(Radii.md)),
          // FittedBox rather than a fixed gap/icon size: four of these share a narrow phone's width, and a
          // two-letter side code plus the filled checkmark is tight enough at 1.4x text to overflow otherwise.
          child: FittedBox(
            child: Row(mainAxisSize: MainAxisSize.min, children: [
              Text(label, style: TextStyle(fontWeight: FontWeight.w600, color: selected ? t.primaryForeground : t.foreground)),
              if (filled) ...[
                const SizedBox(width: 4),
                Icon(LucideIcons.check, size: 12, color: selected ? t.primaryForeground : t.foreground),
              ],
            ]),
          ),
        ),
      ),
    );
  }
}
