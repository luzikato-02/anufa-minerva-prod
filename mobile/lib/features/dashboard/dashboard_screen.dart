import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/api_client.dart';
import '../../core/api/api_exception.dart';
import '../../core/auth/auth_controller.dart';
import '../../core/sync/online_state.dart';
import '../../core/sync/sync_queue.dart';
import '../shared/minerva_scaffold.dart';
import 'widgets/home_config.dart';
import 'widgets/home_header.dart';
import 'widgets/module_stat.dart';
import 'widgets/overlap_column.dart';
import 'widgets/plied_cord_texture.dart';
import 'widgets/module_tile.dart';
import 'widgets/problems_carousel.dart';
import 'widgets/trends_section.dart';
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

/// How far the summary card rides up over the hero's rounded bottom edge.
const _cardOverlap = 40.0;

class DashboardScreen extends ConsumerWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(sessionProvider);
    final data = ref.watch(dashboardProvider);
    final failed = ref.watch(syncQueueProvider).failed;
    final dismissed = ref.watch(dismissedNoticeProvider);
    final notice = failed > 0
        ? '${failed == 1 ? '1 upload was' : '$failed uploads were'} rejected by the server. Open the Sync queue to retry or discard.'
        : null;
    final topInset = MediaQuery.paddingOf(context).top;
    final tension = data.value?['tension'];
    final kpis = [
      HeroKpi(tension is Map ? '${tension['total']}' : '–', 'records'),
      HeroKpi(tension is Map ? '${tension['open_problems']}' : '–', 'open'),
      HeroKpi('$failed', 'rejected'),
    ];
    // Hold the texture still while offline: the stopped strands are a quiet status cue.
    final offline = ref.watch(onlineProvider).value == false;

    return MinervaScaffold(
      title: 'Home',
      hideAppBar: true,
      bottomNav: true,
      body: RefreshIndicator(
        edgeOffset: topInset,
        onRefresh: () => ref.refresh(dashboardProvider.future),
        child: ListView(
          padding: EdgeInsets.zero,
          children: [
            OverlapColumn(
              overlap: _cardOverlap,
              // The hero background bleeds to the edges on any width; its content stays in a 600px column.
              top: ClipRRect(
                borderRadius: const BorderRadius.vertical(bottom: Radius.circular(24)),
                child: ColoredBox(
                  color: HeroColors.background,
                  child: Stack(
                    children: [
                      Positioned.fill(child: PliedCordTexture(accent: kHeroAccent, paused: offline)),
                      Center(
                        child: ConstrainedBox(
                          constraints: const BoxConstraints(maxWidth: 600),
                          // 56 below the content: 40 sits under the summary card, 16 stays clear.
                          child: Padding(
                            padding: EdgeInsets.fromLTRB(16, topInset + 12, 16, _cardOverlap + 16),
                            child: HomeHeader(kpis: kpis),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              bottom: Center(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 600),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 16),
                        child: SummaryCard(
                          stats: data.value == null ? const [] : ModuleStat.listFrom(data.value!),
                          loading: data.isLoading && !data.hasValue,
                          error: data.hasError && !data.hasValue ? ApiException.from(data.error!).message : null,
                          onRetry: () => ref.invalidate(dashboardProvider),
                        ),
                      ),
                      // An actionable alert leads: it sits above the tiles, and only while there is something to act on.
                      if (notice != null && notice != dismissed)
                        Padding(
                          padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
                          child: NoticeBanner(
                            title: 'Uploads need attention',
                            message: notice,
                            onTap: () => context.push('/sync'),
                            onDismiss: () => ref.read(dismissedNoticeProvider.notifier).dismiss(notice),
                          ),
                        ),
                      const SizedBox(height: 24),
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 12),
                        child: ModuleGrid(items: homeModules(session), maxTiles: 8, showAllModules: true),
                      ),
                      if (session.can('tension-records.view')) ...[
                        const SizedBox(height: 8),
                        const ProblemsSection(),
                        const SizedBox(height: 32),
                        const TrendsSection(),
                      ],
                      const SizedBox(height: 24),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
