import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../core/api/api_client.dart';
import '../../core/api/api_exception.dart';
import '../../core/api/paged.dart';
import '../../core/auth/auth_controller.dart';
import '../../core/theme/app_theme.dart';
import '../../core/ui/app_alert.dart';
import '../../core/ui/app_badge.dart';
import '../../core/ui/app_button.dart';
import '../../core/ui/app_card.dart';
import '../../core/ui/app_text_field.dart';
import '../../core/ui/form_sheet.dart';
import '../../core/ui/paged_list.dart';
import '../settings/settings_shell.dart' show showToast;
import 'tension_providers.dart';

/// Flattened problem reports across all records (web "Problem Records" tab).
class TensionProblemsTab extends ConsumerStatefulWidget {
  const TensionProblemsTab({super.key});

  @override
  ConsumerState<TensionProblemsTab> createState() => _TensionProblemsTabState();
}

class _TensionProblemsTabState extends ConsumerState<TensionProblemsTab> with AutomaticKeepAliveClientMixin {
  String _status = 'open';
  String _search = '';

  @override
  bool get wantKeepAlive => true;

  @override
  Widget build(BuildContext context) {
    super.build(context);
    final canResolve = ref.watch(sessionProvider).can('tension-records.edit');
    return PagedList(
      query: PagedQuery('/tension-problems', {'status': _status, if (_search.isNotEmpty) 'search': _search}),
      emptyMessage: _status == 'open' ? 'No open problems 🎉' : 'No problems found.',
      header: Padding(
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
        child: Column(children: [
          SearchField(hint: 'Search description, machine, item', onChanged: (v) => setState(() => _search = v)),
          const SizedBox(height: 8),
          Row(children: [
            for (final s in const ['open', 'resolved', 'all'])
              Padding(
                padding: const EdgeInsets.only(right: 8),
                child: ChoiceChip(label: Text(s[0].toUpperCase() + s.substring(1)), selected: _status == s, onSelected: (_) => setState(() => _status = s)),
              ),
          ]),
        ]),
      ),
      itemBuilder: (ctx, p) => _ProblemCard(p, canResolve: canResolve),
    );
  }
}

class _ProblemCard extends ConsumerWidget {
  const _ProblemCard(this.p, {required this.canResolve});

  final Map<String, dynamic> p;
  final bool canResolve;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.tokens;
    final resolved = p['status'] == 'resolved';
    final where = p['spindle_number'] != null ? 'Spindle ${p['spindle_number']}' : (p['position'] ?? 'Unknown position');
    final when = DateTime.tryParse('${p['timestamp'] ?? p['record_created_at']}')?.toLocal();
    return InkWell(
      borderRadius: BorderRadius.circular(Radii.lg + 4),
      onTap: () => context.push('/tension-records/${p['record_id']}'),
      child: AppCard(
        title: '$where',
        description: '${p['record_type']} · ${p['item_number'] ?? '—'} · Machine ${p['machine_number'] ?? '—'}',
        action: AppBadge(resolved ? 'Resolved' : 'Open', variant: resolved ? AppBadgeVariant.secondary : AppBadgeVariant.destructive),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('${p['description'] ?? ''}'),
          if (when != null) Padding(padding: const EdgeInsets.only(top: 4), child: Text(DateFormat('d MMM y, HH:mm').format(when), style: TextStyle(fontSize: 12, color: t.mutedForeground))),
          if (resolved && p['resolution'] is Map) ResolutionSummary(Map<String, dynamic>.from(p['resolution'] as Map)),
          if (!resolved && canResolve)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: AppButton(
                label: 'Mark resolved',
                size: AppButtonSize.sm,
                variant: AppButtonVariant.outline,
                onPressed: () => resolveProblem(context, ref, recordId: (p['record_id'] as num).toInt(), problemId: '${p['problem_id']}', title: '$where'),
              ),
            ),
        ]),
      ),
    );
  }
}

class ResolutionSummary extends StatelessWidget {
  const ResolutionSummary(this.r, {super.key});

  final Map<String, dynamic> r;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final at = DateTime.tryParse('${r['resolved_at']}')?.toLocal();
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(top: 8),
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(color: t.muted, borderRadius: BorderRadius.circular(Radii.md)),
      child: DefaultTextStyle.merge(
        style: const TextStyle(fontSize: 12),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('Action: ${r['action'] ?? '—'}'),
          Text('After-repair max: ${r['after_repair_max'] ?? '—'}  ·  min: ${r['after_repair_min'] ?? '—'}'),
          Text('Resolved by ${r['resolved_by'] ?? '—'}${at == null ? '' : ' on ${DateFormat('d MMM y, HH:mm').format(at)}'}'),
        ]),
      ),
    );
  }
}

/// Opens the resolve sheet; refreshes every tension list/detail on success.
Future<void> resolveProblem(BuildContext context, WidgetRef ref, {required int recordId, required String problemId, required String title}) async {
  final done = await showFormSheet<bool>(
    context,
    title: 'Resolve problem',
    description: title,
    builder: (_) => _ResolveForm(recordId: recordId, problemId: problemId),
  );
  if (done == true) {
    ref.invalidate(pagedProvider);
    ref.invalidate(tensionRecordProvider(recordId));
    ref.invalidate(tensionStatsProvider);
    if (context.mounted) showToast(context, 'Problem marked as resolved');
  }
}

class _ResolveForm extends ConsumerStatefulWidget {
  const _ResolveForm({required this.recordId, required this.problemId});

  final int recordId;
  final String problemId;

  @override
  ConsumerState<_ResolveForm> createState() => _ResolveFormState();
}

class _ResolveFormState extends ConsumerState<_ResolveForm> {
  final _action = TextEditingController();
  final _max = TextEditingController();
  final _min = TextEditingController();
  bool _busy = false;
  ApiException? _error;

  Future<void> _save() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await ref.read(dioProvider).patch('/tension-records/${widget.recordId}/problems/${widget.problemId}/resolve', data: {
        'action': _action.text.trim(),
        'after_repair_max': num.tryParse(_max.text.trim()),
        'after_repair_min': num.tryParse(_min.text.trim()),
      });
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (mounted) setState(() => _error = ApiException.from(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        if (_error != null && _error!.fieldErrors.isEmpty) ...[AppAlert(message: _error!.message), const SizedBox(height: 12)],
        AppTextField(label: 'Action taken', controller: _action, maxLines: 2, error: _error?.field('action')),
        const SizedBox(height: 12),
        Row(children: [
          Expanded(child: AppTextField(label: 'After-repair max', controller: _max, keyboardType: const TextInputType.numberWithOptions(decimal: true), error: _error?.field('after_repair_max'))),
          const SizedBox(width: 12),
          Expanded(child: AppTextField(label: 'After-repair min', controller: _min, keyboardType: const TextInputType.numberWithOptions(decimal: true), error: _error?.field('after_repair_min'))),
        ]),
        const SizedBox(height: 16),
        AppButton(label: 'Mark resolved', expand: true, loading: _busy, onPressed: _save),
      ]);
}
