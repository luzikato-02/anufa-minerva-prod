import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/api/api_exception.dart';
import '../../core/sync/sync_queue.dart';
import '../../core/theme/app_theme.dart';
import '../../core/ui/app_alert.dart';
import '../../core/ui/app_badge.dart';
import '../../core/ui/app_button.dart';
import '../../core/ui/app_card.dart';
import '../../core/ui/app_text_field.dart';
import '../settings/settings_shell.dart' show showToast;
import '../shared/minerva_scaffold.dart';
import '../stock/barcode_scanner.dart';
import 'stock_sheet_controller.dart';
import 'stock_sheet_models.dart';

final _number = NumberFormat('#,##0.##');

/// "Record: Stock Sheet": the paper stock list, one row at a time.
class StockSheetScreen extends ConsumerStatefulWidget {
  const StockSheetScreen({super.key});

  @override
  ConsumerState<StockSheetScreen> createState() => _StockSheetScreenState();
}

class _StockSheetScreenState extends ConsumerState<StockSheetScreen> {
  final _color = TextEditingController();
  final _material = TextEditingController();
  final _batch = TextEditingController();
  final _chs = TextEditingController();
  final _weight = TextEditingController();
  final _position = TextEditingController();
  final _remark = TextEditingController();
  DateTime? _prodDate;
  SheetRow? _editing;
  bool _busy = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    Future.microtask(() => ref.read(stockSheetProvider.notifier).open());
  }

  @override
  void dispose() {
    for (final c in [_color, _material, _batch, _chs, _weight, _position, _remark]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _scan(TextEditingController into) async {
    final code = await ref.read(barcodeScanProvider)(context);
    if (code != null && mounted) setState(() => into.text = code);
  }

  Future<void> _pickDate({required DateTime? current, required ValueChanged<DateTime> onPicked}) async {
    final now = DateTime.now();
    final d = await showDatePicker(context: context, initialDate: current ?? now, firstDate: DateTime(now.year - 3), lastDate: DateTime(now.year + 1));
    if (d != null && mounted) onPicked(d);
  }

  /// Builds the row from the form, or sets [_error] and returns null.
  SheetRow? _read(String uuid) {
    String? bad;
    final chsText = _chs.text.trim(), weightText = _weight.text.trim().replaceAll(',', '.'), positionText = _position.text.trim();
    final chs = int.tryParse(chsText), weight = double.tryParse(weightText), position = int.tryParse(positionText);
    if (_material.text.trim().isEmpty) {
      bad = 'Enter the material code.';
    } else if (_batch.text.trim().isEmpty) {
      bad = 'Enter the batch.';
    } else if (chsText.isNotEmpty && (chs == null || chs < 0)) {
      bad = 'Cheeses must be a whole number.';
    } else if (weightText.isNotEmpty && (weight == null || weight < 0)) {
      bad = 'Weight must be a number, like 146.8.';
    } else if (positionText.isNotEmpty && (position == null || position < 0 || position > 999)) {
      bad = 'Position must be a number from 0 to 999.';
    }
    if (bad != null) {
      setState(() => _error = bad);
      return null;
    }
    return SheetRow(uuid: uuid, color: _color.text.trim(), materialCode: _material.text.trim(), batch: _batch.text.trim(), prodDate: _prodDate, chs: chs, weight: weight, position: position, remark: _remark.text.trim());
  }

  Future<void> _submit() async {
    final ctrl = ref.read(stockSheetProvider.notifier);
    final editing = _editing;
    final row = _read(editing?.uuid ?? ref.read(syncQueueProvider.notifier).newId());
    if (row == null) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final result = editing == null ? await ctrl.addRow(row) : await ctrl.updateRow(row);
      if (!mounted) return;
      showToast(context, result == SubmitResult.sent ? (editing == null ? 'Row added' : 'Row updated') : 'Saved on this device. It will upload when you are online.');
      _resetForm(keep: editing == null ? row : null);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  /// After adding, position and remark stay: most rows in a run share the same rack.
  void _resetForm({SheetRow? keep}) {
    setState(() {
      _editing = null;
      _error = null;
      _prodDate = null;
      for (final c in [_color, _material, _batch, _chs, _weight]) {
        c.clear();
      }
      _position.text = keep?.position?.toString() ?? '';
      _remark.text = keep?.remark ?? '';
    });
  }

  void _edit(SheetRow r) {
    setState(() {
      _editing = r;
      _error = null;
      _color.text = r.color;
      _material.text = r.materialCode;
      _batch.text = r.batch;
      _prodDate = r.prodDate;
      _chs.text = r.chs?.toString() ?? '';
      _weight.text = r.weight == null ? '' : (r.weight! == r.weight!.roundToDouble() ? r.weight!.toStringAsFixed(0) : '${r.weight}');
      _position.text = r.position?.toString() ?? '';
      _remark.text = r.remark;
    });
  }

  Future<void> _delete(SheetRow r) async {
    final ok = await confirmDialog(context, title: 'Delete this row?', message: '${r.batch} will be removed from the sheet.', confirmLabel: 'Delete row', destructive: true);
    if (!ok || !mounted) return;
    try {
      await ref.read(stockSheetProvider.notifier).deleteRow(r.uuid);
      if (mounted) _resetForm();
    } on ApiException catch (e) {
      if (mounted) showToast(context, e.message);
    }
  }

  Future<void> _startNew(ActiveSheet sheet) async {
    if (sheet.rows.isNotEmpty) {
      final ok = await confirmDialog(context, title: 'Start a new sheet?', message: 'The ${sheet.rows.length} rows on this sheet are already saved. You will begin an empty sheet.', confirmLabel: 'Start new sheet');
      if (!ok || !mounted) return;
    }
    await ref.read(stockSheetProvider.notifier).startNew();
    if (mounted) _resetForm();
  }

  /// Recent values from this sheet, shown as one-tap chips under a field.
  List<String> _recent(List<SheetRow> rows, String Function(SheetRow) pick) {
    final seen = <String>[];
    for (final r in rows.reversed) {
      final v = pick(r);
      if (v.isNotEmpty && !seen.contains(v)) seen.add(v);
      if (seen.length == 4) break;
    }
    return seen;
  }

  Widget _chips(List<String> values, TextEditingController into) {
    if (values.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(top: 6),
      child: Wrap(spacing: 8, runSpacing: 4, children: [
        for (final v in values)
          ActionChip(label: Text(v), visualDensity: VisualDensity.compact, onPressed: () => setState(() => into.text = v)),
      ]),
    );
  }

  @override
  Widget build(BuildContext context) {
    final sheet = ref.watch(stockSheetProvider);
    if (sheet == null) return const MinervaScaffold(title: 'Stock Sheet', body: Center(child: CircularProgressIndicator()));
    final waiting = {for (final o in ref.watch(syncQueueProvider).ops) o.id};
    final editing = _editing;
    final dayFmt = DateFormat('EEE d MMM y');
    return MinervaScaffold(
      title: 'Stock Sheet',
      body: ListView(padding: const EdgeInsets.all(16), children: [
        AppCard(
          title: dayFmt.format(sheet.date),
          description: 'Recorded by ${sheet.leader}',
          action: AppButton(label: 'Change date', size: AppButtonSize.sm, variant: AppButtonVariant.outline, onPressed: () => _pickDate(current: sheet.date, onPicked: ref.read(stockSheetProvider.notifier).setDate)),
          child: Align(
            alignment: AlignmentDirectional.centerStart,
            child: AppButton(label: 'Start new sheet', icon: LucideIcons.filePlus, size: AppButtonSize.sm, variant: AppButtonVariant.ghost, onPressed: () => _startNew(sheet)),
          ),
        ),
        const SizedBox(height: 16),
        AppCard(
          title: editing == null ? 'Add row ${sheet.rows.length + 1}' : 'Edit row ${sheet.rows.indexWhere((r) => r.uuid == editing.uuid) + 1}',
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            if (_error != null) ...[AppAlert(message: _error!), const SizedBox(height: 12)],
            AppTextField(label: 'Colour', controller: _color, hint: 'e.g. White orange green', textInputAction: TextInputAction.next),
            _chips(_recent(sheet.rows, (r) => r.color), _color),
            const SizedBox(height: 12),
            _scanField('Material code', _material, hint: 'e.g. TY022002756'),
            const SizedBox(height: 12),
            _scanField('Batch', _batch, hint: 'TA… or a note'),
            const SizedBox(height: 12),
            _dateField(),
            const SizedBox(height: 12),
            Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Expanded(child: AppTextField(label: 'Cheeses', controller: _chs, keyboardType: TextInputType.number)),
              const SizedBox(width: 12),
              Expanded(child: AppTextField(label: 'Weight (kg)', controller: _weight, keyboardType: const TextInputType.numberWithOptions(decimal: true))),
            ]),
            const SizedBox(height: 12),
            Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Expanded(flex: 2, child: AppTextField(label: 'Position', controller: _position, keyboardType: TextInputType.number)),
              const SizedBox(width: 12),
              Expanded(flex: 3, child: AppTextField(label: 'Remark', controller: _remark, hint: 'e.g. ex WV')),
            ]),
            _chips(_recent(sheet.rows, (r) => r.remark), _remark),
            const SizedBox(height: 16),
            AppButton(label: editing == null ? 'Add row' : 'Save changes', icon: editing == null ? LucideIcons.plus : LucideIcons.check, loading: _busy, onPressed: _submit),
            if (editing != null) ...[
              const SizedBox(height: 8),
              Row(children: [
                Expanded(child: AppButton(label: 'Cancel', variant: AppButtonVariant.outline, onPressed: _busy ? null : _resetForm)),
                const SizedBox(width: 8),
                Expanded(child: AppButton(label: 'Delete row', variant: AppButtonVariant.destructive, onPressed: _busy ? null : () => _delete(editing))),
              ]),
            ],
          ]),
        ),
        const SizedBox(height: 16),
        AppCard(
          title: 'Rows',
          description: sheet.rows.isEmpty ? 'Rows you add appear here.' : '${sheet.rows.length} ${sheet.rows.length == 1 ? 'row' : 'rows'} · ${_number.format(sheet.totalChs)} cheeses · ${_number.format(sheet.totalWeight)} kg',
          child: Column(children: [
            for (var i = 0; i < sheet.rows.length; i++) _RowTile(number: i + 1, row: sheet.rows[i], waiting: waiting.contains(sheet.rows[i].uuid), selected: editing?.uuid == sheet.rows[i].uuid, onTap: () => _edit(sheet.rows[i])),
          ]),
        ),
      ]),
    );
  }

  Widget _scanField(String label, TextEditingController c, {required String hint}) => Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
        Expanded(child: AppTextField(label: label, controller: c, hint: hint, textInputAction: TextInputAction.next)),
        const SizedBox(width: 8),
        Tooltip(message: 'Scan ${label.toLowerCase()}', child: AppButton(icon: LucideIcons.scanBarcode, size: AppButtonSize.icon, variant: AppButtonVariant.outline, onPressed: () => _scan(c))),
      ]);

  Widget _dateField() => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Padding(padding: EdgeInsets.only(bottom: 6), child: Text('Production date', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w500))),
        Row(children: [
          Expanded(
            child: AppButton(
              variant: AppButtonVariant.outline,
              icon: LucideIcons.calendar,
              label: _prodDate == null ? 'Pick a date' : DateFormat('d MMM y').format(_prodDate!),
              onPressed: () => _pickDate(current: _prodDate, onPicked: (d) => setState(() => _prodDate = d)),
            ),
          ),
          if (_prodDate != null) ...[
            const SizedBox(width: 8),
            Tooltip(message: 'Clear date', child: AppButton(icon: LucideIcons.x, size: AppButtonSize.icon, variant: AppButtonVariant.ghost, onPressed: () => setState(() => _prodDate = null))),
          ],
        ]),
      ]);
}

class _RowTile extends StatelessWidget {
  const _RowTile({required this.number, required this.row, required this.waiting, required this.selected, required this.onTap});

  final int number;
  final SheetRow row;
  final bool waiting;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final detail = [
      if (row.materialCode.isNotEmpty) row.materialCode,
      if (row.chs != null) '${row.chs} chs',
      if (row.weight != null) '${_number.format(row.weight)} kg',
      if (row.position != null) 'pos ${row.position}',
      if (row.remark.isNotEmpty) row.remark,
    ].map((phrase) => phrase.replaceAll(' ', '\u00A0')).join(' · '); // wrap between phrases, not inside one
    return Semantics(
      button: true,
      label: 'Row $number, ${row.batch}${row.color.isEmpty ? '' : ', ${row.color}'}. $detail${waiting ? '. Waiting to upload' : ''}. Tap to edit.',
      excludeSemantics: true,
      child: InkWell(
        onTap: onTap,
        child: Container(
          constraints: const BoxConstraints(minHeight: 56),
          padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 4),
          decoration: BoxDecoration(color: selected ? t.accent : null, border: Border(top: BorderSide(color: t.border))),
          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            SizedBox(width: 28, child: Text('$number', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: t.mutedForeground))),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(row.batch, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
                if (row.color.isNotEmpty) Text(row.color, style: const TextStyle(fontSize: 13)),
                if (detail.isNotEmpty) Text(detail, style: TextStyle(fontSize: 12, color: t.mutedForeground)),
              ]),
            ),
            if (waiting) const Padding(padding: EdgeInsetsDirectional.only(start: 8), child: AppBadge('Waiting', variant: AppBadgeVariant.warning)),
          ]),
        ),
      ),
    );
  }
}
