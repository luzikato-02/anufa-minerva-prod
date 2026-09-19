import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

/// Mirrors web `card.tsx`: bordered, rounded-xl, optional title/description header.
class AppCard extends StatelessWidget {
  const AppCard({super.key, this.title, this.description, this.action, required this.child, this.padding = const EdgeInsets.all(16)});

  final String? title;
  final String? description;
  final Widget? action;
  final Widget child;
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    return Card(
      child: Padding(
        padding: padding,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (title != null)
              Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(title!, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
                      if (description != null)
                        Padding(
                          padding: const EdgeInsets.only(top: 2),
                          child: Text(description!, style: TextStyle(fontSize: 13, color: t.mutedForeground)),
                        ),
                    ]),
                  ),
                  ?action,
                ]),
              ),
            child,
          ],
        ),
      ),
    );
  }
}
