import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/api/api_client.dart';
import '../../core/api/api_exception.dart';
import '../../core/auth/auth_controller.dart';
import '../../core/theme/app_theme.dart';
import '../../core/ui/app_alert.dart';
import '../../core/ui/app_badge.dart';
import '../../core/ui/app_button.dart';
import '../../core/ui/app_card.dart';
import '../../core/ui/app_select.dart';
import '../../core/ui/app_text_field.dart';
import '../../core/ui/async_body.dart';
import '../../core/ui/form_sheet.dart';
import '../settings/settings_shell.dart' show showToast;
import '../shared/minerva_scaffold.dart';
import 'machine_models.dart';

final machineTypesProvider = FutureProvider.autoDispose<List<MachineType>>((ref) async {
  try {
    final res = await ref.watch(dioProvider).get('/machine-types');
    return [for (final j in res.data as List) MachineType.fromJson(Map<String, dynamic>.from(j as Map))];
  } catch (e) {
    throw ApiException.from(e);
  }
});

final machineDefinitionsProvider = FutureProvider.autoDispose<List<MachineDefinition>>((ref) async {
  try {
    final res = await ref.watch(dioProvider).get('/machine-definitions');
    return [for (final j in res.data as List) MachineDefinition.fromJson(Map<String, dynamic>.from(j as Map))];
  } catch (e) {
    throw ApiException.from(e);
  }
});

class MachineMaintenanceScreen extends ConsumerWidget {
  const MachineMaintenanceScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final canManage = ref.watch(sessionProvider).can('machine-maintenance.manage');
    return DefaultTabController(
      length: 2,
      child: Builder(builder: (context) {
        final tabs = DefaultTabController.of(context);
        return AnimatedBuilder(
          animation: tabs,
          builder: (context, _) => MinervaScaffold(
            title: 'Machine Maintenance',
            fab: canManage
                ? FloatingActionButton.extended(
                    onPressed: () => tabs.index == 0 ? _editType(context, ref, null) : _editDefinition(context, ref, null),
                    icon: const Icon(LucideIcons.plus),
                    label: Text(tabs.index == 0 ? 'Machine type' : 'Machine'),
                  )
                : null,
            body: Column(children: [
              const TabBar(tabs: [Tab(text: 'Machine types'), Tab(text: 'Machines')]),
              Expanded(
                child: TabBarView(children: [
                  _TypesTab(canManage: canManage),
                  _DefinitionsTab(canManage: canManage),
                ]),
              ),
            ]),
          ),
        );
      }),
    );
  }
}

class _TypesTab extends ConsumerWidget {
  const _TypesTab({required this.canManage});

  final bool canManage;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.tokens;
    return RefreshIndicator(
      onRefresh: () => ref.refresh(machineTypesProvider.future),
      child: AsyncBody<List<MachineType>>(
        value: ref.watch(machineTypesProvider),
        onRetry: () => ref.invalidate(machineTypesProvider),
        isEmpty: (d) => d.isEmpty,
        emptyMessage: 'No machine types defined.',
        builder: (types) => ListView.separated(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 96),
          itemCount: types.length,
          separatorBuilder: (_, _) => const SizedBox(height: 12),
          itemBuilder: (_, i) {
            final m = types[i];
            return AppCard(
              title: m.name,
              description: '${m.spindles} spindles · ${m.definitionCount} machine${m.definitionCount == 1 ? '' : 's'}',
              action: canManage
                  ? Row(mainAxisSize: MainAxisSize.min, children: [
                      IconButton(icon: const Icon(LucideIcons.pencil, size: 18), onPressed: () => _editType(context, ref, m)),
                      IconButton(icon: Icon(LucideIcons.trash2, size: 18, color: t.destructive), onPressed: () => _deleteType(context, ref, m)),
                    ])
                  : null,
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                if (m.rpmMin != null || m.rpmMax != null) _kv(context, 'RPM', '${m.rpmMin ?? '–'} – ${m.rpmMax ?? '–'}'),
                if (m.minRuntime != null || m.maxRuntime != null) _kv(context, 'Runtime (h)', '${m.minRuntime ?? '–'} – ${m.maxRuntime ?? '–'}'),
                if (m.description != null && m.description!.isNotEmpty) _kv(context, 'Notes', m.description!),
              ]),
            );
          },
        ),
      ),
    );
  }
}

class _DefinitionsTab extends ConsumerWidget {
  const _DefinitionsTab({required this.canManage});

  final bool canManage;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.tokens;
    return RefreshIndicator(
      onRefresh: () => ref.refresh(machineDefinitionsProvider.future),
      child: AsyncBody<List<MachineDefinition>>(
        value: ref.watch(machineDefinitionsProvider),
        onRetry: () => ref.invalidate(machineDefinitionsProvider),
        isEmpty: (d) => d.isEmpty,
        emptyMessage: 'No machines defined.',
        builder: (defs) => ListView.separated(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 96),
          itemCount: defs.length,
          separatorBuilder: (_, _) => const SizedBox(height: 12),
          itemBuilder: (_, i) {
            final d = defs[i];
            return AppCard(
              title: 'Machine ${d.number}',
              description: d.typeName,
              action: Row(mainAxisSize: MainAxisSize.min, children: [
                AppBadge(d.active ? 'Active' : 'Inactive', variant: d.active ? AppBadgeVariant.success : AppBadgeVariant.secondary),
                if (canManage) ...[
                  IconButton(icon: const Icon(LucideIcons.pencil, size: 18), onPressed: () => _editDefinition(context, ref, d)),
                  IconButton(icon: Icon(LucideIcons.trash2, size: 18, color: t.destructive), onPressed: () => _deleteDefinition(context, ref, d)),
                ],
              ]),
              child: d.notes == null || d.notes!.isEmpty ? const SizedBox.shrink() : _kv(context, 'Notes', d.notes!),
            );
          },
        ),
      ),
    );
  }
}

Widget _kv(BuildContext context, String k, String v) => Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        SizedBox(width: 96, child: Text(k, style: TextStyle(fontSize: 13, color: context.tokens.mutedForeground))),
        Expanded(child: Text(v, style: const TextStyle(fontSize: 13))),
      ]),
    );

// ── Actions ───────────────────────────────────────────────────────────────────

Future<void> _editType(BuildContext context, WidgetRef ref, MachineType? existing) async {
  final saved = await showFormSheet<bool>(
    context,
    title: existing == null ? 'New machine type' : 'Edit machine type',
    builder: (_) => _TypeForm(existing: existing),
  );
  if (saved == true) ref.invalidate(machineTypesProvider);
}

Future<void> _deleteType(BuildContext context, WidgetRef ref, MachineType m) async {
  if (!await confirmDialog(context, title: 'Delete ${m.name}?', message: 'This cannot be undone.', confirmLabel: 'Delete', destructive: true)) return;
  try {
    await ref.read(dioProvider).delete('/machine-types/${m.id}');
    ref.invalidate(machineTypesProvider);
  } catch (e) {
    if (context.mounted) showToast(context, ApiException.from(e).message);
  }
}

Future<void> _editDefinition(BuildContext context, WidgetRef ref, MachineDefinition? existing) async {
  final types = await ref.read(machineTypesProvider.future).catchError((_) => <MachineType>[]);
  if (!context.mounted) return;
  if (types.isEmpty) {
    showToast(context, 'Create a machine type first.');
    return;
  }
  final saved = await showFormSheet<bool>(
    context,
    title: existing == null ? 'New machine' : 'Edit machine',
    builder: (_) => _DefinitionForm(existing: existing, types: types),
  );
  if (saved == true) {
    ref.invalidate(machineDefinitionsProvider);
    ref.invalidate(machineTypesProvider);
  }
}

Future<void> _deleteDefinition(BuildContext context, WidgetRef ref, MachineDefinition d) async {
  if (!await confirmDialog(context, title: 'Delete machine ${d.number}?', message: 'This cannot be undone.', confirmLabel: 'Delete', destructive: true)) return;
  try {
    await ref.read(dioProvider).delete('/machine-definitions/${d.id}');
    ref.invalidate(machineDefinitionsProvider);
    ref.invalidate(machineTypesProvider);
  } catch (e) {
    if (context.mounted) showToast(context, ApiException.from(e).message);
  }
}

// ── Forms ─────────────────────────────────────────────────────────────────────

class _TypeForm extends ConsumerStatefulWidget {
  const _TypeForm({this.existing});

  final MachineType? existing;

  @override
  ConsumerState<_TypeForm> createState() => _TypeFormState();
}

class _TypeFormState extends ConsumerState<_TypeForm> {
  late final _name = TextEditingController(text: widget.existing?.name);
  late final _spindles = TextEditingController(text: widget.existing?.spindles.toString());
  late final _rpmMin = TextEditingController(text: widget.existing?.rpmMin?.toString());
  late final _rpmMax = TextEditingController(text: widget.existing?.rpmMax?.toString());
  late final _minRun = TextEditingController(text: widget.existing?.minRuntime?.toString());
  late final _maxRun = TextEditingController(text: widget.existing?.maxRuntime?.toString());
  late final _desc = TextEditingController(text: widget.existing?.description);
  bool _busy = false;
  ApiException? _error;

  num? _num(TextEditingController c) => c.text.trim().isEmpty ? null : num.tryParse(c.text.trim());

  Future<void> _save() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    final body = {
      'type_name': _name.text.trim(),
      'total_spindles': _num(_spindles),
      'rpm_min': _num(_rpmMin),
      'rpm_max': _num(_rpmMax),
      'min_runtime_hours': _num(_minRun),
      'max_runtime_hours': _num(_maxRun),
      'description': _desc.text.trim().isEmpty ? null : _desc.text.trim(),
    };
    try {
      final dio = ref.read(dioProvider);
      widget.existing == null ? await dio.post('/machine-types', data: body) : await dio.patch('/machine-types/${widget.existing!.id}', data: body);
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
        AppTextField(label: 'Type name', controller: _name, error: _error?.field('type_name')),
        const SizedBox(height: 12),
        AppTextField(label: 'Total spindles', controller: _spindles, keyboardType: TextInputType.number, error: _error?.field('total_spindles')),
        const SizedBox(height: 12),
        Row(children: [
          Expanded(child: AppTextField(label: 'RPM min', controller: _rpmMin, keyboardType: TextInputType.number, error: _error?.field('rpm_min'))),
          const SizedBox(width: 12),
          Expanded(child: AppTextField(label: 'RPM max', controller: _rpmMax, keyboardType: TextInputType.number, error: _error?.field('rpm_max'))),
        ]),
        const SizedBox(height: 12),
        Row(children: [
          Expanded(child: AppTextField(label: 'Min runtime (h)', controller: _minRun, keyboardType: const TextInputType.numberWithOptions(decimal: true), error: _error?.field('min_runtime_hours'))),
          const SizedBox(width: 12),
          Expanded(child: AppTextField(label: 'Max runtime (h)', controller: _maxRun, keyboardType: const TextInputType.numberWithOptions(decimal: true), error: _error?.field('max_runtime_hours'))),
        ]),
        const SizedBox(height: 12),
        AppTextField(label: 'Description', controller: _desc, maxLines: 2, error: _error?.field('description')),
        const SizedBox(height: 16),
        AppButton(label: 'Save', expand: true, loading: _busy, onPressed: _save),
      ]);
}

class _DefinitionForm extends ConsumerStatefulWidget {
  const _DefinitionForm({this.existing, required this.types});

  final MachineDefinition? existing;
  final List<MachineType> types;

  @override
  ConsumerState<_DefinitionForm> createState() => _DefinitionFormState();
}

class _DefinitionFormState extends ConsumerState<_DefinitionForm> {
  late final _number = TextEditingController(text: widget.existing?.number);
  late final _notes = TextEditingController(text: widget.existing?.notes);
  late int? _typeId = widget.existing?.typeId;
  late bool _active = widget.existing?.active ?? true;
  bool _busy = false;
  ApiException? _error;

  Future<void> _save() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    final body = {
      'machine_number': _number.text.trim(),
      'machine_type_id': _typeId,
      'is_active': _active,
      'notes': _notes.text.trim().isEmpty ? null : _notes.text.trim(),
    };
    try {
      final dio = ref.read(dioProvider);
      widget.existing == null ? await dio.post('/machine-definitions', data: body) : await dio.patch('/machine-definitions/${widget.existing!.id}', data: body);
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
        AppTextField(label: 'Machine number', controller: _number, error: _error?.field('machine_number')),
        const SizedBox(height: 12),
        AppSelect<int>(
          label: 'Machine type',
          value: _typeId,
          items: {for (final t in widget.types) t.id: t.name},
          onChanged: (v) => setState(() => _typeId = v),
          error: _error?.field('machine_type_id'),
        ),
        const SizedBox(height: 12),
        SwitchListTile(contentPadding: EdgeInsets.zero, title: const Text('Active'), value: _active, onChanged: (v) => setState(() => _active = v)),
        AppTextField(label: 'Notes', controller: _notes, maxLines: 2, error: _error?.field('notes')),
        const SizedBox(height: 16),
        AppButton(label: 'Save', expand: true, loading: _busy, onPressed: _save),
      ]);
}
