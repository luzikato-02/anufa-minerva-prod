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
import '../../core/ui/app_card.dart';
import '../../core/ui/async_body.dart';
import '../settings/settings_shell.dart' show showToast;
import '../shared/minerva_scaffold.dart';
import '../tension/tension_models.dart';
import 'torque_check_models.dart';

/// A sheet as the server holds it, with its full grid of readings.
class ServerTorqueSheet {
  ServerTorqueSheet(this.raw);

  final Map<String, dynamic> raw;

  int get id => (raw['id'] as num).toInt();
  DateTime? get date => DateTime.tryParse('${raw['check_date']}');
  String get operatorName => '${raw['operator_name'] ?? ''}';
  String get machineNumber => '${raw['machine_number'] ?? ''}';
  String get side => '${raw['side'] ?? ''}';
  String? get creelTypeName => raw['creel_type'] is Map ? '${(raw['creel_type'] as Map)['name']}' : null;

  Map<String, TorqueReading> get readings => {
        for (final reading in [if (raw['readings'] is List) for (final r in raw['readings'] as List) TorqueReading.fromJson({...asMap(r), 'uuid': asMap(r)['id']})]) reading.position: reading,
      };

  int get lastRow => readings.values.fold(0, (a, r) => r.rowNo > a ? r.rowNo : a);
}

final torqueCheckDetailProvider = FutureProvider.autoDispose.family<ServerTorqueSheet, int>((ref, id) async {
  try {
    final res = await ref.watch(dioProvider).get('/torque-checks/$id');
    return ServerTorqueSheet(asMap((res.data as Map)['data']));
  } catch (e) {
    throw ApiException.from(e);
  }
});

class TorqueCheckDetailScreen extends ConsumerStatefulWidget {
  const TorqueCheckDetailScreen({super.key, required this.id});

  final int id;

  @override
  ConsumerState<TorqueCheckDetailScreen> createState() => _TorqueCheckDetailScreenState();
}

class _TorqueCheckDetailScreenState extends ConsumerState<TorqueCheckDetailScreen> {
  Future<void> _download(ServerTorqueSheet s) async {
    try {
      final res = await ref.read(dioProvider).get('/torque-checks/${s.id}/download');
      final body = asMap(res.data);
      final grid = [for (final r in body['grid'] as List? ?? const []) asMap(r)];
      final problems = [for (final r in body['problems'] as List? ?? const []) asMap(r)];
      if (grid.isEmpty) throw ApiException('This sheet has no readings yet.');

      final headers = grid.first.keys.toList();
      final lines = [
        headers.join(','),
        for (final row in grid) headers.map((h) => csvEscape(row[h])).join(','),
        '',
        'LIST PROBLEM',
        for (final p in problems) '${p['ROW']} ${p['COLUMN']} ${csvEscape(p['NOTE'])}',
      ];

      final day = s.date == null ? '${s.id}' : DateFormat('yyyy-MM-dd').format(s.date!);
      await ref.read(fileOpenerProvider).open('torque_check_$day.csv', utf8.encode(lines.join('\n')));
    } catch (e) {
      if (mounted) showToast(context, ApiException.from(e).message);
    }
  }

  Future<void> _delete(ServerTorqueSheet s) async {
    if (!await confirmDialog(context, title: 'Delete this sheet?', message: 'This permanently deletes the sheet and everything on it.', confirmLabel: 'Delete sheet', destructive: true)) return;
    try {
      await ref.read(dioProvider).delete('/torque-checks/${s.id}');
      ref.invalidate(pagedProvider);
      if (mounted) context.go('/torque-checks');
    } catch (e) {
      if (mounted) showToast(context, ApiException.from(e).message);
    }
  }

  @override
  Widget build(BuildContext context) {
    final session = ref.watch(sessionProvider);
    final async = ref.watch(torqueCheckDetailProvider(widget.id));
    final s = async.value;
    return MinervaScaffold(
      title: s?.date == null ? 'Torque check' : DateFormat('d MMM y').format(s!.date!),
      showDrawer: false,
      actions: [
        if (s != null)
          PopupMenuButton<String>(
            onSelected: (v) => v == 'csv' ? _download(s) : _delete(s),
            itemBuilder: (_) => [
              const PopupMenuItem(value: 'csv', child: Text('Download CSV')),
              if (session.can('torque-checks.delete')) const PopupMenuItem(value: 'delete', child: Text('Delete')),
            ],
          ),
      ],
      body: RefreshIndicator(
        onRefresh: () => ref.refresh(torqueCheckDetailProvider(widget.id).future),
        child: AsyncBody<ServerTorqueSheet>(
          value: async,
          onRetry: () => ref.invalidate(torqueCheckDetailProvider(widget.id)),
          builder: (s) => _Grid(s),
        ),
      ),
    );
  }
}

class _Grid extends StatelessWidget {
  const _Grid(this.s);

  final ServerTorqueSheet s;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final readings = s.readings;
    final lastRow = s.lastRow;
    return ListView(padding: const EdgeInsets.all(16), children: [
      AppCard(
        title: 'Summary',
        description: [s.operatorName, 'Machine ${s.machineNumber}', 'Side ${s.side}', if (s.creelTypeName != null) s.creelTypeName!].join(' · '),
        child: Text('${readings.length} cells filled, up to row $lastRow', style: TextStyle(color: t.mutedForeground)),
      ),
      const SizedBox(height: 16),
      if (readings.isEmpty)
        const AppAlert(message: 'No readings recorded on this sheet yet.', destructive: false)
      else
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: DataTable(
            headingRowHeight: 36,
            dataRowMinHeight: 32,
            dataRowMaxHeight: 32,
            columnSpacing: 20,
            columns: [const DataColumn(label: Text('NO')), for (final c in kTorqueColumns) DataColumn(label: Text(c), numeric: true)],
            rows: [
              for (var row = 1; row <= lastRow; row++)
                DataRow(cells: [
                  DataCell(Text('$row')),
                  for (final c in kTorqueColumns)
                    DataCell(_cell(t, readings['$row$c'])),
                ]),
            ],
          ),
        ),
    ]);
  }

  Widget _cell(TokenSet t, TorqueReading? r) {
    if (r == null) return const Text('–');
    final flagged = r.note.isNotEmpty;
    return Tooltip(
      message: flagged ? r.note : '',
      child: Text(fmtNum(r.value), style: TextStyle(color: flagged ? t.destructive : null, fontWeight: flagged ? FontWeight.w700 : null)),
    );
  }
}
