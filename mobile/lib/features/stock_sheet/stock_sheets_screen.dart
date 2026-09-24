import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../core/api/paged.dart';
import '../../core/theme/app_theme.dart';
import '../../core/ui/app_card.dart';
import '../../core/ui/paged_list.dart';
import '../shared/minerva_scaffold.dart';

final _number = NumberFormat('#,##0.##');

/// "Display: Stock Sheets": every sheet recorded, newest first.
class StockSheetsScreen extends ConsumerStatefulWidget {
  const StockSheetsScreen({super.key});

  @override
  ConsumerState<StockSheetsScreen> createState() => _StockSheetsScreenState();
}

class _StockSheetsScreenState extends ConsumerState<StockSheetsScreen> {
  String _search = '';

  @override
  Widget build(BuildContext context) => MinervaScaffold(
        title: 'Stock Sheets',
        body: PagedList(
          query: PagedQuery('/stock-sheets', {if (_search.isNotEmpty) 'search': _search}),
          emptyMessage: 'No stock sheets yet.',
          header: Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
            child: SearchField(hint: 'Search leader, batch, material or colour', onChanged: (v) => setState(() => _search = v)),
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
    final date = DateTime.tryParse('${r['sheet_date']}');
    final sessionId = r['session_id'] as String?;
    final rows = (r['rows_count'] as num?)?.toInt() ?? 0;
    final chs = (num.tryParse('${r['total_chs'] ?? 0}') ?? 0).toInt();
    final kg = num.tryParse('${r['total_weight'] ?? 0}') ?? 0;
    return Semantics(
      button: true,
      label: 'Stock sheet ${date == null ? '' : DateFormat('d MMM y').format(date)}, ${sessionId == null ? '' : 'session $sessionId, '}${r['leader']}, $rows rows',
      excludeSemantics: true,
      child: InkWell(
        borderRadius: BorderRadius.circular(Radii.lg + 4),
        onTap: () => context.push('/stock-sheets/${r['id']}'),
        child: AppCard(
          title: date == null ? 'Stock sheet' : DateFormat('EEE d MMM y').format(date),
          description: [if (sessionId != null) 'Session $sessionId', 'Recorded by ${r['leader']}'].join(' · '),
          child: Align(
            alignment: AlignmentDirectional.centerStart,
            child: Text('$rows ${rows == 1 ? 'row' : 'rows'} · ${_number.format(chs)} cheeses · ${_number.format(kg)} kg', style: TextStyle(fontSize: 13, color: t.mutedForeground)),
          ),
        ),
      ),
    );
  }
}
