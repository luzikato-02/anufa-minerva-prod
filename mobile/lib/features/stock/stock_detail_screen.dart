import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../core/api/api_client.dart';
import '../../core/api/api_exception.dart';
import '../../core/api/paged.dart';
import '../../core/auth/auth_controller.dart';
import '../../core/csv_parse.dart';
import '../../core/files/file_opener.dart';
import '../../core/theme/app_theme.dart';
import '../../core/theme/tokens.g.dart' show TokenSet;
import '../../core/ui/app_alert.dart';
import '../../core/ui/app_badge.dart';
import '../../core/ui/app_button.dart';
import '../../core/ui/app_card.dart';
import '../../core/ui/app_select.dart';
import '../../core/ui/async_body.dart';
import '../../core/ui/form_sheet.dart';
import '../settings/settings_shell.dart' show showToast;
import '../shared/minerva_scaffold.dart';
import '../tension/tension_models.dart';
import 'stock_models.dart';
import 'stock_records_screen.dart';

final stockSessionProvider = FutureProvider.autoDispose.family<StockSession, int>((ref, id) async {
  try {
    final res = await ref.watch(dioProvider).get('/stock-take-records/$id');
    return StockSession(asMap((res.data as Map)['data']));
  } catch (e) {
    throw ApiException.from(e);
  }
});

/// Turns the server's per-batch summary rows into CSV (same output as the web download).
String summaryToCsv(List<Map<String, dynamic>> rows) {
  if (rows.isEmpty) return '';
  final headers = rows.first.keys.toList();
  return [headers.join(','), for (final r in rows) headers.map((h) => csvEscape(r[h])).join(',')].join('\n');
}

class StockDetailScreen extends ConsumerStatefulWidget {
  const StockDetailScreen({super.key, required this.id});

  final int id;

  @override
  ConsumerState<StockDetailScreen> createState() => _StockDetailScreenState();
}

class _StockDetailScreenState extends ConsumerState<StockDetailScreen> {
  String _filter = 'all';

  Future<void> _download(StockSession s) async {
    try {
      final res = await ref.read(dioProvider).get('/stock-take-records/${s.id}/download');
      final rows = [for (final r in (asMap(res.data)['summary'] as List? ?? const [])) asMap(r)];
      if (rows.isEmpty) throw ApiException('No summary data for this session yet.');
      await ref.read(fileOpenerProvider).open('stock_take_summary_${s.sessionId}.csv', utf8.encode(summaryToCsv(rows)));
    } catch (e) {
      if (mounted) showToast(context, ApiException.from(e).message);
    }
  }

  Future<void> _delete(StockSession s) async {
    if (!await confirmDialog(context, title: 'Delete session ${s.sessionId}?', message: 'This permanently deletes the session and everything recorded in it.', confirmLabel: 'Delete', destructive: true)) return;
    try {
      await ref.read(dioProvider).delete('/stock-take-records/${s.id}');
      ref.invalidate(pagedProvider);
      ref.invalidate(stockStatsProvider);
      if (mounted) context.go('/stock-take-records');
    } catch (e) {
      if (mounted) showToast(context, ApiException.from(e).message);
    }
  }

  Future<void> _changeStatus(StockSession s) async {
    final saved = await showFormSheet<bool>(context, title: 'Change session status', description: 'Session ${s.sessionId}', builder: (_) => _StatusForm(s));
    if (saved == true) {
      ref.invalidate(stockSessionProvider(s.id));
      ref.invalidate(pagedProvider);
      ref.invalidate(stockStatsProvider);
    }
  }

  @override
  Widget build(BuildContext context) {
    final session = ref.watch(sessionProvider);
    final async = ref.watch(stockSessionProvider(widget.id));
    final s = async.value;
    return MinervaScaffold(
      title: s == null ? 'Stock take session' : 'Session ${s.sessionId}',
      showDrawer: false,
      actions: [
        if (s != null)
          PopupMenuButton<String>(
            onSelected: (v) => switch (v) {
              'csv' => _download(s),
              'status' => _changeStatus(s),
              _ => _delete(s),
            },
            itemBuilder: (_) => [
              const PopupMenuItem(value: 'csv', child: Text('Download CSV')),
              if (session.can('stock-take.edit')) const PopupMenuItem(value: 'status', child: Text('Change status')),
              if (session.can('stock-take.delete')) const PopupMenuItem(value: 'delete', child: Text('Delete')),
            ],
          ),
      ],
      body: RefreshIndicator(
        onRefresh: () => ref.refresh(stockSessionProvider(widget.id).future),
        child: AsyncBody<StockSession>(
          value: async,
          onRetry: () => ref.invalidate(stockSessionProvider(widget.id)),
          builder: (s) => _Body(s, filter: _filter, onFilter: (f) => setState(() => _filter = f)),
        ),
      ),
    );
  }
}

class _Body extends StatelessWidget {
  const _Body(this.s, {required this.filter, required this.onFilter});

  final StockSession s;
  final String filter;
  final ValueChanged<String> onFilter;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final all = s.summary;
    final rows = all.where((r) => filter == 'all' || (filter == 'found') == (r['is_recorded'] == true)).toList();
    final found = all.where((r) => r['is_recorded'] == true).length;
    return ListView(padding: const EdgeInsets.all(16), children: [
      AppCard(
        title: 'Summary',
        description: s.createdAt == null ? null : DateFormat('d MMM y, HH:mm').format(s.createdAt!),
        action: AppBadge(s.status.isEmpty ? '—' : s.status, variant: s.completed ? AppBadgeVariant.success : AppBadgeVariant.warning),
        child: Column(children: [
          _kv(t, 'Session leader', s.leader.isEmpty ? '—' : s.leader),
          _kv(t, 'Total batches', '${s.totalBatches}'),
          _kv(t, 'Total materials', '${s.totalMaterials}'),
          _kv(t, 'Found', '${s.checked} (${(s.progress * 100).round()}%)'),
          const SizedBox(height: 8),
          LinearProgressIndicator(value: s.progress.clamp(0, 1).toDouble(), minHeight: 6, borderRadius: BorderRadius.circular(3), backgroundColor: t.muted),
        ]),
      ),
      const SizedBox(height: 16),
      Wrap(spacing: 8, runSpacing: 4, children: [
        for (final f in const [('all', 'All'), ('found', 'Found'), ('missing', 'Not found')]) ChoiceChip(label: Text(f.$2), selected: filter == f.$1, onSelected: (_) => onFilter(f.$1)),
      ]),
      const SizedBox(height: 8),
      Text('${rows.length} of ${all.length} batches · $found found', style: TextStyle(fontSize: 12, color: t.mutedForeground)),
      const SizedBox(height: 8),
      if (all.isEmpty)
        const AppAlert(message: 'No batch summary yet. It is built once the session is saved.', destructive: false)
      else
        for (final r in rows) _BatchTile(r),
    ]);
  }

  Widget _kv(TokenSet t, String k, String v) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 3),
        child: Row(children: [
          SizedBox(width: 120, child: Text(k, style: TextStyle(fontSize: 13, color: t.mutedForeground))),
          Expanded(child: Text(v, style: const TextStyle(fontWeight: FontWeight.w500))),
        ]),
      );
}

class _BatchTile extends StatelessWidget {
  const _BatchTile(this.r);

  final Map<String, dynamic> r;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final found = r['is_recorded'] == true;
    final at = DateTime.tryParse('${r['timestamp_found'] ?? r['recorded_at']}')?.toLocal();
    String v(Object? x) => x == null || '$x'.isEmpty ? '—' : '$x';
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(border: Border.all(color: t.border), borderRadius: BorderRadius.circular(Radii.md)),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Expanded(child: Text(v(r['batch_number']), style: const TextStyle(fontWeight: FontWeight.w600))),
            AppBadge(found ? 'Found' : 'Not found', variant: found ? AppBadgeVariant.success : AppBadgeVariant.outline),
          ]),
          Text('${v(r['material_code'])} · ${v(r['material_description'])}', style: TextStyle(fontSize: 12, color: t.mutedForeground)),
          if (found) ...[
            const SizedBox(height: 6),
            Wrap(spacing: 16, runSpacing: 2, children: [
              Text('Weight ${v(r['actual_weight'])}', style: const TextStyle(fontSize: 13)),
              Text('Bobbins ${v(r['total_bobbins'])}', style: const TextStyle(fontSize: 13)),
              Text('Line ${v(r['line_position'])} · Row ${v(r['row_position'])}', style: const TextStyle(fontSize: 13)),
            ]),
            Text('By ${v(r['user_found'])}${at == null ? '' : ' · ${DateFormat('d MMM, HH:mm').format(at)}'}', style: TextStyle(fontSize: 12, color: t.mutedForeground)),
            if ('${r['explanation'] ?? ''}'.isNotEmpty) Text('“${r['explanation']}”', style: TextStyle(fontSize: 12, color: t.mutedForeground)),
          ],
        ]),
      ),
    );
  }
}

class _StatusForm extends ConsumerStatefulWidget {
  const _StatusForm(this.s);

  final StockSession s;

  @override
  ConsumerState<_StatusForm> createState() => _StatusFormState();
}

class _StatusFormState extends ConsumerState<_StatusForm> {
  late String _status = widget.s.completed ? 'Completed' : 'In Progress';
  bool _busy = false;
  String? _error;

  Future<void> _save() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await ref.read(dioProvider).patch('/stock-take-records/${widget.s.id}/status', data: {'session_status': _status});
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
        AppSelect<String>(label: 'Status', value: _status, items: const {'In Progress': 'In Progress', 'Completed': 'Completed'}, onChanged: (v) => setState(() => _status = v ?? _status)),
        const SizedBox(height: 16),
        AppButton(label: 'Save', loading: _busy, onPressed: _save),
      ]);
}
