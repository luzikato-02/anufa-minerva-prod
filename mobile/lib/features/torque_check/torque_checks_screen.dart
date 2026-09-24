import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../core/api/paged.dart';
import '../../core/theme/app_theme.dart';
import '../../core/ui/app_badge.dart';
import '../../core/ui/app_card.dart';
import '../../core/ui/paged_list.dart';
import '../shared/minerva_scaffold.dart';
import 'torque_check_models.dart';

/// "Display: Torque Checks": every sheet recorded, newest first.
class TorqueChecksScreen extends ConsumerStatefulWidget {
  const TorqueChecksScreen({super.key});

  @override
  ConsumerState<TorqueChecksScreen> createState() => _TorqueChecksScreenState();
}

class _TorqueChecksScreenState extends ConsumerState<TorqueChecksScreen> {
  String _search = '';

  @override
  Widget build(BuildContext context) => MinervaScaffold(
        title: 'Torque Checks',
        body: PagedList(
          query: PagedQuery('/torque-checks', {if (_search.isNotEmpty) 'search': _search}),
          emptyMessage: 'No torque checks yet.',
          header: Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
            child: SearchField(hint: 'Search session, operator or machine number', onChanged: (v) => setState(() => _search = v)),
          ),
          itemBuilder: (ctx, r) => _SheetCard(r),
        ),
      );
}

class _SheetCard extends StatelessWidget {
  const _SheetCard(this.r);

  final Map<String, dynamic> r;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final date = DateTime.tryParse('${r['check_date']}');
    final filled = (r['readings_count'] as num?)?.toInt() ?? 0;
    final outOfRange = (r['out_of_range_count'] as num?)?.toInt() ?? 0;
    final creelType = r['creel_type'] is Map ? (r['creel_type'] as Map)['name'] : null;
    final sessionId = r['session_id'] as String?;
    final sides = r['sides_recorded'] is List ? (r['sides_recorded'] as List).join(', ') : '';
    final totalCells = kTorqueSides.length * kTorqueMaxRow * kTorqueColumns.length;
    return Semantics(
      button: true,
      label: 'Torque check ${date == null ? '' : DateFormat('d MMM y').format(date)}, ${sessionId == null ? '' : 'session $sessionId, '}machine ${r['machine_number']}, sides $sides, $filled cells filled',
      excludeSemantics: true,
      child: InkWell(
        borderRadius: BorderRadius.circular(Radii.lg + 4),
        onTap: () => context.push('/torque-checks/${r['id']}'),
        child: AppCard(
          title: date == null ? 'Torque check' : DateFormat('EEE d MMM y').format(date),
          description: [if (sessionId != null) 'Session $sessionId', 'Machine ${r['machine_number']}', '${r['operator_name']}'].join(' · '),
          action: outOfRange > 0 ? AppBadge('$outOfRange out of range', variant: AppBadgeVariant.warning) : null,
          child: Align(
            alignment: AlignmentDirectional.centerStart,
            child: Text('$filled of $totalCells cells filled${sides.isEmpty ? '' : ' · Sides $sides'}${creelType == null ? '' : ' · $creelType'}', style: TextStyle(fontSize: 13, color: t.mutedForeground)),
          ),
        ),
      ),
    );
  }
}
