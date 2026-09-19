import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../theme/app_theme.dart';
import 'app_alert.dart';
import 'app_button.dart';
import 'app_skeleton.dart';

/// Standard loading / error+retry / empty handling for AsyncValue-driven lists.
class AsyncBody<T> extends StatelessWidget {
  const AsyncBody({super.key, required this.value, required this.onRetry, required this.builder, this.isEmpty, this.emptyMessage = 'Nothing here yet.'});

  final AsyncValue<T> value;
  final VoidCallback onRetry;
  final Widget Function(T data) builder;
  final bool Function(T data)? isEmpty;
  final String emptyMessage;

  @override
  Widget build(BuildContext context) {
    return value.when(
      skipLoadingOnRefresh: true,
      loading: () => ListView(padding: const EdgeInsets.all(16), children: [for (var i = 0; i < 4; i++) const Padding(padding: EdgeInsets.only(bottom: 12), child: AppSkeleton(height: 72))]),
      error: (e, _) => ListView(padding: const EdgeInsets.all(16), children: [
        AppAlert(message: e.toString()),
        const SizedBox(height: 12),
        AppButton(label: 'Retry', variant: AppButtonVariant.outline, onPressed: onRetry),
      ]),
      data: (d) => (isEmpty?.call(d) ?? false) ? EmptyState(emptyMessage) : builder(d),
    );
  }
}

class EmptyState extends StatelessWidget {
  const EmptyState(this.message, {super.key});

  final String message;

  @override
  Widget build(BuildContext context) => Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Icon(LucideIcons.inbox, size: 36, color: context.tokens.mutedForeground),
            const SizedBox(height: 8),
            Text(message, textAlign: TextAlign.center, style: TextStyle(color: context.tokens.mutedForeground)),
          ]),
        ),
      );
}
