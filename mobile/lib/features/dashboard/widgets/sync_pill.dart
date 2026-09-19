import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/sync/sync_queue.dart';
import '../../../core/theme/app_theme.dart';

/// Pill on the hero: "Synced" or the number of uploads waiting; opens the queue.
class SyncPill extends ConsumerWidget {
  const SyncPill({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.tokens;
    final s = ref.watch(syncQueueProvider);
    final waiting = s.ops.length - s.failed;
    final synced = s.ops.isEmpty;
    final label = synced
        ? 'Synced'
        : (s.failed > 0 ? '${s.failed} rejected' : '$waiting waiting');
    return Semantics(
      button: true,
      label: synced
          ? 'Everything is synced'
          : (s.failed > 0
                ? '${uploadsLabel(s.failed)} rejected by the server, open sync queue'
                : '${uploadsLabel(waiting)} waiting, open sync queue'),
      child: Material(
        color: t.primaryForeground.withValues(alpha: 0.16),
        shape: const StadiumBorder(),
        child: InkWell(
          customBorder: const StadiumBorder(),
          onTap: () => context.push('/sync'),
          child: ConstrainedBox(
            constraints: const BoxConstraints(minHeight: 44),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 14),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    synced
                        ? LucideIcons.cloudCheck
                        : (s.failed > 0
                              ? LucideIcons.cloudAlert
                              : LucideIcons.cloudOff),
                    size: 18,
                    color: t.primaryForeground,
                  ),
                  const SizedBox(width: 8),
                  Text(
                    label,
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w500,
                      color: t.primaryForeground,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
