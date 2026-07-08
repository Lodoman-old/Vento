import 'package:flutter/foundation.dart';
import '../services/api_service.dart';

class AuthProvider extends ChangeNotifier {
  final ApiService _api = ApiService();
  Map<String, dynamic>? _user;
  bool _isLoading = false;

  Map<String, dynamic>? get user => _user;
  bool get isLoading => _isLoading;
  ApiService get api => _api;
  bool get isAdmin => _user?['role'] == 'admin';
  bool get isStaff => _user?['role'] == 'staff';

  Future<void> login(String email, String password) async {
    _isLoading = true;
    notifyListeners();

    try {
      final data = await _api.post('/auth/login', body: {
        'email': email,
        'password': password,
      });
      _user = data['user'];
      _api.setToken(data['token']);
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  void logout() {
    _user = null;
    _api.setToken(null);
    notifyListeners();
  }
}
