import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'api_client.dart';
import 'api_exception.dart';

/// Identifies one server-paginated list: endpoint + filters. Value-equal so it works as a family key.
class PagedQuery {
  const PagedQuery(this.path, [this.params = const {}]);

  final String path;
  final Map<String, String> params;

  PagedQuery withParams(Map<String, String> more) => PagedQuery(path, {...params, ...more}..removeWhere((_, v) => v.isEmpty));

  @override
  bool operator ==(Object other) => other is PagedQuery && other.path == path && _mapEq(other.params, params);

  @override
  int get hashCode => Object.hash(path, Object.hashAllUnordered(params.entries.map((e) => Object.hash(e.key, e.value))));

  static bool _mapEq(Map a, Map b) => a.length == b.length && a.entries.every((e) => b[e.key] == e.value);
}

class Paged {
  const Paged({this.items = const [], this.page = 0, this.lastPage = 1, this.total = 0, this.loading = false, this.error});

  final List<Map<String, dynamic>> items;
  final int page;
  final int lastPage;
  final int total;
  final bool loading;
  final ApiException? error;

  bool get hasMore => page < lastPage;
  bool get initialLoading => loading && items.isEmpty;

  Paged copyWith({List<Map<String, dynamic>>? items, int? page, int? lastPage, int? total, bool? loading, Object? error = _keep}) => Paged(
        items: items ?? this.items,
        page: page ?? this.page,
        lastPage: lastPage ?? this.lastPage,
        total: total ?? this.total,
        loading: loading ?? this.loading,
        error: identical(error, _keep) ? this.error : error as ApiException?,
      );

  static const _keep = Object();
}

/// Loads Laravel `paginate()` responses page by page.
class PagedNotifier extends Notifier<Paged> {
  PagedNotifier(this.query);

  final PagedQuery query;
  static const perPage = 15;

  @override
  Paged build() {
    Future.microtask(loadMore);
    return const Paged(loading: true);
  }

  Future<void> loadMore() async {
    if (state.page > 0 && (!state.hasMore || state.loading && state.items.isNotEmpty)) return;
    state = state.copyWith(loading: true, error: null);
    try {
      final res = await ref.read(dioProvider).get(query.path, queryParameters: {'per_page': perPage, ...query.params, 'page': state.page + 1});
      final body = Map<String, dynamic>.from(res.data as Map);
      final rows = [for (final r in body['data'] as List) Map<String, dynamic>.from(r as Map)];
      state = state.copyWith(
        items: [...state.items, ...rows],
        page: (body['current_page'] as num).toInt(),
        lastPage: (body['last_page'] as num).toInt(),
        total: (body['total'] as num?)?.toInt() ?? state.items.length + rows.length,
        loading: false,
      );
    } catch (e) {
      state = state.copyWith(loading: false, error: ApiException.from(e));
    }
  }

  Future<void> refresh() async {
    state = const Paged(loading: true);
    await loadMore();
  }
}

final pagedProvider = NotifierProvider.autoDispose.family<PagedNotifier, Paged, PagedQuery>(PagedNotifier.new);
