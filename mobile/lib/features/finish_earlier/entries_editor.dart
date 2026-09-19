import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/theme/app_theme.dart';
import '../../core/ui/app_button.dart';
import '../../core/ui/app_select.dart';
import 'fe_models.dart';

/// Editable list of finish-earlier entries: side/row pickers, column and meters inputs.
/// The parent owns [entries]; this mutates them in place and calls [onChanged] to rebuild.
class EntriesEditor extends StatelessWidget {
  const EntriesEditor({super.key, required this.entries, required this.onChanged, this.showErrors = false});

  final List<FeEntry> entries;
  final VoidCallback onChanged;

  /// Turn on after a failed submit so untouched-but-invalid rows are highlighted too.
  final bool showErrors;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      for (var i = 0; i < entries.length; i++)
        Container(
          key: ValueKey(entries[i].id),
          margin: const EdgeInsets.only(bottom: 12),
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(border: Border.all(color: showErrors && entries[i].error != null ? t.destructive : t.border), borderRadius: BorderRadius.circular(Radii.md)),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Text('#${i + 1}', style: TextStyle(fontWeight: FontWeight.w600, color: t.mutedForeground)),
              const Spacer(),
              IconButton(
                tooltip: 'Remove entry ${i + 1}',
                icon: Icon(LucideIcons.trash2, size: 18, color: t.destructive),
                onPressed: () {
                  entries.removeAt(i);
                  onChanged();
                },
              ),
            ]),
            Row(children: [
              Expanded(
                child: AppSelect<String>(
                  label: 'Side',
                  value: entries[i].side,
                  items: {for (final s in kFeSides) s: s},
                  hint: '—',
                  onChanged: (v) {
                    entries[i].side = v ?? '';
                    onChanged();
                  },
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: AppSelect<String>(
                  label: 'Row',
                  value: entries[i].row,
                  items: {for (final r in kFeRows) r: r},
                  hint: '—',
                  onChanged: (v) {
                    entries[i].row = v ?? '';
                    onChanged();
                  },
                ),
              ),
            ]),
            const SizedBox(height: 8),
            Row(children: [
              Expanded(child: _Field(label: 'Column', initial: entries[i].column, keyboard: TextInputType.number, formatters: [FilteringTextInputFormatter.digitsOnly], onChanged: (v) => entries[i].column = v, onCommit: onChanged)),
              const SizedBox(width: 8),
              Expanded(child: _Field(label: 'Meters finish', initial: entries[i].meters, keyboard: const TextInputType.numberWithOptions(decimal: true), onChanged: (v) => entries[i].meters = v, onCommit: onChanged)),
            ]),
            if (showErrors && entries[i].error != null) Padding(padding: const EdgeInsets.only(top: 6), child: Text(entries[i].error!, style: TextStyle(fontSize: 12, color: t.destructive))),
          ]),
        ),
      AppButton(
        label: 'Add entry',
        icon: LucideIcons.plus,
        variant: AppButtonVariant.outline,
        onPressed: () {
          // Carry the previous row's side/row forward: entries usually run down one creel line.
          final last = entries.isEmpty ? null : entries.last;
          entries.add(FeEntry(side: last?.side ?? '', row: last?.row ?? ''));
          onChanged();
        },
      ),
    ]);
  }
}

class _Field extends StatelessWidget {
  const _Field({required this.label, required this.initial, required this.onChanged, required this.onCommit, this.keyboard, this.formatters});

  final String label;
  final String initial;
  final ValueChanged<String> onChanged;
  final VoidCallback onCommit;
  final TextInputType? keyboard;
  final List<TextInputFormatter>? formatters;

  @override
  Widget build(BuildContext context) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Padding(padding: const EdgeInsets.only(bottom: 6), child: Text(label, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500))),
        TextFormField(
          initialValue: initial,
          keyboardType: keyboard,
          inputFormatters: formatters,
          style: const TextStyle(fontSize: 15),
          onChanged: onChanged,
          onEditingComplete: () {
            FocusScope.of(context).nextFocus();
            onCommit();
          },
          onTapOutside: (_) => onCommit(),
        ),
      ]);
}
