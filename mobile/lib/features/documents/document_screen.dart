import 'dart:async';
import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_markdown_plus/flutter_markdown_plus.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:markdown/markdown.dart' as md;

import '../../core/api/api_client.dart';
import '../../core/api/api_exception.dart';
import '../../core/files/file_pick.dart';
import '../../core/files/file_sharer.dart';
import '../../core/theme/app_theme.dart';
import '../../core/ui/app_alert.dart';
import '../../core/ui/app_button.dart';
import '../../core/ui/app_card.dart';
import '../settings/settings_shell.dart' show showToast;
import '../shared/minerva_scaffold.dart';
import 'ocr_result.dart';

enum _Stage { idle, processing, done }

/// "Document Intelligence" — OCR a scanned PDF or photo and export the text and tables.
/// OCR runs on the server, so this needs a connection.
class DocumentScreen extends ConsumerStatefulWidget {
  const DocumentScreen({super.key});

  @override
  ConsumerState<DocumentScreen> createState() => _DocumentScreenState();
}

class _DocumentScreenState extends ConsumerState<DocumentScreen> {
  _Stage _stage = _Stage.idle;
  PickedFile? _file;
  OcrResult? _result;
  String? _error;
  CancelToken? _cancel;
  Timer? _tick;
  int _seconds = 0;
  final _raw = <int>{};

  @override
  void dispose() {
    _tick?.cancel();
    _cancel?.cancel();
    super.dispose();
  }

  void _choose(PickedFile? f) {
    if (f == null) return;
    final problem = validateOcrUpload(f);
    setState(() {
      _error = problem;
      if (problem == null) _file = f;
    });
  }

  String get _progressText => _seconds < 4 ? 'Uploading the document…' : _seconds < 15 ? 'Reading pages with OCR…' : 'Still working — long or dense documents can take a minute or two…';

  Future<void> _process() async {
    final f = _file;
    if (f == null) return;
    _cancel = CancelToken();
    setState(() {
      _stage = _Stage.processing;
      _error = null;
      _seconds = 0;
    });
    _tick = Timer.periodic(const Duration(seconds: 1), (_) => setState(() => _seconds++));
    try {
      final res = await ref.read(dioProvider).post(
            '/document-intelligence/process',
            data: FormData.fromMap({'file': MultipartFile.fromBytes(f.bytes, filename: f.name, contentType: DioMediaType.parse(mimeTypeFor(f.name)))}),
            cancelToken: _cancel,
            options: Options(receiveTimeout: const Duration(minutes: 3), sendTimeout: const Duration(minutes: 2)),
          );
      final result = OcrResult(Map<String, dynamic>.from(res.data as Map));
      if (mounted) {
        setState(() {
          _result = result;
          _raw.clear();
          _stage = _Stage.done;
        });
      }
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

  String get _baseName => (_file?.name ?? 'document').replaceFirst(RegExp(r'\.[^.]+$'), '');

  Future<void> _export(String ext, List<int> Function(OcrResult) build, String mime) async {
    final r = _result;
    if (r == null) return;
    try {
      await ref.read(fileSharerProvider).share('$_baseName.$ext', build(r), mimeType: mime);
    } catch (e) {
      if (mounted) showToast(context, 'Could not share the file: ${ApiException.from(e).message}');
    }
  }

  void _reset() => setState(() {
        _stage = _Stage.idle;
        _file = null;
        _result = null;
        _error = null;
        _raw.clear();
      });

  @override
  Widget build(BuildContext context) => MinervaScaffold(
        title: 'Document Intelligence',
        body: ListView(padding: const EdgeInsets.all(16), children: [
          if (_error != null) ...[AppAlert(message: _error!), const SizedBox(height: 12)],
          switch (_stage) {
            _Stage.idle => _idle(),
            _Stage.processing => _processing(),
            _Stage.done => _done(),
          },
        ]),
      );

  Widget _idle() => AppCard(
        title: 'Extract text from a document',
        description: 'Upload a PDF or image and extract its text and tables with OCR',
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          AppButton(label: 'Take photo', icon: LucideIcons.camera, onPressed: () async => _choose(await ref.read(takePhotoProvider)())),
          const SizedBox(height: 8),
          AppButton(label: 'Choose PDF or image', icon: LucideIcons.fileUp, variant: AppButtonVariant.outline, onPressed: () async => _choose(await ref.read(pickFileProvider)(kOcrExtensions))),
          const SizedBox(height: 4),
          Text('PDF, PNG, JPG, WEBP — up to 20 MB', textAlign: TextAlign.center, style: TextStyle(fontSize: 12, color: context.tokens.mutedForeground)),
          if (_file != null) ...[
            const SizedBox(height: 12),
            Row(children: [
              const Icon(LucideIcons.fileText, size: 16),
              const SizedBox(width: 6),
              Expanded(child: Text('${_file!.name} · ${(_file!.bytes.length / 1024).round()} KB', overflow: TextOverflow.ellipsis)),
            ]),
            const SizedBox(height: 12),
            AppButton(label: 'Extract text', onPressed: _process),
          ],
        ]),
      );

  Widget _processing() => AppCard(
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

  Widget _done() {
    final r = _result!;
    final t = context.tokens;
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      AppCard(
        title: 'Export',
        description: '${r.pages.length} page${r.pages.length == 1 ? '' : 's'} extracted from $_baseName',
        child: Wrap(spacing: 8, runSpacing: 8, children: [
          AppButton(label: 'Markdown', icon: LucideIcons.fileText, size: AppButtonSize.sm, variant: AppButtonVariant.outline, onPressed: () => _export('md', (r) => utf8.encode(r.toMarkdown()), 'text/markdown')),
          AppButton(label: 'JSON', icon: LucideIcons.braces, size: AppButtonSize.sm, variant: AppButtonVariant.outline, onPressed: () => _export('json', (r) => utf8.encode(r.toJsonText()), 'application/json')),
          AppButton(label: 'Excel', icon: LucideIcons.sheet, size: AppButtonSize.sm, variant: AppButtonVariant.outline, onPressed: () => _export('xlsx', (r) => r.toXlsx(), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')),
        ]),
      ),
      const SizedBox(height: 16),
      if (r.isEmpty) const AppAlert(message: 'No text was found in this document.', destructive: false),
      for (final p in r.pages)
        Padding(
          padding: const EdgeInsets.only(bottom: 16),
          child: Container(
            decoration: BoxDecoration(border: Border.all(color: t.border), borderRadius: BorderRadius.circular(Radii.lg)),
            clipBehavior: Clip.antiAlias,
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Container(
                color: t.muted,
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                child: Row(children: [
                  Text('PAGE ${p.index + 1}', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, letterSpacing: .5)),
                  const Spacer(),
                  TextButton.icon(
                    onPressed: () => setState(() => _raw.contains(p.index) ? _raw.remove(p.index) : _raw.add(p.index)),
                    icon: const Icon(LucideIcons.code, size: 14),
                    label: Text(_raw.contains(p.index) ? 'Rendered' : 'Raw'),
                  ),
                ]),
              ),
              Padding(
                padding: const EdgeInsets.all(12),
                child: _raw.contains(p.index)
                    ? SelectableText(p.markdown, style: const TextStyle(fontFamily: 'monospace', fontSize: 13, height: 1.5))
                    : MarkdownBody(
                        data: p.markdown,
                        selectable: true,
                        extensionSet: md.ExtensionSet.gitHubFlavored,
                        styleSheet: MarkdownStyleSheet.fromTheme(Theme.of(context)).copyWith(
                          tableBorder: TableBorder.all(color: t.border),
                          tableHead: const TextStyle(fontWeight: FontWeight.w600),
                          codeblockDecoration: BoxDecoration(color: t.muted, borderRadius: BorderRadius.circular(Radii.md)),
                        ),
                      ),
              ),
            ]),
          ),
        ),
      AppButton(label: 'Process another document', variant: AppButtonVariant.outline, onPressed: _reset),
      const SizedBox(height: 24),
    ]);
  }
}
