import 'dart:math' as math;

import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../core/theme/app_theme.dart';
import '../home_data.dart';

/// A clean top for the y axis: at most four gridline steps of 1/2/5/10/20/50/…, never below [minTop].
({double max, double interval}) axisFor(int peak, {int minTop = 4}) {
  final top = math.max(peak, minTop);
  for (final step in const [
    1,
    2,
    5,
    10,
    20,
    50,
    100,
    200,
    500,
    1000,
    2000,
    5000,
    10000,
  ]) {
    if (top / step <= 4) {
      return (
        max: (top / step).ceil() * step.toDouble(),
        interval: step.toDouble(),
      );
    }
  }
  return (max: top.toDouble(), interval: (top / 4).ceilToDouble());
}

/// Daily counts as columns, following the dataviz mark specs: one baseline, 4px rounded data ends, thin bars
/// (never wider than 24px), hairline solid gridlines, clean y ticks, labels in text colours, a tooltip on touch.
class DailyBarChart extends StatelessWidget {
  const DailyBarChart({
    super.key,
    required this.days,
    required this.valueOf,
    required this.color,
    this.minTop = 4,
    this.height = 132,
  });

  final List<TrendDay> days;
  final int Function(TrendDay) valueOf;
  final Color color;
  final int minTop;
  final double height;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final values = [for (final d in days) valueOf(d)];
    final axis = axisFor(values.fold(0, math.max), minTop: minTop);
    final label = DateFormat('d MMM');
    final last = days.length - 1;
    final noMotion = MediaQuery.disableAnimationsOf(context);
    final labelStyle = TextStyle(fontSize: 12, color: t.mutedForeground);

    return LayoutBuilder(
      builder: (context, box) {
        // Slot per day minus the left axis; the bar takes 60% of it, capped at 24px, leaving air (and a gap) between bars.
        final slot = (box.maxWidth - 40) / math.max(1, days.length);
        final barWidth = (slot * 0.6).clamp(4.0, 24.0);
        return SizedBox(
          height: height + 24 + 10, // the plot, the x-axis label band, and headroom so the top tick label is not clipped
          child: Padding(
            padding: const EdgeInsets.only(top: 10),
            child: BarChart(
              duration: noMotion
                  ? Duration.zero
                  : const Duration(milliseconds: 150),
              BarChartData(
                alignment: BarChartAlignment.spaceAround,
                minY: 0,
                maxY: axis.max,
                gridData: FlGridData(
                  drawVerticalLine: false,
                  horizontalInterval: axis.interval,
                  getDrawingHorizontalLine: (_) =>
                      FlLine(color: t.border, strokeWidth: 1),
                ),
                borderData: FlBorderData(
                  show: true,
                  border: Border(bottom: BorderSide(color: t.border)),
                ),
                titlesData: FlTitlesData(
                  topTitles: const AxisTitles(),
                  rightTitles: const AxisTitles(),
                  leftTitles: AxisTitles(
                    sideTitles: SideTitles(
                      showTitles: true,
                      reservedSize:
                          40, // room for a four-digit tick such as 1,500
                      interval: axis.interval,
                      getTitlesWidget: (v, meta) =>
                          v > axis.max || v % axis.interval != 0
                          ? const SizedBox.shrink()
                          : SideTitleWidget(
                              meta: meta,
                              child: Text(
                                NumberFormat.decimalPattern().format(v.toInt()),
                                maxLines: 1,
                                softWrap: false, // a wrapped 300 read as "30" over "0"
                                style: labelStyle,
                              ),
                            ),
                    ),
                  ),
                  bottomTitles: AxisTitles(
                    sideTitles: SideTitles(
                      showTitles: true,
                      reservedSize: 24,
                      interval: 1,
                      getTitlesWidget: (v, meta) {
                        final i = v.toInt();
                        // Label today and every fourth day before it, so labels never collide.
                        if (i < 0 ||
                            i > last ||
                            v != i.toDouble() ||
                            (last - i) % 4 != 0) {
                          return const SizedBox.shrink();
                        }
                        return SideTitleWidget(
                          meta: meta,
                          space: 6,
                          child: Text(
                            label.format(days[i].date),
                            style: labelStyle,
                          ),
                        );
                      },
                    ),
                  ),
                ),
                barTouchData: BarTouchData(
                  touchTooltipData: BarTouchTooltipData(
                    getTooltipColor: (_) => t.foreground,
                    getTooltipItem: (group, groupIndex, rod, rodIndex) =>
                        BarTooltipItem(
                          '${rod.toY.toInt()}',
                          TextStyle(
                            color: t.background,
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                          ),
                          children: [
                            TextSpan(
                              text:
                                  '  ${DateFormat('EEE d MMM').format(days[group.x].date)}',
                              style: TextStyle(
                                color: t.background.withValues(alpha: 0.8),
                                fontSize: 12,
                                fontWeight: FontWeight.w400,
                              ),
                            ),
                          ],
                        ),
                  ),
                ),
                barGroups: [
                  for (var i = 0; i < days.length; i++)
                    BarChartGroupData(
                      x: i,
                      barRods: [
                        BarChartRodData(
                          toY: values[i].toDouble(),
                          color: color,
                          width: barWidth,
                          // Rounded data end, square at the baseline.
                          borderRadius: const BorderRadius.vertical(
                            top: Radius.circular(4),
                          ),
                        ),
                      ],
                    ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}
