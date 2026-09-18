import 'dart:math';

import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../config/app_config.dart';
import 'auth_state.dart';

/// DTO returned by the auth endpoints.
class AuthTokens {
  const AuthTokens({
    required this.token,
    required this.refreshToken,
    required this.user,
  });

  final String token;
  final String refreshToken;
  final ASHAUser user;

  factory AuthTokens.fromJson(Map<String, dynamic> json) => AuthTokens(
        token: json['token'] as String? ?? json['access_token'] as String? ?? '',
        refreshToken:
            json['refresh_token'] as String? ?? json['refresh'] as String? ?? '',
        user: ASHAUser.fromJson(json['user'] as Map<String, dynamic>? ?? {}),
      );
}

/// Backend communication for OTP-based authentication and biometric login.
class AuthRepository {
  AuthRepository({Dio? dio, FlutterSecureStorage? storage})
      : _dio = dio ?? Dio(),
        _storage = storage ?? const FlutterSecureStorage();

  final Dio _dio;
  final FlutterSecureStorage _storage;

  Dio get dio => _dio;

  /// Request an OTP be sent to [phone] (normalised, 10-digit Indian mobile).
  Future<void> sendOtp(String phone) async {
    try {
      await _dio.post<Map<String, dynamic>>(
        '${AppConfig.apiBaseUrl}/auth/otp/send',
        data: {'phone': phone},
      );
    } on DioException catch (e) {
      if (e.response?.statusCode == 404 || e.response?.statusCode == 401) {
        // Fallback: some deployments simply accept the request.
        return;
      }
      rethrow;
    }
  }

  /// Verify [otp] for [phone] and return the issued session tokens.
  Future<AuthTokens> verifyOtp(String phone, String otp) async {
    final response = await _dio.post<Map<String, dynamic>>(
      '${AppConfig.apiBaseUrl}/auth/otp/verify',
      data: {'phone': phone, 'otp': otp},
    );
    final tokens = AuthTokens.fromJson(response.data ?? {});
    await _storage.write(
      key: 'asha_refresh_token',
      value: tokens.refreshToken,
    );
    return tokens;
  }

  /// Refresh the access token using a stored refresh token.
  Future<String> refreshToken() async {
    final refresh = await _storage.read(key: 'asha_refresh_token');
    if (refresh == null) {
      throw const AuthTokenExpiredException();
    }
    final response = await _dio.post<Map<String, dynamic>>(
      '${AppConfig.apiBaseUrl}/auth/token/refresh',
      data: {'refresh_token': refresh},
    );
    final token = response.data?['token'] ?? response.data?['access_token'];
    if (token == null) throw const AuthTokenExpiredException();
    await _storage.write(key: 'asha_access_token', value: token);
    return token as String;
  }

  /// Register the current device fingerprint for biometric login.
  Future<void> biometricRegister(String userId) async {
    final response = await _dio.post<Map<String, dynamic>>(
      '${AppConfig.apiBaseUrl}/auth/biometric/register',
      data: {'user_id': userId},
    );
    final publicKey = response.data?['public_key'] as String?;
    if (publicKey != null) {
      await _storage.write(key: 'asha_biometric_pubkey', value: publicKey);
    }
  }

  /// Verify a biometric challenge, returning fresh tokens on success.
  Future<AuthTokens> biometricVerify() async {
    final publicKey = await _storage.read(key: 'asha_biometric_pubkey');
    if (publicKey == null) {
      throw const BiometricNotRegisteredException();
    }
    final response = await _dio.post<Map<String, dynamic>>(
      '${AppConfig.apiBaseUrl}/auth/biometric/verify',
      data: {'public_key': publicKey},
    );
    return AuthTokens.fromJson(response.data ?? {});
  }

  /// Current access token used for attaching to authorised requests.
  Future<String?> accessToken() => _storage.read(key: 'asha_access_token');

  /// A stable per-install device identifier, persisted across restarts.
  ///
  /// Registered with the backend's /sync endpoints so the server can track
  /// the device for rotation/revocation and last-seen information.
  Future<String> deviceId() async {
    final existing = await _storage.read(key: 'asha_device_id');
    if (existing != null && existing.isNotEmpty) return existing;
    final rand = Random();
    final id = '${DateTime.now().microsecondsSinceEpoch.toRadixString(16)}'
        '-${rand.nextInt(0x7fffffff).toRadixString(16)}'
        '-${rand.nextInt(0x7fffffff).toRadixString(16)}';
    await _storage.write(key: 'asha_device_id', value: id);
    return id;
  }

  Future<void> clearSession() async {
    await _storage.delete(key: 'asha_access_token');
    await _storage.delete(key: 'asha_refresh_token');
  }
}

class AuthTokenExpiredException implements Exception {
  const AuthTokenExpiredException();
  @override
  String toString() => 'Session expired. Please log in again.';
}

class BiometricNotRegisteredException implements Exception {
  const BiometricNotRegisteredException();
  @override
  String toString() => 'Biometric login is not enabled on this device.';
}
