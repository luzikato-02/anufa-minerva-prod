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
            child: SearchField(hint: 'Search operator or machine number', onChanged: (v) => setState(() => _search = v)),
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
    return Semantics(
      button: true,
      label: 'Torque check ${date == null ? '' : DateFormat('d MMM y').format(date)}, machine ${r['machine_number']}, side ${r['side']}, $filled cells filled',
      excludeSemantics: true,
      child: InkWell(
        borderRadius: BorderRadius.circular(Radii.lg + 4),
        onTap: () => context.push('/torque-checks/${r['id']}'),
        child: AppCard(
          title: date == null ? 'Torque check' : DateFormat('EEE d MMM y').format(date),
          description: 'Machine ${r['machine_number']} · Side ${r['side']} · ${r['operator_name']}',
          action: outOfRange > 0 ? AppBadge('$outOfRange out of range', variant: AppBadgeVariant.warning) : null,
          child: Align(
            alignment: AlignmentDirectional.centerStart,
            child: Text('$filled of ${kTorqueMaxRow * kTorqueColumns.length} cells filled${creelType == null ? '' : ' · $creelType'}', style: TextStyle(fontSize: 13, color: t.mutedForeground)),
          ),
        ),
      ),
    );
  }
}
