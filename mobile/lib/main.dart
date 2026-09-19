import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'app/router.dart';
import 'core/theme/app_theme.dart';
import 'core/theme/theme_mode_provider.dart';

void main() => runApp(const ProviderScope(child: MinervaApp()));

class MinervaApp extends ConsumerWidget {
  const MinervaApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) => MaterialApp.router(
        title: 'Minerva',
        debugShowCheckedModeBanner: false,
        theme: buildTheme(Brightness.light),
        darkTheme: buildTheme(Brightness.dark),
        themeMode: ref.watch(themeModeProvider),
        routerConfig: ref.watch(routerProvider),
        // Honour large-text settings but cap them so fixed-height controls and tables don't break.
        builder: (context, child) => MediaQuery.withClampedTextScaling(maxScaleFactor: 1.4, child: child!),
      );
}
