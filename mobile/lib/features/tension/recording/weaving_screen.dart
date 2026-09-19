import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/ui/app_alert.dart';
import '../../../core/ui/app_button.dart';
import '../../../core/ui/app_card.dart';
import '../../../core/ui/app_text_field.dart';
import '../../settings/settings_shell.dart' show showToast;
import '../../shared/minerva_scaffold.dart';
import 'recording_widgets.dart';
import 'weaving_controller.dart';
import 'weaving_draft.dart';

enum _View { select, params, numpad, problem }

/// "Record: Weaving Tension" — session select → parameters → creel numpad → problem report.
class WeavingScreen extends ConsumerStatefulWidget {
  const WeavingScreen({super.key});

  @override
  ConsumerState<WeavingScreen> createState() => _WeavingScreenState();
}

class _WeavingScreenState extends ConsumerState<WeavingScreen> {
  _View _view = _View.select;

  void _go(_View v) => setState(() => _view = v);

  @override
  Widget build(BuildContext context) => switch (_view) {
        _View.select => _SelectView(onCreate: () => _go(_View.params), onContinue: () => _go(_View.params), onResumeLocal: () => _go(_View.numpad)),
        _View.params => _ParamsView(onStart: () => _go(_View.numpad), onBack: () => _go(_View.select)),
        _View.numpad => _NumpadView(onParams: () => _go(_View.params), onProblem: () => _go(_View.problem), onFinished: () => _go(_View.select)),
        _View.problem => _ProblemView(onBack: () => _go(_View.numpad)),
      };
}

// ── Session select ────────────────────────────────────────────────────────────

class _SelectView extends ConsumerStatefulWidget {
  const _SelectView({required this.onCreate, required this.onContinue, required this.onResumeLocal});

  final VoidCallback onCreate;
  final VoidCallback onContinue;
  final VoidCallback onResumeLocal;

  @override
  ConsumerState<_SelectView> createState() => _SelectViewState();
}

class _SelectViewState extends ConsumerState<_SelectView> {
  late final _po = TextEditingController(text: ref.read(weavingControllerProvider).sessionPo ?? ref.read(weavingControllerProvider).field('productionOrder'));
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _po.dispose();
    super.dispose();
  }

  Future<void> _run(Future<void> Function(String po) action) async {
    final po = _po.text.trim();
    if (po.isEmpty) {
      setState(() => _error = 'Enter a production order number first.');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await action(po);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _continue(String po) async {
    final summary = await ref.read(weavingControllerProvider.notifier).resume(po);
    if (!mounted) return;
    if (summary == null) {
      setState(() => _error = 'No in-progress session found for "$po".');
      return;
    }
    if (summary.any) showToast(context, 'Session merged · local newer ${summary.localWon}, server newer ${summary.serverWon}, synced ${summary.localOnly + summary.serverOnly}');
    widget.onContinue();
  }

  Future<void> _create(String po) async {
    final c = ref.read(weavingControllerProvider.notifier);
    if (await c.sessionExists(po)) {
      if (!mounted) return;
      setState(() => _busy = false); // no spinner behind the dialog
      final cont = await confirmDialog(context, title: 'Session already exists', message: 'An in-progress session for $po already exists. Continue it instead of creating a new one.', confirmLabel: 'Continue session');
      if (cont && mounted) await _continue(po);
      return;
    }
    c.setField('productionOrder', po);
    widget.onCreate();
  }

  @override
  Widget build(BuildContext context) {
    final draft = ref.watch(weavingControllerProvider);
    final t = context.tokens;
    return MinervaScaffold(
      title: 'Weaving Tension',
      body: ListView(padding: const EdgeInsets.all(16), children: [
        if (draft.hasReadings)
          Padding(
            padding: const EdgeInsets.only(bottom: 16),
            child: AppCard(
              title: 'Unfinished session on this device',
              description: draft.field('productionOrder').isEmpty ? null : 'PO ${draft.field('productionOrder')} · ${draft.grid.length} positions',
              child: AppButton(label: 'Resume recording', icon: LucideIcons.play, onPressed: widget.onResumeLocal),
            ),
          ),
        AppCard(
          title: 'Weaving Tension Session',
          description: 'Enter the production order to start or continue a session',
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            if (_error != null) ...[AppAlert(message: _error!), const SizedBox(height: 12)],
            AppTextField(label: 'Production order', controller: _po, hint: 'Enter production order…', onSubmitted: (_) => _run(_create)),
            const SizedBox(height: 16),
            AppButton(label: 'Create New Session', loading: _busy, onPressed: () => _run(_create)),
            const SizedBox(height: 8),
            AppButton(label: 'Continue Session', variant: AppButtonVariant.outline, onPressed: _busy ? null : () => _run(_continue)),
            const SizedBox(height: 12),
            Text('Continue picks up where you or a colleague left off on any device. Create New starts a fresh session for this production order.', style: TextStyle(fontSize: 12, color: t.mutedForeground)),
          ]),
        ),
      ]),
    );
  }
}

// ── Parameters ────────────────────────────────────────────────────────────────

class _ParamsView extends ConsumerStatefulWidget {
  const _ParamsView({required this.onStart, required this.onBack});

  final VoidCallback onStart;
  final VoidCallback onBack;

  @override
  ConsumerState<_ParamsView> createState() => _ParamsViewState();
}

class _ParamsViewState extends ConsumerState<_ParamsView> {
  final _controllers = <String, TextEditingController>{};
  bool _busy = false;

  TextEditingController _c(String key) => _controllers.putIfAbsent(key, () => TextEditingController(text: ref.read(weavingControllerProvider).field(key)));

  @override
  void dispose() {
    for (final c in _controllers.values) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _start() async {
    final ctrl = ref.read(weavingControllerProvider.notifier);
    if (ref.read(weavingControllerProvider).field('productionOrder').trim().isEmpty) {
      await showDialog<void>(
        context: context,
        builder: (ctx) => AlertDialog(
          title: const Text('Production Order Required', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600)),
          content: const Text('Enter a production order number before starting to record.'),
          actions: [AppButton(label: 'OK', onPressed: () => Navigator.pop(ctx))],
        ),
      );
      return;
    }
    setState(() => _busy = true);
    try {
      final outcome = await ctrl.startRecording();
      if (!mounted) return;
      if (outcome == SessionOutcome.offline) showToast(context, 'Could not reach the server. Recording offline; it will upload when you finish.');
      widget.onStart();
    } on ApiException catch (e) {
      if (mounted) showToast(context, e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final ctrl = ref.read(weavingControllerProvider.notifier);
    ref.listen(weavingControllerProvider, (prev, next) {
      for (final f in weavingFormFields) {
        final c = _controllers[f.$1];
        if (c != null && c.text != next.field(f.$1)) c.text = next.field(f.$1);
      }
    });
    final hasData = ref.watch(weavingControllerProvider.select((d) => d.hasReadings));
    return MinervaScaffold(
      title: 'Weaving Tension',
      body: ListView(padding: const EdgeInsets.all(16), children: [
        AppCard(
          title: 'Weaving Tension Recorder',
          description: 'Configure recording parameters',
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            for (final f in weavingFormFields)
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
            AppButton(label: hasData ? 'Resume Recording' : 'Start Recording', size: AppButtonSize.lg, loading: _busy, onPressed: _start),
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
              Expanded(child: AppButton(label: 'Sessions', variant: AppButtonVariant.outline, onPressed: widget.onBack)),
            ]),
            const SizedBox(height: 8),
            AppButton(
              label: 'Clear All Data',
              variant: AppButtonVariant.ghost,
              onPressed: () async {
                if (await confirmDialog(context, title: 'Clear all saved data?', message: 'This removes the form, measurements and problem reports on this device. It cannot be undone.', confirmLabel: 'Clear all data', destructive: true)) {
                  await ctrl.reset();
                  for (final c in _controllers.values) {
                    c.clear();
                  }
                }
              },
            ),
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
    final ctrl = ref.read(weavingControllerProvider.notifier);
    if (!ref.read(weavingControllerProvider).hasReadings) {
      showToast(context, 'Record at least one measurement first.');
      return;
    }
    final clear = await askFinishChoice(context);
    if (clear == null || !context.mounted) return;
    await runUpload(context, what: 'weaving record', action: () => ctrl.finish(clearAfter: clear), onDone: clear ? onFinished : () {});
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final d = ref.watch(weavingControllerProvider);
    final c = ref.read(weavingControllerProvider.notifier);
    final cur = d.current;
    final problems = d.problemsHere.length;

    return MinervaScaffold(
      title: 'Weaving Tension',
      body: ListView(padding: const EdgeInsets.all(16), children: [
        Row(children: [
          ReadingBox(label: 'Max value', value: cur.max, inSpec: d.inSpec(cur.max), low: d.lowLimit, high: d.highLimit),
          const SizedBox(width: 8),
          ReadingBox(label: 'Min value', value: cur.min, inSpec: d.inSpec(cur.min), low: d.lowLimit, high: d.highLimit),
        ]),
        SpecBanner(spec: d.spec, tolerance: d.tolerance),
        const SizedBox(height: 12),
        Text(d.position, textAlign: TextAlign.center, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
        const SizedBox(height: 8),
        NumberStepper(label: 'Side', value: d.side, onPrev: c.previousSide, onNext: c.nextSide),
        const SizedBox(height: 8),
        NumberStepper(label: 'Row', value: d.row, onPrev: c.previousRow, onNext: c.nextRow),
        const SizedBox(height: 8),
        NumberStepper(
          label: 'Col',
          value: '${d.col}',
          onPrev: d.col > 1 ? c.previousCol : null,
          onNext: d.col < kCreelColumns ? c.nextCol : null,
          onTap: () async {
            final n = await askNumber(context, title: 'Go to column', current: d.col, max: kCreelColumns);
            if (n != null) c.goToCol(n);
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
        AppButton(label: 'Report problem for ${d.position}${problems == 0 ? '' : ' ($problems)'}', variant: AppButtonVariant.outline, expand: true, icon: LucideIcons.triangleAlert, onPressed: onProblem),
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
    final d = ref.watch(weavingControllerProvider);
    final c = ref.read(weavingControllerProvider.notifier);
    final t = context.tokens;
    return MinervaScaffold(
      title: 'Problem report',
      body: ListView(padding: const EdgeInsets.all(16), children: [
        AppCard(
          title: d.position,
          description: 'Describe the problem you found',
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            for (final p in d.problemsHere)
              Container(
                margin: const EdgeInsets.only(bottom: 8),
                padding: const EdgeInsets.only(left: 12),
                decoration: BoxDecoration(border: Border.all(color: t.border), borderRadius: BorderRadius.circular(Radii.md)),
                child: Row(children: [
                  Expanded(child: Text(p.description)),
                  IconButton(tooltip: 'Delete problem', icon: Icon(LucideIcons.trash2, size: 18, color: t.destructive), onPressed: () => c.removeProblem(p.id)),
                ]),
              ),
            AppTextField(controller: _text, maxLines: 4, hint: 'Enter problem description for ${d.position}…'),
            const SizedBox(height: 12),
            AppButton(
              label: 'Submit problem',
              onPressed: () {
                final text = _text.text.trim();
                if (text.isEmpty) return;
                c.addProblem(text.length > 500 ? text.substring(0, 500) : text);
                _text.clear();
                showToast(context, 'Problem recorded for ${d.position}');
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
