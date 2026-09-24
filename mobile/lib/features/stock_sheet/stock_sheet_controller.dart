import 'dart:async';
import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../core/api/api_client.dart';
import '../../core/api/api_exception.dart';
import '../../core/auth/auth_controller.dart';
import '../../core/sync/sync_queue.dart';
import '../tension/tension_models.dart';
import 'stock_sheet_models.dart';

/// The stock sheet being filled in. It lives on the device, so a restart or a dead connection loses nothing:
/// every row is uploaded (or queued) on its own the moment it is added.
class StockSheetController extends Notifier<ActiveSheet?> {
  static const storageKey = 'stock-sheet-active';

  @override
  ActiveSheet? build() => null;

  Future<void> _save() async {
    final prefs = await SharedPreferences.getInstance();
    final s = state;
    if (s == null) {
      await prefs.remove(storageKey);
    } else {
      await prefs.setString(storageKey, jsonEncode(s.toJson()));
    }
  }

  ActiveSheet _fresh() => ActiveSheet(uuid: ref.read(syncQueueProvider.notifier).newId(), date: _today(), leader: ref.read(sessionProvider).name);

  DateTime _today() {
    final n = DateTime.now();
    return DateTime(n.year, n.month, n.day);
  }

  /// Restores this device's sheet, if one is already active. Starting fresh or resuming by session id
  /// happens on the session-select screen, not here — this leaves [state] null when nothing was saved yet
  /// (a first/direct visit), which is the record screen's cue to send the operator there first.
  Future<void> open() async {
    if (state != null) return;
    final raw = (await SharedPreferences.getInstance()).getString(storageKey);
    if (raw == null) return;
    try {
      state = ActiveSheet.fromJson(asMap(jsonDecode(raw)));
    } catch (_) {
      state = null;
    }
    unawaited(_refreshSessionId());
  }

  /// A sheet started offline has no session id until the server has actually seen it. Best-effort: looks the
  /// sheet up by its own client uuid (which the scope also matches), so the id appears once connectivity
  /// allows the first row to reach the server, even if that happened via a later automatic retry rather than
  /// the original submit. Failures (still offline, nothing saved yet) are silently ignored.
  Future<void> _refreshSessionId() async {
    final sheet = state;
    if (sheet == null || sheet.sessionId != null || sheet.rows.isEmpty) return;
    try {
      final res = await ref.read(dioProvider).get('/stock-sheets/session/${sheet.uuid}');
      final sessionId = asMap(asMap(res.data)['data'])['session_id'] as String?;
      if (sessionId != null && state?.sessionId == null) {
        state = state!.copyWith(sessionId: sessionId);
        await _save();
      }
    } catch (_) {
      // Offline, or the first row hasn't reached the server yet — fine, try again next time.
    }
  }

  Future<void> setDate(DateTime d) async {
    state = state!.copyWith(date: DateTime(d.year, d.month, d.day));
    await _save();
  }

  /// Starts a new sheet. Rows already added are on the server or in the upload queue, so nothing is dropped.
  Future<void> startNew() async {
    state = _fresh();
    await _save();
  }

  /// Loads an existing sheet by the session id it was assigned on its first row (typed in by the operator
  /// to keep recording into it from this device), replacing whatever draft is active here.
  Future<void> loadSession(String sessionId) async {
    try {
      final res = await ref.read(dioProvider).get('/stock-sheets/session/${Uri.encodeComponent(sessionId)}');
      state = ActiveSheet.fromServer(asMap(asMap(res.data)['data']), localUuid: ref.read(syncQueueProvider.notifier).newId());
      await _save();
    } catch (e) {
      final err = ApiException.from(e);
      throw err.status == 404 ? ApiException('Session "$sessionId" was not found.', status: 404) : err;
    }
  }

  Map<String, dynamic> _rowBody(SheetRow row) => {
        if (state!.sessionId != null) 'session_id': state!.sessionId,
        'sheet_client_uuid': state!.uuid,
        'sheet_date': sheetDay(state!.date),
        'leader': state!.leader,
        ...row.toFields(),
      };

  String _label(int line) => 'Stock sheet · row $line';

  /// Adds a row to the sheet and uploads it, or queues it when offline. It shows in the list either way.
  Future<SubmitResult> addRow(SheetRow row) async {
    final sheet = state!;
    state = sheet.copyWith(rows: [...sheet.rows, row]);
    await _save();
    try {
      final result = await ref.read(syncQueueProvider.notifier).submit(method: 'POST', path: '/stock-sheets/rows', data: _rowBody(row), label: _label(sheet.rows.length + 1), id: row.uuid);
      unawaited(_refreshSessionId());
      return result;
    } catch (_) {
      // The server refused it (validation), so it isn't on the sheet.
      state = state!.copyWith(rows: [for (final r in state!.rows) if (r.uuid != row.uuid) r]);
      await _save();
      rethrow;
    }
  }

  bool _waiting(String uuid) => ref.read(syncQueueProvider).ops.any((o) => o.id == uuid);

  int _line(String uuid) => state!.rows.indexWhere((r) => r.uuid == uuid) + 1;

  /// Changes a row. One still waiting to upload is swapped in the queue; an uploaded one is patched.
  Future<SubmitResult> updateRow(SheetRow row) async {
    final line = _line(row.uuid);
    final previous = state!.rows.firstWhere((r) => r.uuid == row.uuid);
    state = state!.copyWith(rows: [for (final r in state!.rows) r.uuid == row.uuid ? row : r]);
    await _save();
    final queue = ref.read(syncQueueProvider.notifier);
    try {
      if (_waiting(row.uuid)) {
        await queue.discard(row.uuid);
        return await queue.submit(method: 'POST', path: '/stock-sheets/rows', data: _rowBody(row), label: _label(line), id: row.uuid);
      }
      return await queue.submit(method: 'PATCH', path: '/stock-sheets/rows/${row.uuid}', data: row.toFields(), label: _label(line));
    } catch (_) {
      state = state!.copyWith(rows: [for (final r in state!.rows) r.uuid == row.uuid ? previous : r]);
      await _save();
      rethrow;
    }
  }

  Future<SubmitResult?> deleteRow(String uuid) async {
    final line = _line(uuid);
    final waiting = _waiting(uuid);
    state = state!.copyWith(rows: [for (final r in state!.rows) if (r.uuid != uuid) r]);
    await _save();
    final queue = ref.read(syncQueueProvider.notifier);
    if (waiting) {
      await queue.discard(uuid); // never reached the server
      return null;
    }
    return queue.submit(method: 'DELETE', path: '/stock-sheets/rows/$uuid', data: const {}, label: 'Stock sheet · delete row $line');
  }
}

final stockSheetProvider = NotifierProvider<StockSheetController, ActiveSheet?>(StockSheetController.new);
