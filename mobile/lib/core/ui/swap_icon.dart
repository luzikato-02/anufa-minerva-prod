import 'dart:ui' as ui;

import 'package:flutter/material.dart';

/// An icon that cross-fades when it changes: scale 0.25→1, opacity 0→1, blur 4→0.
class SwapIcon extends StatelessWidget {
  const SwapIcon(this.icon, {super.key, this.size = 18});

  final IconData icon;
  final double size;

  @override
  Widget build(BuildContext context) {
    if (MediaQuery.disableAnimationsOf(context)) return Icon(icon, size: size);
    return AnimatedSwitcher(
      duration: const Duration(milliseconds: 200),
      switchInCurve: const Cubic(0.2, 0, 0, 1),
      switchOutCurve: const Cubic(0.2, 0, 0, 1),
      transitionBuilder: (child, animation) => AnimatedBuilder(
        animation: animation,
        builder: (context, _) {
          final blur = 4 * (1 - animation.value);
          return ImageFiltered(
            enabled: blur > 0.01,
            imageFilter: ui.ImageFilter.blur(sigmaX: blur, sigmaY: blur),
            child: FadeTransition(
              opacity: animation,
              child: ScaleTransition(
                scale: Tween<double>(begin: 0.25, end: 1).animate(animation),
                child: child,
              ),
            ),
          );
        },
      ),
      child: Icon(icon, key: ValueKey(icon), size: size),
    );
  }
}
