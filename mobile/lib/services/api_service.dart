import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

class ApiService {
  static final ApiService _instance = ApiService._();
  factory ApiService() => _instance;
  ApiService._();

  String _baseUrl = '';
  String? _token;

  String get baseUrl => _baseUrl;

  Future<void> init() async {
    final prefs = await SharedPreferences.getInstance();
    _baseUrl = prefs.getString('api_url') ?? '';
    _token = prefs.getString('token');
  }

  Future<void> setBaseUrl(String url) async {
    _baseUrl = url.replaceAll(RegExp(r'/+$'), '');
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('api_url', _baseUrl);
  }

  Future<void> setToken(String? token) async {
    _token = token;
    final prefs = await SharedPreferences.getInstance();
    if (token != null) {
      await prefs.setString('token', token);
    } else {
      await prefs.remove('token');
    }
  }

  bool get hasBaseUrl => _baseUrl.isNotEmpty;
  bool get hasToken => _token != null && _token!.isNotEmpty;

  /// Resuelve URLs de imágenes: si ya es absoluta (http) la usa directo, si no, prepende el baseUrl
  String imageUrl(String? url) {
    if (url == null || url.isEmpty) return '';
    if (url.startsWith('http')) return url;
    return '$_baseUrl$url';
  }

  Map<String, String> get _headers => {
    'Content-Type': 'application/json',
    if (_token != null) 'Authorization': 'Bearer $_token',
  };

  Future<dynamic> get(String path) => _request('GET', path);
  Future<dynamic> post(String path, {Map<String, dynamic>? body}) => _request('POST', path, body: body);
  Future<dynamic> put(String path, {Map<String, dynamic>? body}) => _request('PUT', path, body: body);
  Future<dynamic> patch(String path, {Map<String, dynamic>? body}) => _request('PATCH', path, body: body);
  Future<dynamic> delete(String path) => _request('DELETE', path);

  Future<String> uploadFile(String path, String filePath, {Map<String, String>? fields}) async {
    final uri = Uri.parse('$_baseUrl/api$path');
    final request = http.MultipartRequest('POST', uri);
    if (_token != null) request.headers['Authorization'] = 'Bearer $_token';
    if (fields != null) request.fields.addAll(fields);
    request.files.add(await http.MultipartFile.fromPath('file', filePath));
    final streamed = await request.send().timeout(const Duration(seconds: 30));
    final res = await http.Response.fromStream(streamed);
    final data = jsonDecode(res.body);
    if (res.statusCode >= 400) throw Exception(data['error'] ?? 'Error al subir');
    return data['url'] as String;
  }

  Future<dynamic> _request(String method, String path, {Map<String, dynamic>? body}) async {
    final uri = Uri.parse('$_baseUrl/api$path');
    try {
      late http.Response res;
      switch (method) {
        case 'GET': res = await http.get(uri, headers: _headers).timeout(const Duration(seconds: 10)); break;
        case 'POST': res = await http.post(uri, headers: _headers, body: body != null ? jsonEncode(body) : null).timeout(const Duration(seconds: 10)); break;
        case 'PUT': res = await http.put(uri, headers: _headers, body: body != null ? jsonEncode(body) : null).timeout(const Duration(seconds: 10)); break;
        case 'PATCH': res = await http.patch(uri, headers: _headers, body: body != null ? jsonEncode(body) : null).timeout(const Duration(seconds: 10)); break;
        case 'DELETE': res = await http.delete(uri, headers: _headers).timeout(const Duration(seconds: 10)); break;
      }
      final data = jsonDecode(res.body);
      if (res.statusCode >= 400) throw Exception(data['error'] ?? 'Error del servidor');
      return data;
    } on TimeoutException {
      throw Exception('Tiempo de espera agotado');
    } on SocketException {
      throw Exception('Sin conexión al servidor');
    }
  }
}
