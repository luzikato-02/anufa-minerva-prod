import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/api/api_client.dart';
import '../../core/api/api_exception.dart';
import '../../core/api/paged.dart';
import '../../core/files/file_pick.dart';
import '../../core/theme/app_theme.dart';
import '../../core/theme/tokens.g.dart' show TokenSet;
import '../../core/ui/app_alert.dart';
import '../../core/ui/app_button.dart';
import '../../core/ui/app_card.dart';
import '../../core/ui/app_text_field.dart';
import '../shared/minerva_scaffold.dart';
import '../tension/tension_models.dart';
import 'entries_editor.dart';
import 'fe_models.dart';

enum _Stage { idle, scanning, review, submitting, done }

/// "Scan: Finish Earlier Form" — photograph or upload the paper form, review the OCR result, save.
/// Needs a connection (OCR runs on the server), so nothing here is queued offline.
class FeScanScreen extends ConsumerStatefulWidget {
  const FeScanScreen({super.key});

  @override
  ConsumerState<FeScanScreen> createState() => _FeScanScreenState();
}

class _FeScanScreenState extends ConsumerState<FeScanScreen> {
  _Stage _stage = _Stage.idle;
  PickedFile? _file;
  String? _error;
  bool _showErrors = false;
  CancelToken? _cancel;
  Timer? _tick;
  int _seconds = 0;

  final _meta = {for (final f in feMetaFields) f.$1: TextEditingController()};
  List<FeEntry> _entries = [];
  String _ocr = '';
  int? _savedId;

  @override
  void dispose() {
    _tick?.cancel();
    _cancel?.cancel();
    for (final c in _meta.values) {
      c.dispose();
    }
    super.dispose();
  }

  void _choose(PickedFile? f) {
    if (f == null) return;
    final problem = validateOcrUpload(f);
    setState(() {
      if (problem != null) {
        _error = problem;
      } else {
        _file = f;
        _error = null;
      }
    });
  }

  String get _progressText => _seconds < 4 ? 'Uploading the form…' : _seconds < 20 ? 'Reading the handwriting (OCR)…' : 'Extracting entries — big forms can take a minute or two…';

  Future<void> _extract() async {
    final f = _file;
    if (f == null) return;
    _cancel = CancelToken();
    setState(() {
      _stage = _Stage.scanning;
      _error = null;
      _seconds = 0;
    });
    _tick = Timer.periodic(const Duration(seconds: 1), (_) => setState(() => _seconds++));
    try {
      final res = await ref.read(dioProvider).post(
            '/finish-earlier-scan/extract',
            data: FormData.fromMap({'file': MultipartFile.fromBytes(f.bytes, filename: f.name, contentType: DioMediaType.parse(mimeTypeFor(f.name)))}),
            cancelToken: _cancel,
            options: Options(receiveTimeout: const Duration(minutes: 3), sendTimeout: const Duration(minutes: 2)),
          );
      final d = asMap(res.data);
      final meta = asMap(d['metadata']);
      for (final k in feMetaFields) {
        _meta[k.$1]!.text = '${meta[k.$1] ?? ''}'.trim();
      }
      _entries = [if (d['entries'] is List) for (final e in d['entries'] as List) FeEntry.fromJson(asMap(e))];
      _ocr = '${d['_ocr_text'] ?? ''}';
      if (mounted) setState(() => _stage = _Stage.review);
    } catch (e) {
      if (e is DioException && CancelToken.isCancel(e)) return;
      if (mounted) {
        setState(() {
          _error = ApiException.from(e).message;
          _stage = _Stage.idle;
        });
      }
    } finally {
      _tick?.cancel();
    }
  }

  List<String> get _problems => [
        for (final f in feMetaFields)
          if (_meta[f.$1]!.text.trim().isEmpty) '${f.$2} is required',
        if (_entries.isEmpty) 'Add at least one entry',
        if (_entries.any((e) => e.error != null)) 'Fix the highlighted entries',
      ];

  Future<void> _submit([String? resolution]) async {
    if (_problems.isNotEmpty) {
      setState(() {
        _showErrors = true;
        _error = _problems.join('. ');
      });
      return;
    }
    setState(() {
      _stage = _Stage.submitting;
      _error = null;
    });
    try {
      final res = await ref.read(dioProvider).post('/finish-earlier/submit-scan', data: {
        'metadata': {for (final f in feMetaFields) f.$1: _meta[f.$1]!.text.trim()},
        'entries': [for (final e in _entries) e.toJson()],
        'conflict_resolution': ?resolution,
      });
      ref.invalidate(pagedProvider);
      if (mounted) {
        setState(() {
          _savedId = (asMap(res.data)['id'] as num?)?.toInt();
          _stage = _Stage.done;
        });
      }
    } on DioException catch (e) {
      final data = asMap(e.response?.data);
      if (e.response?.statusCode == 409 && data['conflict'] == true) {
        if (mounted) setState(() => _stage = _Stage.review);
        await _askConflict(asMap(data['existing']));
      } else if (mounted) {
        setState(() {
          _error = ApiException.from(e).message;
          _stage = _Stage.review;
        });
      }
    }
  }

  Future<void> _askConflict(Map<String, dynamic> existing) async {
    final choice = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Record already exists', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600)),
        content: Text('A record for PO ${_meta['production_order']!.text.trim()} already exists with ${existing['entry_count'] ?? 0} entries. Merge adds these entries to it; Replace deletes the old record first.'),
        actionsOverflowButtonSpacing: 8,
        actions: [
          AppButton(label: 'Merge entries', onPressed: () => Navigator.pop(ctx, 'merge')),
          AppButton(label: 'Replace record', variant: AppButtonVariant.destructive, onPressed: () => Navigator.pop(ctx, 'replace')),
          AppButton(label: 'Cancel', variant: AppButtonVariant.outline, onPressed: () => Navigator.pop(ctx)),
        ],
      ),
    );
    if (choice != null) await _submit(choice);
  }

  void _reset() => setState(() {
        _stage = _Stage.idle;
        _file = null;
        _error = null;
        _showErrors = false;
        _entries = [];
        _ocr = '';
        _savedId = null;
        for (final c in _meta.values) {
          c.clear();
        }
      });

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    return MinervaScaffold(
      title: 'Scan Finish Earlier Form',
      body: ListView(padding: const EdgeInsets.all(16), children: [
        if (_error != null) ...[AppAlert(message: _error!), const SizedBox(height: 12)],
        switch (_stage) {
          _Stage.idle => _idle(t),
          _Stage.scanning => _scanning(),
          _Stage.review || _Stage.submitting => _review(t),
          _Stage.done => _done(),
        },
      ]),
    );
  }

  Widget _idle(TokenSet t) => AppCard(
        title: 'Scan a form',
        description: 'Photograph or upload a “Catatan Cable Finish Earlier” form to extract its data',
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          AppButton(label: 'Take photo', icon: LucideIcons.camera, onPressed: () async => _choose(await ref.read(takePhotoProvider)())),
          const SizedBox(height: 8),
          AppButton(label: 'Choose PDF or image', icon: LucideIcons.fileUp, variant: AppButtonVariant.outline, onPressed: () async => _choose(await ref.read(pickFileProvider)(kOcrExtensions))),
          const SizedBox(height: 4),
          Text('PDF, PNG, JPG, WEBP — up to 20 MB', textAlign: TextAlign.center, style: TextStyle(fontSize: 12, color: t.mutedForeground)),
          if (_file != null) ...[
            const SizedBox(height: 12),
            Row(children: [
              const Icon(LucideIcons.fileText, size: 16),
              const SizedBox(width: 6),
              Expanded(child: Text('${_file!.name} · ${(_file!.bytes.length / 1024).round()} KB', overflow: TextOverflow.ellipsis)),
            ]),
            const SizedBox(height: 12),
            AppButton(label: 'Extract data', onPressed: _extract),
          ],
        ]),
      );

  Widget _scanning() => AppCard(
        child: Column(children: [
          const SizedBox(height: 8),
          const CircularProgressIndicator(),
          const SizedBox(height: 16),
          Text(_progressText, textAlign: TextAlign.center),
          const SizedBox(height: 4),
          Text('${_seconds}s', style: TextStyle(color: context.tokens.mutedForeground)),
          const SizedBox(height: 12),
          AppButton(
            label: 'Cancel',
            variant: AppButtonVariant.outline,
            onPressed: () {
              _cancel?.cancel();
              _tick?.cancel();
              setState(() => _stage = _Stage.idle);
            },
          ),
        ]),
      );

  Widget _review(TokenSet t) {
    final busy = _stage == _Stage.submitting;
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      AppCard(
        title: 'Review extracted data',
        description: 'Handwriting can be misread. Check every field before saving.',
        child: Column(children: [
          for (final f in feMetaFields)
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: AppTextField(label: f.$2, controller: _meta[f.$1], error: _showErrors && _meta[f.$1]!.text.trim().isEmpty ? 'Required' : null),
            ),
        ]),
      ),
      const SizedBox(height: 16),
      Text('Entries (${_entries.length})', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
      const SizedBox(height: 8),
      EntriesEditor(entries: _entries, showErrors: _showErrors, onChanged: () => setState(() {})),
      if (_ocr.isNotEmpty) ExpansionTile(tilePadding: EdgeInsets.zero, title: const Text('Raw OCR text'), children: [SelectableText(_ocr, style: TextStyle(fontSize: 12, fontFamily: 'monospace', color: t.mutedForeground))]),
      const SizedBox(height: 16),
      AppButton(label: 'Save to Minerva', loading: busy, onPressed: _submit),
      const SizedBox(height: 8),
      AppButton(label: 'Start over', variant: AppButtonVariant.outline, onPressed: busy ? null : _reset),
      const SizedBox(height: 24),
    ]);
  }

  Widget _done() => AppCard(
        title: 'Saved',
        description: 'The form data was saved${_savedId == null ? '' : ' as record #$_savedId'}.',
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          if (_savedId != null) AppButton(label: 'View record', onPressed: () => context.go('/finish-earlier/$_savedId')),
          const SizedBox(height: 8),
          AppButton(label: 'Scan another form', variant: AppButtonVariant.outline, onPressed: _reset),
        ]),
      );
}
