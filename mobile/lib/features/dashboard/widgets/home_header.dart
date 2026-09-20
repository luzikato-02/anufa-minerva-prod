import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/auth/auth_controller.dart';
import '../../../core/ui/app_alert.dart';
import '../shifts.dart';
import 'home_config.dart';
import 'scan_sheet.dart';
import 'sync_pill.dart';

/// Content of the hero block: sync pill, scan shortcut, profile menu and greeting.
/// Sits on a `primary` surface, so it only uses `primaryForeground` for text and icons.
class HomeHeader extends ConsumerWidget {
  const HomeHeader({super.key, required this.kpis});

  /// The three values under the greeting; "–" while a number is not available.
  final List<HeroKpi> kpis;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(sessionProvider);
    final now = ref.watch(clockProvider).value ?? DateTime.now();
    final shift = shiftAt(now);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  const SyncPill(),
                  if (scanOptionsFor(session).isNotEmpty)
                    Semantics(
                      button: true,
                      label: 'Scan, choose a document or form',
                      child: Material(
                        color: HeroColors.foreground,
                        shape: const StadiumBorder(),
                        child: InkWell(
                          customBorder: const StadiumBorder(),
                          onTap: () => showScanOptions(context, session),
                          child: ConstrainedBox(
                            constraints: const BoxConstraints(minHeight: 44),
                            child: Padding(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 14,
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(
                                    LucideIcons.scanBarcode,
                                    size: 18,
                                    color: HeroColors.background,
                                  ),
                                  const SizedBox(width: 8),
                                  Text(
                                    'Scan',
                                    style: TextStyle(
                                      fontSize: 13,
                                      fontWeight: FontWeight.w600,
                                      color: HeroColors.background,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            _ProfileMenu(initials: session.initials),
          ],
        ),
        const SizedBox(height: 20),
        Text(
          contextLine(now, shift),
          style: TextStyle(fontSize: 12, color: HeroColors.muted),
        ),
        const SizedBox(height: 4),
        Text(
          greetingFor(now, session.name.split(' ').first),
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(
            fontSize: 24,
            height: 1.2,
            fontWeight: FontWeight.w500,
            color: HeroColors.foreground,
          ),
        ),
        const SizedBox(height: 12),
        _ShiftBar(shift: shift, progress: shiftProgress(now, shift)),
        const SizedBox(height: 16),
        _KpiStrip(kpis: kpis),
      ],
    );
  }
}

class _ProfileMenu extends ConsumerWidget {
  const _ProfileMenu({required this.initials});
  final String initials;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return PopupMenuButton<String>(
      tooltip: 'Profile menu',
      onSelected: (v) async {
        if (v == 'settings') {
          context.go('/settings/profile');
        } else if (v == 'logout') {
          if (await confirmDialog(
            context,
            title: 'Log out?',
            message: 'You will need to sign in again.',
            confirmLabel: 'Log out',
          )) {
            await ref.read(authProvider.notifier).logout();
          }
        }
      },
      itemBuilder: (_) => const [
        PopupMenuItem(value: 'settings', child: Text('Settings')),
        PopupMenuItem(value: 'logout', child: Text('Log out')),
      ],
      child: Container(
        width: 44,
        height: 44,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: HeroColors.foreground.withValues(alpha: 0.16),
        ),
        child: Text(
          initials,
          style: TextStyle(
            fontWeight: FontWeight.w600,
            fontSize: 14,
            color: HeroColors.foreground,
          ),
        ),
      ),
    );
  }
}

class HeroKpi {
  const HeroKpi(this.value, this.label);
  final String value;
  final String label;
}

/// A 4px bar showing how far through the current shift it is.
class _ShiftBar extends StatelessWidget {
  const _ShiftBar({required this.shift, required this.progress});
  final Shift shift;
  final double progress;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: 'Shift ${shift.name} progress',
      value: '${(progress * 100).round()} percent',
      child: ExcludeSemantics(
        child: ClipRRect(
          borderRadius: BorderRadius.circular(2),
          // Explicit widths: a Stack would shrink to its only in-flow child and collapse the track to the fill's width.
          child: LayoutBuilder(
            builder: (context, box) => Stack(
              children: [
                SizedBox(
                  width: box.maxWidth,
                  height: 4,
                  child: ColoredBox(color: HeroColors.track),
                ),
                SizedBox(
                  key: const Key('shift-bar-fill'),
                  width: box.maxWidth * progress,
                  height: 4,
                  child: const ColoredBox(color: kHeroAccent),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Three equal columns: a value over its label.
class _KpiStrip extends StatelessWidget {
  const _KpiStrip({required this.kpis});
  final List<HeroKpi> kpis;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (final k in kpis)
          Expanded(
            child: MergeSemantics(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    k.value,
                    style: TextStyle(
                      fontSize: 18,
                      height: 1.2,
                      fontWeight: FontWeight.w500,
                      color: HeroColors.foreground,
                    ),
                  ),
                  Text(
                    k.label,
                    style: TextStyle(
                      fontSize: 11,
                      height: 1.3,
                      color: HeroColors.muted,
                    ),
                  ),
                ],
              ),
            ),
          ),
      ],
    );
  }
}
