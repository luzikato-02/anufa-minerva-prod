import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/api/paged.dart';
import '../../core/theme/app_theme.dart';
import '../../core/ui/app_badge.dart';
import '../../core/ui/app_button.dart';
import '../../core/ui/app_card.dart';
import '../../core/ui/app_select.dart';
import '../../core/ui/form_sheet.dart';
import '../../core/ui/paged_list.dart';
import '../shared/minerva_scaffold.dart';

const _events = ['login', 'logout', 'created', 'updated', 'deleted', 'role_assignment', 'status_change'];

class ActivityLogScreen extends ConsumerStatefulWidget {
  const ActivityLogScreen({super.key});

  @override
  ConsumerState<ActivityLogScreen> createState() => _ActivityLogScreenState();
}

class _ActivityLogScreenState extends ConsumerState<ActivityLogScreen> {
  String _event = '';
  DateTimeRange? _range;

  static final _ymd = DateFormat('yyyy-MM-dd');

  PagedQuery get _query => PagedQuery('/activity-log', {
        if (_event.isNotEmpty) 'event': _event,
        if (_range != null) 'date_from': _ymd.format(_range!.start),
        if (_range != null) 'date_to': _ymd.format(_range!.end),
      });

  Future<void> _openFilters() async {
    var event = _event;
    var range = _range;
    final applied = await showFormSheet<bool>(
      context,
      title: 'Filter activity',
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheet) => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          AppSelect<String>(
            label: 'Event',
            value: event.isEmpty ? '' : event,
            items: {'': 'All events', for (final e in _events) e: e.replaceAll('_', ' ')},
            onChanged: (v) => setSheet(() => event = v ?? ''),
          ),
          const SizedBox(height: 12),
          AppButton(
            variant: AppButtonVariant.outline,
            icon: LucideIcons.calendar,
            label: range == null ? 'Any date' : '${_ymd.format(range!.start)} → ${_ymd.format(range!.end)}',
            onPressed: () async {
              final r = await showDateRangePicker(context: ctx, firstDate: DateTime(2020), lastDate: DateTime.now().add(const Duration(days: 1)), initialDateRange: range);
              if (r != null) setSheet(() => range = r);
            },
          ),
          const SizedBox(height: 16),
          Row(children: [
            Expanded(
              child: AppButton(label: 'Clear', variant: AppButtonVariant.outline, onPressed: () {
                event = '';
                range = null;
                Navigator.pop(ctx, true);
              }),
            ),
            const SizedBox(width: 12),
            Expanded(child: AppButton(label: 'Apply', onPressed: () => Navigator.pop(ctx, true))),
          ]),
        ]),
      ),
    );
    if (applied == true) {
      setState(() {
        _event = event;
        _range = range;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final active = _event.isNotEmpty || _range != null;
    return MinervaScaffold(
      title: 'Activity Log',
      actions: [
        IconButton(
          tooltip: 'Filter',
          icon: Badge(isLabelVisible: active, smallSize: 8, child: const Icon(LucideIcons.listFilter)),
          onPressed: _openFilters,
        ),
      ],
      body: PagedList(
        query: _query,
        emptyMessage: 'No activity matches these filters.',
        itemBuilder: (ctx, a) => _ActivityCard(a),
      ),
    );
  }
}

class _ActivityCard extends StatelessWidget {
  const _ActivityCard(this.a);

  final Map<String, dynamic> a;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final causer = (a['causer'] as Map?)?['name'] as String? ?? 'System';
    final event = a['event'] as String?;
    final when = DateTime.tryParse('${a['created_at']}')?.toLocal();
    final variant = switch (event) {
      'deleted' => AppBadgeVariant.destructive,
      'created' => AppBadgeVariant.success,
      'login' || 'logout' => AppBadgeVariant.secondary,
      _ => AppBadgeVariant.outline,
    };
    return AppCard(
      padding: const EdgeInsets.all(12),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Wrap(
          alignment: WrapAlignment.spaceBetween,
          crossAxisAlignment: WrapCrossAlignment.center,
          spacing: 8,
          runSpacing: 4,
          children: [
            if (event != null) AppBadge(event.replaceAll('_', ' '), variant: variant),
            if (when != null) Text(DateFormat('d MMM y, HH:mm').format(when), style: TextStyle(fontSize: 12, color: t.mutedForeground)),
          ],
        ),
        const SizedBox(height: 8),
        Text('${a['description'] ?? ''}', style: const TextStyle(fontSize: 14)),
        const SizedBox(height: 2),
        Text('by $causer', style: TextStyle(fontSize: 12, color: t.mutedForeground)),
      ]),
    );
  }
}
