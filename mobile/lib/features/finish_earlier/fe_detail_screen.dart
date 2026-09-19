import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'dart:convert';

import '../../core/api/api_client.dart';
import '../../core/api/api_exception.dart';
import '../../core/api/paged.dart';
import '../../core/auth/auth_controller.dart';
import '../../core/files/file_opener.dart';
import '../../core/theme/app_theme.dart';
import '../../core/ui/app_alert.dart';
import '../../core/ui/app_button.dart';
import '../../core/ui/app_card.dart';
import '../../core/ui/app_text_field.dart';
import '../../core/ui/async_body.dart';
import '../../core/ui/form_sheet.dart';
import '../settings/settings_shell.dart' show showToast;
import '../shared/minerva_scaffold.dart';
import '../tension/tension_models.dart';
import 'entries_editor.dart';
import 'fe_models.dart';
import 'fe_records_screen.dart';

final feRecordProvider = FutureProvider.autoDispose.family<FeRecord, int>((ref, id) async {
  try {
    final res = await ref.watch(dioProvider).get('/finish-earlier/$id');
    return FeRecord(asMap((res.data as Map)['data']));
  } catch (e) {
    throw ApiException.from(e);
  }
});

class FeDetailScreen extends ConsumerWidget {
  const FeDetailScreen({super.key, required this.id});

  final int id;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(sessionProvider);
    final async = ref.watch(feRecordProvider(id));
    final r = async.value;

    Future<void> guard(Future<void> Function() action) async {
      try {
        await action();
      } catch (e) {
        if (context.mounted) showToast(context, ApiException.from(e).message);
      }
    }

    Future<void> csv(FeRecord r) => guard(() async {
          final res = await ref.read(dioProvider).get('/finish-earlier/${Uri.encodeComponent(r.productionOrder)}/download');
          final d = asMap(res.data);
          if (d['metadata'] == null) throw ApiException('Session not found');
          final entries = [for (final e in (d['entries'] as List? ?? const [])) asMap(e)];
          await ref.read(fileOpenerProvider).open('FinishEarlier_${r.productionOrder}.csv', utf8.encode(feCsv(asMap(d['metadata']), entries)));
        });

    Future<void> pdf(FeRecord r) => guard(() => ref.read(fileDownloaderProvider).download('/finish-earlier/${Uri.encodeComponent(r.productionOrder)}/pdf', 'FinishEarlier_${r.productionOrder}.pdf'));

    Future<void> editMeta(FeRecord r) async {
      final saved = await showFormSheet<bool>(context, title: 'Edit record', builder: (_) => _MetaForm(r));
      if (saved == true) {
        ref.invalidate(feRecordProvider(r.id));
        ref.invalidate(pagedProvider);
      }
    }

    Future<void> delete(FeRecord r) async {
      if (!await confirmDialog(context, title: 'Delete record?', message: 'PO ${r.productionOrder} and all its entries will be permanently deleted.', confirmLabel: 'Delete', destructive: true)) return;
      await guard(() async {
        await ref.read(dioProvider).delete('/finish-earlier/${r.id}');
        ref.invalidate(pagedProvider);
        if (context.mounted) context.go('/finish-earlier');
      });
    }

    return MinervaScaffold(
      title: r == null ? 'Finish earlier' : 'PO ${r.productionOrder}',
      showDrawer: false,
      actions: [
        if (r != null)
          PopupMenuButton<String>(
            onSelected: (v) => switch (v) {
              'csv' => csv(r),
              'pdf' => pdf(r),
              'meta' => editMeta(r),
              'entries' => context.push('/finish-earlier/${r.id}/entries'),
              _ => delete(r),
            },
            itemBuilder: (_) => [
              const PopupMenuItem(value: 'csv', child: Text('Download CSV')),
              const PopupMenuItem(value: 'pdf', child: Text('Download PDF')),
              if (session.can('finish-earlier.edit')) ...const [PopupMenuItem(value: 'meta', child: Text('Edit record')), PopupMenuItem(value: 'entries', child: Text('Edit entries'))],
              if (session.can('finish-earlier.delete')) const PopupMenuItem(value: 'delete', child: Text('Delete')),
            ],
          ),
      ],
      body: RefreshIndicator(
        onRefresh: () => ref.refresh(feRecordProvider(id).future),
        child: AsyncBody<FeRecord>(value: async, onRetry: () => ref.invalidate(feRecordProvider(id)), builder: (r) => _Body(r)),
      ),
    );
  }
}

class _Body extends StatelessWidget {
  const _Body(this.r);

  final FeRecord r;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    Widget kv(String k, String v, {Color? color}) => Padding(
          padding: const EdgeInsets.symmetric(vertical: 3),
          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            SizedBox(width: 130, child: Text(k, style: TextStyle(fontSize: 13, color: t.mutedForeground))),
            Expanded(child: Text(v.isEmpty ? '—' : v, style: TextStyle(fontWeight: FontWeight.w500, color: color))),
          ]),
        );
    final entries = r.entries;
    return ListView(padding: const EdgeInsets.all(16), children: [
      AppCard(
        title: 'Cable Finish Earlier Summary',
        description: r.createdAt == null ? null : DateFormat('d MMM y, HH:mm').format(r.createdAt!),
        child: Column(children: [
          kv('Production order', r.productionOrder),
          kv('Material description', r.meta('style')),
          kv('Machine number', r.meta('machine_number')),
          kv('Shift group', r.meta('shift_group')),
          kv('Roll construction', r.meta('roll_construction')),
          kv('Finish-earlier bobbins', '${r.total}'),
          kv('Average meters finish', fmtAvg(r.average), color: Colors.green.shade600),
        ]),
      ),
      const SizedBox(height: 16),
      AppCard(
        title: 'Entries (${entries.length})',
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
        child: entries.isEmpty
            ? Padding(padding: const EdgeInsets.only(bottom: 8), child: Text('No entries recorded.', style: TextStyle(color: t.mutedForeground)))
            : Column(children: [
                Row(children: [
                  for (final (flex, h) in const [(1, '#'), (2, 'Side'), (2, 'Row'), (2, 'Col'), (3, 'Meters')]) Expanded(flex: flex, child: Text(h, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: t.mutedForeground))),
                ]),
                const Divider(),
                for (var i = 0; i < entries.length; i++)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 5),
                    child: Row(children: [
                      Expanded(flex: 1, child: Text('${i + 1}', style: TextStyle(fontSize: 13, color: t.mutedForeground))),
                      Expanded(flex: 2, child: Text(entries[i].side, style: const TextStyle(fontSize: 13))),
                      Expanded(flex: 2, child: Text(entries[i].row, style: const TextStyle(fontSize: 13))),
                      Expanded(flex: 2, child: Text(entries[i].column, style: const TextStyle(fontSize: 13))),
                      Expanded(flex: 3, child: Text(entries[i].meters, style: const TextStyle(fontSize: 13))),
                    ]),
                  ),
              ]),
      ),
    ]);
  }
}

class _MetaForm extends ConsumerStatefulWidget {
  const _MetaForm(this.r);

  final FeRecord r;

  @override
  ConsumerState<_MetaForm> createState() => _MetaFormState();
}

class _MetaFormState extends ConsumerState<_MetaForm> {
  late final _c = {for (final f in feMetaFields) f.$1: TextEditingController(text: widget.r.meta(f.$1))};
  bool _busy = false;
  ApiException? _error;

  Future<void> _save() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await ref.read(dioProvider).patch('/finish-earlier/${widget.r.id}', data: {for (final f in feMetaFields) f.$1: _c[f.$1]!.text.trim()});
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
        for (final f in feMetaFields) Padding(padding: const EdgeInsets.only(bottom: 12), child: AppTextField(label: f.$2, controller: _c[f.$1], error: _error?.field(f.$1))),
        AppButton(label: 'Save', loading: _busy, onPressed: _save),
      ]);
}

/// Full-screen editor for a record's entries (web "Edit Entries").
class FeEntriesScreen extends ConsumerWidget {
  const FeEntriesScreen({super.key, required this.id});

  final int id;

  @override
  Widget build(BuildContext context, WidgetRef ref) => MinervaScaffold(
        title: 'Edit entries',
        showDrawer: false,
        body: AsyncBody<FeRecord>(value: ref.watch(feRecordProvider(id)), onRetry: () => ref.invalidate(feRecordProvider(id)), builder: (r) => _EntriesForm(r)),
      );
}

class _EntriesForm extends ConsumerStatefulWidget {
  const _EntriesForm(this.r);

  final FeRecord r;

  @override
  ConsumerState<_EntriesForm> createState() => _EntriesFormState();
}

class _EntriesFormState extends ConsumerState<_EntriesForm> {
  late final List<FeEntry> _entries = widget.r.entries;
  bool _busy = false;
  bool _showErrors = false;
  ApiException? _error;

  Future<void> _save() async {
    if (_entries.any((e) => e.error != null)) {
      setState(() => _showErrors = true);
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await ref.read(dioProvider).patch('/finish-earlier/${widget.r.id}', data: {'entries': [for (final e in _entries) e.toJson()]});
      ref.invalidate(feRecordProvider(widget.r.id));
      ref.invalidate(pagedProvider);
      if (mounted) context.pop();
    } catch (e) {
      if (mounted) setState(() => _error = ApiException.from(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => ListView(padding: const EdgeInsets.all(16), children: [
        if (_error != null) ...[AppAlert(message: _error!.message), const SizedBox(height: 12)],
        Text('${_entries.length} entries', style: TextStyle(color: context.tokens.mutedForeground)),
        const SizedBox(height: 8),
        EntriesEditor(entries: _entries, showErrors: _showErrors, onChanged: () => setState(() {})),
        const SizedBox(height: 16),
        AppButton(label: 'Save changes', expand: true, loading: _busy, onPressed: _save),
        const SizedBox(height: 24),
      ]);
}
