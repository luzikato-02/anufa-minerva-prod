import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../core/api/api_client.dart';
import '../../core/api/api_exception.dart';
import '../../core/api/paged.dart';
import '../../core/auth/auth_controller.dart';
import '../../core/files/file_opener.dart';
import '../../core/theme/app_theme.dart';
import '../../core/ui/app_alert.dart';
import '../../core/ui/app_button.dart';
import '../../core/ui/app_card.dart';
import '../../core/ui/app_text_field.dart';
import '../../core/ui/async_body.dart';
import '../../core/ui/form_sheet.dart';
import '../settings/settings_shell.dart' show showToast;
import '../shared/minerva_scaffold.dart';
import '../stock/stock_detail_screen.dart' show summaryToCsv;
import '../tension/tension_models.dart';
import 'stock_sheet_models.dart';

final _number = NumberFormat('#,##0.##');

/// A sheet as the server holds it. Row ids are the numeric database ids, carried in [SheetRow.uuid].
class ServerSheet {
  ServerSheet(this.raw);

  final Map<String, dynamic> raw;

  int get id => (raw['id'] as num).toInt();
  DateTime? get date => DateTime.tryParse('${raw['sheet_date']}');
  String get leader => '${raw['leader'] ?? ''}';
  String? get sessionId => raw['session_id'] as String?;
  List<SheetRow> get rows => [
        if (raw['rows'] is List)
          for (final r in raw['rows'] as List) SheetRow.fromJson({...asMap(r), 'uuid': asMap(r)['id']}),
      ];
  int get totalChs => rows.fold(0, (a, r) => a + (r.chs ?? 0));
  double get totalWeight => rows.fold(0.0, (a, r) => a + (r.weight ?? 0));
}

final stockSheetDetailProvider = FutureProvider.autoDispose.family<ServerSheet, int>((ref, id) async {
  try {
    final res = await ref.watch(dioProvider).get('/stock-sheets/$id');
    return ServerSheet(asMap((res.data as Map)['data']));
  } catch (e) {
    throw ApiException.from(e);
  }
});

class StockSheetDetailScreen extends ConsumerStatefulWidget {
  const StockSheetDetailScreen({super.key, required this.id});

  final int id;

  @override
  ConsumerState<StockSheetDetailScreen> createState() => _StockSheetDetailScreenState();
}

class _StockSheetDetailScreenState extends ConsumerState<StockSheetDetailScreen> {
  Future<void> _download(ServerSheet s) async {
    try {
      final res = await ref.read(dioProvider).get('/stock-sheets/${s.id}/download');
      final rows = [for (final r in (asMap(res.data)['summary'] as List? ?? const [])) asMap(r)];
      if (rows.isEmpty) throw ApiException('This sheet has no rows yet.');
      final day = s.date == null ? '${s.id}' : DateFormat('yyyy-MM-dd').format(s.date!);
      await ref.read(fileOpenerProvider).open('stock_sheet_$day.csv', utf8.encode(summaryToCsv(rows)));
    } catch (e) {
      if (mounted) showToast(context, ApiException.from(e).message);
    }
  }

  Future<void> _delete(ServerSheet s) async {
    if (!await confirmDialog(context, title: 'Delete this sheet?', message: 'This permanently deletes the sheet and its ${s.rows.length} rows.', confirmLabel: 'Delete sheet', destructive: true)) return;
    try {
      await ref.read(dioProvider).delete('/stock-sheets/${s.id}');
      ref.invalidate(pagedProvider);
      if (mounted) context.go('/stock-sheets');
    } catch (e) {
      if (mounted) showToast(context, ApiException.from(e).message);
    }
  }

  Future<void> _editRow(SheetRow row) async {
    final changed = await showFormSheet<bool>(context, title: 'Edit row', description: row.batch, builder: (_) => _RowForm(row: row, canDelete: ref.read(sessionProvider).can('stock-take.delete')));
    if (changed == true) {
      ref.invalidate(stockSheetDetailProvider(widget.id));
      ref.invalidate(pagedProvider);
    }
  }

  @override
  Widget build(BuildContext context) {
    final session = ref.watch(sessionProvider);
    final async = ref.watch(stockSheetDetailProvider(widget.id));
    final s = async.value;
    final t = context.tokens;
    return MinervaScaffold(
      title: s?.date == null ? 'Stock sheet' : DateFormat('d MMM y').format(s!.date!),
      showDrawer: false,
      actions: [
        if (s != null)
          PopupMenuButton<String>(
            onSelected: (v) => v == 'csv' ? _download(s) : _delete(s),
            itemBuilder: (_) => [
              const PopupMenuItem(value: 'csv', child: Text('Download CSV')),
              if (session.can('stock-take.delete')) const PopupMenuItem(value: 'delete', child: Text('Delete')),
            ],
          ),
      ],
      body: RefreshIndicator(
        onRefresh: () => ref.refresh(stockSheetDetailProvider(widget.id).future),
        child: AsyncBody<ServerSheet>(
          value: async,
          onRetry: () => ref.invalidate(stockSheetDetailProvider(widget.id)),
          builder: (s) => ListView(padding: const EdgeInsets.all(16), children: [
            AppCard(
              title: 'Summary',
              description: [if (s.sessionId != null) 'Session ${s.sessionId}', 'Recorded by ${s.leader}'].join(' · '),
              child: Text('${s.rows.length} ${s.rows.length == 1 ? 'row' : 'rows'} · ${_number.format(s.totalChs)} cheeses · ${_number.format(s.totalWeight)} kg', style: TextStyle(color: t.mutedForeground)),
            ),
            const SizedBox(height: 16),
            if (s.rows.isEmpty)
              const AppAlert(message: 'No rows on this sheet yet.', destructive: false)
            else
              for (var i = 0; i < s.rows.length; i++) _RowCard(number: i + 1, row: s.rows[i], onTap: session.can('stock-take.edit') ? () => _editRow(s.rows[i]) : null),
          ]),
        ),
      ),
    );
  }
}

class _RowCard extends StatelessWidget {
  const _RowCard({required this.number, required this.row, this.onTap});

  final int number;
  final SheetRow row;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    String v(Object? x) => x == null || '$x'.isEmpty ? '—' : '$x';
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Semantics(
        button: onTap != null,
        label: 'Row $number, ${row.batch}, ${v(row.color)}',
        excludeSemantics: true,
        child: InkWell(
          borderRadius: BorderRadius.circular(Radii.md),
          onTap: onTap,
          child: Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(border: Border.all(color: t.border), borderRadius: BorderRadius.circular(Radii.md)),
            child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              SizedBox(width: 28, child: Text('$number', style: TextStyle(fontWeight: FontWeight.w600, color: t.mutedForeground))),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(row.batch, style: const TextStyle(fontWeight: FontWeight.w600)),
                  Text('${v(row.color)} · ${v(row.materialCode)}', style: TextStyle(fontSize: 12, color: t.mutedForeground)),
                  const SizedBox(height: 6),
                  Wrap(spacing: 16, runSpacing: 2, children: [
                    Text('Prod ${row.prodDate == null ? '—' : DateFormat('d MMM y').format(row.prodDate!)}', style: const TextStyle(fontSize: 13)),
                    Text('Cheeses ${v(row.chs)}', style: const TextStyle(fontSize: 13)),
                    Text('Weight ${row.weight == null ? '—' : '${_number.format(row.weight)} kg'}', style: const TextStyle(fontSize: 13)),
                    Text('Position ${v(row.position)}', style: const TextStyle(fontSize: 13)),
                    if (row.remark.isNotEmpty) Text(row.remark, style: const TextStyle(fontSize: 13)),
                  ]),
                ]),
              ),
            ]),
          ),
        ),
      ),
    );
  }
}

class _RowForm extends ConsumerStatefulWidget {
  const _RowForm({required this.row, required this.canDelete});

  final SheetRow row;
  final bool canDelete;

  @override
  ConsumerState<_RowForm> createState() => _RowFormState();
}

class _RowFormState extends ConsumerState<_RowForm> {
  late final _color = TextEditingController(text: widget.row.color);
  late final _material = TextEditingController(text: widget.row.materialCode);
  late final _batch = TextEditingController(text: widget.row.batch);
  late final _chs = TextEditingController(text: widget.row.chs?.toString() ?? '');
  late final _weight = TextEditingController(text: widget.row.weight == null ? '' : _number.format(widget.row.weight).replaceAll(',', ''));
  late final _position = TextEditingController(text: widget.row.position?.toString() ?? '');
  late final _remark = TextEditingController(text: widget.row.remark);
  late DateTime? _date = widget.row.prodDate;
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    for (final c in [_color, _material, _batch, _chs, _weight, _position, _remark]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _save() async {
    if (_material.text.trim().isEmpty || _batch.text.trim().isEmpty) return setState(() => _error = 'Material code and batch are required.');
    final weight = double.tryParse(_weight.text.trim());
    final chs = int.tryParse(_chs.text.trim());
    final position = int.tryParse(_position.text.trim());
    if (_weight.text.trim().isNotEmpty && (weight == null || weight < 0)) return setState(() => _error = 'Weight must be a number, like 146.8.');
    if (_chs.text.trim().isNotEmpty && (chs == null || chs < 0)) return setState(() => _error = 'Cheeses must be a whole number.');
    if (_position.text.trim().isNotEmpty && (position == null || position < 0 || position > 999)) return setState(() => _error = 'Position must be a number from 0 to 999.');
    final row = widget.row.copyWith(color: _color.text.trim(), materialCode: _material.text.trim(), batch: _batch.text.trim(), prodDate: _date, clearDate: _date == null, chs: chs, clearChs: chs == null, weight: weight, clearWeight: weight == null, position: position, clearPosition: position == null, remark: _remark.text.trim());
    await _send(() => ref.read(dioProvider).patch('/stock-sheets/rows/${row.uuid}', data: row.toFields()));
  }

  Future<void> _remove() async {
    if (!await confirmDialog(context, title: 'Delete this row?', message: '${widget.row.batch} will be removed from the sheet.', confirmLabel: 'Delete row', destructive: true)) return;
    await _send(() => ref.read(dioProvider).delete('/stock-sheets/rows/${widget.row.uuid}'));
  }

  Future<void> _send(Future<Object?> Function() call) async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await call();
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (mounted) setState(() => _error = ApiException.from(e).message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        if (_error != null) ...[AppAlert(message: _error!), const SizedBox(height: 12)],
        AppTextField(label: 'Colour', controller: _color),
        const SizedBox(height: 12),
        AppTextField(label: 'Material code', controller: _material),
        const SizedBox(height: 12),
        AppTextField(label: 'Batch', controller: _batch),
        const SizedBox(height: 12),
        AppButton(
          variant: AppButtonVariant.outline,
          icon: Icons.calendar_today_outlined,
          label: _date == null ? 'Production date: none' : 'Production date: ${DateFormat('d MMM y').format(_date!)}',
          onPressed: () async {
            final now = DateTime.now();
            final d = await showDatePicker(context: context, initialDate: _date ?? now, firstDate: DateTime(now.year - 3), lastDate: DateTime(now.year + 1));
            if (d != null && mounted) setState(() => _date = d);
          },
        ),
        const SizedBox(height: 12),
        Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Expanded(child: AppTextField(label: 'Cheeses', controller: _chs, keyboardType: TextInputType.number)),
          const SizedBox(width: 12),
          Expanded(child: AppTextField(label: 'Weight (kg)', controller: _weight, keyboardType: const TextInputType.numberWithOptions(decimal: true))),
        ]),
        const SizedBox(height: 12),
        AppTextField(label: 'Position', controller: _position, keyboardType: TextInputType.number),
        const SizedBox(height: 12),
        AppTextField(label: 'Remark', controller: _remark),
        const SizedBox(height: 16),
        AppButton(label: 'Save changes', loading: _busy, onPressed: _save),
        if (widget.canDelete) ...[
          const SizedBox(height: 8),
          AppButton(label: 'Delete row', variant: AppButtonVariant.destructive, onPressed: _busy ? null : _remove),
        ],
      ]);
}
