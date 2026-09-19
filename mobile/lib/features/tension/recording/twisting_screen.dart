import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/ui/app_alert.dart';
import '../../../core/ui/app_button.dart';
import '../../../core/ui/app_card.dart';
import '../../../core/ui/app_text_field.dart';
import '../../settings/settings_shell.dart' show showToast;
import '../../shared/minerva_scaffold.dart';
import 'recording_widgets.dart';
import 'twisting_controller.dart';
import 'twisting_draft.dart';

enum _View { params, numpad, problem }

/// "Record: Twisting Tension" — parameters → numpad → problem report, like the web recorder.
class TwistingScreen extends ConsumerStatefulWidget {
  const TwistingScreen({super.key});

  @override
  ConsumerState<TwistingScreen> createState() => _TwistingScreenState();
}

class _TwistingScreenState extends ConsumerState<TwistingScreen> {
  _View _view = _View.params;

  @override
  Widget build(BuildContext context) {
    return switch (_view) {
      _View.params => _ParamsView(onStart: () => setState(() => _view = _View.numpad)),
      _View.numpad => _NumpadView(onParams: () => setState(() => _view = _View.params), onProblem: () => setState(() => _view = _View.problem), onFinished: () => setState(() => _view = _View.params)),
      _View.problem => _ProblemView(onBack: () => setState(() => _view = _View.numpad)),
    };
  }
}

// ── Parameters ────────────────────────────────────────────────────────────────

class _ParamsView extends ConsumerStatefulWidget {
  const _ParamsView({required this.onStart});

  final VoidCallback onStart;

  @override
  ConsumerState<_ParamsView> createState() => _ParamsViewState();
}

class _ParamsViewState extends ConsumerState<_ParamsView> {
  final _controllers = <String, TextEditingController>{};

  TextEditingController _c(String key) => _controllers.putIfAbsent(key, () => TextEditingController(text: ref.read(twistingControllerProvider).field(key)));

  @override
  void dispose() {
    for (final c in _controllers.values) {
      c.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final ctrl = ref.read(twistingControllerProvider.notifier);
    // Draft restores asynchronously after launch; refresh fields once it lands.
    ref.listen(twistingControllerProvider, (prev, next) {
      for (final f in twistingFormFields) {
        final c = _controllers[f.$1];
        if (c != null && c.text != next.field(f.$1)) c.text = next.field(f.$1);
      }
    });
    final hasData = ref.watch(twistingControllerProvider.select((d) => d.hasReadings));
    return MinervaScaffold(
      title: 'Twisting Tension',
      body: ListView(padding: const EdgeInsets.all(16), children: [
        AppCard(
          title: 'Twisting Tension Recorder',
          description: 'Configure recording parameters',
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            for (final f in twistingFormFields)
              Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: AppTextField(
                  label: f.$2,
                  controller: _c(f.$1),
                  keyboardType: f.$3 ? const TextInputType.numberWithOptions(decimal: true) : TextInputType.text,
                  onChanged: (v) => ctrl.setField(f.$1, v),
                ),
              ),
            const SizedBox(height: 4),
            AppButton(label: hasData ? 'Resume Recording' : 'Start Recording', size: AppButtonSize.lg, onPressed: widget.onStart),
            const SizedBox(height: 8),
            Row(children: [
              Expanded(
                child: AppButton(label: 'Clear Form', variant: AppButtonVariant.outline, onPressed: () {
                  ctrl.clearForm();
                  for (final c in _controllers.values) {
                    c.clear();
                  }
                }),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: AppButton(
                  label: 'Clear All Data',
                  variant: AppButtonVariant.outline,
                  onPressed: () async {
                    if (await confirmDialog(context, title: 'Clear all saved data?', message: 'This removes the form, measurements and problem reports on this device. It cannot be undone.', confirmLabel: 'Clear all data', destructive: true)) {
                      await ctrl.reset();
                    }
                  },
                ),
              ),
            ]),
          ]),
        ),
      ]),
    );
  }
}

// ── Numpad ────────────────────────────────────────────────────────────────────

class _NumpadView extends ConsumerWidget {
  const _NumpadView({required this.onParams, required this.onProblem, required this.onFinished});

  final VoidCallback onParams;
  final VoidCallback onProblem;
  final VoidCallback onFinished;

  Future<void> _finish(BuildContext context, WidgetRef ref) async {
    final ctrl = ref.read(twistingControllerProvider.notifier);
    if (!ref.read(twistingControllerProvider).hasReadings) {
      showToast(context, 'Record at least one measurement first.');
      return;
    }
    final clear = await askFinishChoice(context);
    if (clear == null || !context.mounted) return;
    await runUpload(context, what: 'twisting record', action: () => ctrl.finish(clearAfter: clear), onDone: clear ? onFinished : () {});
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final d = ref.watch(twistingControllerProvider);
    final c = ref.read(twistingControllerProvider.notifier);
    final cur = d.current;
    final problems = d.problemsFor(d.spindle).length;

    return MinervaScaffold(
      title: 'Twisting Tension',
      body: ListView(padding: const EdgeInsets.all(16), children: [
        Row(children: [
          ReadingBox(label: 'Max value', value: cur.max, inSpec: d.inSpec(cur.max), low: d.lowLimit, high: d.highLimit),
          const SizedBox(width: 8),
          ReadingBox(label: 'Min value', value: cur.min, inSpec: d.inSpec(cur.min), low: d.lowLimit, high: d.highLimit),
        ]),
        SpecBanner(spec: d.spec, tolerance: d.tolerance),
        const SizedBox(height: 12),
        NumberStepper(
          label: 'Spd No.',
          value: '${d.spindle}',
          onPrev: d.spindle > 1 ? c.previous : null,
          onNext: d.spindle < kTwistingSpindles ? c.next : null,
          onTap: () async {
            final n = await askNumber(context, title: 'Go to spindle', current: d.spindle, max: kTwistingSpindles);
            if (n != null) c.goTo(n);
          },
        ),
        const SizedBox(height: 12),
        TypeToggle(isMax: d.isMax, onToggle: c.toggleType),
        const SizedBox(height: 12),
        Numpad(display: d.display, onKey: c.press, onClear: c.clearDisplay, onBackspace: c.backspace),
        const SizedBox(height: 8),
        Row(children: [
          Expanded(child: AppButton(label: 'Finish', variant: AppButtonVariant.outline, onPressed: () => _finish(context, ref))),
          const SizedBox(width: 8),
          Expanded(child: AppButton(label: 'Submit ${d.isMax ? 'Max' : 'Min'}', onPressed: c.submitValue)),
        ]),
        const SizedBox(height: 8),
        Row(children: [
          Expanded(child: AppButton(label: 'Proc. Parameters', variant: AppButtonVariant.outline, onPressed: onParams)),
          const SizedBox(width: 8),
          Expanded(child: AppButton(label: 'Delete ${d.isMax ? 'Max' : 'Min'}', variant: AppButtonVariant.outline, icon: LucideIcons.delete, onPressed: c.deleteStored)),
        ]),
        const SizedBox(height: 8),
        AppButton(label: 'Report problem for Spd #${d.spindle}${problems == 0 ? '' : ' ($problems)'}', variant: AppButtonVariant.outline, expand: true, icon: LucideIcons.triangleAlert, onPressed: onProblem),
      ]),
    );
  }
}

// ── Problem report ────────────────────────────────────────────────────────────

class _ProblemView extends ConsumerStatefulWidget {
  const _ProblemView({required this.onBack});

  final VoidCallback onBack;

  @override
  ConsumerState<_ProblemView> createState() => _ProblemViewState();
}

class _ProblemViewState extends ConsumerState<_ProblemView> {
  final _text = TextEditingController();

  @override
  void dispose() {
    _text.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final d = ref.watch(twistingControllerProvider);
    final c = ref.read(twistingControllerProvider.notifier);
    final t = context.tokens;
    final existing = d.problemsFor(d.spindle);
    return MinervaScaffold(
      title: 'Problem report',
      body: ListView(padding: const EdgeInsets.all(16), children: [
        AppCard(
          title: 'Spindle #${d.spindle}',
          description: 'Describe the problem you found',
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            for (final p in existing)
              Container(
                margin: const EdgeInsets.only(bottom: 8),
                padding: const EdgeInsets.only(left: 12),
                decoration: BoxDecoration(border: Border.all(color: t.border), borderRadius: BorderRadius.circular(Radii.md)),
                child: Row(children: [
                  Expanded(child: Text(p.description)),
                  IconButton(tooltip: 'Delete problem', icon: Icon(LucideIcons.trash2, size: 18, color: t.destructive), onPressed: () => c.removeProblem(p.id)),
                ]),
              ),
            AppTextField(controller: _text, maxLines: 4, hint: 'Enter problem description for Spindle ${d.spindle}…'),
            const SizedBox(height: 4),
            Text('${_text.text.length}/500', textAlign: TextAlign.end, style: TextStyle(fontSize: 12, color: t.mutedForeground)),
            const SizedBox(height: 8),
            AppButton(
              label: 'Submit problem',
              onPressed: () {
                final text = _text.text.trim();
                if (text.isEmpty) return;
                c.addProblem(d.spindle, text.length > 500 ? text.substring(0, 500) : text);
                _text.clear();
                showToast(context, 'Problem recorded for spindle ${d.spindle}');
                widget.onBack();
              },
            ),
            const SizedBox(height: 8),
            AppButton(label: 'Back', variant: AppButtonVariant.outline, onPressed: widget.onBack),
          ]),
        ),
      ]),
    );
  }
}
