import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

enum AppButtonVariant { primary, destructive, outline, secondary, ghost, link }

enum AppButtonSize { defaultSize, sm, lg, icon }

/// Mirrors web `components/ui/button.tsx` (cva variants x sizes).
class AppButton extends StatelessWidget {
  const AppButton({
    super.key,
    required this.onPressed,
    this.label,
    this.child,
    this.icon,
    this.variant = AppButtonVariant.primary,
    this.size = AppButtonSize.defaultSize,
    this.loading = false,
    this.expand = false,
  }) : assert(label != null || child != null || icon != null);

  final VoidCallback? onPressed;
  final String? label;
  final Widget? child;
  final IconData? icon;
  final AppButtonVariant variant;
  final AppButtonSize size;
  final bool loading;
  final bool expand;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final (bg, fg, side) = switch (variant) {
      AppButtonVariant.primary => (t.primary, t.primaryForeground, BorderSide.none),
      AppButtonVariant.destructive => (t.destructive, const Color(0xFFFFFFFF), BorderSide.none),
      AppButtonVariant.outline => (t.background, t.foreground, BorderSide(color: t.input)),
      AppButtonVariant.secondary => (t.secondary, t.secondaryForeground, BorderSide.none),
      AppButtonVariant.ghost => (Colors.transparent, t.foreground, BorderSide.none),
      AppButtonVariant.link => (Colors.transparent, t.primary, BorderSide.none),
    };
    // Web heights are 36/32/40; floor targets to 44+ for gloved factory use except `sm`.
    final (double h, double px, double fs) = switch (size) {
      AppButtonSize.defaultSize => (44, 16, 14),
      AppButtonSize.sm => (36, 12, 13),
      AppButtonSize.lg => (52, 24, 15),
      AppButtonSize.icon => (44, 0, 14),
    };
    final disabled = onPressed == null || loading;
    final content = loading
        ? SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: fg))
        : child ??
            Row(mainAxisSize: MainAxisSize.min, children: [
              if (icon != null) Icon(icon, size: 18),
              if (icon != null && label != null) const SizedBox(width: 8),
              if (label != null)
                Flexible(
                  child: Text(label!,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: fs,
                        fontWeight: FontWeight.w500,
                        decoration: variant == AppButtonVariant.link ? TextDecoration.underline : null,
                      )),
                ),
            ]);
    final button = Opacity(
      opacity: disabled && !loading ? .5 : 1,
      child: Material(
        color: bg,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(Radii.md), side: side),
        child: InkWell(
          borderRadius: BorderRadius.circular(Radii.md),
          onTap: disabled ? null : onPressed,
          child: Container(
            height: h,
            width: size == AppButtonSize.icon ? h : null,
            padding: EdgeInsets.symmetric(horizontal: px),
            alignment: Alignment.center,
            child: DefaultTextStyle.merge(style: TextStyle(color: fg), child: IconTheme.merge(data: IconThemeData(color: fg), child: content)),
          ),
        ),
      ),
    );
    return expand ? SizedBox(width: double.infinity, child: button) : button;
  }
}
