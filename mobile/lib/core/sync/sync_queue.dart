import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:dio/dio.dart' show Options;
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path_provider/path_provider.dart';
import 'package:uuid/uuid.dart';

import '../api/api_client.dart';
import '../api/api_exception.dart';

/// One queued write. `id` doubles as the server-side `client_uuid` idempotency key.
class SyncOp {
  SyncOp({required this.id, required this.method, required this.path, required this.data, required this.label, DateTime? createdAt, this.attempts = 0, this.error, this.failed = false})
      : createdAt = createdAt ?? DateTime.now();

  final String id;
  final String method;
  final String path;
  final Map<String, dynamic> data;
  final String label;
  final DateTime createdAt;
  final int attempts;

  /// Last error message from the server, if any.
  final String? error;

  /// True when the server rejected it (validation etc.); needs the user, retrying blindly won't help.
  final bool failed;

  SyncOp copyWith({int? attempts, String? error, bool? failed}) =>
      SyncOp(id: id, method: method, path: path, data: data, label: label, createdAt: createdAt, attempts: attempts ?? this.attempts, error: error, failed: failed ?? this.failed);

  Map<String, dynamic> toJson() => {'id': id, 'method': method, 'path': path, 'data': data, 'label': label, 'createdAt': createdAt.toIso8601String(), 'attempts': attempts, 'error': error, 'failed': failed};

  factory SyncOp.fromJson(Map<String, dynamic> j) => SyncOp(
        id: j['id'] as String,
        method: j['method'] as String,
        path: j['path'] as String,
        data: Map<String, dynamic>.from(j['data'] as Map),
        label: j['label'] as String,
        createdAt: DateTime.tryParse('${j['createdAt']}'),
        attempts: (j['attempts'] as num?)?.toInt() ?? 0,
        error: j['error'] as String?,
        failed: j['failed'] == true,
      );
}

abstract class QueueStorage {
  Future<List<Map<String, dynamic>>> load();
  Future<void> save(List<Map<String, dynamic>> ops);
}

/// JSON file in the app documents dir (survives restarts; no size limit like shared_preferences).
class FileQueueStorage implements QueueStorage {
  Future<File> _file() async => File('${(await getApplicationDocumentsDirectory()).path}/sync_queue.json');

  @override
  Future<List<Map<String, dynamic>>> load() async {
    try {
      final f = await _file();
      if (!await f.exists()) return [];
      return [for (final e in jsonDecode(await f.readAsString()) as List) Map<String, dynamic>.from(e as Map)];
    } catch (_) {
      return [];
    }
  }

  @override
  Future<void> save(List<Map<String, dynamic>> ops) async => (await _file()).writeAsString(jsonEncode(ops), flush: true);
}

final queueStorageProvider = Provider<QueueStorage>((_) => FileQueueStorage());

/// Emits on any connectivity change; overridden in tests.
final connectivityChangesProvider = Provider<Stream<List<ConnectivityResult>>>((_) => Connectivity().onConnectivityChanged);

class SyncState {
  const SyncState({this.ops = const [], this.flushing = false, this.loaded = false});

  final List<SyncOp> ops;
  final bool flushing;
  final bool loaded;

  int get pending => ops.where((o) => !o.failed).length;
  int get failed => ops.where((o) => o.failed).length;
}

enum SubmitResult { sent, queued }

class SyncQueue extends Notifier<SyncState> {
  static const _uuid = Uuid();
  StreamSubscription<List<ConnectivityResult>>? _sub;
  AppLifecycleListener? _lifecycle;
  bool _busy = false;

  QueueStorage get _storage => ref.read(queueStorageProvider);

  @override
  SyncState build() {
    _sub = ref.read(connectivityChangesProvider).listen((r) {
      if (r.any((c) => c != ConnectivityResult.none)) flush();
    });
    _lifecycle = AppLifecycleListener(onResume: flush);
    ref.onDispose(() {
      _sub?.cancel();
      _lifecycle?.dispose();
    });
    Future.microtask(_load);
    return const SyncState();
  }

  Future<void> _load() async {
    final ops = [for (final j in await _storage.load()) SyncOp.fromJson(j)];
    if (!ref.mounted) return;
    state = SyncState(ops: [...ops, ...state.ops], loaded: true);
    await flush();
  }

  Future<void> _persist() => _storage.save([for (final o in state.ops) o.toJson()]);

  String newId() => _uuid.v4();

  /// Tries the request now. Offline → queues it (once) and reports [SubmitResult.queued].
  /// Server-side errors are thrown so the caller can show them; nothing is queued for those.
  Future<SubmitResult> submit({required String method, required String path, required Map<String, dynamic> data, required String label, String? id}) async {
    final op = SyncOp(id: id ?? newId(), method: method, path: path, data: data, label: label);
    try {
      await _send(op);
      return SubmitResult.sent;
    } catch (e) {
      final err = ApiException.from(e);
      if (!err.isOffline) throw err;
      state = SyncState(ops: [...state.ops, op], flushing: state.flushing, loaded: state.loaded);
      await _persist();
      return SubmitResult.queued;
    }
  }

  Future<void> _send(SyncOp op) => ref.read(dioProvider).request(op.path, data: {...op.data, 'client_uuid': op.id}, options: Options(method: op.method));

  /// Sends queued ops in order. Stops when offline/unauthorised; a rejected op is marked failed and skipped.
  Future<void> flush() async {
    if (_busy || state.ops.every((o) => o.failed)) return;
    _busy = true;
    state = SyncState(ops: state.ops, flushing: true, loaded: state.loaded);
    try {
      for (final op in List.of(state.ops.where((o) => !o.failed))) {
        try {
          await _send(op);
          state = SyncState(ops: [...state.ops.where((o) => o.id != op.id)], flushing: true, loaded: state.loaded);
        } catch (e) {
          final err = ApiException.from(e);
          if (err.isOffline || err.isUnauthorized) break;
          final rejected = err.status != null && err.status! >= 400 && err.status! < 500 && err.status != 408 && err.status != 429;
          _replace(op.copyWith(attempts: op.attempts + 1, error: err.message, failed: rejected));
        }
      }
    } finally {
      _busy = false;
      if (ref.mounted) {
        state = SyncState(ops: state.ops, loaded: state.loaded);
        await _persist();
      }
    }
  }

  void _replace(SyncOp op) => state = SyncState(ops: [for (final o in state.ops) o.id == op.id ? op : o], flushing: true, loaded: state.loaded);

  /// Puts a rejected op back in line for another attempt.
  Future<void> retry(String id) async {
    state = SyncState(ops: [for (final o in state.ops) o.id == id ? o.copyWith(failed: false, error: null) : o], loaded: state.loaded);
    await _persist();
    await flush();
  }

  Future<void> discard(String id) async {
    state = SyncState(ops: [...state.ops.where((o) => o.id != id)], loaded: state.loaded);
    await _persist();
  }
}

final syncQueueProvider = NotifierProvider<SyncQueue, SyncState>(SyncQueue.new);
