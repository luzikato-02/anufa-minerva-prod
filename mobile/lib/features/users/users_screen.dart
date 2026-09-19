import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/api/api_client.dart';
import '../../core/api/api_exception.dart';
import '../../core/api/paged.dart';
import '../../core/auth/auth_controller.dart';
import '../../core/theme/app_theme.dart';
import '../../core/ui/app_alert.dart';
import '../../core/ui/app_badge.dart';
import '../../core/ui/app_button.dart';
import '../../core/ui/app_card.dart';
import '../../core/ui/app_text_field.dart';
import '../../core/ui/async_body.dart';
import '../../core/ui/form_sheet.dart';
import '../../core/ui/paged_list.dart';
import '../settings/settings_shell.dart' show showToast;
import '../shared/minerva_scaffold.dart';

class RoleInfo {
  RoleInfo(this.id, this.name, this.permissions);
  final int id;
  final String name;
  final List<String> permissions;

  factory RoleInfo.fromJson(Map<String, dynamic> j) => RoleInfo(
        j['id'] as int,
        j['name'] as String,
        [for (final p in (j['permissions'] as List? ?? const [])) (p as Map)['name'] as String],
      );
}

final rolesProvider = FutureProvider.autoDispose<List<RoleInfo>>((ref) async {
  try {
    final res = await ref.watch(dioProvider).get('/roles');
    return [for (final j in res.data as List) RoleInfo.fromJson(Map<String, dynamic>.from(j as Map))];
  } catch (e) {
    throw ApiException.from(e);
  }
});

final permissionsProvider = FutureProvider.autoDispose<List<String>>((ref) async {
  try {
    final res = await ref.watch(dioProvider).get('/permissions');
    return [for (final j in res.data as List) (j as Map)['name'] as String];
  } catch (e) {
    throw ApiException.from(e);
  }
});

final userStatsProvider = FutureProvider.autoDispose<Map<String, dynamic>>((ref) async {
  try {
    final res = await ref.watch(dioProvider).get('/user-management-statistics');
    return Map<String, dynamic>.from(res.data as Map);
  } catch (e) {
    throw ApiException.from(e);
  }
});

class UsersScreen extends ConsumerStatefulWidget {
  const UsersScreen({super.key});

  @override
  ConsumerState<UsersScreen> createState() => _UsersScreenState();
}

class _UsersScreenState extends ConsumerState<UsersScreen> with SingleTickerProviderStateMixin {
  late final TabController _tabs;
  String _search = '';

  @override
  void initState() {
    super.initState();
    final canRoles = ref.read(sessionProvider).can('roles.manage');
    _tabs = TabController(length: canRoles ? 2 : 1, vsync: this)..addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final session = ref.watch(sessionProvider);
    final canManage = session.can('users.manage');
    final canRoles = session.can('roles.manage');
    final query = PagedQuery('/users', {if (_search.isNotEmpty) 'search': _search});

    return MinervaScaffold(
      title: 'User & Role Management',
      fab: (_tabs.index == 0 && canManage)
          ? FloatingActionButton.extended(onPressed: () => _editUser(context, ref, null), icon: const Icon(LucideIcons.userPlus), label: const Text('New user'))
          : (_tabs.index == 1 && canRoles)
              ? FloatingActionButton.extended(onPressed: () => _editRole(context, ref, null), icon: const Icon(LucideIcons.plus), label: const Text('New role'))
              : null,
      body: Column(children: [
        if (canRoles) TabBar(controller: _tabs, tabs: const [Tab(text: 'Users'), Tab(text: 'Roles')]),
        Expanded(
          child: TabBarView(controller: _tabs, children: [
            PagedList(
              query: query,
              emptyMessage: 'No users found.',
              header: Padding(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
                child: Column(children: [
                  const _StatsRow(),
                  const SizedBox(height: 12),
                  SearchField(hint: 'Search name, email or username', onChanged: (v) => setState(() => _search = v)),
                ]),
              ),
              itemBuilder: (ctx, u) => _UserCard(user: u, canManage: canManage, selfId: session.id, query: query),
            ),
            if (canRoles) const _RolesTab(),
          ]),
        ),
      ]),
    );
  }
}

class _StatsRow extends ConsumerWidget {
  const _StatsRow();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.tokens;
    final s = ref.watch(userStatsProvider).value;
    if (s == null) return const SizedBox.shrink();
    Widget cell(String label, Object? v) => Expanded(
          child: Column(children: [
            Text('$v', style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w600)),
            Text(label, textAlign: TextAlign.center, style: TextStyle(fontSize: 11, color: t.mutedForeground)),
          ]),
        );
    return AppCard(
      padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
      child: Row(children: [
        cell('Users', s['total_users']),
        cell('Roles', s['total_roles']),
        cell('Permissions', s['total_permissions']),
        cell('No role', s['unassigned_users']),
      ]),
    );
  }
}

class _UserCard extends ConsumerWidget {
  const _UserCard({required this.user, required this.canManage, required this.selfId, required this.query});

  final Map<String, dynamic> user;
  final bool canManage;
  final int selfId;
  final PagedQuery query;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.tokens;
    final active = user['status'] != 'inactive';
    final roles = [for (final r in (user['roles'] as List? ?? const [])) (r as Map)['name'] as String];
    final isSelf = user['id'] == selfId;
    return AppCard(
      title: user['name'] as String,
      description: '${user['username'] ?? ''} · ${user['email']}',
      action: Row(mainAxisSize: MainAxisSize.min, children: [
        AppBadge(active ? 'Active' : 'Inactive', variant: active ? AppBadgeVariant.success : AppBadgeVariant.secondary),
        if (canManage)
          PopupMenuButton<String>(
            icon: const Icon(LucideIcons.ellipsisVertical, size: 18),
            onSelected: (v) => _act(context, ref, v),
            itemBuilder: (_) => [
              const PopupMenuItem(value: 'edit', child: Text('Edit')),
              const PopupMenuItem(value: 'roles', child: Text('Assign roles')),
              if (!isSelf) PopupMenuItem(value: 'status', child: Text(active ? 'Deactivate' : 'Activate')),
              if (!isSelf) PopupMenuItem(value: 'delete', child: Text('Delete', style: TextStyle(color: t.destructive))),
            ],
          ),
      ]),
      child: roles.isEmpty
          ? Text('No roles assigned', style: TextStyle(fontSize: 13, color: t.mutedForeground))
          : Wrap(spacing: 6, runSpacing: 6, children: [for (final r in roles) AppBadge(r, variant: AppBadgeVariant.outline)]),
    );
  }

  Future<void> _act(BuildContext context, WidgetRef ref, String action) async {
    final notifier = ref.read(pagedProvider(query).notifier);
    final dio = ref.read(dioProvider);
    final id = user['id'];
    try {
      switch (action) {
        case 'edit':
          await _editUser(context, ref, user);
        case 'roles':
          final roles = await ref.read(rolesProvider.future);
          if (!context.mounted) return;
          final current = {for (final r in (user['roles'] as List? ?? const [])) (r as Map)['name'] as String};
          final chosen = await showFormSheet<Set<String>>(
            context,
            title: 'Assign roles',
            description: user['name'] as String,
            builder: (_) => _RolePicker(all: [for (final r in roles) r.name], initial: current),
          );
          if (chosen != null) {
            await dio.put('/users/$id/roles', data: {'roles': chosen.toList()});
            notifier.refresh();
            ref.invalidate(userStatsProvider);
          }
        case 'status':
          final next = user['status'] == 'inactive' ? 'active' : 'inactive';
          if (next == 'inactive' && !await confirmDialog(context, title: 'Deactivate ${user['name']}?', message: 'They will lose access immediately.', confirmLabel: 'Deactivate', destructive: true)) return;
          await dio.patch('/users/$id/status', data: {'status': next});
          notifier.refresh();
        case 'delete':
          if (!await confirmDialog(context, title: 'Delete ${user['name']}?', message: 'This cannot be undone.', confirmLabel: 'Delete', destructive: true)) return;
          await dio.delete('/users/$id');
          notifier.refresh();
          ref.invalidate(userStatsProvider);
      }
    } catch (e) {
      if (context.mounted) showToast(context, ApiException.from(e).message);
    }
  }
}

Future<void> _editUser(BuildContext context, WidgetRef ref, Map<String, dynamic>? existing) async {
  final roles = await ref.read(rolesProvider.future).catchError((_) => <RoleInfo>[]);
  if (!context.mounted) return;
  final saved = await showFormSheet<bool>(
    context,
    title: existing == null ? 'New user' : 'Edit user',
    builder: (_) => _UserForm(existing: existing, roleNames: [for (final r in roles) r.name]),
  );
  if (saved == true) {
    // Invalidate every cached user list (any search term) and the stats.
    ref.invalidate(pagedProvider);
    ref.invalidate(userStatsProvider);
  }
}

class _RolePicker extends StatefulWidget {
  const _RolePicker({required this.all, required this.initial});

  final List<String> all;
  final Set<String> initial;

  @override
  State<_RolePicker> createState() => _RolePickerState();
}

class _RolePickerState extends State<_RolePicker> {
  late final Set<String> _sel = {...widget.initial};

  @override
  Widget build(BuildContext context) => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        if (widget.all.isEmpty) const Text('No roles exist yet.'),
        for (final r in widget.all)
          CheckboxListTile(
            contentPadding: EdgeInsets.zero,
            controlAffinity: ListTileControlAffinity.leading,
            title: Text(r),
            value: _sel.contains(r),
            onChanged: (v) => setState(() => v == true ? _sel.add(r) : _sel.remove(r)),
          ),
        const SizedBox(height: 12),
        AppButton(label: 'Save roles', expand: true, onPressed: () => Navigator.pop(context, _sel)),
      ]);
}

class _UserForm extends ConsumerStatefulWidget {
  const _UserForm({this.existing, required this.roleNames});

  final Map<String, dynamic>? existing;
  final List<String> roleNames;

  @override
  ConsumerState<_UserForm> createState() => _UserFormState();
}

class _UserFormState extends ConsumerState<_UserForm> {
  late final _name = TextEditingController(text: widget.existing?['name'] as String?);
  late final _username = TextEditingController(text: widget.existing?['username'] as String?);
  late final _email = TextEditingController(text: widget.existing?['email'] as String?);
  final _password = TextEditingController();
  final Set<String> _roles = {};
  bool _busy = false;
  ApiException? _error;

  bool get _isNew => widget.existing == null;

  Future<void> _save() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    final body = {
      'name': _name.text.trim(),
      'username': _username.text.trim(),
      'email': _email.text.trim(),
      if (_isNew || _password.text.isNotEmpty) 'password': _password.text,
      if (_isNew) 'roles': _roles.toList(),
    };
    try {
      final dio = ref.read(dioProvider);
      _isNew ? await dio.post('/users', data: body) : await dio.patch('/users/${widget.existing!['id']}', data: body);
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (mounted) setState(() => _error = ApiException.from(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        if (_error != null && _error!.fieldErrors.isEmpty) ...[AppAlert(message: _error!.message), const SizedBox(height: 12)],
        AppTextField(label: 'Name', controller: _name, error: _error?.field('name')),
        const SizedBox(height: 12),
        AppTextField(label: 'Username', controller: _username, error: _error?.field('username')),
        const SizedBox(height: 12),
        AppTextField(label: 'Email', controller: _email, keyboardType: TextInputType.emailAddress, error: _error?.field('email')),
        const SizedBox(height: 12),
        AppTextField(label: _isNew ? 'Password' : 'New password (optional)', controller: _password, obscure: true, error: _error?.field('password')),
        if (_isNew && widget.roleNames.isNotEmpty) ...[
          const SizedBox(height: 12),
          const Text('Roles', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w500)),
          for (final r in widget.roleNames)
            CheckboxListTile(
              dense: true,
              contentPadding: EdgeInsets.zero,
              controlAffinity: ListTileControlAffinity.leading,
              title: Text(r),
              value: _roles.contains(r),
              onChanged: (v) => setState(() => v == true ? _roles.add(r) : _roles.remove(r)),
            ),
        ],
        const SizedBox(height: 16),
        AppButton(label: 'Save', expand: true, loading: _busy, onPressed: _save),
      ]);
}

// ── Roles ─────────────────────────────────────────────────────────────────────

class _RolesTab extends ConsumerWidget {
  const _RolesTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.tokens;
    return RefreshIndicator(
      onRefresh: () => ref.refresh(rolesProvider.future),
      child: AsyncBody<List<RoleInfo>>(
        value: ref.watch(rolesProvider),
        onRetry: () => ref.invalidate(rolesProvider),
        isEmpty: (d) => d.isEmpty,
        emptyMessage: 'No roles yet.',
        builder: (roles) => ListView.separated(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 96),
          itemCount: roles.length,
          separatorBuilder: (_, _) => const SizedBox(height: 12),
          itemBuilder: (_, i) {
            final r = roles[i];
            return AppCard(
              title: r.name,
              description: '${r.permissions.length} permission${r.permissions.length == 1 ? '' : 's'}',
              action: Row(mainAxisSize: MainAxisSize.min, children: [
                IconButton(icon: const Icon(LucideIcons.pencil, size: 18), onPressed: () => _editRole(context, ref, r)),
                IconButton(icon: Icon(LucideIcons.trash2, size: 18, color: t.destructive), onPressed: () => _deleteRole(context, ref, r)),
              ]),
              child: Wrap(spacing: 6, runSpacing: 6, children: [for (final p in r.permissions) AppBadge(p, variant: AppBadgeVariant.secondary)]),
            );
          },
        ),
      ),
    );
  }
}

Future<void> _deleteRole(BuildContext context, WidgetRef ref, RoleInfo r) async {
  if (!await confirmDialog(context, title: 'Delete role ${r.name}?', message: 'Users with this role will lose its permissions.', confirmLabel: 'Delete', destructive: true)) return;
  try {
    await ref.read(dioProvider).delete('/roles/${r.id}');
    ref.invalidate(rolesProvider);
    ref.invalidate(userStatsProvider);
    ref.invalidate(pagedProvider);
  } catch (e) {
    if (context.mounted) showToast(context, ApiException.from(e).message);
  }
}

Future<void> _editRole(BuildContext context, WidgetRef ref, RoleInfo? existing) async {
  final perms = await ref.read(permissionsProvider.future).catchError((_) => <String>[]);
  if (!context.mounted) return;
  final saved = await showFormSheet<bool>(
    context,
    title: existing == null ? 'New role' : 'Edit role',
    builder: (_) => _RoleForm(existing: existing, allPermissions: perms),
  );
  if (saved == true) {
    ref.invalidate(rolesProvider);
    ref.invalidate(userStatsProvider);
    ref.invalidate(pagedProvider);
  }
}

class _RoleForm extends ConsumerStatefulWidget {
  const _RoleForm({this.existing, required this.allPermissions});

  final RoleInfo? existing;
  final List<String> allPermissions;

  @override
  ConsumerState<_RoleForm> createState() => _RoleFormState();
}

class _RoleFormState extends ConsumerState<_RoleForm> {
  late final _name = TextEditingController(text: widget.existing?.name);
  late final Set<String> _sel = {...?widget.existing?.permissions};
  bool _busy = false;
  ApiException? _error;

  Map<String, List<String>> get _grouped {
    final g = <String, List<String>>{};
    for (final p in widget.allPermissions) {
      g.putIfAbsent(p.split('.').first, () => []).add(p);
    }
    return g;
  }

  Future<void> _save() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    final body = {'name': _name.text.trim(), 'permissions': _sel.toList()};
    try {
      final dio = ref.read(dioProvider);
      widget.existing == null ? await dio.post('/roles', data: body) : await dio.patch('/roles/${widget.existing!.id}', data: body);
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (mounted) setState(() => _error = ApiException.from(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      if (_error != null && _error!.fieldErrors.isEmpty) ...[AppAlert(message: _error!.message), const SizedBox(height: 12)],
      AppTextField(label: 'Role name', controller: _name, error: _error?.field('name')),
      const SizedBox(height: 12),
      for (final e in _grouped.entries) ...[
        Padding(padding: const EdgeInsets.only(top: 8), child: Text(e.key, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: t.mutedForeground))),
        for (final p in e.value)
          CheckboxListTile(
            dense: true,
            contentPadding: EdgeInsets.zero,
            controlAffinity: ListTileControlAffinity.leading,
            title: Text(p.substring(e.key.length + 1)),
            value: _sel.contains(p),
            onChanged: (v) => setState(() => v == true ? _sel.add(p) : _sel.remove(p)),
          ),
      ],
      const SizedBox(height: 16),
      AppButton(label: 'Save role', expand: true, loading: _busy, onPressed: _save),
    ]);
  }
}
