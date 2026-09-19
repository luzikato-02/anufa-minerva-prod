import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../api/paged.dart';
import '../theme/app_theme.dart';
import 'app_alert.dart';
import 'app_button.dart';
import 'app_skeleton.dart';
import 'async_body.dart';

/// Debounced search box used above paged lists (web tables' global search).
class SearchField extends StatefulWidget {
  const SearchField({super.key, required this.onChanged, this.hint = 'Search…'});

  final ValueChanged<String> onChanged;
  final String hint;

  @override
  State<SearchField> createState() => _SearchFieldState();
}

class _SearchFieldState extends State<SearchField> {
  final _c = TextEditingController();
  Timer? _debounce;

  @override
  void dispose() {
    _debounce?.cancel();
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => TextField(
        controller: _c,
        onChanged: (v) {
          _debounce?.cancel();
          _debounce = Timer(const Duration(milliseconds: 400), () => widget.onChanged(v.trim()));
          setState(() {});
        },
        decoration: InputDecoration(
          hintText: widget.hint,
          prefixIcon: Icon(LucideIcons.search, size: 18, color: context.tokens.mutedForeground),
          suffixIcon: _c.text.isEmpty
              ? null
              : IconButton(
                  icon: const Icon(LucideIcons.x, size: 16),
                  onPressed: () {
                    _c.clear();
                    widget.onChanged('');
                    setState(() {});
                  },
                ),
        ),
      );
}

/// Infinite-scroll list over a [PagedQuery], with pull-to-refresh, skeletons, errors and empty state.
class PagedList extends ConsumerStatefulWidget {
  const PagedList({super.key, required this.query, required this.itemBuilder, this.header, this.emptyMessage = 'No records found.', this.padding = const EdgeInsets.fromLTRB(16, 8, 16, 96)});

  final PagedQuery query;
  final Widget Function(BuildContext context, Map<String, dynamic> item) itemBuilder;
  final Widget? header;
  final String emptyMessage;
  final EdgeInsets padding;

  @override
  ConsumerState<PagedList> createState() => _PagedListState();
}

class _PagedListState extends ConsumerState<PagedList> {
  final _scroll = ScrollController();

  @override
  void initState() {
    super.initState();
    _scroll.addListener(() {
      if (_scroll.position.extentAfter < 400) ref.read(pagedProvider(widget.query).notifier).loadMore();
    });
  }

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(pagedProvider(widget.query));
    final notifier = ref.read(pagedProvider(widget.query).notifier);

    Widget body;
    if (state.initialLoading) {
      body = ListView(padding: widget.padding, children: [for (var i = 0; i < 5; i++) const Padding(padding: EdgeInsets.only(bottom: 12), child: AppSkeleton(height: 76))]);
    } else if (state.error != null && state.items.isEmpty) {
      body = ListView(padding: widget.padding, children: [
        AppAlert(message: state.error!.message),
        const SizedBox(height: 12),
        AppButton(label: 'Retry', variant: AppButtonVariant.outline, onPressed: notifier.refresh),
      ]);
    } else if (state.items.isEmpty) {
      body = ListView(children: [SizedBox(height: 300, child: EmptyState(widget.emptyMessage))]);
    } else {
      body = ListView.separated(
        controller: _scroll,
        physics: const AlwaysScrollableScrollPhysics(),
        padding: widget.padding,
        itemCount: state.items.length + 1,
        separatorBuilder: (_, _) => const SizedBox(height: 12),
        itemBuilder: (ctx, i) {
          if (i < state.items.length) return widget.itemBuilder(ctx, state.items[i]);
          if (state.loading) return const Center(child: Padding(padding: EdgeInsets.all(8), child: CircularProgressIndicator(strokeWidth: 2)));
          if (state.error != null) return AppButton(label: 'Failed to load more — retry', variant: AppButtonVariant.ghost, onPressed: notifier.loadMore);
          return const SizedBox.shrink();
        },
      );
    }

    return Column(children: [
      ?widget.header,
      Expanded(child: RefreshIndicator(onRefresh: notifier.refresh, child: body)),
    ]);
  }
}
