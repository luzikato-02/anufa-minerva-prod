import 'package:flutter/material.dart';

/// Modal bottom sheet for create/edit forms; keyboard-aware and scrollable.
Future<T?> showFormSheet<T>(BuildContext context, {required String title, String? description, required WidgetBuilder builder}) {
  return showModalBottomSheet<T>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (ctx) => Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(ctx).bottom),
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
          Text(title, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w600)),
          if (description != null) Padding(padding: const EdgeInsets.only(top: 2), child: Text(description, style: TextStyle(color: Theme.of(ctx).colorScheme.onSurfaceVariant))),
          const SizedBox(height: 16),
          builder(ctx),
        ]),
      ),
    ),
  );
}
