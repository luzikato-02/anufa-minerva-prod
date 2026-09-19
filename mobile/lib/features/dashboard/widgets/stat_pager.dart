import 'package:flutter/material.dart';
import 'package:flutter/semantics.dart' show CustomSemanticsAction;
import 'package:go_router/go_router.dart';

import '../../../core/theme/app_theme.dart';
import 'module_stat.dart';

/// The left half of the Home summary card: one module's stat per page, swipe or tap the dots to move between them.
/// With a single page it shows just the stat (no dots, nothing to swipe).
class StatPager extends StatefulWidget {
  const StatPager({super.key, required this.stats});

  final List<ModuleStat> stats;

  @override
  State<StatPager> createState() => _StatPagerState();
}

class _StatPagerState extends State<StatPager> {
  final _controller = PageController();
  int _page = 0;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _goTo(int page) {
    final target = page.clamp(0, widget.stats.length - 1);
    if (MediaQuery.disableAnimationsOf(context)) {
      _controller.jumpToPage(target);
    } else {
      _controller.animateToPage(target, duration: const Duration(milliseconds: 150), curve: const Cubic(0.2, 0, 0, 1));
    }
  }

  @override
  Widget build(BuildContext context) {
    final stats = widget.stats;
    // Title (16) + gap (4) + value (34) + a two-line secondary (34) = 88 at 1x text, with room to spare; it scales with the text size.
    final pageHeight = MediaQuery.textScalerOf(context).scale(96);
    final many = stats.length > 1;

    return Semantics(
      container: true,
      customSemanticsActions: many
          ? {
              const CustomSemanticsAction(label: 'Next stat'): () => _goTo(_page + 1),
              const CustomSemanticsAction(label: 'Previous stat'): () => _goTo(_page - 1),
            }
          : null,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            height: pageHeight,
            child: PageView.builder(
              controller: _controller,
              itemCount: stats.length,
              onPageChanged: (i) => setState(() => _page = i),
              itemBuilder: (context, i) => _StatPage(stat: stats[i], position: many ? '${i + 1} of ${stats.length}' : null),
            ),
          ),
          if (many)
            ExcludeSemantics(
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [for (var i = 0; i < stats.length; i++) _Dot(active: i == _page, onTap: () => _goTo(i))],
              ),
            ),
        ],
      ),
    );
  }
}

class _StatPage extends StatelessWidget {
  const _StatPage({required this.stat, this.position});

  final ModuleStat stat;
  final String? position;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    return Semantics(
      button: true,
      label: position == null ? stat.semantics : '${stat.semantics}, $position',
      excludeSemantics: true,
      child: InkWell(
        borderRadius: BorderRadius.circular(8),
        onTap: () => context.go(stat.path),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(stat.icon, size: 16, color: t.mutedForeground),
                const SizedBox(width: 6),
                Flexible(
                  child: Text(stat.title, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 13, height: 1.25, fontWeight: FontWeight.w500, color: t.mutedForeground)),
                ),
              ],
            ),
            const SizedBox(height: 4),
            Text(stat.value, style: const TextStyle(fontSize: 28, height: 1.2, fontWeight: FontWeight.w700)),
            Text(stat.secondary, maxLines: 2, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 13, height: 1.3, color: t.mutedForeground)),
          ],
        ),
      ),
    );
  }
}

/// A 44x24 target around a 6px dot (16px wide when active), so it is easy to hit without adding height.
class _Dot extends StatelessWidget {
  const _Dot({required this.active, required this.onTap});

  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    return InkWell(
      borderRadius: BorderRadius.circular(12),
      onTap: onTap,
      child: SizedBox(
        width: 44,
        height: 24,
        child: Center(
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 150),
            width: active ? 16 : 6,
            height: 6,
            decoration: BoxDecoration(color: active ? t.foreground : t.mutedForeground.withValues(alpha: 0.4), borderRadius: BorderRadius.circular(3)),
          ),
        ),
      ),
    );
  }
}
