/// The signed-in user with roles/permissions, as returned by `/auth/me` and login.
class Session {
  Session({required this.user, required this.roles, required this.permissions, required this.twoFactorEnabled});

  final Map<String, dynamic> user;
  final List<String> roles;
  final Set<String> permissions;
  final bool twoFactorEnabled;

  int get id => user['id'] as int;
  String get name => (user['name'] ?? '') as String;
  String get email => (user['email'] ?? '') as String;
  String? get username => user['username'] as String?;

  bool can(String permission) => permissions.contains(permission);
  bool canAny(Iterable<String> perms) => perms.any(can);

  String get initials {
    final parts = name.trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty).toList();
    if (parts.isEmpty) return '?';
    return parts.take(2).map((p) => p[0].toUpperCase()).join();
  }

  factory Session.fromJson(Map<String, dynamic> json) => Session(
        user: Map<String, dynamic>.from(json['user'] as Map),
        roles: List<String>.from(json['roles'] as List? ?? const []),
        permissions: Set<String>.from(json['permissions'] as List? ?? const []),
        twoFactorEnabled: json['two_factor_enabled'] == true,
      );
}
