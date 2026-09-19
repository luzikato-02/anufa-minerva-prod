import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/api_client.dart';
import '../../core/api/api_exception.dart';
import '../../core/auth/auth_controller.dart';
import '../../core/sync/sync_queue.dart';
import '../../core/theme/app_theme.dart';
import '../shared/minerva_scaffold.dart';
import 'widgets/home_config.dart';
import 'widgets/home_header.dart';
import 'widgets/module_tile.dart';
import 'widgets/notice_banner.dart';
import 'widgets/summary_card.dart';

final dashboardProvider = FutureProvider.autoDispose<Map<String, dynamic>>((
  ref,
) async {
  try {
    final res = await ref.watch(dioProvider).get('/dashboard');
    return Map<String, dynamic>.from(res.data as Map);
  } catch (e) {
    throw ApiException.from(e);
  }
});

/// Text of the sync notice the user last dismissed; the banner returns when the text changes.
class DismissedNotice extends Notifier<String?> {
  @override
  String? build() => null;
  void dismiss(String text) => state = text;
}

final dismissedNoticeProvider = NotifierProvider<DismissedNotice, String?>(
  DismissedNotice.new,
);

const _heroContentHeight = 212.0; // leaves room for the pills wrapping at 1.4x text scale
const _cardOverlap = 40.0;

class DashboardScreen extends ConsumerWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.tokens;
    final session = ref.watch(sessionProvider);
    final data = ref.watch(dashboardProvider);
    final failed = ref.watch(syncQueueProvider).failed;
    final dismissed = ref.watch(dismissedNoticeProvider);
    final notice = failed > 0
        ? '$failed ${failed == 1 ? 'upload was' : 'uploads were'} rejected by the server'
        : null;
    final topInset = MediaQuery.paddingOf(context).top;
    final heroHeight = topInset + _heroContentHeight;

    return MinervaScaffold(
      title: 'Home',
      hideAppBar: true,
      bottomNav: true,
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 600),
          child: RefreshIndicator(
            edgeOffset: topInset,
            onRefresh: () => ref.refresh(dashboardProvider.future),
            child: ListView(
              padding: EdgeInsets.zero,
              children: [
                // Hero + summary card. The card is the only in-flow child, pushed down by the hero minus the overlap.
                Stack(
                  clipBehavior: Clip.none,
                  children: [
                    Positioned(
                      top: 0,
                      left: 0,
                      right: 0,
                      height: heroHeight,
                      child: DecoratedBox(
                        decoration: BoxDecoration(
                          color: t.primary,
                          borderRadius: const BorderRadius.vertical(
                            bottom: Radius.circular(24),
                          ),
                        ),
                        child: Padding(
                          padding: EdgeInsets.fromLTRB(
                            16,
                            topInset + 12,
                            16,
                            0,
                          ),
                          child: const HomeHeader(),
                        ),
                      ),
                    ),
                    Padding(
                      padding: EdgeInsets.fromLTRB(
                        16,
                        heroHeight - _cardOverlap,
                        16,
                        0,
                      ),
                      child: SummaryCard(
                        stat: data.value == null
                            ? null
                            : SummaryStat.from(data.value!),
                        loading: data.isLoading && !data.hasValue,
                        error: data.hasError && !data.hasValue
                            ? ApiException.from(data.error!).message
                            : null,
                        onRetry: () => ref.invalidate(dashboardProvider),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 24),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  child: ModuleGrid(
                    items: homeModules(session),
                    maxTiles: 8,
                    showAllModules: true,
                  ),
                ),
                if (notice != null && notice != dismissed)
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
                    child: NoticeBanner(
                      title: 'Needs attention',
                      message: notice,
                      onTap: () => context.push('/sync'),
                      onDismiss: () => ref
                          .read(dismissedNoticeProvider.notifier)
                          .dismiss(notice),
                    ),
                  ),
                const SizedBox(height: 24),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
