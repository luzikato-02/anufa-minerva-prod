import 'package:flutter/material.dart';

import 'tokens.g.dart';

const String kFontFamily = 'Instrument Sans';

/// Design tokens mirrored from the web app (shadcn/ui new-york, neutral).
/// Read with `context.tokens` so widgets never hardcode colours.
class AppTokens extends ThemeExtension<AppTokens> {
  const AppTokens(this.t, {required this.success, required this.warning});

  final TokenSet t;

  /// Semantic colours that shadcn neutral does not define; mapped from the
  /// web app's status badges (green/amber) so problem/finish states read alike.
  final Color success;
  final Color warning;

  static const light = AppTokens(lightTokens, success: Color(0xFF16A34A), warning: Color(0xFFD97706));
  static const dark = AppTokens(darkTokens, success: Color(0xFF4ADE80), warning: Color(0xFFFBBF24));

  @override
  AppTokens copyWith({TokenSet? t, Color? success, Color? warning}) =>
      AppTokens(t ?? this.t, success: success ?? this.success, warning: warning ?? this.warning);

  @override
  AppTokens lerp(ThemeExtension<AppTokens>? other, double amount) => amount < 0.5 ? this : (other as AppTokens);
}

extension TokensX on BuildContext {
  TokenSet get tokens => Theme.of(this).extension<AppTokens>()!.t;
  AppTokens get semantic => Theme.of(this).extension<AppTokens>()!;
}

class Radii {
  static const double lg = kRadius; // 10
  static const double md = kRadius - 2; // 8
  static const double sm = kRadius - 4; // 6
}

ThemeData buildTheme(Brightness brightness) {
  final ext = brightness == Brightness.dark ? AppTokens.dark : AppTokens.light;
  final t = ext.t;
  final scheme = ColorScheme(
    brightness: brightness,
    primary: t.primary,
    onPrimary: t.primaryForeground,
    secondary: t.secondary,
    onSecondary: t.secondaryForeground,
    error: t.destructive,
    onError: t.primaryForeground,
    surface: t.background,
    onSurface: t.foreground,
    surfaceContainerHighest: t.muted,
    onSurfaceVariant: t.mutedForeground,
    outline: t.border,
    outlineVariant: t.border,
  );
  final border = OutlineInputBorder(
    borderRadius: BorderRadius.circular(Radii.md),
    borderSide: BorderSide(color: t.input),
  );
  final base = ThemeData(
    useMaterial3: true,
    brightness: brightness,
    colorScheme: scheme,
    fontFamily: kFontFamily,
    scaffoldBackgroundColor: t.background,
    canvasColor: t.background,
    dividerColor: t.border,
    dividerTheme: DividerThemeData(color: t.border, space: 1, thickness: 1),
    splashFactory: InkRipple.splashFactory,
    extensions: [ext],
  );
  return base.copyWith(
    appBarTheme: AppBarTheme(
      backgroundColor: t.background,
      foregroundColor: t.foreground,
      elevation: 0,
      scrolledUnderElevation: 0,
      centerTitle: false,
      shape: Border(bottom: BorderSide(color: t.border)),
      titleTextStyle: TextStyle(fontFamily: kFontFamily, fontSize: 16, fontWeight: FontWeight.w600, color: t.foreground),
    ),
    cardTheme: CardThemeData(
      color: t.card,
      elevation: 0,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(Radii.lg + 4),
        side: BorderSide(color: t.border),
      ),
    ),
    drawerTheme: DrawerThemeData(backgroundColor: t.sidebar, surfaceTintColor: Colors.transparent),
    dialogTheme: DialogThemeData(
      backgroundColor: t.background,
      surfaceTintColor: Colors.transparent,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(Radii.lg), side: BorderSide(color: t.border)),
    ),
    bottomSheetTheme: BottomSheetThemeData(
      backgroundColor: t.background,
      surfaceTintColor: Colors.transparent,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(Radii.lg)),
        side: BorderSide(color: t.border),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      isDense: true,
      filled: false,
      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
      hintStyle: TextStyle(color: t.mutedForeground),
      border: border,
      enabledBorder: border,
      disabledBorder: border.copyWith(borderSide: BorderSide(color: t.input.withValues(alpha: .5))),
      focusedBorder: border.copyWith(borderSide: BorderSide(color: t.ring, width: 2)),
      errorBorder: border.copyWith(borderSide: BorderSide(color: t.destructive)),
      focusedErrorBorder: border.copyWith(borderSide: BorderSide(color: t.destructive, width: 2)),
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: t.background,
      surfaceTintColor: Colors.transparent,
      indicatorColor: t.accent,
      labelTextStyle: WidgetStatePropertyAll(TextStyle(fontFamily: kFontFamily, fontSize: 12, fontWeight: FontWeight.w500, color: t.foreground)),
    ),
    snackBarTheme: SnackBarThemeData(
      behavior: SnackBarBehavior.floating,
      backgroundColor: t.foreground,
      contentTextStyle: TextStyle(fontFamily: kFontFamily, color: t.background),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(Radii.md)),
    ),
    tabBarTheme: TabBarThemeData(
      labelColor: t.foreground,
      unselectedLabelColor: t.mutedForeground,
      indicatorColor: t.primary,
      dividerColor: t.border,
      labelStyle: const TextStyle(fontFamily: kFontFamily, fontWeight: FontWeight.w500),
    ),
    checkboxTheme: CheckboxThemeData(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4)),
      side: BorderSide(color: t.input, width: 1.5),
      fillColor: WidgetStateProperty.resolveWith((s) => s.contains(WidgetState.selected) ? t.primary : Colors.transparent),
      checkColor: WidgetStatePropertyAll(t.primaryForeground),
    ),
    switchTheme: SwitchThemeData(
      thumbColor: WidgetStatePropertyAll(t.background),
      trackColor: WidgetStateProperty.resolveWith((s) => s.contains(WidgetState.selected) ? t.primary : t.input),
      trackOutlineColor: const WidgetStatePropertyAll(Colors.transparent),
    ),
    textTheme: base.textTheme.apply(bodyColor: t.foreground, displayColor: t.foreground, fontFamily: kFontFamily),
  );
}
