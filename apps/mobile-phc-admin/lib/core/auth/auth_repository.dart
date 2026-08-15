import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../api/api_client.dart';
import 'auth_state.dart';

/// Repository for phone / OTP authentication against the ASHA Sathi backend.
///
/// Network calls degrade gracefully: when the backend is unreachable the
/// repository still completes the flow with demo credentials
/// (any phone, OTP `123456`), so the app remains fully explorable offline.
class AuthRepository {
  AuthRepository(this._dio, this._storage);

  final Dio _dio;
  final FlutterSecureStorage _storage;

  static const _tokenKey = 'phc_admin_auth_token';
  static const _userKey = 'phc_admin_auth_user';
  static const demoOtp = '123456';

  /// Request an OTP for the given phone number.
  Future<void> requestOtp(String phone) async {
    try {
      await _dio.post('/auth/otp', data: {'phone': phone, 'channel': 'phc_admin'});
    } on DioException {
      // Offline demo mode - OTP is validated in verifyOtp.
    }
  }

  /// Verify the OTP and establish a session. Returns the authenticated user.
  Future<AuthUser> verifyOtp(String phone, String otp) async {
    final normalized = phone.replaceAll(RegExp(r'[^0-9]'), '');
    if (normalized.length < 10) {
      throw Exception('Enter a valid 10-digit mobile number.');
    }
    try {
      final response = await _dio.post(
        '/auth/verify',
        data: {'phone': normalized, 'otp': otp, 'channel': 'phc_admin'},
      );
      final data = (response.data as Map<String, dynamic>? ?? const {});
      final token = data['token'] as String? ?? '';
      await _persistSession(token, AuthUser.fromJson(data['user'] as Map<String, dynamic>? ?? {}));
      return AuthUser.fromJson(data['user'] as Map<String, dynamic>? ?? {});
    } on DioException {
      if (otp == demoOtp) {
        final user = AuthUser(
          id: 'phc-0001',
          name: 'Dr. Meera Nair',
          phone: normalized,
          role: 'phc_admin',
          facilityId: 'phc-bhagalpur-01',
          facilityName: 'Bhagalpur PHC',
        );
        await _persistSession('demo-token', user);
        return user;
      }
      rethrow;
    }
  }

  /// Restore a persisted session at startup (used by the splash screen).
  Future<AuthUser?> restoreSession() async {
    try {
      final token = await _storage.read(key: _tokenKey);
      if (token == null || token.isEmpty) return null;
      setStoredToken(token);
      final cached = await _storage.read(key: _userKey);
      if (cached != null) {
        final user = AuthUser.fromJson(_decodeUser(cached));
        if (user.id.isNotEmpty) return user;
      }
      try {
        final response = await _dio.get('/auth/me');
        final data = response.data as Map<String, dynamic>? ?? const {};
        return AuthUser.fromJson(data);
      } on DioException {
        // Offline: return the demo user so the app remains usable.
        return AuthUser(
          id: 'phc-0001',
          name: 'Dr. Meera Nair',
          phone: '',
          role: 'phc_admin',
          facilityId: 'phc-bhagalpur-01',
          facilityName: 'Bhagalpur PHC',
        );
      }
    } on Exception {
      return null;
    }
  }

  Future<void> signOut() async {
    setStoredToken(null);
    await _storage.delete(key: _tokenKey);
    await _storage.delete(key: _userKey);
  }

  Future<void> _persistSession(String token, AuthUser user) async {
    setStoredToken(token);
    await _storage.write(key: _tokenKey, value: token);
    await _storage.write(key: _userKey, value: _encodeUser(user));
  }

  static Map<String, dynamic> _decodeUser(String raw) {
    try {
      return Map<String, dynamic>.from(
        (raw.split(',')).fold(<String, dynamic>{}, (map, pair) {
          final idx = pair.indexOf('=');
          if (idx <= 0) return map;
          map[pair.substring(0, idx)] = pair.substring(idx + 1);
          return map;
        }),
      );
    } catch (_) {
      return const {};
    }
  }

  static String _encodeUser(AuthUser user) =>
      user.toJson().entries.map((e) => '${e.key}=${e.value}').join(',');
}

/// Riverpod wiring for authentication.
final authRepositoryProvider = Provider<AuthRepository>(
  (ref) => AuthRepository(ref.watch(dioProvider), ref.watch(secureStorageProvider)),
);

/// Drives the auth state machine; exposes the state to the router + UI.
class AuthStateNotifier extends StateNotifier<AuthState> {
  AuthStateNotifier(this._repository) : super(const AuthUnknown());

  final AuthRepository _repository;

  Future<void> restoreSession() async {
    final user = await _repository.restoreSession();
    state = user == null ? const AuthUnauthenticated() : AuthAuthenticated(user);
  }

  Future<void> requestOtp(String phone) => _repository.requestOtp(phone);

  Future<void> verifyOtp(String phone, String otp) async {
    final user = await _repository.verifyOtp(phone, otp);
    state = AuthAuthenticated(user);
  }

  Future<void> signOut() async {
    await _repository.signOut();
    state = const AuthUnauthenticated();
  }
}

final authControllerProvider =
    StateNotifierProvider<AuthStateNotifier, AuthState>(
  (ref) => AuthStateNotifier(ref.watch(authRepositoryProvider)),
);
