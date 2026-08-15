import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Secure persistence keys.
abstract class _StorageKeys {
  static const token = 'asha_auth_token';
  static const refreshToken = 'asha_auth_refresh_token';
  static const userId = 'asha_auth_user_id';
  static const userJson = 'asha_auth_user_json';
  static const phone = 'asha_auth_phone';
}

/// Serializable representation of the authenticated ASHA worker.
class ASHAUser {
  const ASHAUser({
    required this.id,
    required this.name,
    required this.phone,
    this.role = 'asha',
    this.villageId,
    this.avatarUrl,
    this.isBiometricEnabled = false,
  });

  final String id;
  final String name;
  final String phone;
  final String role;
  final String? villageId;
  final String? avatarUrl;
  final bool isBiometricEnabled;

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'phone': phone,
        'role': role,
        'village_id': villageId,
        'avatar_url': avatarUrl,
        'is_biometric_enabled': isBiometricEnabled,
      };

  factory ASHAUser.fromJson(Map<String, dynamic> json) => ASHAUser(
        id: json['id'] as String,
        name: json['name'] as String? ?? '',
        phone: json['phone'] as String? ?? '',
        role: json['role'] as String? ?? 'asha',
        villageId: json['village_id'] as String?,
        avatarUrl: json['avatar_url'] as String?,
        isBiometricEnabled: json['is_biometric_enabled'] as bool? ?? false,
      );

  ASHAUser copyWith({bool? isBiometricEnabled}) => ASHAUser(
        id: id,
        name: name,
        phone: phone,
        role: role,
        villageId: villageId,
        avatarUrl: avatarUrl,
        isBiometricEnabled: isBiometricEnabled ?? this.isBiometricEnabled,
      );
}

/// Riverpod-friendly [ChangeNotifier] holding authentication state and
/// persisting credentials via [FlutterSecureStorage].
class AuthState extends ChangeNotifier {
  AuthState({FlutterSecureStorage? storage})
      : _storage = storage ?? const FlutterSecureStorage();

  final FlutterSecureStorage _storage;

  ASHAUser? _user;
  String? _token;
  bool _isAuthenticated = false;
  bool _isLoading = false;
  String? _phone;

  ASHAUser? get user => _user;
  String? get token => _token;
  String? get phone => _phone;
  bool get isAuthenticated => _isAuthenticated;
  bool get isLoading => _isLoading;

  set loading(bool value) {
    _isLoading = value;
    notifyListeners();
  }

  /// Restore a previously persisted session at app startup.
  Future<void> restoreSession() async {
    _token = await _storage.read(key: _StorageKeys.token);
    _phone = await _storage.read(key: _StorageKeys.phone);
    final userJson = await _storage.read(key: _StorageKeys.userJson);
    if (_token != null && userJson != null) {
      _user = ASHAUser.fromJson(jsonDecode(userJson) as Map<String, dynamic>);
      _isAuthenticated = true;
      notifyListeners();
    }
  }

  /// Persist a freshly verified session.
  Future<void> login({
    required String token,
    String? refreshToken,
    required ASHAUser user,
  }) async {
    _token = token;
    _user = user;
    _phone = user.phone;
    _isAuthenticated = true;

    await _storage.write(key: _StorageKeys.token, value: token);
    if (refreshToken != null) {
      await _storage.write(key: _StorageKeys.refreshToken, value: refreshToken);
    }
    await _storage.write(key: _StorageKeys.phone, value: user.phone);
    await _storage.write(
      key: _StorageKeys.userJson,
      value: jsonEncode(user.toJson()),
    );
    notifyListeners();
  }

  /// Update user object after profile/biometric changes.
  Future<void> updateUser(ASHAUser user) async {
    _user = user;
    await _storage.write(
      key: _StorageKeys.userJson,
      value: jsonEncode(user.toJson()),
    );
    notifyListeners();
  }

  /// Clear session and wipe persisted credentials.
  Future<void> logout() async {
    _user = null;
    _token = null;
    _phone = null;
    _isAuthenticated = false;
    await _storage.delete(key: _StorageKeys.token);
    await _storage.delete(key: _StorageKeys.refreshToken);
    await _storage.delete(key: _StorageKeys.userJson);
    await _storage.delete(key: _StorageKeys.phone);
    notifyListeners();
  }
}
