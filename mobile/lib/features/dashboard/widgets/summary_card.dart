import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/auth/auth_controller.dart';
import '../../../core/sync/sync_queue.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/theme/tokens.g.dart';
import 'home_config.dart';
import 'module_stat.dart';
import 'stat_pager.dart';

/// White card overlapping the hero: headline value on the left, quick actions on the right.
class SummaryCard extends ConsumerWidget {
  const SummaryCard({
    super.key,
    required this.stats,
    required this.loading,
    this.error,
    this.onRetry,
  });

  final List<ModuleStat> stats;
  final bool loading;
  final String? error;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.tokens;
    final session = ref.watch(sessionProvider);
    final ops = ref.watch(syncQueueProvider).ops;
    final actions = [
      for (final a in quickActions)
        if (session.can(a.permission)) a,
    ];

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: t.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: t.border),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.08),
            blurRadius: 16,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Expanded(flex: 5, child: _left(context, t)),
          if (actions.isNotEmpty) ...[
            const SizedBox(width: 8),
            Expanded(
              flex: 6,
              child: Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  for (final a in actions)
                    Expanded(
                      child: _QuickAction(
                        config: a,
                        badge: ops.where(a.matches).length,
                      ),
                    ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _left(BuildContext context, TokenSet t) {
    if (loading) {
      return const SizedBox(
        height: 64,
        child: Center(child: LinearProgressIndicator()),
      );
    }
    if (error != null) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            error!,
            maxLines: 3,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(fontSize: 13, color: t.mutedForeground),
          ),
          TextButton(onPressed: onRetry, child: const Text('Retry')),
        ],
      );
    }
    if (stats.isEmpty) {
      return Text(
        'No summary for your role.',
        style: TextStyle(fontSize: 13, color: t.mutedForeground),
      );
    }
    return StatPager(stats: stats);
  }
}

class _QuickAction extends StatelessWidget {
  const _QuickAction({required this.config, required this.badge});
  final QuickActionConfig config;
  final int badge;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    return Semantics(
      button: true,
      label: badge > 0
          ? '${config.label}, $badge waiting to upload'
          : config.label,
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: () => context.go(config.path),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 4),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Badge.count(
                count: badge,
                isLabelVisible: badge > 0,
                backgroundColor: t.destructive,
                child: Container(
                  width: 48,
                  height: 48,
                  decoration: BoxDecoration(
                    color: t.muted,
                    shape: BoxShape.circle,
                  ),
                  child: Icon(config.icon, size: 22, color: t.foreground),
                ),
              ),
              const SizedBox(height: 4),
              Text(
                config.label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
