import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

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

  /// Restores this device's sheet, or starts an empty one.
  Future<void> open() async {
    if (state != null) return;
    final raw = (await SharedPreferences.getInstance()).getString(storageKey);
    try {
      state = raw == null ? _fresh() : ActiveSheet.fromJson(asMap(jsonDecode(raw)));
    } catch (_) {
      state = _fresh();
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

  Map<String, dynamic> _rowBody(SheetRow row) => {
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
      return await ref.read(syncQueueProvider.notifier).submit(method: 'POST', path: '/stock-sheets/rows', data: _rowBody(row), label: _label(sheet.rows.length + 1), id: row.uuid);
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
