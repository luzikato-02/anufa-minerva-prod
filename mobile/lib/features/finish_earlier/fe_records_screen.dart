import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/api/paged.dart';
import '../../core/auth/auth_controller.dart';
import '../../core/theme/app_theme.dart';
import '../../core/ui/app_badge.dart';
import '../../core/ui/app_card.dart';
import '../../core/ui/paged_list.dart';
import '../shared/minerva_scaffold.dart';
import 'fe_models.dart';

/// "Display: Finish Earlier Records".
class FeRecordsScreen extends ConsumerStatefulWidget {
  const FeRecordsScreen({super.key});

  @override
  ConsumerState<FeRecordsScreen> createState() => _FeRecordsScreenState();
}

class _FeRecordsScreenState extends ConsumerState<FeRecordsScreen> {
  String _search = '';

  @override
  Widget build(BuildContext context) {
    final canScan = ref.watch(sessionProvider).can('finish-earlier.create');
    return MinervaScaffold(
      title: 'Finish Earlier Records',
      fab: canScan ? FloatingActionButton.extended(onPressed: () => context.go('/finish-earlier/scan'), icon: const Icon(LucideIcons.scanLine), label: const Text('Scan form')) : null,
      body: PagedList(
        query: PagedQuery('/finish-earlier', {if (_search.isNotEmpty) 'search': _search}),
        emptyMessage: 'No finish-earlier records yet.',
        header: Padding(padding: const EdgeInsets.fromLTRB(16, 12, 16, 4), child: SearchField(hint: 'Search PO, style, machine or shift', onChanged: (v) => setState(() => _search = v))),
        itemBuilder: (ctx, j) => _Card(FeRecord(j)),
      ),
    );
  }
}

class _Card extends StatelessWidget {
  const _Card(this.r);

  final FeRecord r;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    Widget meta(IconData i, String s) => Row(mainAxisSize: MainAxisSize.min, children: [Icon(i, size: 14, color: t.mutedForeground), const SizedBox(width: 4), Text(s, style: const TextStyle(fontSize: 13))]);
    return InkWell(
      borderRadius: BorderRadius.circular(Radii.lg + 4),
      onTap: () => context.push('/finish-earlier/${r.id}'),
      child: AppCard(
        title: 'PO ${r.productionOrder}',
        description: [if (r.meta('style').isNotEmpty) r.meta('style'), if (r.createdAt != null) DateFormat('d MMM y, HH:mm').format(r.createdAt!)].join(' · '),
        action: AppBadge('${r.total} bobbins', variant: AppBadgeVariant.secondary),
        child: Wrap(spacing: 16, runSpacing: 4, children: [
          meta(LucideIcons.cog, 'Machine ${r.meta('machine_number').isEmpty ? '—' : r.meta('machine_number')}'),
          meta(LucideIcons.users, 'Shift ${r.meta('shift_group').isEmpty ? '—' : r.meta('shift_group')}'),
          meta(LucideIcons.ruler, 'Avg ${fmtAvg(r.average)} m'),
        ]),
      ),
    );
  }
}

String fmtAvg(double v) => v == v.roundToDouble() ? v.toInt().toString() : v.toStringAsFixed(1);
