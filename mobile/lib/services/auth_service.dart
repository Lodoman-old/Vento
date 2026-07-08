import 'package:flutter/foundation.dart';
import 'package:local_auth/local_auth.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/user.dart';
import 'api_service.dart';

class AuthService extends ChangeNotifier {
  static final AuthService _instance = AuthService._();
  factory AuthService() => _instance;
  AuthService._();

  final LocalAuthentication _localAuth = LocalAuthentication();
  User? _currentUser;
  bool _biometricEnabled = false;
  bool _hasBiometricsCache = false;

  User? get currentUser => _currentUser;
  bool get isLoggedIn => _currentUser != null;

  Future<void> init() async {
    final prefs = await SharedPreferences.getInstance();
    _biometricEnabled = prefs.getBool('biometric_enabled') ?? false;
    await hasBiometrics();
  }

  Future<bool> _checkBiometrics() async {
    try {
      return await _localAuth.canCheckBiometrics || await _localAuth.isDeviceSupported();
    } catch (_) {
      return false;
    }
  }

  Future<bool> hasBiometrics() async {
    _hasBiometricsCache = await _checkBiometrics();
    return _hasBiometricsCache;
  }

  bool isBiometricEnabledSync() => _biometricEnabled;

  bool hasBiometricsSync() => _hasBiometricsCache;

  Future<bool> authenticateWithBiometrics() async {
    try {
      return await _localAuth.authenticate(
        localizedReason: 'Usa tu huella para iniciar sesión',
        options: const AuthenticationOptions(biometricOnly: true, stickyAuth: true),
      );
    } catch (_) {
      return false;
    }
  }

  Future<bool> biometricLogin() async {
    final prefs = await SharedPreferences.getInstance();
    final enabled = prefs.getBool('biometric_enabled') ?? false;
    if (!enabled || !await hasBiometrics()) return false;
    if (!await authenticateWithBiometrics()) return false;
    final api = ApiService();
    final storedToken = prefs.getString('token');
    if (storedToken == null) return false;
    await api.setToken(storedToken);
    try {
      final data = await api.get('/auth/me');
      _currentUser = User.fromJson(data);
      notifyListeners();
      return true;
    } catch (_) {
      await api.setToken(null);
      return false;
    }
  }

  Future<User?> login(String email, String password) async {
    final api = ApiService();
    final data = await api.post('/auth/login', body: {'email': email, 'password': password});
    await api.setToken(data['token']);
    final user = User.fromJson(data['user']);
    _currentUser = user;
    notifyListeners();
    return user;
  }

  Future<void> toggleBiometric(bool enable) async {
    _biometricEnabled = enable;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('biometric_enabled', enable);
    notifyListeners();
  }

  Future<bool> isBiometricEnabled() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool('biometric_enabled') ?? false;
  }

  Future<void> logout() async {
    final api = ApiService();
    await api.setToken(null);
    _currentUser = null;
    _biometricEnabled = false;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('biometric_enabled', false);
    notifyListeners();
  }
}
