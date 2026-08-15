import 'package:flutter/foundation.dart';

/// Authenticated beneficiary.
@immutable
class AuthUser {
  const AuthUser({
    required this.id,
    required this.name,
    required this.phone,
    this.abhaNumber,
    this.abhaStatus,
    this.village,
    this.district,
  });

  final String id;
  final String name;
  final String phone;
  final String? abhaNumber;
  final String? abhaStatus;
  final String? village;
  final String? district;

  factory AuthUser.fromJson(Map<String, dynamic> json) => AuthUser(
        id: json['id'] as String? ?? '',
        name: json['name'] as String? ?? 'Beneficiary',
        phone: json['phone'] as String? ?? '',
        abhaNumber: json['abha_number'] as String?,
        abhaStatus: json['abha_status'] as String?,
        village: json['village'] as String?,
        district: json['district'] as String?,
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'phone': phone,
        'abha_number': abhaNumber,
        'abha_status': abhaStatus,
        'village': village,
        'district': district,
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
