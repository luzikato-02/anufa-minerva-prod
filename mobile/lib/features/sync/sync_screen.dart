import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/sync/sync_queue.dart';
import '../../core/theme/app_theme.dart';
import '../../core/ui/app_alert.dart';
import '../../core/ui/app_badge.dart';
import '../../core/ui/app_button.dart';
import '../../core/ui/app_card.dart';
import '../../core/ui/async_body.dart';
import '../shared/minerva_scaffold.dart';

/// Offline uploads waiting for the network, plus any the server rejected.
class SyncScreen extends ConsumerWidget {
  const SyncScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final s = ref.watch(syncQueueProvider);
    final q = ref.read(syncQueueProvider.notifier);
    return MinervaScaffold(
      title: 'Sync queue',
      actions: [
        IconButton(tooltip: 'Sync now', icon: s.flushing ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2)) : const Icon(LucideIcons.refreshCw), onPressed: s.flushing ? null : q.flush),
      ],
      body: s.ops.isEmpty
          ? const EmptyState('Nothing waiting to upload. Recordings saved offline appear here.')
          : ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: s.ops.length,
              separatorBuilder: (_, _) => const SizedBox(height: 12),
              itemBuilder: (ctx, i) {
                final o = s.ops[i];
                final t = ctx.tokens;
                return AppCard(
                  title: o.label,
                  description: 'Saved ${DateFormat('d MMM, HH:mm').format(o.createdAt)}${o.attempts == 0 ? '' : o.attempts == 1 ? ' · tried once' : ' · tried ${o.attempts} times'}',
                  action: AppBadge(o.failed ? 'Rejected' : 'Waiting', variant: o.failed ? AppBadgeVariant.destructive : AppBadgeVariant.warning),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    if (o.error != null) Text(o.error!, style: TextStyle(fontSize: 13, color: t.destructive)),
                    Padding(
                      padding: const EdgeInsets.only(top: 4),
                      child: Text(o.failed ? 'The server rejected this upload. Retry it once the problem is fixed, or discard it.' : 'Uploads automatically when you are back online.', style: TextStyle(fontSize: 13, color: t.mutedForeground)),
                    ),
                    const SizedBox(height: 8),
                    Row(children: [
                      if (o.failed) ...[
                        AppButton(label: 'Retry', size: AppButtonSize.sm, variant: AppButtonVariant.outline, onPressed: () => q.retry(o.id)),
                        const SizedBox(width: 8),
                      ],
                      AppButton(
                        label: 'Discard',
                        size: AppButtonSize.sm,
                        variant: AppButtonVariant.ghost,
                        onPressed: () async {
                          if (await confirmDialog(ctx, title: 'Discard this upload?', message: 'This deletes the saved recording from this device. It will not be sent to the server.', confirmLabel: 'Discard upload', destructive: true)) {
                            await q.discard(o.id);
                          }
                        },
                      ),
                    ]),
                  ]),
                );
              },
            ),
    );
  }
}
