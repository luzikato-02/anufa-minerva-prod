import 'dart:async';

import 'package:anufa_minerva_mobile/core/api/api_exception.dart';
import 'package:anufa_minerva_mobile/core/sync/sync_queue.dart';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'support/fakes.dart';

ProviderContainer _container(FakeAdapter a, {MemoryQueueStorage? storage, StreamController<List<ConnectivityResult>>? net}) {
  final c = ProviderContainer(overrides: overridesFor(a, MemoryTokenStore('t'), queue: storage, net: net));
  addTearDown(c.dispose);
  return c;
}

Future<void> _settle() => Future.delayed(const Duration(milliseconds: 20));

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('online submit goes straight through and sends its id as client_uuid', () async {
    final a = FakeAdapter({'POST /tension-records': (_) => (status: 201, body: {'ok': true})});
    final c = _container(a);
    final q = c.read(syncQueueProvider.notifier);
    await _settle();

    final r = await q.submit(method: 'POST', path: '/tension-records', data: {'x': 1}, label: 'Twisting', id: 'abc');

    expect(r, SubmitResult.sent);
    expect((a.requests.single.data as Map)['client_uuid'], 'abc');
    expect(c.read(syncQueueProvider).ops, isEmpty);
  });

  test('offline submit is queued, persisted, and flushed with the same id when the network returns', () async {
    final a = FakeAdapter({'POST /tension-records': (_) => (status: 201, body: {'ok': true})})..offline = true;
    final storage = MemoryQueueStorage();
    final net = StreamController<List<ConnectivityResult>>.broadcast();
    final c = _container(a, storage: storage, net: net);
    final q = c.read(syncQueueProvider.notifier);
    await _settle();

    expect(await q.submit(method: 'POST', path: '/tension-records', data: {'x': 1}, label: 'Twisting T-01', id: 'id-1'), SubmitResult.queued);
    expect(c.read(syncQueueProvider).pending, 1);
    expect(storage.saved.single['id'], 'id-1');

    a.offline = false;
    net.add([ConnectivityResult.wifi]);
    await _settle();

    expect(c.read(syncQueueProvider).ops, isEmpty);
    expect(storage.saved, isEmpty);
    expect((a.requests.last.data as Map)['client_uuid'], 'id-1');
  });

  test('queued work survives an app restart', () async {
    final storage = MemoryQueueStorage();
    final off = FakeAdapter({})..offline = true;
    final first = _container(off, storage: storage);
    await _settle();
    await first.read(syncQueueProvider.notifier).submit(method: 'POST', path: '/tension-records', data: {'x': 1}, label: 'L', id: 'keep');

    final on = FakeAdapter({'POST /tension-records': (_) => (status: 201, body: {})});
    final second = _container(on, storage: storage);
    second.read(syncQueueProvider);
    await _settle();

    expect(on.requests.single.path, '/tension-records');
    expect(second.read(syncQueueProvider).ops, isEmpty);
  });

  test('a rejected op is marked failed and does not block later ones', () async {
    final storage = MemoryQueueStorage();
    final off = FakeAdapter({})..offline = true;
    final c0 = _container(off, storage: storage);
    await _settle();
    final q0 = c0.read(syncQueueProvider.notifier);
    await q0.submit(method: 'POST', path: '/bad', data: {}, label: 'Bad', id: 'bad');
    await q0.submit(method: 'POST', path: '/good', data: {}, label: 'Good', id: 'good');

    final on = FakeAdapter({
      'POST /bad': (_) => (status: 422, body: {'message': 'x', 'errors': {'csv_data': ['csv_data is required']}}),
      'POST /good': (_) => (status: 201, body: {}),
    });
    final c = _container(on, storage: storage);
    c.read(syncQueueProvider);
    await _settle();

    final s = c.read(syncQueueProvider);
    expect(s.ops.map((o) => o.id), ['bad']);
    expect(s.ops.single.failed, isTrue);
    expect(s.ops.single.error, 'csv_data is required');
    expect(s.pending, 0);
  });

  test('server errors (5xx) stay pending for another try; discard removes an op', () async {
    final storage = MemoryQueueStorage();
    final off = FakeAdapter({})..offline = true;
    final c0 = _container(off, storage: storage);
    await _settle();
    await c0.read(syncQueueProvider.notifier).submit(method: 'POST', path: '/x', data: {}, label: 'X', id: 'x');

    final on = FakeAdapter({'POST /x': (_) => (status: 503, body: {'message': 'down'})});
    final c = _container(on, storage: storage);
    c.read(syncQueueProvider);
    await _settle();
    expect(c.read(syncQueueProvider).ops.single.failed, isFalse);
    expect(c.read(syncQueueProvider).ops.single.attempts, 1);

    await c.read(syncQueueProvider.notifier).discard('x');
    expect(c.read(syncQueueProvider).ops, isEmpty);
    expect(storage.saved, isEmpty);
  });

  test('non-network failures are thrown to the caller instead of being queued', () async {
    final a = FakeAdapter({'POST /x': (_) => (status: 422, body: {'message': 'bad', 'errors': {'a': ['nope']}})});
    final c = _container(a);
    await _settle();
    await expectLater(c.read(syncQueueProvider.notifier).submit(method: 'POST', path: '/x', data: {}, label: 'X'), throwsA(isA<ApiException>()));
    expect(c.read(syncQueueProvider).ops, isEmpty);
  });
}
