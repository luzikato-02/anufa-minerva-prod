import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/api/api_client.dart';
import '../../core/api/api_exception.dart';
import '../../core/api/paged.dart';
import '../../core/auth/auth_controller.dart';
import '../../core/files/file_opener.dart';
import '../../core/theme/app_theme.dart';
import '../../core/theme/tokens.g.dart' show TokenSet;
import '../../core/ui/app_alert.dart';
import '../../core/ui/app_badge.dart';
import '../../core/ui/app_button.dart';
import '../../core/ui/app_card.dart';
import '../../core/ui/async_body.dart';
import '../settings/settings_shell.dart' show showToast;
import '../shared/minerva_scaffold.dart';
import 'tension_chart.dart';
import 'tension_models.dart';
import 'tension_problems_tab.dart';
import 'tension_providers.dart';

class TensionDetailScreen extends ConsumerWidget {
  const TensionDetailScreen({super.key, required this.id});

  final int id;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(sessionProvider);
    final record = ref.watch(tensionRecordProvider(id));
    final r = record.value;

    Future<void> download() async {
      try {
        await ref.read(fileDownloaderProvider).download('/tension-records/$id/download', 'tension-$id.csv');
      } catch (e) {
        if (context.mounted) showToast(context, ApiException.from(e).message);
      }
    }

    Future<void> delete() async {
      if (!await confirmDialog(context, title: 'Delete record #$id?', message: 'This cannot be undone.', confirmLabel: 'Delete', destructive: true)) return;
      try {
        await ref.read(dioProvider).delete('/tension-records/$id');
        ref.invalidate(pagedProvider);
        ref.invalidate(tensionStatsProvider);
        if (context.mounted) context.go('/tension-records');
      } catch (e) {
        if (context.mounted) showToast(context, ApiException.from(e).message);
      }
    }

    return MinervaScaffold(
      title: r == null ? 'Tension record' : '${r.isWeaving ? 'Weaving' : 'Twisting'} #${r.id}',
      showDrawer: false,
      actions: [
        if (r != null)
          PopupMenuButton<String>(
            onSelected: (v) => switch (v) {
              'csv' => download(),
              'edit' => context.push('/tension-records/$id/edit'),
              _ => delete(),
            },
            itemBuilder: (_) => [
              const PopupMenuItem(value: 'csv', child: Text('Download CSV')),
              if (session.can('tension-records.edit')) const PopupMenuItem(value: 'edit', child: Text('Edit')),
              if (session.can('tension-records.delete')) const PopupMenuItem(value: 'delete', child: Text('Delete')),
            ],
          ),
      ],
      body: RefreshIndicator(
        onRefresh: () => ref.refresh(tensionRecordProvider(id).future),
        child: AsyncBody<TensionRecord>(
          value: record,
          onRetry: () => ref.invalidate(tensionRecordProvider(id)),
          builder: (r) => _Body(r, canResolve: session.can('tension-records.edit')),
        ),
      ),
    );
  }
}

class _Body extends ConsumerWidget {
  const _Body(this.r, {required this.canResolve});

  final TensionRecord r;
  final bool canResolve;

  List<(String, String)> _info() {
    final f = r.form;
    String v(Object? x) => x == null || '$x'.isEmpty ? 'N/A' : '$x';
    return r.isWeaving
        ? [
            ('Operator', v(r.operator)),
            ('Machine', v(r.machine)),
            ('Item', v(r.itemNumber)),
            ('Description', v(r.metadata['item_description'])),
            ('Production order', v(f['productionOrder'])),
            ('Bale', v(f['baleNumber'])),
            ('Color code', v(f['colorCode'])),
            ('Spec tension (cN)', v(f['specTens'])),
            ('Deviation (cN)', v(f['tensPlus'])),
            ('Meters check (m)', v(f['metersCheck'])),
          ]
        : [
            ('Operator', v(r.operator)),
            ('Machine', v(r.machine)),
            ('Item', v(r.itemNumber)),
            ('Yarn code', v(r.metadata['yarn_code'])),
            ('Density (Dtex)', v(f['dtexNumber'])),
            ('Table twist (TPM)', v(f['tpm'])),
            ('Cycle speed (RPM)', v(f['rpm'])),
            ('Spec tension (cN)', v(f['specTens'])),
            ('Deviation (cN)', v(f['tensPlus'])),
            ('Meters check (m)', v(f['metersCheck'])),
          ];
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.tokens;
    final points = r.points;
    return ListView(padding: const EdgeInsets.all(16), children: [
      AppCard(
        title: 'Details',
        description: r.createdAt == null ? null : DateFormat('d MMM y, HH:mm').format(r.createdAt!),
        action: r.status == 'in_progress' ? const AppBadge('In progress', variant: AppBadgeVariant.warning) : null,
        child: Column(children: [
          for (final (k, v) in _info())
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 3),
              child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                SizedBox(width: 130, child: Text(k, style: TextStyle(fontSize: 13, color: t.mutedForeground))),
                Expanded(child: Text(v, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500))),
              ]),
            ),
          const Divider(height: 24),
          Row(children: [
            Text('Progress', style: TextStyle(fontSize: 13, color: t.mutedForeground)),
            const Spacer(),
            Text('${r.completed} / ${r.total} (${r.progress}%)', style: const TextStyle(fontWeight: FontWeight.w600)),
          ]),
        ]),
      ),
      if (points.isNotEmpty) ...[
        const SizedBox(height: 16),
        AppCard(title: 'Tension chart', description: 'Max / min per ${r.isWeaving ? 'position' : 'spindle'}', child: TensionChart(points: points, spec: r.spec, tolerance: r.tolerance)),
      ],
      const SizedBox(height: 16),
      AppCard(
        title: 'Measurements',
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
        child: points.isEmpty
            ? Padding(padding: const EdgeInsets.only(bottom: 8), child: Text('No measurements recorded.', style: TextStyle(color: t.mutedForeground)))
            : Column(children: [
                Row(children: [
                  Expanded(flex: 4, child: Text(r.isWeaving ? 'Position' : 'Spindle', style: _th(t))),
                  Expanded(flex: 2, child: Text('Max', style: _th(t))),
                  Expanded(flex: 2, child: Text('Min', style: _th(t))),
                  Expanded(flex: 2, child: Text('Issue', style: _th(t))),
                ]),
                const Divider(),
                for (final p in points)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 6),
                    child: Row(children: [
                      Expanded(flex: 4, child: Text(p.label, style: const TextStyle(fontSize: 13))),
                      Expanded(flex: 2, child: Text(p.max == null ? '—' : fmtNum(p.max), style: const TextStyle(fontSize: 13))),
                      Expanded(flex: 2, child: Text(p.min == null ? '—' : fmtNum(p.min), style: const TextStyle(fontSize: 13))),
                      Expanded(
                        flex: 2,
                        child: Align(
                          alignment: Alignment.centerLeft,
                          child: p.problemStatus == null
                              ? Text('—', style: TextStyle(color: t.mutedForeground))
                              : AppBadge(p.problemStatus == 'resolved' ? 'Resolved' : 'Open', variant: p.problemStatus == 'resolved' ? AppBadgeVariant.secondary : AppBadgeVariant.destructive),
                        ),
                      ),
                    ]),
                  ),
              ]),
      ),
      const SizedBox(height: 16),
      AppCard(
        title: 'Problem reports',
        child: r.problems.isEmpty
            ? Text('No problems reported.', style: TextStyle(color: t.mutedForeground))
            : Column(children: [
                for (final p in r.problems) _ProblemTile(r, p, canResolve: canResolve),
              ]),
      ),
    ]);
  }

  TextStyle _th(TokenSet t) => TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: t.mutedForeground);
}

class _ProblemTile extends ConsumerWidget {
  const _ProblemTile(this.r, this.p, {required this.canResolve});

  final TensionRecord r;
  final Map<String, dynamic> p;
  final bool canResolve;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.tokens;
    final resolved = p['status'] == 'resolved';
    final where = p['spindleNumber'] != null ? 'Spindle ${p['spindleNumber']}' : '${p['position'] ?? 'Problem'}';
    final when = DateTime.tryParse('${p['timestamp']}')?.toLocal();
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(border: Border.all(color: t.border), borderRadius: BorderRadius.circular(Radii.md)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Wrap(
          alignment: WrapAlignment.spaceBetween,
          crossAxisAlignment: WrapCrossAlignment.center,
          spacing: 6,
          runSpacing: 4,
          children: [
            Row(mainAxisSize: MainAxisSize.min, children: [
              AppBadge(where, variant: AppBadgeVariant.destructive),
              const SizedBox(width: 6),
              AppBadge(resolved ? 'Resolved' : 'Open', variant: resolved ? AppBadgeVariant.secondary : AppBadgeVariant.outline),
            ]),
            if (when != null) Text(DateFormat('d MMM, HH:mm').format(when), style: TextStyle(fontSize: 12, color: t.mutedForeground)),
          ],
        ),
        const SizedBox(height: 8),
        Text('${p['description'] ?? ''}'),
        if (resolved && p['resolution'] is Map) ResolutionSummary(Map<String, dynamic>.from(p['resolution'] as Map)),
        if (!resolved && canResolve)
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: AppButton(
              label: 'Mark resolved',
              icon: LucideIcons.check,
              size: AppButtonSize.sm,
              variant: AppButtonVariant.outline,
              onPressed: () => resolveProblem(context, ref, recordId: r.id, problemId: '${p['id']}', title: where),
            ),
          ),
      ]),
    );
  }
}
