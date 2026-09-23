import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/api/api_client.dart';
import '../../core/api/api_exception.dart';
import '../../core/auth/auth_controller.dart';
import '../../core/theme/app_theme.dart';
import '../../core/ui/app_alert.dart';
import '../../core/ui/app_button.dart';
import '../../core/ui/app_card.dart';
import '../../core/ui/app_text_field.dart';
import '../../core/ui/async_body.dart';
import '../../core/ui/form_sheet.dart';
import '../settings/settings_shell.dart' show showToast;
import '../shared/minerva_scaffold.dart';
import 'creel_type_models.dart';

/// "Creel Type Settings": the torque standard (min/max) for each creel type, used by Torque Check.
class CreelTypeSettingsScreen extends ConsumerWidget {
  const CreelTypeSettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final canManage = ref.watch(sessionProvider).can('creel-types.manage');
    return MinervaScaffold(
      title: 'Creel Type Settings',
      fab: canManage ? FloatingActionButton.extended(onPressed: () => _edit(context, ref, null), icon: const Icon(LucideIcons.plus), label: const Text('Creel type')) : null,
      body: RefreshIndicator(
        onRefresh: () => ref.refresh(creelTypesProvider.future),
        child: AsyncBody<List<CreelType>>(
          value: ref.watch(creelTypesProvider),
          onRetry: () => ref.invalidate(creelTypesProvider),
          isEmpty: (d) => d.isEmpty,
          emptyMessage: canManage ? 'No creel types yet. Add one to start recording torque checks.' : 'No creel types have been set up yet.',
          builder: (types) => ListView.separated(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 96),
            itemCount: types.length,
            separatorBuilder: (_, _) => const SizedBox(height: 12),
            itemBuilder: (_, i) {
              final type = types[i];
              return AppCard(
                title: type.name,
                description: '${type.sheetCount} sheet${type.sheetCount == 1 ? '' : 's'} recorded',
                action: canManage
                    ? Row(mainAxisSize: MainAxisSize.min, children: [
                        IconButton(icon: const Icon(LucideIcons.pencil, size: 18), onPressed: () => _edit(context, ref, type)),
                        IconButton(icon: Icon(LucideIcons.trash2, size: 18, color: context.tokens.destructive), onPressed: () => _delete(context, ref, type)),
                      ])
                    : null,
                child: Text('Torque range ${fmt(type.torqueMin)} – ${fmt(type.torqueMax)}', style: const TextStyle(fontWeight: FontWeight.w500)),
              );
            },
          ),
        ),
      ),
    );
  }
}

String fmt(double v) => v == v.roundToDouble() ? v.toInt().toString() : v.toString();

Future<void> _edit(BuildContext context, WidgetRef ref, CreelType? existing) async {
  final saved = await showFormSheet<bool>(context, title: existing == null ? 'New creel type' : 'Edit creel type', builder: (_) => _CreelTypeForm(existing: existing));
  if (saved == true) ref.invalidate(creelTypesProvider);
}

Future<void> _delete(BuildContext context, WidgetRef ref, CreelType type) async {
  if (!await confirmDialog(context, title: 'Delete ${type.name}?', message: 'This cannot be undone.', confirmLabel: 'Delete', destructive: true)) return;
  try {
    await ref.read(dioProvider).delete('/creel-types/${type.id}');
    ref.invalidate(creelTypesProvider);
  } catch (e) {
    if (context.mounted) showToast(context, ApiException.from(e).message);
  }
}

class _CreelTypeForm extends ConsumerStatefulWidget {
  const _CreelTypeForm({this.existing});

  final CreelType? existing;

  @override
  ConsumerState<_CreelTypeForm> createState() => _CreelTypeFormState();
}

class _CreelTypeFormState extends ConsumerState<_CreelTypeForm> {
  late final _name = TextEditingController(text: widget.existing?.name);
  late final _min = TextEditingController(text: widget.existing == null ? '' : fmt(widget.existing!.torqueMin));
  late final _max = TextEditingController(text: widget.existing == null ? '' : fmt(widget.existing!.torqueMax));
  bool _busy = false;
  ApiException? _error;

  Future<void> _save() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    final body = {'name': _name.text.trim(), 'torque_min': double.tryParse(_min.text.trim()), 'torque_max': double.tryParse(_max.text.trim())};
    try {
      final dio = ref.read(dioProvider);
      widget.existing == null ? await dio.post('/creel-types', data: body) : await dio.patch('/creel-types/${widget.existing!.id}', data: body);
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
        AppTextField(label: 'Name', controller: _name, error: _error?.field('name')),
        const SizedBox(height: 12),
        Row(children: [
          Expanded(child: AppTextField(label: 'Torque min', controller: _min, keyboardType: const TextInputType.numberWithOptions(decimal: true), error: _error?.field('torque_min'))),
          const SizedBox(width: 12),
          Expanded(child: AppTextField(label: 'Torque max', controller: _max, keyboardType: const TextInputType.numberWithOptions(decimal: true), error: _error?.field('torque_max'))),
        ]),
        const SizedBox(height: 16),
        AppButton(label: 'Save', expand: true, loading: _busy, onPressed: _save),
      ]);
}
