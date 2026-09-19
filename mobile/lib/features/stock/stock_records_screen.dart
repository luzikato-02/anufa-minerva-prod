import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/api/api_client.dart';
import '../../core/api/api_exception.dart';
import '../../core/api/paged.dart';
import '../../core/auth/auth_controller.dart';
import '../../core/csv_parse.dart';
import '../../core/files/file_pick.dart';
import '../../core/theme/app_theme.dart';
import '../../core/ui/app_alert.dart';
import '../../core/ui/app_badge.dart';
import '../../core/ui/app_button.dart';
import '../../core/ui/app_card.dart';
import '../../core/ui/app_text_field.dart';
import '../../core/ui/form_sheet.dart';
import '../../core/ui/paged_list.dart';
import '../settings/settings_shell.dart' show showToast;
import '../shared/minerva_scaffold.dart';
import '../tension/tension_models.dart';
import 'stock_models.dart';

final stockStatsProvider = FutureProvider.autoDispose<Map<String, dynamic>>((ref) async {
  try {
    final res = await ref.watch(dioProvider).get('/stock-take-statistics');
    return asMap((res.data as Map)['data']);
  } catch (e) {
    throw ApiException.from(e);
  }
});

/// "Display: Stock Take Records" — stats, sessions list with search, and CSV upload to start a session.
class StockRecordsScreen extends ConsumerStatefulWidget {
  const StockRecordsScreen({super.key});

  @override
  ConsumerState<StockRecordsScreen> createState() => _StockRecordsScreenState();
}

class _StockRecordsScreenState extends ConsumerState<StockRecordsScreen> {
  String _search = '';

  Future<void> _create() async {
    final ok = await showFormSheet<bool>(context, title: 'New stock take session', description: 'Upload the CSV of batches to be counted', builder: (_) => const _CreateForm());
    if (ok == true) {
      ref.invalidate(pagedProvider);
      ref.invalidate(stockStatsProvider);
      if (mounted) showToast(context, 'Session created successfully!');
    }
  }

  @override
  Widget build(BuildContext context) {
    final canCreate = ref.watch(sessionProvider).can('stock-take.create');
    return MinervaScaffold(
      title: 'Stock Take Records',
      fab: canCreate ? FloatingActionButton.extended(onPressed: _create, icon: const Icon(LucideIcons.upload), label: const Text('New session')) : null,
      body: PagedList(
        query: PagedQuery('/stock-take-records', {if (_search.isNotEmpty) 'search': _search}),
        emptyMessage: 'No stock take sessions yet.',
        header: Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
          child: Column(children: [
            const _Stats(),
            const SizedBox(height: 12),
            SearchField(hint: 'Search session ID, leader or status', onChanged: (v) => setState(() => _search = v)),
          ]),
        ),
        itemBuilder: (ctx, r) => _SessionCard(StockSession(r)),
      ),
    );
  }
}

class _Stats extends ConsumerWidget {
  const _Stats();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final s = ref.watch(stockStatsProvider).value;
    if (s == null) return const SizedBox.shrink();
    final t = context.tokens;
    Widget cell(String label, Object? v) => Expanded(
          child: Column(children: [
            Text('${v ?? 0}', style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w600)),
            Text(label, textAlign: TextAlign.center, style: TextStyle(fontSize: 11, color: t.mutedForeground)),
          ]),
        );
    return AppCard(
      padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
      child: Row(children: [
        cell('Sessions', s['total_sessions']),
        cell('In progress', s['in_progress_sessions']),
        cell('Completed', s['completed_sessions']),
        cell('Batches found', '${s['total_checked_batches'] ?? 0}/${s['total_batches'] ?? 0}'),
        cell('Completion', '${s['overall_completion'] ?? 0}%'),
      ]),
    );
  }
}

class _SessionCard extends StatelessWidget {
  const _SessionCard(this.s);

  final StockSession s;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    return InkWell(
      borderRadius: BorderRadius.circular(Radii.lg + 4),
      onTap: () => context.push('/stock-take-records/${s.id}'),
      child: AppCard(
        title: 'Session ${s.sessionId}',
        description: [if (s.leader.isNotEmpty) s.leader, if (s.createdAt != null) DateFormat('d MMM y, HH:mm').format(s.createdAt!)].join(' · '),
        action: AppBadge(s.status.isEmpty ? '—' : s.status, variant: s.completed ? AppBadgeVariant.success : AppBadgeVariant.warning),
        child: Column(children: [
          Row(children: [
            Expanded(child: LinearProgressIndicator(value: s.progress.clamp(0, 1).toDouble(), minHeight: 6, borderRadius: BorderRadius.circular(3), backgroundColor: t.muted)),
            const SizedBox(width: 8),
            Text('${s.checked}/${s.totalBatches}', style: TextStyle(fontSize: 12, color: t.mutedForeground)),
          ]),
          const SizedBox(height: 4),
          Align(alignment: Alignment.centerLeft, child: Text('${s.totalMaterials} materials', style: TextStyle(fontSize: 12, color: t.mutedForeground))),
        ]),
      ),
    );
  }
}

class _CreateForm extends ConsumerStatefulWidget {
  const _CreateForm();

  @override
  ConsumerState<_CreateForm> createState() => _CreateFormState();
}

class _CreateFormState extends ConsumerState<_CreateForm> {
  late final _leader = TextEditingController(text: ref.read(sessionProvider).name);
  List<Map<String, String>> _rows = [];
  String? _fileName;
  bool _busy = false;
  String? _error;

  Future<void> _pick() async {
    final f = await ref.read(pickFileProvider)(['csv']);
    if (f == null) return;
    final rows = parseCsvRecords(f.text);
    setState(() {
      _fileName = f.name;
      _rows = rows;
      _error = rows.isEmpty ? 'No data rows found in that file.' : null;
    });
  }

  Future<void> _submit() async {
    if (_leader.text.trim().isEmpty || _rows.isEmpty) {
      setState(() => _error = 'Please provide a session leader and upload a CSV file.');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await ref.read(dioProvider).post('/stock-take-records', data: newSessionPayload(rows: _rows, leader: _leader.text.trim()));
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (mounted) setState(() => _error = ApiException.from(e).message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final materials = _rows.map((r) => StockBatch.fromRaw(r).materialCode.trim()).toSet().length;
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      if (_error != null) ...[AppAlert(message: _error!), const SizedBox(height: 12)],
      AppTextField(label: 'Session leader', controller: _leader),
      const SizedBox(height: 12),
      AppButton(label: _fileName ?? 'Choose CSV file', icon: LucideIcons.fileUp, variant: AppButtonVariant.outline, onPressed: _pick),
      if (_rows.isNotEmpty) Padding(padding: const EdgeInsets.only(top: 8), child: Text('${_rows.length} batches · $materials materials ready to upload', style: TextStyle(color: t.mutedForeground))),
      const SizedBox(height: 16),
      AppButton(label: 'Create session', loading: _busy, onPressed: _submit),
    ]);
  }
}
