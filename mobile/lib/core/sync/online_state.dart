import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'sync_queue.dart';

/// One-off "what is the connection right now" read. Overridden in tests (the plugin is not available there).
final connectivityCheckProvider = Provider<Future<List<ConnectivityResult>> Function()>((_) => Connectivity().checkConnectivity);

/// Whether the device has a connection: the state at start, then every change the sync queue already listens to.
final onlineProvider = StreamProvider.autoDispose<bool>((ref) async* {
  bool online(List<ConnectivityResult> r) => r.any((c) => c != ConnectivityResult.none);
  try {
    yield online(await ref.read(connectivityCheckProvider)());
  } catch (_) {
    yield true; // unknown: assume online rather than freeze anything
  }
  yield* ref.watch(connectivityChangesProvider).map(online);
});
