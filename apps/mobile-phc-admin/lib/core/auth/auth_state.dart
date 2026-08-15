import 'package:flutter/foundation.dart';

/// Authenticated PHC Admin user.
@immutable
class AuthUser {
  const AuthUser({
    required this.id,
    required this.name,
    required this.phone,
    this.role,
    this.facilityId,
    this.facilityName,
  });

  final String id;
  final String name;
  final String phone;
  final String? role;
  final String? facilityId;
  final String? facilityName;

  factory AuthUser.fromJson(Map<String, dynamic> json) => AuthUser(
        id: json['id'] as String? ?? '',
        name: json['name'] as String? ?? 'PHC Admin',
        phone: json['phone'] as String? ?? '',
        role: json['role'] as String?,
        facilityId: json['facility_id'] as String?,
        facilityName: json['facility_name'] as String?,
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'phone': phone,
        'role': role,
        'facility_id': facilityId,
        'facility_name': facilityName,
      };
}

/// Auth flow state machine.
@immutable
sealed class AuthState {
  const AuthState();
}

/// Bootstrapping - a persisted session may exist.
class AuthUnknown extends AuthState {
  const AuthUnknown();
}

/// No valid session.
class AuthUnauthenticated extends AuthState {
  const AuthUnauthenticated();
}

/// Valid session.
class AuthAuthenticated extends AuthState {
  const AuthAuthenticated(this.user);
  final AuthUser user;
}
