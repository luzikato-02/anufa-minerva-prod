import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/api/paged.dart';
import '../../core/theme/app_theme.dart';
import '../../core/theme/tokens.g.dart' show TokenSet;
import '../../core/ui/app_badge.dart';
import '../../core/ui/app_card.dart';
import '../../core/ui/paged_list.dart';
import '../shared/minerva_scaffold.dart';
import 'tension_models.dart';
import 'tension_problems_tab.dart';
import 'tension_providers.dart';

/// "Display: Tension Records" — stats, then Twisting / Weaving / Problem tabs.
class TensionRecordsScreen extends ConsumerWidget {
  const TensionRecordsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final openProblems = GoRouterState.of(context).uri.queryParameters['tab'] == 'problems';
    return DefaultTabController(
      length: 3,
      initialIndex: openProblems ? 2 : 0,
      child: MinervaScaffold(
        title: 'Tension Records',
        body: Column(children: [
          const _Stats(),
          const TabBar(tabs: [Tab(text: 'Twisting'), Tab(text: 'Weaving'), Tab(text: 'Problems')]),
          const Expanded(
            child: TabBarView(children: [
              _RecordList(type: 'twisting'),
              _RecordList(type: 'weaving'),
              TensionProblemsTab(),
            ]),
          ),
        ]),
      ),
    );
  }
}

class _Stats extends ConsumerWidget {
  const _Stats();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final s = ref.watch(tensionStatsProvider).value;
    if (s == null) return const SizedBox(height: 8);
    final t = context.tokens;
    Widget cell(String label, Object? v, {Color? color}) => Expanded(
          child: Column(children: [
            Text('${v ?? 0}', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w600, color: color)),
            Text(label, textAlign: TextAlign.center, style: TextStyle(fontSize: 11, color: t.mutedForeground)),
          ]),
        );
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
      child: AppCard(
        padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
        child: Row(children: [
          cell('Total', s['total_records']),
          cell('Twisting', s['twisting_records']),
          cell('Weaving', s['weaving_records']),
          cell('Twisting issues', s['twisting_problems'], color: t.destructive),
          cell('Weaving issues', s['weaving_problems'], color: t.destructive),
        ]),
      ),
    );
  }
}

class _RecordList extends StatefulWidget {
  const _RecordList({required this.type});

  final String type;

  @override
  State<_RecordList> createState() => _RecordListState();
}

class _RecordListState extends State<_RecordList> with AutomaticKeepAliveClientMixin {
  String _search = '';

  @override
  bool get wantKeepAlive => true;

  @override
  Widget build(BuildContext context) {
    super.build(context);
    return PagedList(
      query: PagedQuery('/tension-records', {'type': widget.type, if (_search.isNotEmpty) 'search': _search}),
      emptyMessage: 'No ${widget.type} records yet.',
      header: Padding(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
        child: SearchField(hint: 'Search item, machine, operator', onChanged: (v) => setState(() => _search = v)),
      ),
      itemBuilder: (ctx, r) => _RecordCard(TensionRecord(r)),
    );
  }
}

class _RecordCard extends ConsumerWidget {
  const _RecordCard(this.r);

  final TensionRecord r;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.tokens;
    final open = r.openProblems;
    final inProgress = r.status == 'in_progress';
    return InkWell(
      borderRadius: BorderRadius.circular(Radii.lg + 4),
      onTap: () => context.push('/tension-records/${r.id}'),
      child: AppCard(
        title: r.itemNumber?.isNotEmpty == true ? r.itemNumber! : 'Record #${r.id}',
        description: r.createdAt == null ? null : DateFormat('d MMM y, HH:mm').format(r.createdAt!),
        action: Row(mainAxisSize: MainAxisSize.min, children: [
          if (inProgress) const AppBadge('In progress', variant: AppBadgeVariant.warning),
          if (open > 0) ...[const SizedBox(width: 6), AppBadge('$open open', variant: AppBadgeVariant.destructive)],
        ]),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Wrap(spacing: 16, runSpacing: 4, children: [
            _meta(t, LucideIcons.user, r.operator ?? '—'),
            _meta(t, LucideIcons.cog, 'Machine ${r.machine ?? '—'}'),
            if (r.isWeaving && r.form['productionOrder'] != null) _meta(t, LucideIcons.hash, '${r.form['productionOrder']}'),
          ]),
          const SizedBox(height: 10),
          Row(children: [
            Expanded(child: LinearProgressIndicator(value: r.progress / 100, minHeight: 6, borderRadius: BorderRadius.circular(3), backgroundColor: t.muted)),
            const SizedBox(width: 8),
            Text('${r.completed}/${r.total}', style: TextStyle(fontSize: 12, color: t.mutedForeground)),
          ]),
        ]),
      ),
    );
  }

  Widget _meta(TokenSet t, IconData icon, String text) => Row(mainAxisSize: MainAxisSize.min, children: [
        Icon(icon, size: 14, color: t.mutedForeground),
        const SizedBox(width: 4),
        Text(text, style: const TextStyle(fontSize: 13)),
      ]);
}
