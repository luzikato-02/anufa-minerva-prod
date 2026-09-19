import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../core/auth/auth_controller.dart';
import '../features/activity/activity_screen.dart';
import '../features/auth/forgot_password_screen.dart';
import '../features/auth/login_screen.dart';
import '../features/auth/two_factor_screen.dart';
import '../features/dashboard/dashboard_screen.dart';
import '../features/dashboard/module_list_screen.dart';
import '../features/machines/machine_screen.dart';
import '../features/settings/appearance_page.dart';
import '../features/sync/sync_screen.dart';
import '../features/documents/document_screen.dart';
import '../features/finish_earlier/fe_detail_screen.dart';
import '../features/finish_earlier/fe_records_screen.dart';
import '../features/finish_earlier/fe_scan_screen.dart';
import '../features/stock/stock_detail_screen.dart';
import '../features/stock/stock_recording_screen.dart';
import '../features/stock/stock_records_screen.dart';
import '../features/tension/recording/twisting_screen.dart';
import '../features/tension/recording/weaving_screen.dart';
import '../features/tension/tension_detail_screen.dart';
import '../features/tension/tension_edit_screen.dart';
import '../features/tension/tension_records_screen.dart';
import '../features/settings/password_page.dart';
import '../features/settings/profile_page.dart';
import '../features/settings/two_factor_page.dart';
import '../features/shared/module_placeholder.dart';
import '../features/users/users_screen.dart';
import 'nav.dart';

/// Nav paths that have a real screen registered above; the rest fall back to a placeholder.
const _built = {'/dashboard', '/under-construction', '/machine-maintenance', '/users', '/activity-log', '/tension-records', '/twisting-tension', '/weaving-tension', '/stock-taking', '/stock-take-records', '/finish-earlier', '/finish-earlier/scan', '/document-intelligence'};

const _publicPaths = {'/login', '/two-factor', '/forgot-password'};

/// Routes that need a permission, taken from the nav table plus non-nav pages.
String? _permissionFor(String path) {
  if (RegExp(r'^/tension-records/\d+/edit$').hasMatch(path)) return 'tension-records.edit';
  if (RegExp(r'^/finish-earlier/\d+/entries$').hasMatch(path)) return 'finish-earlier.edit';
  // Most specific nav entry wins: `/finish-earlier/scan` needs create, not just the list's view.
  NavItem? best;
  for (final g in navGroups) {
    for (final i in g.items) {
      final matches = path == i.path || path.startsWith('${i.path}/');
      if (matches && i.permission != null && (best == null || i.path.length > best.path.length)) best = i;
    }
  }
  return best?.permission;
}

final routerProvider = Provider<GoRouter>((ref) {
  final refresh = ValueNotifier<int>(0);
  ref.listen(authProvider, (_, _) => refresh.value++);
  ref.onDispose(refresh.dispose);

  return GoRouter(
    initialLocation: '/dashboard',
    refreshListenable: refresh,
    redirect: (context, state) {
      final auth = ref.read(authProvider);
      final path = state.uri.path;
      if (auth.isLoading) return path == '/splash' ? null : '/splash';
      final session = auth.value;
      if (session == null) return _publicPaths.contains(path) ? null : '/login';
      if (_publicPaths.contains(path) || path == '/splash' || path == '/') return '/dashboard';
      final needed = _permissionFor(path);
      if (needed != null && !session.can(needed)) return '/forbidden';
      return null;
    },
    routes: [
      GoRoute(path: '/', redirect: (_, _) => '/dashboard'),
      GoRoute(path: '/splash', builder: (_, _) => const Scaffold(body: Center(child: CircularProgressIndicator()))),
      GoRoute(path: '/login', builder: (_, _) => const LoginScreen()),
      GoRoute(path: '/two-factor', builder: (_, s) => TwoFactorScreen(challenge: s.extra as String? ?? '')),
      GoRoute(path: '/forgot-password', builder: (_, _) => const ForgotPasswordScreen()),
      GoRoute(path: '/forbidden', builder: (_, _) => const ModulePlaceholder('Access denied', message: "You don't have permission to view this page.")),
      GoRoute(path: '/dashboard', builder: (_, _) => const DashboardScreen()),
      GoRoute(path: '/record', builder: (_, _) => const ModuleListScreen(title: 'Record', section: NavSection.record)),
      GoRoute(path: '/records', builder: (_, _) => const ModuleListScreen(title: 'Records', section: NavSection.records)),
      GoRoute(path: '/more', builder: (_, _) => const ModuleListScreen(title: 'More', section: NavSection.more, showAccount: true)),
      GoRoute(path: '/settings', redirect: (_, _) => '/settings/profile'),
      GoRoute(path: '/settings/profile', builder: (_, _) => const ProfilePage()),
      GoRoute(path: '/settings/password', builder: (_, _) => const PasswordPage()),
      GoRoute(path: '/settings/two-factor', builder: (_, _) => const TwoFactorPage()),
      GoRoute(path: '/settings/appearance', builder: (_, _) => const AppearancePage()),
      GoRoute(path: '/under-construction', builder: (_, _) => const ModulePlaceholder('Under construction', message: 'This page is not available yet.')),
      GoRoute(path: '/machine-maintenance', builder: (_, _) => const MachineMaintenanceScreen()),
      GoRoute(path: '/users', builder: (_, _) => const UsersScreen()),
      GoRoute(path: '/activity-log', builder: (_, _) => const ActivityLogScreen()),
      GoRoute(path: '/twisting-tension', builder: (_, _) => const TwistingScreen()),
      GoRoute(path: '/weaving-tension', builder: (_, _) => const WeavingScreen()),
      GoRoute(path: '/stock-taking', builder: (_, _) => const StockRecordingScreen()),
      GoRoute(path: '/stock-take-records', builder: (_, _) => const StockRecordsScreen()),
      GoRoute(path: '/stock-take-records/:id', builder: (_, s) => StockDetailScreen(id: int.parse(s.pathParameters['id']!))),
      GoRoute(path: '/finish-earlier', builder: (_, _) => const FeRecordsScreen()),
      GoRoute(path: '/finish-earlier/scan', builder: (_, _) => const FeScanScreen()),
      GoRoute(path: '/finish-earlier/:id', builder: (_, s) => FeDetailScreen(id: int.parse(s.pathParameters['id']!))),
      GoRoute(path: '/finish-earlier/:id/entries', builder: (_, s) => FeEntriesScreen(id: int.parse(s.pathParameters['id']!))),
      GoRoute(path: '/document-intelligence', builder: (_, _) => const DocumentScreen()),
      GoRoute(path: '/sync', builder: (_, _) => const SyncScreen()),
      GoRoute(path: '/tension-records', builder: (_, _) => const TensionRecordsScreen()),
      GoRoute(path: '/tension-records/:id', builder: (_, s) => TensionDetailScreen(id: int.parse(s.pathParameters['id']!))),
      GoRoute(path: '/tension-records/:id/edit', builder: (_, s) => TensionEditScreen(id: int.parse(s.pathParameters['id']!))),
      // Module routes are replaced with real screens as each module lands.
      for (final g in navGroups)
        for (final i in g.items)
          if (!_built.contains(i.path)) GoRoute(path: i.path, builder: (_, _) => ModulePlaceholder(i.title)),
    ],
  );
});
