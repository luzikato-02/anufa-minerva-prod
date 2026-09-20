import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:anufa_minerva_mobile/core/api/api_client.dart';
import 'package:anufa_minerva_mobile/core/auth/token_store.dart';
import 'package:anufa_minerva_mobile/core/sync/sync_queue.dart';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/misc.dart' show Override;

class MemoryTokenStore extends TokenStore {
  MemoryTokenStore([this.token]);
  String? token;
  @override
  Future<String?> read() async => token;
  @override
  Future<void> write(String t) async => token = t;
  @override
  Future<void> clear() async => token = null;
}

class MemoryQueueStorage implements QueueStorage {
  MemoryQueueStorage([List<Map<String, dynamic>>? initial]) : saved = initial ?? [];
  List<Map<String, dynamic>> saved;
  @override
  Future<List<Map<String, dynamic>>> load() async => saved;
  @override
  Future<void> save(List<Map<String, dynamic>> ops) async => saved = ops;
}

typedef Handler = ({int status, Object body}) Function(RequestOptions o);

/// Routes `METHOD /path` to canned responses; records requests for assertions.
class FakeAdapter implements HttpClientAdapter {
  FakeAdapter(this.routes);
  final Map<String, Handler> routes;
  final List<RequestOptions> requests = [];

  /// When true every request fails like a dropped connection.
  bool offline = false;

  @override
  Future<ResponseBody> fetch(RequestOptions o, Stream<Uint8List>? body, Future<void>? cancel) async {
    requests.add(o);
    if (offline) throw DioException.connectionError(requestOptions: o, reason: 'offline');
    // A route ending in `/:id` answers any last path segment (for ids the app generates).
    final h = routes['${o.method} ${o.path}'] ?? routes['${o.method} ${o.path.replaceFirst(RegExp(r'/[^/]+$'), '/:id')}'];
    final r = h == null ? (status: 404, body: {'message': 'no fake for ${o.method} ${o.path}'}) : h(o);
    return ResponseBody.fromString(jsonEncode(r.body), r.status, headers: {
      Headers.contentTypeHeader: ['application/json'],
    });
  }

  @override
  void close({bool force = false}) {}
}

Map<String, dynamic> sessionJson({List<String> permissions = const [], bool twoFactor = false, String? token}) => {
      'token': ?token,
      'user': {'id': 1, 'name': 'Ana Operator', 'email': 'ana@anufa.my.id', 'username': 'ana'},
      'roles': ['operator'],
      'permissions': permissions,
      'two_factor_enabled': twoFactor,
    };

List<Override> overridesFor(FakeAdapter adapter, MemoryTokenStore store, {MemoryQueueStorage? queue, StreamController<List<ConnectivityResult>>? net}) => [
      queueStorageProvider.overrideWithValue(queue ?? MemoryQueueStorage()),
      connectivityChangesProvider.overrideWithValue((net ?? StreamController<List<ConnectivityResult>>.broadcast()).stream),
      tokenStoreProvider.overrideWithValue(store),
      dioProvider.overrideWith((ref) {
        final dio = Dio(BaseOptions(baseUrl: 'http://test/api/v1', headers: {'Accept': 'application/json'}))..httpClientAdapter = adapter;
        dio.interceptors.add(InterceptorsWrapper(onRequest: (o, h) async {
          final t = await store.read();
          if (t != null) o.headers['Authorization'] = 'Bearer $t';
          h.next(o);
        }));
        return dio;
      }),
    ];
