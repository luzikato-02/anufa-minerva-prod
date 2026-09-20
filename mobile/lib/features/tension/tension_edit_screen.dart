import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/api_client.dart';
import '../../core/api/api_exception.dart';
import '../../core/api/paged.dart';
import '../../core/ui/app_alert.dart';
import '../../core/ui/app_button.dart';
import '../../core/ui/app_card.dart';
import '../../core/ui/app_text_field.dart';
import '../../core/ui/async_body.dart';
import '../shared/minerva_scaffold.dart';
import 'tension_models.dart';
import 'tension_providers.dart';

typedef _Field = (String key, String label, bool inMetadata);

const _twistingFields = <_Field>[
  ('item_number', 'Item number', true),
  ('yarn_code', 'Yarn material code', true),
  ('operator', 'Operator', true),
  ('machineNumber', 'Machine number', false),
  ('dtexNumber', 'Density (Dtex)', false),
  ('tpm', 'Table twist (TPM)', false),
  ('rpm', 'Cycle speed (RPM)', false),
  ('specTens', 'Spec tension (cN)', false),
  ('tensPlus', 'Tension deviation (cN)', false),
  ('metersCheck', 'Meters check (m)', false),
];

const _weavingFields = <_Field>[
  ('operator', 'Operator', true),
  ('item_number', 'Item number', true),
  ('item_description', 'Item description', true),
  ('machineNumber', 'Machine number', false),
  ('productionOrder', 'Production order', false),
  ('baleNumber', 'Bale number', false),
  ('colorCode', 'Color code', false),
  ('specTens', 'Spec tension (cN)', false),
  ('tensPlus', 'Tension deviation (cN)', false),
  ('metersCheck', 'Meters check (m)', false),
];

/// Full-screen edit of header fields, measurements and problem descriptions
/// (web "Edit record" dialog). Saves with PATCH like the web does.
class TensionEditScreen extends ConsumerWidget {
  const TensionEditScreen({super.key, required this.id});

  final int id;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return MinervaScaffold(
      title: 'Edit record #$id',
      showDrawer: false,
      body: AsyncBody<TensionRecord>(
        value: ref.watch(tensionRecordProvider(id)),
        onRetry: () => ref.invalidate(tensionRecordProvider(id)),
        builder: (r) => _EditForm(r),
      ),
    );
  }
}

class _EditForm extends ConsumerStatefulWidget {
  const _EditForm(this.record);

  final TensionRecord record;

  @override
  ConsumerState<_EditForm> createState() => _EditFormState();
}

class _EditFormState extends ConsumerState<_EditForm> {
  late final List<_Field> _fields = widget.record.isWeaving ? _weavingFields : _twistingFields;
  late final Map<String, TextEditingController> _header = {
    for (final f in _fields) f.$1: TextEditingController(text: '${(f.$3 ? widget.record.metadata : widget.record.form)[f.$1] ?? ''}'),
  };
  late final List<TensionPoint> _points = widget.record.points;
  late final List<(TextEditingController, TextEditingController)> _values = [
    for (final p in _points) (TextEditingController(text: fmtNum(p.max)), TextEditingController(text: fmtNum(p.min))),
  ];
  late final List<TextEditingController> _problemText = [for (final p in widget.record.problems) TextEditingController(text: '${p['description'] ?? ''}')];
  bool _busy = false;
  ApiException? _error;
  bool _saved = false;
  late final List<String> _initial;

  Iterable<TextEditingController> get _all => [..._header.values, ..._problemText, for (final v in _values) ...[v.$1, v.$2]];
  List<TextEditingController> get _controllers => _all.toList();

  bool get _dirty {
    if (_saved) return false;
    final now = _controllers;
    for (var i = 0; i < now.length; i++) {
      if (now[i].text != _initial[i]) return true;
    }
    return false;
  }

  Future<void> _confirmLeave() async {
    final leave = await confirmDialog(context, title: 'Discard changes?', message: 'You have edits on this record that are not saved.', confirmLabel: 'Discard', destructive: true);
    if (leave && mounted) context.pop();
  }

  @override
  void initState() {
    super.initState();
    _initial = _controllers.map((c) => c.text).toList(); // before any typing; late fields are lazy
  }

  @override
  void dispose() {
    for (final c in [..._header.values, ..._problemText, for (final v in _values) ...[v.$1, v.$2]]) {
      c.dispose();
    }
    super.dispose();
  }

  dynamic _coerce(String s) => num.tryParse(s.trim()) ?? s.trim();

  Future<void> _save() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    final r = widget.record;
    // Deep copy so unedited structure (extra keys, resolution data) survives untouched.
    final metadata = Map<String, dynamic>.from(jsonDecode(jsonEncode(r.metadata)) as Map);
    final form = Map<String, dynamic>.from(jsonDecode(jsonEncode(r.form)) as Map);
    for (final f in _fields) {
      final text = _header[f.$1]!.text.trim();
      (f.$3 ? metadata : form)[f.$1] = f.$3 ? text : (text.isEmpty ? '' : _coerce(text));
    }
    if (form['machineNumber'] != null) metadata['machine_number'] = '${form['machineNumber']}';

    final measurement = jsonDecode(jsonEncode(r.raw['measurement_data'] is Map ? r.raw['measurement_data'] : {})) as Map<String, dynamic>;
    for (var i = 0; i < _points.length; i++) {
      final value = {'max': _coerce(_values[i].$1.text), 'min': _coerce(_values[i].$2.text)};
      var node = measurement;
      final key = _points[i].key;
      for (final k in key.take(key.length - 1)) {
        node = node[k] as Map<String, dynamic>; // already a deep copy
      }
      node[key.last] = value;
    }

    final problems = [
      for (var i = 0; i < r.problems.length; i++) {...r.problems[i], 'description': _problemText[i].text.trim()},
    ];

    try {
      await ref.read(dioProvider).patch('/tension-records/${r.id}', data: {'metadata': metadata, 'form_data': form, 'measurement_data': measurement, 'problems': problems});
      ref.invalidate(pagedProvider);
      ref.invalidate(tensionRecordProvider(r.id));
      _saved = true;
      if (mounted) context.pop();
    } catch (e) {
      if (mounted) setState(() => _error = ApiException.from(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    // Dirtiness is read when Back is pressed, so no rebuild is needed as the user types.
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (didPop) return;
        if (_dirty) {
          _confirmLeave();
        } else {
          context.pop();
        }
      },
      child: _form(),
    );
  }

  Widget _form() {
    return ListView(padding: const EdgeInsets.all(16), children: [
      if (_error != null) ...[AppAlert(message: _error!.message), const SizedBox(height: 12)],
      AppCard(
        title: 'Details',
        child: Column(children: [
          for (final f in _fields) Padding(padding: const EdgeInsets.only(bottom: 12), child: AppTextField(label: f.$2, controller: _header[f.$1])),
        ]),
      ),
      if (_points.isNotEmpty) ...[
        const SizedBox(height: 16),
        AppCard(
          title: 'Measurements',
          child: Column(children: [
            for (var i = 0; i < _points.length; i++)
              Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
                  Expanded(flex: 3, child: Padding(padding: const EdgeInsets.only(bottom: 12), child: Text(_points[i].label, style: const TextStyle(fontWeight: FontWeight.w500)))),
                  Expanded(flex: 2, child: AppTextField(label: i == 0 ? 'Max' : null, controller: _values[i].$1, keyboardType: const TextInputType.numberWithOptions(decimal: true))),
                  const SizedBox(width: 8),
                  Expanded(flex: 2, child: AppTextField(label: i == 0 ? 'Min' : null, controller: _values[i].$2, keyboardType: const TextInputType.numberWithOptions(decimal: true))),
                ]),
              ),
          ]),
        ),
      ],
      if (_problemText.isNotEmpty) ...[
        const SizedBox(height: 16),
        AppCard(
          title: 'Problem reports',
          child: Column(children: [
            for (var i = 0; i < _problemText.length; i++)
              Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: AppTextField(label: widget.record.problems[i]['spindleNumber'] != null ? 'Spindle ${widget.record.problems[i]['spindleNumber']}' : '${widget.record.problems[i]['position'] ?? 'Problem'}', controller: _problemText[i], maxLines: 2),
              ),
          ]),
        ),
      ],
      const SizedBox(height: 16),
      AppButton(label: 'Save changes', expand: true, loading: _busy, onPressed: _save),
      const SizedBox(height: 24),
    ]);
  }
}
