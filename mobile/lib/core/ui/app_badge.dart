import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

enum AppBadgeVariant { primary, secondary, destructive, outline, success, warning }

/// Mirrors web `badge.tsx`.
class AppBadge extends StatelessWidget {
  const AppBadge(this.text, {super.key, this.variant = AppBadgeVariant.primary});

  final String text;
  final AppBadgeVariant variant;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final s = context.semantic;
    final (bg, fg, side) = switch (variant) {
      AppBadgeVariant.primary => (t.primary, t.primaryForeground, BorderSide.none),
      AppBadgeVariant.secondary => (t.secondary, t.secondaryForeground, BorderSide.none),
      AppBadgeVariant.destructive => (t.destructive, const Color(0xFFFFFFFF), BorderSide.none),
      AppBadgeVariant.outline => (Colors.transparent, t.foreground, BorderSide(color: t.border)),
      AppBadgeVariant.success => (s.success.withValues(alpha: .15), s.success, BorderSide.none),
      AppBadgeVariant.warning => (s.warning.withValues(alpha: .15), s.warning, BorderSide.none),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(Radii.md), border: side == BorderSide.none ? null : Border.fromBorderSide(side)),
      child: Text(text, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w500, color: fg)),
    );
  }
}
