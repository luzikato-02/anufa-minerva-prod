import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/api/api_exception.dart';
import '../../core/auth/auth_controller.dart';
import '../../core/sync/sync_queue.dart';
import '../../core/theme/app_theme.dart';
import '../../core/ui/app_alert.dart';
import '../../core/ui/app_badge.dart';
import '../../core/ui/app_button.dart';
import '../../core/ui/app_card.dart';
import '../../core/ui/app_text_field.dart';
import '../../core/ui/form_sheet.dart';
import '../shared/minerva_scaffold.dart';
import 'barcode_scanner.dart';
import 'stock_models.dart';
import 'stock_recording_controller.dart';

/// "Record: Batch Stock Taking" — pick a session, then scan or type batches and record what was found.
class StockRecordingScreen extends ConsumerWidget {
  const StockRecordingScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final loaded = ref.watch(stockRecordingProvider.select((s) => s.loaded));
    return MinervaScaffold(title: 'Batch Stock Taking', body: loaded ? const _ScanView() : const _SessionSelect());
  }
}

class _SessionSelect extends ConsumerStatefulWidget {
  const _SessionSelect();

  @override
  ConsumerState<_SessionSelect> createState() => _SessionSelectState();
}

class _SessionSelectState extends ConsumerState<_SessionSelect> {
  final _id = TextEditingController();
  bool _busy = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    ref.read(stockRecordingProvider.notifier).lastSessionId().then((v) {
      if (v != null && mounted && _id.text.isEmpty) _id.text = v;
    });
  }

  @override
  void dispose() {
    _id.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    if (_id.text.trim().isEmpty) {
      setState(() => _error = 'Please enter a session ID');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await ref.read(stockRecordingProvider.notifier).loadSession(_id.text);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => ListView(padding: const EdgeInsets.all(16), children: [
        AppCard(
          title: 'Session selection',
          description: 'Enter your session ID to begin stock taking',
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            if (_error != null) ...[AppAlert(message: _error!), const SizedBox(height: 12)],
            AppTextField(label: 'Session ID', controller: _id, hint: 'e.g. 123456', keyboardType: TextInputType.text, onSubmitted: (_) => _load()),
            const SizedBox(height: 16),
            AppButton(label: 'Load session', icon: LucideIcons.search, loading: _busy, onPressed: _load),
          ]),
        ),
      ]);
}

class _ScanView extends ConsumerStatefulWidget {
  const _ScanView();

  @override
  ConsumerState<_ScanView> createState() => _ScanViewState();
}

class _ScanViewState extends ConsumerState<_ScanView> {
  final _batch = TextEditingController();
  bool _busy = false;
  LookupResult? _last;
  String? _error;

  @override
  void dispose() {
    _batch.dispose();
    super.dispose();
  }

  Future<void> _scan() async {
    final code = await ref.read(barcodeScanProvider)(context);
    if (code == null || !mounted) return;
    _batch.text = code;
    await _check();
  }

  Future<void> _check() async {
    final n = _batch.text.trim();
    if (n.isEmpty) {
      setState(() => _error = 'Please enter a batch number');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
      _last = null;
    });
    try {
      final r = await ref.read(stockRecordingProvider.notifier).lookup(n);
      if (!mounted) return;
      setState(() {
        _last = r;
        _busy = false; // no spinner behind the sheet
      });
      if (r.kind == LookupKind.ready) {
        await _openForm(r.batch!);
      } else if (r.kind == LookupKind.alreadyRecorded) {
        _batch.clear();
      }
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _openForm(StockBatch batch) async {
    final result = await showFormSheet<SubmitResult>(
      context,
      title: 'Record batch',
      description: '${batch.batchNumber} · ${batch.materialCode}',
      builder: (_) => _RecordForm(batch: batch),
    );
    if (result == null || !mounted) return;
    _batch.clear();
    setState(() => _last = LookupResult(LookupKind.ready, result == SubmitResult.sent ? 'Batch recorded successfully!' : 'Saved on this device — will upload when you are online.'));
  }

  @override
  Widget build(BuildContext context) {
    final s = ref.watch(stockRecordingProvider);
    final t = context.tokens;
    final done = s.recorded.length;
    final ok = _last != null && _last!.kind != LookupKind.notFound;
    return ListView(padding: const EdgeInsets.all(16), children: [
      AppCard(
        title: 'Session ${s.sessionId}',
        description: '$done of ${s.total} batches found',
        action: s.offlineCopy ? const AppBadge('Offline copy', variant: AppBadgeVariant.warning) : null,
        child: Column(children: [
          LinearProgressIndicator(value: s.total == 0 ? 0 : (done / s.total).clamp(0, 1), minHeight: 6, borderRadius: BorderRadius.circular(3), backgroundColor: t.muted),
          const SizedBox(height: 8),
          Align(alignment: Alignment.centerLeft, child: AppButton(label: 'Change session', size: AppButtonSize.sm, variant: AppButtonVariant.ghost, onPressed: ref.read(stockRecordingProvider.notifier).leaveSession)),
        ]),
      ),
      const SizedBox(height: 16),
      AppCard(
        title: 'Batch',
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          if (_error != null) ...[AppAlert(message: _error!), const SizedBox(height: 12)],
          if (_last != null) ...[AppAlert(message: _last!.message, destructive: !ok), const SizedBox(height: 12)],
          Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
            Expanded(child: AppTextField(label: 'Batch number', controller: _batch, hint: 'Scan or type…', onSubmitted: (_) => _check())),
            const SizedBox(width: 8),
            Tooltip(message: 'Scan barcode', child: AppButton(icon: LucideIcons.scanBarcode, size: AppButtonSize.icon, variant: AppButtonVariant.outline, onPressed: _busy ? null : _scan)),
          ]),
          const SizedBox(height: 16),
          AppButton(label: 'Check batch', loading: _busy, onPressed: _check),
        ]),
      ),
    ]);
  }
}

class _RecordForm extends ConsumerStatefulWidget {
  const _RecordForm({required this.batch});

  final StockBatch batch;

  @override
  ConsumerState<_RecordForm> createState() => _RecordFormState();
}

class _RecordFormState extends ConsumerState<_RecordForm> {
  late final _weight = TextEditingController(text: widget.batch.weight ?? '');
  late final _bobbins = TextEditingController(text: widget.batch.bobbinQty ?? '');
  final _line = TextEditingController();
  final _row = TextEditingController();
  final _why = TextEditingController();
  bool _busy = false;
  String? _error;

  Future<void> _submit() async {
    final weight = double.tryParse(_weight.text.trim());
    final bobbins = int.tryParse(_bobbins.text.trim());
    if (_weight.text.trim().isEmpty) return setState(() => _error = 'Please enter actual weight');
    if (_bobbins.text.trim().isEmpty) return setState(() => _error = 'Please enter total bobbins');
    if (weight == null || weight <= 0) return setState(() => _error = 'Actual weight must be a valid positive number');
    if (bobbins == null || bobbins <= 0) return setState(() => _error = 'Total bobbins must be a valid positive number');
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final result = await ref.read(stockRecordingProvider.notifier).record(
            batch: widget.batch,
            weight: weight,
            bobbins: bobbins,
            line: int.tryParse(_line.text.trim()),
            row: _row.text.trim(),
            explanation: _why.text,
            userName: ref.read(sessionProvider).name,
          );
      if (mounted) Navigator.pop(context, result);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Text(widget.batch.materialDescription, style: TextStyle(color: context.tokens.mutedForeground)),
        const SizedBox(height: 12),
        if (_error != null) ...[AppAlert(message: _error!), const SizedBox(height: 12)],
        Row(children: [
          Expanded(child: AppTextField(label: 'Actual weight', controller: _weight, keyboardType: const TextInputType.numberWithOptions(decimal: true))),
          const SizedBox(width: 12),
          Expanded(child: AppTextField(label: 'Total bobbins', controller: _bobbins, keyboardType: TextInputType.number)),
        ]),
        const SizedBox(height: 12),
        Row(children: [
          Expanded(child: AppTextField(label: 'Line position', controller: _line, keyboardType: TextInputType.number)),
          const SizedBox(width: 12),
          Expanded(child: AppTextField(label: 'Row position', controller: _row)),
        ]),
        const SizedBox(height: 12),
        AppTextField(label: 'Explanation (optional)', controller: _why, maxLines: 2),
        const SizedBox(height: 16),
        AppButton(label: 'Record batch', loading: _busy, onPressed: _submit),
      ]);
}

