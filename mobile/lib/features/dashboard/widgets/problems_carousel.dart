import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/ui/app_alert.dart';
import '../../../core/ui/app_badge.dart';
import '../../../core/ui/app_button.dart';
import '../../../core/ui/app_skeleton.dart';
import '../home_data.dart';
import 'section_header.dart';

/// Problems after the first, two to a section, so the carousel reads as: one big card, then stacked pairs.
List<List<ReportedProblem>> pairUp(List<ReportedProblem> problems) => [
  for (var i = 0; i < problems.length; i += 2)
    problems.sublist(i, math.min(i + 2, problems.length)),
];

/// "Reported problems": the newest open problems on tension records. The newest is a big card; the rest are
/// compact cards stacked two to a section, and the next section peeks past the edge to show it scrolls.
class ProblemsSection extends ConsumerWidget {
  const ProblemsSection({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final problems = ref.watch(recentProblemsProvider);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: SectionHeader(
            title: 'Reported problems',
            actionLabel: 'View all',
            onAction: () => context.go('/tension-records?tab=problems'),
          ),
        ),
        const SizedBox(height: 8),
        problems.when(
          loading: () => const _Skeleton(),
          error: (e, _) => Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Column(
              children: [
                AppAlert(message: ApiException.from(e).message),
                const SizedBox(height: 12),
                AppButton(
                  label: 'Retry',
                  variant: AppButtonVariant.outline,
                  onPressed: () => ref.invalidate(recentProblemsProvider),
                ),
              ],
            ),
          ),
          data: (list) =>
              list.isEmpty ? const _Empty() : _Carousel(problems: list),
        ),
      ],
    );
  }
}

class _Carousel extends StatelessWidget {
  const _Carousel({required this.problems});
  final List<ReportedProblem> problems;

  @override
  Widget build(BuildContext context) {
    final height = MediaQuery.textScalerOf(context).scale(172);
    return LayoutBuilder(
      builder: (context, box) {
        final single = problems.length == 1;
        // The big card leaves room for the next section to peek in (about 20%); a lone card fills the width.
        final bigWidth = single
            ? box.maxWidth - 32
            : (box.maxWidth * 0.78).clamp(240.0, 340.0);
        final pairWidth = (box.maxWidth * 0.62).clamp(200.0, 280.0);
        final smallHeight = (height - 12) / 2;
        return SizedBox(
          height: height,
          child: ListView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            children: [
              SizedBox(
                width: bigWidth,
                child: _BigCard(problem: problems.first),
              ),
              for (final pair in pairUp(problems.skip(1).toList())) ...[
                const SizedBox(width: 12),
                SizedBox(
                  width: pairWidth,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      SizedBox(
                        height: smallHeight,
                        child: _SmallCard(problem: pair[0]),
                      ),
                      if (pair.length > 1) ...[
                        const SizedBox(height: 12),
                        SizedBox(
                          height: smallHeight,
                          child: _SmallCard(problem: pair[1]),
                        ),
                      ],
                    ],
                  ),
                ),
              ],
            ],
          ),
        );
      },
    );
  }
}

String _when(ReportedProblem p, String pattern) =>
    p.reportedAt == null ? '' : DateFormat(pattern).format(p.reportedAt!);

String _spoken(ReportedProblem p) =>
    'Open problem, ${p.where}, ${p.context}. ${p.description}. Reported ${_when(p, 'd MMM, HH:mm')}.';

/// Card surface shared by both sizes: the app's card border and radius, tappable, opening the record.
class _Shell extends StatelessWidget {
  const _Shell({
    required this.problem,
    required this.padding,
    required this.child,
  });
  final ReportedProblem problem;
  final double padding;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    return Semantics(
      button: true,
      label: _spoken(problem),
      excludeSemantics: true,
      child: Material(
        color: t.card,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(Radii.lg + 4),
          side: BorderSide(color: t.border),
        ),
        child: InkWell(
          borderRadius: BorderRadius.circular(Radii.lg + 4),
          onTap: () => context.push('/tension-records/${problem.recordId}'),
          child: Padding(padding: EdgeInsets.all(padding), child: child),
        ),
      ),
    );
  }
}

class _BigCard extends StatelessWidget {
  const _BigCard({required this.problem});
  final ReportedProblem problem;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    return _Shell(
      problem: problem,
      padding: 16,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const AppBadge('Open', variant: AppBadgeVariant.destructive),
              const SizedBox(width: 8),
              // Flexible so a long timestamp or large text shortens it instead of overflowing the card.
              Expanded(
                child: Text(
                  _when(problem, 'd MMM, HH:mm'),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  textAlign: TextAlign.end,
                  style: TextStyle(fontSize: 12, color: t.mutedForeground),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            problem.where,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
          ),
          Text(
            problem.context,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(fontSize: 13, color: t.mutedForeground),
          ),
          const SizedBox(height: 8),
          Expanded(
            child: Text(
              problem.description,
              maxLines: 4,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontSize: 14, height: 1.3),
            ),
          ),
        ],
      ),
    );
  }
}

class _SmallCard extends StatelessWidget {
  const _SmallCard({required this.problem});
  final ReportedProblem problem;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    return _Shell(
      problem: problem,
      padding: 12,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  '${problem.where} · ${problem.typeLabel}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Text(
                _when(problem, 'd MMM'),
                style: TextStyle(fontSize: 12, color: t.mutedForeground),
              ),
            ],
          ),
          const SizedBox(height: 2),
          Expanded(
            child: Text(
              problem.description,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                fontSize: 13,
                height: 1.3,
                color: t.mutedForeground,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _Empty extends StatelessWidget {
  const _Empty();

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: t.card,
          borderRadius: BorderRadius.circular(Radii.lg + 4),
          border: Border.all(color: t.border),
        ),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              Icon(
                LucideIcons.circleCheck,
                size: 24,
                color: context.semantic.success,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'No open problems',
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    Text(
                      'Problems reported on tension records appear here.',
                      style: TextStyle(fontSize: 13, color: t.mutedForeground),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Skeleton extends StatelessWidget {
  const _Skeleton();

  @override
  Widget build(BuildContext context) => const Padding(
    padding: EdgeInsets.symmetric(horizontal: 16),
    child: Row(
      children: [
        Expanded(flex: 3, child: AppSkeleton(height: 172)),
        SizedBox(width: 12),
        Expanded(
          flex: 2,
          child: Column(
            children: [
              AppSkeleton(height: 80),
              SizedBox(height: 12),
              AppSkeleton(height: 80),
            ],
          ),
        ),
      ],
    ),
  );
}
