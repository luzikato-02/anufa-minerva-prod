import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/api/api_client.dart';
import '../../core/api/api_exception.dart';
import '../../core/auth/auth_controller.dart';
import '../../core/theme/app_theme.dart';
import '../../core/ui/app_alert.dart';
import '../../core/ui/app_button.dart';
import '../../core/ui/app_card.dart';
import '../../core/ui/app_skeleton.dart';
import '../shared/minerva_scaffold.dart';

final dashboardProvider = FutureProvider.autoDispose<Map<String, dynamic>>((ref) async {
  try {
    final res = await ref.watch(dioProvider).get('/dashboard');
    return Map<String, dynamic>.from(res.data as Map);
  } catch (e) {
    throw ApiException.from(e);
  }
});

class DashboardScreen extends ConsumerWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(sessionProvider);
    final data = ref.watch(dashboardProvider);
    return MinervaScaffold(
      title: 'Home',
      body: RefreshIndicator(
        onRefresh: () => ref.refresh(dashboardProvider.future),
        child: ListView(padding: const EdgeInsets.all(16), children: [
          Text('Welcome back, ${session.name.split(' ').first}', style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w600)),
          const SizedBox(height: 16),
          data.when(
            loading: () => const Column(children: [AppSkeleton(height: 110), SizedBox(height: 12), AppSkeleton(height: 110)]),
            error: (e, _) => Column(children: [
              AppAlert(message: e.toString()),
              const SizedBox(height: 12),
              AppButton(label: 'Retry', variant: AppButtonVariant.outline, onPressed: () => ref.invalidate(dashboardProvider)),
            ]),
            data: (d) => Column(children: [
              if (d['tension'] is Map)
                _StatsCard(
                  title: 'Tension records',
                  icon: LucideIcons.activity,
                  onTap: () => context.go('/tension-records'),
                  stats: {
                    'Total': d['tension']['total'],
                    'Twisting': d['tension']['twisting'],
                    'Weaving': d['tension']['weaving'],
                    'Open problems': d['tension']['open_problems'],
                  },
                ),
              if (d['stockTake'] is Map)
                _StatsCard(
                  title: 'Stock taking',
                  icon: LucideIcons.scanBarcode,
                  onTap: () => context.go('/stock-take-records'),
                  stats: {
                    'Sessions': d['stockTake']['total'],
                    'In progress': d['stockTake']['in_progress'],
                    'Completed': d['stockTake']['completed'],
                    'Completion': '${d['stockTake']['completion']}%',
                  },
                ),
              if (d['users'] is Map)
                _StatsCard(
                  title: 'Users',
                  icon: LucideIcons.users,
                  onTap: () => context.go('/users'),
                  stats: {'Total': d['users']['total'], 'No role': d['users']['unassigned']},
                ),
              if (d['tension'] == null && d['stockTake'] == null && d['users'] == null)
                const AppCard(child: Text('No dashboard sections are available for your role.')),
            ]),
          ),
        ]),
      ),
    );
  }
}

class _StatsCard extends StatelessWidget {
  const _StatsCard({required this.title, required this.icon, required this.stats, required this.onTap});

  final String title;
  final IconData icon;
  final Map<String, Object?> stats;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: InkWell(
        borderRadius: BorderRadius.circular(Radii.lg + 4),
        onTap: onTap,
        child: AppCard(
          title: title,
          action: Icon(icon, size: 18, color: t.mutedForeground),
          child: Wrap(spacing: 24, runSpacing: 12, children: [
            for (final e in stats.entries)
              Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('${e.value}', style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w600)),
                Text(e.key, style: TextStyle(fontSize: 12, color: t.mutedForeground)),
              ]),
          ]),
        ),
      ),
    );
  }
}
