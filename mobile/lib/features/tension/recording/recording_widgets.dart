import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/sync/sync_queue.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/ui/app_alert.dart';
import '../../../core/ui/app_button.dart';
import '../../../core/ui/app_text_field.dart';
import '../../settings/settings_shell.dart' show showToast;
import '../tension_models.dart';

/// Max / Min reading box that turns red with the allowed range when out of spec.
class ReadingBox extends StatelessWidget {
  const ReadingBox({super.key, required this.label, required this.value, required this.inSpec, required this.low, required this.high});

  final String label;
  final double? value;
  final bool inSpec;
  final double low;
  final double high;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final color = inSpec ? t.chart3 : t.destructive;
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 10),
        decoration: BoxDecoration(color: color.withValues(alpha: .08), border: Border.all(color: color.withValues(alpha: inSpec ? .3 : .8), width: 2), borderRadius: BorderRadius.circular(Radii.lg)),
        child: Column(children: [
          Row(mainAxisAlignment: MainAxisAlignment.center, children: [
            Text(label, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w500, color: color)),
            if (value != null) Padding(padding: const EdgeInsets.only(left: 4), child: Icon(inSpec ? LucideIcons.check : LucideIcons.circleAlert, size: 14, color: color)),
          ]),
          Text(value == null ? '--' : fmtNum(value), style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700, fontFamily: 'monospace', color: color)),
          if (!inSpec) Text('Range ${low.toStringAsFixed(1)}–${high.toStringAsFixed(1)}', style: TextStyle(fontSize: 11, color: color)),
        ]),
      ),
    );
  }
}

class SpecBanner extends StatelessWidget {
  const SpecBanner({super.key, required this.spec, required this.tolerance});

  final double spec;
  final double tolerance;

  @override
  Widget build(BuildContext context) {
    if (spec <= 0) return const SizedBox.shrink();
    final t = context.tokens;
    return Container(
      margin: const EdgeInsets.only(top: 8),
      padding: const EdgeInsets.all(8),
      width: double.infinity,
      decoration: BoxDecoration(color: t.muted, borderRadius: BorderRadius.circular(Radii.md)),
      child: Text('Spec ${fmtNum(spec)} ± ${fmtNum(tolerance)}   →   ${(spec - tolerance).toStringAsFixed(1)} – ${(spec + tolerance).toStringAsFixed(1)}', textAlign: TextAlign.center, style: const TextStyle(fontSize: 13, fontFamily: 'monospace')),
    );
  }
}

/// Max / Min selector pair.
class TypeToggle extends StatelessWidget {
  const TypeToggle({super.key, required this.isMax, required this.onToggle});

  final bool isMax;
  final VoidCallback onToggle;

  @override
  Widget build(BuildContext context) => Row(children: [
        Expanded(child: _Chip(label: 'Max', selected: isMax, onTap: isMax ? null : onToggle)),
        const SizedBox(width: 8),
        Expanded(child: _Chip(label: 'Min', selected: !isMax, onTap: isMax ? onToggle : null)),
      ]);
}

class _Chip extends StatelessWidget {
  const _Chip({required this.label, required this.selected, required this.onTap});

  final String label;
  final bool selected;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    return Material(
      color: selected ? t.primary : t.background,
      borderRadius: BorderRadius.circular(Radii.md),
      child: InkWell(
        borderRadius: BorderRadius.circular(Radii.md),
        onTap: onTap,
        child: Container(
          height: 44,
          alignment: Alignment.center,
          decoration: BoxDecoration(border: Border.all(color: selected ? t.primary : t.input), borderRadius: BorderRadius.circular(Radii.md)),
          child: Text(label, style: TextStyle(fontWeight: FontWeight.w600, color: selected ? t.primaryForeground : t.foreground)),
        ),
      ),
    );
  }
}

/// Big-target numeric display + keypad shared by both recorders.
class Numpad extends StatelessWidget {
  const Numpad({super.key, required this.display, required this.onKey, required this.onClear, required this.onBackspace});

  final String display;
  final ValueChanged<String> onKey;
  final VoidCallback onClear;
  final VoidCallback onBackspace;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    Widget key(VoidCallback onTap, {String? label, Widget? child, Color? bg}) => Expanded(
          child: Padding(
            padding: const EdgeInsets.all(4),
            child: SizedBox(
              height: 60,
              child: Material(
                color: bg ?? t.secondary,
                borderRadius: BorderRadius.circular(Radii.lg),
                child: InkWell(
                  borderRadius: BorderRadius.circular(Radii.lg),
                  onTap: () {
                    HapticFeedback.selectionClick();
                    onTap();
                  },
                  child: Center(child: child ?? Text(label!, style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w600))),
                ),
              ),
            ),
          ),
        );
    Widget row(List<String> keys) => Row(children: [for (final k in keys) key(() => onKey(k), label: k)]);
    return Column(children: [
      Container(
        height: 64,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        alignment: Alignment.centerRight,
        width: double.infinity,
        decoration: BoxDecoration(color: t.muted, borderRadius: BorderRadius.circular(Radii.lg)),
        child: Text(display, style: const TextStyle(fontSize: 34, fontWeight: FontWeight.w700, fontFamily: 'monospace')),
      ),
      const SizedBox(height: 8),
      Row(children: [
        key(onClear, label: 'C', bg: t.accent),
        key(onBackspace, bg: t.accent, child: const Icon(LucideIcons.delete)),
      ]),
      row(['7', '8', '9']),
      row(['4', '5', '6']),
      row(['1', '2', '3']),
      row(['0', '.']),
    ]);
  }
}

/// Small stepper: `‹  N  ›` with tap-to-jump.
class NumberStepper extends StatelessWidget {
  const NumberStepper({super.key, required this.label, required this.value, required this.onPrev, required this.onNext, this.onTap});

  final String label;
  final String value;
  final VoidCallback? onPrev;
  final VoidCallback? onNext;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    return Row(children: [
      Text(label, style: const TextStyle(fontWeight: FontWeight.w600)),
      const Spacer(),
      IconButton.outlined(tooltip: 'Previous $label', onPressed: onPrev, icon: const Icon(LucideIcons.chevronLeft)),
      InkWell(
        onTap: onTap,
        child: Container(
          constraints: const BoxConstraints(minWidth: 64),
          alignment: Alignment.center,
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
          decoration: BoxDecoration(border: Border.all(color: t.border), borderRadius: BorderRadius.circular(Radii.md)),
          child: Text(value, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700)),
        ),
      ),
      IconButton.outlined(tooltip: 'Next $label', onPressed: onNext, icon: const Icon(LucideIcons.chevronRight)),
    ]);
  }
}

/// Asks for a number in `1..max`; returns null if cancelled.
Future<int?> askNumber(BuildContext context, {required String title, required int current, required int max}) {
  final c = TextEditingController(text: '$current');
  return showDialog<int>(
    context: context,
    builder: (ctx) => AlertDialog(
      title: Text(title, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w600)),
      content: AppTextField(controller: c, autofocus: true, keyboardType: TextInputType.number, hint: '1 – $max', inputFormatters: [FilteringTextInputFormatter.digitsOnly]),
      actions: [
        AppButton(label: 'Cancel', variant: AppButtonVariant.outline, onPressed: () => Navigator.pop(ctx)),
        AppButton(label: 'Go', onPressed: () {
          final v = int.tryParse(c.text);
          if (v == null || v < 1 || v > max) {
            showToast(ctx, 'Please enter a number between 1 and $max');
            return;
          }
          Navigator.pop(ctx, v);
        }),
      ],
    ),
  );
}

/// "Clear the data on this device afterwards?" → true = clear, false = keep, null = cancel.
Future<bool?> askFinishChoice(BuildContext context) => showDialog<bool?>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Finish measurement session', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600)),
        content: const Text('Save this session to Minerva. Would you like to clear the data on this device afterwards?'),
        actionsOverflowButtonSpacing: 8,
        actions: [
          AppButton(label: 'Yes, clear all', variant: AppButtonVariant.destructive, onPressed: () => Navigator.pop(ctx, true)),
          AppButton(label: 'No, keep data', onPressed: () => Navigator.pop(ctx, false)),
          AppButton(label: 'Cancel', variant: AppButtonVariant.outline, onPressed: () => Navigator.pop(ctx)),
        ],
      ),
    );

/// Progress dialog → result dialog (saved / stored offline) or an error dialog with Retry.
Future<void> runUpload(BuildContext context, {required String what, required Future<SubmitResult> Function() action, required VoidCallback onDone}) async {
  showDialog<void>(context: context, barrierDismissible: false, builder: (_) => const AlertDialog(content: Row(children: [SizedBox(width: 24, height: 24, child: CircularProgressIndicator(strokeWidth: 2)), SizedBox(width: 16), Text('Saving to Minerva…')])));
  try {
    final result = await action();
    if (!context.mounted) return;
    Navigator.of(context, rootNavigator: true).pop();
    await showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(result == SubmitResult.sent ? 'Saved' : 'Saved on this device', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w600)),
        content: Text(result == SubmitResult.sent
            ? 'The $what was saved to Minerva.'
            : 'No connection right now. The $what is stored safely and will upload automatically when you are back online. You can check it under the cloud icon.'),
        actions: [AppButton(label: 'OK', onPressed: () => Navigator.pop(ctx))],
      ),
    );
    onDone();
  } catch (e) {
    if (!context.mounted) return;
    Navigator.of(context, rootNavigator: true).pop();
    await showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Could not save', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600)),
        content: AppAlert(message: ApiException.from(e).message),
        actions: [
          AppButton(label: 'Close', variant: AppButtonVariant.outline, onPressed: () => Navigator.pop(ctx)),
          AppButton(label: 'Retry', onPressed: () {
            Navigator.pop(ctx);
            runUpload(context, what: what, action: action, onDone: onDone);
          }),
        ],
      ),
    );
  }
}
