import 'dart:async';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import '../services/api_service.dart';
import '../widgets/vento_logo.dart';

class SetupScreen extends StatefulWidget {
  const SetupScreen({super.key});

  @override
  State<SetupScreen> createState() => _SetupScreenState();
}

class _SetupScreenState extends State<SetupScreen> {
  final _controller = TextEditingController(text: 'http://192.168.0.4:4000');
  bool _loading = false;
  String? _testResult;

  Future<void> _testConnection() async {
    final url = _controller.text.trim().replaceAll(RegExp(r'/+$'), '');
    if (url.isEmpty) return;
    setState(() { _loading = true; _testResult = null; });
    try {
      final res = await http.get(Uri.parse('$url/api/events?limit=1'), headers: {'Content-Type': 'application/json'})
          .timeout(const Duration(seconds: 5));
      if (res.statusCode == 401 || res.statusCode == 200) {
        _testResult = '✓ Conexión exitosa';
      } else {
        _testResult = '✗ Error: ${res.statusCode}';
      }
    } on TimeoutException {
      _testResult = '✗ Tiempo de espera agotado';
    } on SocketException {
      _testResult = '✗ No se puede alcanzar el servidor';
    } catch (e) {
      _testResult = '✗ ${e.toString().replaceFirst("Exception: ", "")}';
    }
    if (mounted) setState(() => _loading = false);
  }

  Future<void> _save() async {
    final url = _controller.text.trim();
    if (url.isEmpty) return;
    setState(() => _loading = true);
    try {
      await context.read<ApiService>().setBaseUrl(url);
      if (mounted) Navigator.pushReplacementNamed(context, '/login');
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e')));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            const VentoLogo(size: 100),
            const SizedBox(height: 24),
            TextField(
              controller: _controller,
              decoration: const InputDecoration(labelText: 'URL del servidor', border: OutlineInputBorder()),
              keyboardType: TextInputType.url,
            ),
            const SizedBox(height: 8),
            if (_testResult != null)
              Text(_testResult!, style: TextStyle(
                fontSize: 13,
                color: _testResult!.startsWith('✓') ? Colors.green : Colors.red,
              )),
            const SizedBox(height: 16),
            Row(children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: _loading ? null : _testConnection,
                  child: _loading ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2)) : const Text('Probar conexión'),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: ElevatedButton(
                  onPressed: _loading ? null : _save,
                  child: const Text('Conectar'),
                ),
              ),
            ]),
          ]),
        ),
      ),
    );
  }
}
