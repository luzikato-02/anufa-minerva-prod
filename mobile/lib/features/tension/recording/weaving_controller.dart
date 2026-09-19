import 'dart:async';
import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../../core/api/api_client.dart';
import '../../../core/api/api_exception.dart';
import '../../../core/sync/sync_queue.dart';
import '../tension_models.dart';
import 'weaving_draft.dart';

enum SessionOutcome { resumed, created, offline }

/// In-progress weaving recording: mirrors to device storage on every change and, when a
/// server session exists, autosaves to it (debounced) so another device can resume.
class WeavingController extends Notifier<WeavingDraft> {
  static const _key = 'weaving-draft-v1';
  static const autosaveDelay = Duration(milliseconds: 600);
  Timer? _timer;
  bool _touched = false;

  @override
  WeavingDraft build() {
    ref.onDispose(() => _timer?.cancel());
    _restore();
    return const WeavingDraft();
  }

  Future<void> _restore() async {
    try {
      final raw = (await SharedPreferences.getInstance()).getString(_key);
      if (raw != null && ref.mounted && !_touched) state = WeavingDraft.fromJson(jsonDecode(raw) as Map<String, dynamic>);
    } catch (_) {/* corrupt draft: start fresh */}
  }

  void _set(WeavingDraft d) {
    _touched = true;
    final dataChanged = !identical(d.grid, state.grid) || !identical(d.problems, state.problems);
    state = d;
    _save();
    if (dataChanged) _scheduleAutosave();
  }

  Future<void> _save() async => (await SharedPreferences.getInstance()).setString(_key, jsonEncode(state.toJson()));

  void _scheduleAutosave() {
    _timer?.cancel();
    if (!state.hasSession) return;
    _timer = Timer(autosaveDelay, _autosave);
  }

  /// Best-effort: a failed autosave is fine, the draft is safe on the device and finish re-sends everything.
  Future<void> _autosave() async {
    final d = state;
    if (!d.hasSession) return;
    try {
      await ref.read(dioProvider).put('/tension-records/${d.sessionId}', data: d.toRecord());
    } catch (_) {}
  }

  // ── Editing ────────────────────────────────────────────────────────────────

  void setField(String k, String v) => _set(state.setField(k, v));
  void press(String k) => _set(state.press(k));
  void backspace() => _set(state.backspace());
  void clearDisplay() => _set(state.clearDisplay());
  void submitValue() => _set(state.submit());
  void deleteStored() => _set(state.deleteStored());
  void toggleType() => _set(state.toggleType());
  void nextCol() => _set(state.nextCol());
  void previousCol() => _set(state.previousCol());
  void goToCol(int n) => _set(state.goToCol(n));
  void nextSide() => _set(state.nextSide());
  void previousSide() => _set(state.previousSide());
  void nextRow() => _set(state.nextRow());
  void previousRow() => _set(state.previousRow());
  void addProblem(String text) => _set(state.addProblem(text));
  void removeProblem(int id) => _set(state.removeProblem(id));
  void clearForm() => _set(state.copyWith(form: {}));

  Future<void> reset() async {
    _timer?.cancel();
    _touched = true;
    state = const WeavingDraft();
    await (await SharedPreferences.getInstance()).remove(_key);
  }

  // ── Server session ─────────────────────────────────────────────────────────

  Future<TensionRecord?> _fetchSession(String po) async {
    try {
      final res = await ref.read(dioProvider).get('/tension-records/session/${Uri.encodeComponent(po)}');
      return TensionRecord(asMap((res.data as Map)['data']));
    } catch (e) {
      final err = ApiException.from(e);
      if (err.status == 404) return null;
      throw err;
    }
  }

  /// Is there an in-progress session for [po]? Unreachable server counts as "no" (web behaviour).
  Future<bool> sessionExists(String po) async {
    try {
      return await _fetchSession(po) != null;
    } on ApiException {
      return false;
    }
  }

  /// Loads the server session for [po] into the draft. Null if none; throws if the server is unreachable.
  Future<MergeSummary?> resume(String po) async {
    final record = await _fetchSession(po);
    if (record == null) return null;
    final (d, summary) = state.resumedFrom(record);
    _set(d.withSession(record.id, po));
    return summary;
  }

  /// Called by "Start Recording": resume the PO's session, else start one. If the server can't
  /// be reached, recording continues offline and is uploaded on finish.
  Future<SessionOutcome> startRecording() async {
    final po = state.field('productionOrder').trim();
    try {
      if (await resume(po) != null) return SessionOutcome.resumed;
      // A cached grid from a different production order must not leak into this session.
      if (state.sessionPo != null && state.sessionPo != po) _set(state.copyWith(grid: {}, problems: []));
      final res = await ref.read(dioProvider).post('/tension-records/start-session', data: {'form_data': {for (final f in weavingFormFields) f.$1: state.field(f.$1)}});
      final id = ((res.data as Map)['data'] as Map)['id'] as num;
      _set(state.withSession(id.toInt(), po));
      return SessionOutcome.created;
    } catch (e) {
      if (!ApiException.from(e).isOffline) rethrow;
      _set(state.copyWith(sessionId: null, sessionPo: null));
      return SessionOutcome.offline;
    }
  }

  /// Completes the session (PUT) or creates the record (POST) — queued if offline.
  Future<SubmitResult> finish({required bool clearAfter}) async {
    _timer?.cancel();
    final d = state;
    final record = d.toRecord(status: 'completed');
    final label = 'Weaving · PO ${d.field('productionOrder')} · machine ${d.field('machineNumber')}';
    final queue = ref.read(syncQueueProvider.notifier);
    final result = d.hasSession
        ? await queue.submit(method: 'PUT', path: '/tension-records/${d.sessionId}', data: record, label: label)
        : await queue.submit(method: 'POST', path: '/tension-records', data: record, label: label);
    if (clearAfter) await reset();
    return result;
  }
}

final weavingControllerProvider = NotifierProvider<WeavingController, WeavingDraft>(WeavingController.new);
