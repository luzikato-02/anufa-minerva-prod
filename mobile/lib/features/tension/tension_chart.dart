import 'dart:math' as math;

import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';

import '../../core/theme/app_theme.dart';
import 'tension_models.dart';

/// Max/min tension per position with spec and tolerance guide lines (web recharts LineChart).
class TensionChart extends StatelessWidget {
  const TensionChart({super.key, required this.points, this.spec, this.tolerance});

  final List<TensionPoint> points;
  final double? spec;
  final double? tolerance;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final s = context.semantic;
    List<FlSpot> spots(double? Function(TensionPoint) f) =>
        [for (var i = 0; i < points.length; i++) if (f(points[i]) != null) FlSpot(i.toDouble(), f(points[i])!)];
    final maxSpots = spots((p) => p.max);
    final minSpots = spots((p) => p.min);

    final values = [...maxSpots, ...minSpots].map((e) => e.y).toList();
    if (spec != null) values.add(spec!);
    if (values.isEmpty) return const SizedBox.shrink();
    final lo = values.reduce(math.min) - (tolerance ?? 0) - 5;
    final hi = values.reduce(math.max) + (tolerance ?? 0) + 5;
    final every = math.max(1, (points.length / 6).ceil());

    HorizontalLine guide(double y, Color c, {bool dashed = false}) =>
        HorizontalLine(y: y, color: c, strokeWidth: 1.2, dashArray: dashed ? [6, 4] : null);

    LineChartBarData bar(List<FlSpot> sp, Color c) => LineChartBarData(
          spots: sp,
          color: c,
          barWidth: 2,
          isCurved: false,
          dotData: FlDotData(show: points.length <= 40),
        );

    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      SizedBox(
        height: 240,
        child: LineChart(LineChartData(
          minY: lo,
          maxY: hi,
          minX: 0,
          maxX: math.max(1, points.length - 1).toDouble(),
          gridData: FlGridData(show: true, getDrawingHorizontalLine: (_) => FlLine(color: t.border, strokeWidth: 1)),
          borderData: FlBorderData(show: true, border: Border.all(color: t.border)),
          titlesData: FlTitlesData(
            topTitles: const AxisTitles(),
            rightTitles: const AxisTitles(),
            leftTitles: AxisTitles(sideTitles: SideTitles(showTitles: true, reservedSize: 40, getTitlesWidget: (v, m) => Text(v.toStringAsFixed(0), style: TextStyle(fontSize: 10, color: t.mutedForeground)))),
            bottomTitles: AxisTitles(
              sideTitles: SideTitles(
                showTitles: true,
                interval: every.toDouble(),
                getTitlesWidget: (v, m) {
                  final i = v.toInt();
                  if (i < 0 || i >= points.length || v != i.toDouble()) return const SizedBox.shrink();
                  return Padding(padding: const EdgeInsets.only(top: 4), child: Text('${i + 1}', style: TextStyle(fontSize: 10, color: t.mutedForeground)));
                },
              ),
            ),
          ),
          extraLinesData: ExtraLinesData(horizontalLines: [
            if (spec != null) guide(spec!, s.success),
            if (spec != null && tolerance != null) ...[guide(spec! + tolerance!, s.warning, dashed: true), guide(spec! - tolerance!, s.warning, dashed: true)],
          ]),
          lineTouchData: LineTouchData(
            touchTooltipData: LineTouchTooltipData(
              getTooltipItems: (spots) => [
                for (final sp in spots)
                  LineTooltipItem(
                    '${points[sp.x.toInt()].label}\n${sp.barIndex == 0 ? 'Max' : 'Min'}: ${sp.y}',
                    TextStyle(color: t.primaryForeground, fontSize: 12),
                  ),
              ],
            ),
          ),
          lineBarsData: [bar(maxSpots, t.chart1), bar(minSpots, t.chart2)],
        )),
      ),
      const SizedBox(height: 8),
      Wrap(spacing: 16, runSpacing: 4, children: [
        _Legend(t.chart1, 'Max'),
        _Legend(t.chart2, 'Min'),
        if (spec != null) _Legend(s.success, 'Spec'),
        if (spec != null && tolerance != null) _Legend(s.warning, '± Tolerance'),
      ]),
    ]);
  }
}

class _Legend extends StatelessWidget {
  const _Legend(this.color, this.text);

  final Color color;
  final String text;

  @override
  Widget build(BuildContext context) => Row(mainAxisSize: MainAxisSize.min, children: [
        Container(width: 10, height: 10, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
        const SizedBox(width: 4),
        Text(text, style: TextStyle(fontSize: 12, color: context.tokens.mutedForeground)),
      ]);
}
