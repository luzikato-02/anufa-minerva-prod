import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/auth/auth_controller.dart';
import '../../../core/sync/sync_queue.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/theme/tokens.g.dart';
import 'home_config.dart';

/// The headline number of the card, derived from the /dashboard payload.
class SummaryStat {
  const SummaryStat({
    required this.icon,
    required this.title,
    required this.value,
    required this.secondary,
    required this.path,
  });
  final IconData icon;
  final String title;
  final String value;
  final String secondary;
  final String path;

  /// First section the user's role can see: tension, then stock taking, then users.
  static SummaryStat? from(Map<String, dynamic> d) {
    final tension = d['tension'];
    if (tension is Map) {
      return SummaryStat(
        icon: LucideIcons.activity,
        title: 'Tension records',
        value: '${tension['total']}',
        secondary: '${tension['open_problems']} open problems',
        path: '/tension-records',
      );
    }
    final stock = d['stockTake'];
    if (stock is Map) {
      return SummaryStat(
        icon: LucideIcons.scanBarcode,
        title: 'Stock sessions',
        value: '${stock['total']}',
        secondary: '${stock['in_progress']} in progress',
        path: '/stock-take-records',
      );
    }
    final users = d['users'];
    if (users is Map) {
      return SummaryStat(
        icon: LucideIcons.users,
        title: 'Users',
        value: '${users['total']}',
        secondary: '${users['unassigned']} without a role',
        path: '/users',
      );
    }
    return null;
  }
}

/// White card overlapping the hero: headline value on the left, quick actions on the right.
class SummaryCard extends ConsumerWidget {
  const SummaryCard({
    super.key,
    required this.stat,
    required this.loading,
    this.error,
    this.onRetry,
  });

  final SummaryStat? stat;
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
                        badge: ops
                            .where((o) => o.path.contains(a.syncPathContains))
                            .length,
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
    final s = stat;
    if (s == null) {
      return Text(
        'No summary for your role.',
        style: TextStyle(fontSize: 13, color: t.mutedForeground),
      );
    }
    return InkWell(
      borderRadius: BorderRadius.circular(8),
      onTap: () => context.go(s.path),
      child: ConstrainedBox(
        constraints: const BoxConstraints(minHeight: 44),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(s.icon, size: 16, color: t.mutedForeground),
                const SizedBox(width: 6),
                Flexible(
                  child: Text(
                    s.title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w500,
                      color: t.mutedForeground,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 4),
            Text(
              s.value,
              style: const TextStyle(fontSize: 28, fontWeight: FontWeight.w700),
            ),
            Text(
              s.secondary,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(fontSize: 13, color: t.mutedForeground),
            ),
          ],
        ),
      ),
    );
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
