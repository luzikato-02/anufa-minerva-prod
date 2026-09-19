import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

class AppSkeleton extends StatelessWidget {
  const AppSkeleton({super.key, this.width, this.height = 16});

  final double? width;
  final double height;

  @override
  Widget build(BuildContext context) => Container(
        width: width,
        height: height,
        decoration: BoxDecoration(color: context.tokens.accent, borderRadius: BorderRadius.circular(Radii.md)),
      );
}
