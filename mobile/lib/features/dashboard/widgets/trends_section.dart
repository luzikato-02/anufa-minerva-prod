import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/ui/app_alert.dart';
import '../../../core/ui/app_button.dart';
import '../../../core/ui/app_card.dart';
import '../../../core/ui/app_skeleton.dart';
import '../home_data.dart';
import 'daily_bar_chart.dart';
import 'section_header.dart';

/// "Trends": problems reported and measurements recorded per day, twisting or weaving.
/// Two charts (never one dual-axis plot) because the two counts sit on different scales.
class TrendsSection extends ConsumerStatefulWidget {
  const TrendsSection({super.key});

  @override
  ConsumerState<TrendsSection> createState() => _TrendsSectionState();
}

class _TrendsSectionState extends ConsumerState<TrendsSection> {
  static const _types = {'twisting': 'Twisting', 'weaving': 'Weaving'};
  String _type = 'twisting';
  TensionTrend? _last;

  @override
  Widget build(BuildContext context) {
    final trend = ref.watch(tensionTrendProvider(_type));
    // An older server without the endpoint: leave the section out rather than show an error nobody can act on.
    if (trend.hasError &&
        trend.error is ApiException &&
        (trend.error! as ApiException).status == 404) {
      return const SizedBox.shrink();
    }

    if (trend.hasValue) _last = trend.value;
    final data =
        trend.value ??
        _last; // while another tab loads, hold the previous frame, dimmed

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Padding(
          padding: EdgeInsets.symmetric(horizontal: 16),
          child: SectionHeader(title: 'Trends'),
        ),
        const SizedBox(height: 8),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: _Segmented(
            options: _types,
            value: _type,
            onChanged: (v) => setState(() => _type = v),
          ),
        ),
        const SizedBox(height: 12),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: data == null
              ? (trend.hasError
                    ? Column(
                        children: [
                          AppAlert(
                            message: ApiException.from(trend.error!).message,
                          ),
                          const SizedBox(height: 12),
                          AppButton(
                            label: 'Retry',
                            variant: AppButtonVariant.outline,
                            onPressed: () =>
                                ref.invalidate(tensionTrendProvider(_type)),
                          ),
                        ],
                      )
                    : const Column(
                        children: [
                          AppSkeleton(height: 230),
                          SizedBox(height: 12),
                          AppSkeleton(height: 230),
                        ],
                      ))
              : AnimatedOpacity(
                  opacity: trend.isLoading ? 0.5 : 1,
                  duration: const Duration(milliseconds: 150),
                  child: Column(
                    children: [
                      _TrendCard(
                        title: 'Reported problems per day',
                        noun: 'problem',
                        kind: _types[_type]!.toLowerCase(),
                        days: data.days,
                        valueOf: (d) => d.problems,
                        color: context.semantic.chartProblems,
                        minTop: 4,
                      ),
                      const SizedBox(height: 12),
                      _TrendCard(
                        title: 'Measurements per day',
                        noun: 'measurement',
                        kind: _types[_type]!.toLowerCase(),
                        days: data.days,
                        valueOf: (d) => d.measurements,
                        color: context.semantic.chartMeasurements,
                        minTop: 10,
                      ),
                    ],
                  ),
                ),
        ),
      ],
    );
  }
}

/// Two-way switch styled like the recording screens' Max/Min toggle: filled when selected, outlined otherwise.
class _Segmented extends StatelessWidget {
  const _Segmented({
    required this.options,
    required this.value,
    required this.onChanged,
  });
  final Map<String, String> options;
  final String value;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    return Semantics(
      container: true,
      label: 'Record type',
      child: Row(
        children: [
          for (final e in options.entries) ...[
            if (e.key != options.keys.first) const SizedBox(width: 8),
            Expanded(
              child: Semantics(
                button: true,
                selected: e.key == value,
                inMutuallyExclusiveGroup: true,
                label: e.value,
                excludeSemantics: true,
                child: InkWell(
                  borderRadius: BorderRadius.circular(Radii.md),
                  onTap: e.key == value ? null : () => onChanged(e.key),
                  child: Container(
                    height: 44,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: e.key == value ? t.primary : null,
                      borderRadius: BorderRadius.circular(Radii.md),
                      border: Border.all(
                        color: e.key == value ? t.primary : t.input,
                      ),
                    ),
                    child: Text(
                      e.value,
                      style: TextStyle(
                        fontWeight: FontWeight.w600,
                        color: e.key == value
                            ? t.primaryForeground
                            : t.foreground,
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _TrendCard extends StatefulWidget {
  const _TrendCard({
    required this.title,
    required this.noun,
    required this.kind,
    required this.days,
    required this.valueOf,
    required this.color,
    required this.minTop,
  });

  final String title;
  final String noun; // singular, e.g. "problem"
  final String kind; // "twisting" | "weaving"
  final List<TrendDay> days;
  final int Function(TrendDay) valueOf;
  final Color color;
  final int minTop;

  @override
  State<_TrendCard> createState() => _TrendCardState();
}

class _TrendCardState extends State<_TrendCard> {
  bool _table = false;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final values = [for (final d in widget.days) widget.valueOf(d)];
    final total = values.fold(0, (a, b) => a + b);
    var peakAt = 0;
    for (var i = 0; i < values.length; i++) {
      if (values[i] >= values[peakAt]) peakAt = i;
    }
    final peak = values.isEmpty ? 0 : values[peakAt];
    final day = DateFormat('d MMM');
    final plural = total == 1 ? widget.noun : '${widget.noun}s';
    final number = NumberFormat.decimalPattern();
    // Short enough for one line at normal text size; screen readers get the full sentence.
    final subtitle = total == 0
        ? 'No ${widget.noun}s in the last ${widget.days.length} days'
        : [
            '${widget.days.length} days',
            '${number.format(total)} in total',
            'peak ${number.format(peak)} on ${day.format(widget.days[peakAt].date)}',
          ].map((phrase) => phrase.replaceAll(' ', '\u00A0')).join(' · '); // wrap between phrases, not inside one
    final spoken = total == 0
        ? subtitle
        : 'Last ${widget.days.length} days, ${number.format(total)} $plural in total, peak ${number.format(peak)} on ${day.format(widget.days[peakAt].date)}';

    return AppCard(
      title: widget.title,
      description: subtitle,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Semantics(
            label: '${widget.title}, ${widget.kind}. $spoken.',
            child: ExcludeSemantics(
              child: DailyBarChart(
                days: widget.days,
                valueOf: widget.valueOf,
                color: widget.color,
                minTop: widget.minTop,
              ),
            ),
          ),
          Align(
            alignment: AlignmentDirectional.centerStart,
            child: Padding(
              padding: const EdgeInsets.only(top: 4, bottom: 12),
              child: AppButton(
                variant: AppButtonVariant.outline,
                size: AppButtonSize.sm,
                icon: _table ? LucideIcons.chartColumn : LucideIcons.table,
                label: _table ? 'Hide table' : 'View as table',
                onPressed: () => setState(() => _table = !_table),
              ),
            ),
          ),
          if (_table)
            Column(
              children: [
                for (var i = widget.days.length - 1; i >= 0; i--)
                  Container(
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    decoration: BoxDecoration(
                      border: Border(top: BorderSide(color: t.border)),
                    ),
                    child: Row(
                      children: [
                        Expanded(
                          child: Text(
                            DateFormat('EEE d MMM').format(widget.days[i].date),
                            style: const TextStyle(fontSize: 14),
                          ),
                        ),
                        Text(
                          '${values[i]}',
                          style: const TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                  ),
              ],
            ),
        ],
      ),
    );
  }
}
