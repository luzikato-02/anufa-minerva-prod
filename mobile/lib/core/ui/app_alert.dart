import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../theme/app_theme.dart';
import 'app_button.dart';

/// Inline alert (web `alert.tsx` / `alert-error.tsx`).
class AppAlert extends StatelessWidget {
  const AppAlert({super.key, required this.message, this.title, this.destructive = true});

  final String? title;
  final String message;
  final bool destructive;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final color = destructive ? t.destructiveForeground : t.foreground;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: t.card,
        borderRadius: BorderRadius.circular(Radii.lg),
        border: Border.all(color: destructive ? t.destructive.withValues(alpha: .5) : t.border),
      ),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Icon(destructive ? LucideIcons.circleAlert : LucideIcons.info, size: 18, color: color),
        const SizedBox(width: 10),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            if (title != null) Text(title!, style: TextStyle(fontWeight: FontWeight.w500, color: color)),
            Text(message, style: TextStyle(fontSize: 13, color: destructive ? color : t.mutedForeground)),
          ]),
        ),
      ]),
    );
  }
}

/// Confirmation dialog (web `alert-dialog.tsx`). Resolves true if confirmed.
Future<bool> confirmDialog(
  BuildContext context, {
  required String title,
  required String message,
  String confirmLabel = 'Continue',
  bool destructive = false,
}) async {
  final res = await showDialog<bool>(
    context: context,
    builder: (ctx) => AlertDialog(
      title: Text(title, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w600)),
      content: Text(message),
      actions: [
        AppButton(label: 'Cancel', variant: AppButtonVariant.outline, onPressed: () => Navigator.pop(ctx, false)),
        AppButton(
          label: confirmLabel,
          variant: destructive ? AppButtonVariant.destructive : AppButtonVariant.primary,
          onPressed: () => Navigator.pop(ctx, true),
        ),
      ],
    ),
  );
  return res ?? false;
}
