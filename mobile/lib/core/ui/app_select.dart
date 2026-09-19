import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

/// Labelled dropdown (web `select.tsx`).
class AppSelect<T> extends StatelessWidget {
  const AppSelect({super.key, this.label, required this.value, required this.items, required this.onChanged, this.hint, this.error});

  final String? label;
  final T? value;
  final Map<T, String> items;
  final ValueChanged<T?>? onChanged;
  final String? hint;
  final String? error;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      if (label != null)
        Padding(padding: const EdgeInsets.only(bottom: 6), child: Text(label!, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500))),
      DropdownButtonFormField<T>(
        initialValue: items.containsKey(value) ? value : null,
        isExpanded: true,
        hint: hint == null ? null : Text(hint!),
        onChanged: onChanged,
        dropdownColor: t.popover,
        borderRadius: BorderRadius.circular(Radii.md),
        style: TextStyle(fontSize: 15, color: t.foreground, fontFamily: kFontFamily),
        items: [for (final e in items.entries) DropdownMenuItem(value: e.key, child: Text(e.value, overflow: TextOverflow.ellipsis))],
      ),
      if (error != null) Padding(padding: const EdgeInsets.only(top: 4), child: Text(error!, style: TextStyle(fontSize: 13, color: t.destructive))),
    ]);
  }
}
