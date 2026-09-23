import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/api/api_exception.dart';
import '../../core/sync/sync_queue.dart';
import '../../core/theme/app_theme.dart';
import '../../core/ui/app_alert.dart';
import '../../core/ui/app_button.dart';
import '../../core/ui/app_card.dart';
import '../../core/ui/app_select.dart';
import '../../core/ui/app_text_field.dart';
import '../settings/settings_shell.dart' show showToast;
import '../shared/minerva_scaffold.dart';
import '../tension/recording/recording_widgets.dart';
import '../tension/tension_models.dart' show fmtNum;
import 'creel_type_models.dart';
import 'torque_check_controller.dart';
import 'torque_check_models.dart';

/// "Record: Torque Check": one grid cell (row 1-105 x column A-E) at a time.
class TorqueCheckScreen extends ConsumerStatefulWidget {
  const TorqueCheckScreen({super.key});

  @override
  ConsumerState<TorqueCheckScreen> createState() => _TorqueCheckScreenState();
}

class _TorqueCheckScreenState extends ConsumerState<TorqueCheckScreen> {
  int _row = 1;
  int _column = 0; // index into kTorqueColumns
  String _digits = '';
  final _note = TextEditingController();
  final _machineNumber = TextEditingController();
  final _sessionId = TextEditingController();
  bool _busy = false;
  bool _loadingSession = false;
  String? _error;
  String? _sessionError;

  @override
  void initState() {
    super.initState();
    Future.microtask(() => ref.read(torqueCheckProvider.notifier).open());
  }

  @override
  void dispose() {
    _note.dispose();
    _machineNumber.dispose();
    _sessionId.dispose();
    super.dispose();
  }

  Future<void> _loadSession() async {
    final id = _sessionId.text.trim();
    if (id.isEmpty) return setState(() => _sessionError = 'Enter a session ID.');
    setState(() {
      _loadingSession = true;
      _sessionError = null;
    });
    try {
      await ref.read(torqueCheckProvider.notifier).loadSession(id);
      if (mounted) _goTo(1, 0);
    } on ApiException catch (e) {
      if (mounted) setState(() => _sessionError = e.message);
    } finally {
      if (mounted) setState(() => _loadingSession = false);
    }
  }

  String get _position => '$_row${kTorqueColumns[_column]}';

  void _loadCell(ActiveTorqueCheck sheet) {
    final existing = sheet.readings[_position];
    setState(() {
      _digits = existing == null ? '' : fmtNum(existing.value);
      _note.text = existing?.note ?? '';
      _error = null;
    });
  }

  void _goTo(int row, int column) {
    setState(() {
      _row = row;
      _column = column;
    });
    _loadCell(ref.read(torqueCheckProvider)!);
  }

  void _step(double delta) {
    final v = (double.tryParse(_digits) ?? 0) + delta;
    if (v < 0) return;
    setState(() => _digits = fmtNum(v));
  }

  void _key(String k) {
    setState(() {
      if (k == '.' && _digits.contains('.')) return;
      _digits += k;
    });
  }

  CreelType? _type(List<CreelType> types, ActiveTorqueCheck sheet) => types.where((t) => t.id == sheet.creelTypeId).firstOrNull;

  Future<void> _save(ActiveTorqueCheck sheet, CreelType? type) async {
    final value = double.tryParse(_digits);
    if (value == null) return setState(() => _error = 'Enter a reading.');
    if ((value * 2) % 1 != 0) return setState(() => _error = 'Reading must be in steps of 0.5.');
    final outOfRange = type != null && !type.inRange(value);
    if (outOfRange && _note.text.trim().isEmpty) {
      return setState(() => _error = 'This reading is outside ${type.name}\'s range (${fmtNum(type.torqueMin)}–${fmtNum(type.torqueMax)}). Add a note before saving.');
    }
    final existing = sheet.readings[_position];
    final reading = TorqueReading(uuid: existing?.uuid ?? ref.read(syncQueueProvider.notifier).newId(), rowNo: _row, columnLetter: kTorqueColumns[_column], value: value, note: _note.text.trim());
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final result = await ref.read(torqueCheckProvider.notifier).submitReading(reading);
      if (!mounted) return;
      showToast(context, result == SubmitResult.sent ? 'Reading saved' : 'Saved on this device. It will upload when you are online.');
      // Move on to the next cell so the operator can keep going without retyping the position.
      if (_column < kTorqueColumns.length - 1) {
        _goTo(_row, _column + 1);
      } else if (_row < kTorqueMaxRow) {
        _goTo(_row + 1, 0);
      }
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _startNew(ActiveTorqueCheck sheet) async {
    if (sheet.filledCount > 0) {
      final ok = await confirmDialog(context, title: 'Start a new sheet?', message: 'The ${sheet.filledCount} readings on this sheet are already saved. You will begin an empty sheet.', confirmLabel: 'Start new sheet');
      if (!ok || !mounted) return;
    }
    await ref.read(torqueCheckProvider.notifier).startNew();
    if (mounted) _goTo(1, 0);
  }

  @override
  Widget build(BuildContext context) {
    // The sheet loads asynchronously; once it lands, show whatever (if anything) is already saved at 1A.
    ref.listen(torqueCheckProvider, (prev, next) {
      if (prev == null && next != null) _loadCell(next);
    });
    final sheet = ref.watch(torqueCheckProvider);
    final t = context.tokens;
    if (sheet == null) return const MinervaScaffold(title: 'Torque Check', body: Center(child: CircularProgressIndicator()));
    // Keep the field in sync with external changes (initial load, "Start new sheet") without
    // fighting the user's own typing, which already keeps state and text in step.
    if (_machineNumber.text != sheet.machineNumber) {
      _machineNumber.value = _machineNumber.value.copyWith(text: sheet.machineNumber, selection: TextSelection.collapsed(offset: sheet.machineNumber.length));
    }
    final types = ref.watch(creelTypesProvider);
    return types.when(
      loading: () => const MinervaScaffold(title: 'Torque Check', body: Center(child: CircularProgressIndicator())),
      error: (e, _) => MinervaScaffold(title: 'Torque Check', body: Center(child: Padding(padding: const EdgeInsets.all(24), child: AppAlert(message: ApiException.from(e).message)))),
      data: (typeList) {
        if (typeList.isEmpty) {
          return const MinervaScaffold(title: 'Torque Check', body: Center(child: Padding(padding: EdgeInsets.all(24), child: AppAlert(message: 'No creel types are set up yet. Ask an engineer to add one under Creel Type Settings.'))));
        }
        final type = _type(typeList, sheet);
        final value = double.tryParse(_digits);
        final outOfRange = type != null && value != null && !type.inRange(value);
        return MinervaScaffold(
          title: 'Torque Check',
          body: ListView(padding: const EdgeInsets.all(16), children: [
            if (sheet.sessionId == null)
              AppCard(
                title: 'Resume a session',
                description: 'Have a session ID from another device? Enter it to keep recording into that sheet.',
                child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                  if (_sessionError != null) ...[AppAlert(message: _sessionError!), const SizedBox(height: 12)],
                  Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
                    Expanded(child: AppTextField(label: 'Session ID', controller: _sessionId, hint: 'e.g. 483920', keyboardType: TextInputType.number, onSubmitted: (_) => _loadSession())),
                    const SizedBox(width: 8),
                    AppButton(label: 'Load', loading: _loadingSession, onPressed: _loadSession),
                  ]),
                ]),
              ),
            if (sheet.sessionId == null) const SizedBox(height: 16),
            AppCard(
              title: DateFormat('EEE d MMM y').format(sheet.date),
              description: [
                if (sheet.sessionId != null) 'Session ${sheet.sessionId}',
                sheet.operatorName,
                '${sheet.filledCount} of ${kTorqueMaxRow * kTorqueColumns.length} cells filled',
              ].join(' · '),
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                Align(
                  alignment: AlignmentDirectional.centerStart,
                  child: AppButton(label: 'Start new sheet', icon: LucideIcons.filePlus, size: AppButtonSize.sm, variant: AppButtonVariant.ghost, onPressed: () => _startNew(sheet)),
                ),
                const SizedBox(height: 12),
                Row(children: [
                  Expanded(child: AppTextField(label: 'Machine number', controller: _machineNumber, onChanged: (v) => ref.read(torqueCheckProvider.notifier).setHeader(machineNumber: v))),
                  const SizedBox(width: 12),
                  Expanded(child: AppSelect<String>(label: 'Side', value: sheet.side, items: {for (final s in kTorqueSides) s: s}, onChanged: (v) => ref.read(torqueCheckProvider.notifier).setHeader(side: v))),
                ]),
                const SizedBox(height: 12),
                AppSelect<int>(label: 'Creel type', value: sheet.creelTypeId, hint: 'Select a creel type', items: {for (final ty in typeList) ty.id: '${ty.name} (${fmtNum(ty.torqueMin)}–${fmtNum(ty.torqueMax)})'}, onChanged: (v) => ref.read(torqueCheckProvider.notifier).setHeader(creelTypeId: v)),
              ]),
            ),
            const SizedBox(height: 16),
            AppCard(
              title: 'Row $_row, column ${kTorqueColumns[_column]}',
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                if (_error != null) ...[AppAlert(message: _error!), const SizedBox(height: 12)],
                NumberStepper(label: 'Row', value: '$_row', onPrev: _row > 1 ? () => _goTo(_row - 1, _column) : null, onNext: _row < kTorqueMaxRow ? () => _goTo(_row + 1, _column) : null, onTap: () async {
                  final n = await askNumber(context, title: 'Go to row', current: _row, max: kTorqueMaxRow);
                  if (n != null) _goTo(n, _column);
                }),
                const SizedBox(height: 12),
                Row(children: [
                  for (var i = 0; i < kTorqueColumns.length; i++)
                    Expanded(
                      child: Padding(
                        padding: EdgeInsets.only(right: i == kTorqueColumns.length - 1 ? 0 : 8),
                        child: _ColumnChip(label: kTorqueColumns[i], selected: i == _column, filled: sheet.readings.containsKey('$_row${kTorqueColumns[i]}'), onTap: () => _goTo(_row, i)),
                      ),
                    ),
                ]),
                const SizedBox(height: 16),
                Container(
                  padding: const EdgeInsets.symmetric(vertical: 10),
                  decoration: BoxDecoration(color: (outOfRange ? t.destructive : t.chart3).withValues(alpha: .08), border: Border.all(color: (outOfRange ? t.destructive : t.chart3).withValues(alpha: .3), width: 2), borderRadius: BorderRadius.circular(Radii.lg)),
                  child: Column(children: [
                    Text('Reading', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w500, color: outOfRange ? t.destructive : t.chart3)),
                    Text(_digits.isEmpty ? '--' : _digits, style: TextStyle(fontSize: 28, fontWeight: FontWeight.w700, fontFamily: 'monospace', color: outOfRange ? t.destructive : t.chart3)),
                    if (type != null) Text('Range ${fmtNum(type.torqueMin)}–${fmtNum(type.torqueMax)}', style: TextStyle(fontSize: 11, color: t.mutedForeground)),
                  ]),
                ),
                const SizedBox(height: 12),
                Row(children: [
                  Expanded(child: AppButton(label: '-0.5', variant: AppButtonVariant.outline, onPressed: () => _step(-0.5))),
                  const SizedBox(width: 8),
                  Expanded(child: AppButton(label: '+0.5', variant: AppButtonVariant.outline, onPressed: () => _step(0.5))),
                ]),
                const SizedBox(height: 12),
                Numpad(display: _digits.isEmpty ? '0' : _digits, onKey: _key, onClear: () => setState(() => _digits = ''), onBackspace: () => setState(() => _digits = _digits.isEmpty ? '' : _digits.substring(0, _digits.length - 1))),
                if (outOfRange) ...[
                  const SizedBox(height: 12),
                  AppTextField(label: 'Note (required — this reading is out of range)', controller: _note, maxLines: 2, hint: 'e.g. Felt worn/dirty, replaced with new'),
                ],
                const SizedBox(height: 16),
                AppButton(label: 'Save cell', icon: LucideIcons.check, loading: _busy, onPressed: () => _save(sheet, type)),
              ]),
            ),
          ]),
        );
      },
    );
  }
}

class _ColumnChip extends StatelessWidget {
  const _ColumnChip({required this.label, required this.selected, required this.filled, required this.onTap});

  final String label;
  final bool selected;
  final bool filled;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    return Material(
      color: selected ? t.primary : (filled ? t.accent : t.background),
      borderRadius: BorderRadius.circular(Radii.md),
      child: InkWell(
        borderRadius: BorderRadius.circular(Radii.md),
        onTap: onTap,
        child: Container(
          height: 44,
          alignment: Alignment.center,
          decoration: BoxDecoration(border: Border.all(color: selected ? t.primary : t.input), borderRadius: BorderRadius.circular(Radii.md)),
          child: Row(mainAxisSize: MainAxisSize.min, children: [
            Text(label, style: TextStyle(fontWeight: FontWeight.w600, color: selected ? t.primaryForeground : t.foreground)),
            if (filled) ...[
              const SizedBox(width: 4),
              Icon(LucideIcons.check, size: 12, color: selected ? t.primaryForeground : t.foreground),
            ],
          ]),
        ),
      ),
    );
  }
}
