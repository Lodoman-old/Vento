import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/auth_service.dart';
import '../widgets/vento_logo.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _emailCtrl = TextEditingController();
  final _passCtrl = TextEditingController();
  bool _loading = false;
  bool _obscure = true;
  bool _showBio = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _checkBio());
  }

  Future<void> _checkBio() async {
    try {
      final auth = context.read<AuthService>();
      if (await auth.hasBiometrics()) {
        if (mounted) setState(() => _showBio = true);
        if (await auth.isBiometricEnabled()) {
          if (mounted) _biometricLogin();
          return;
        }
      }
    } catch (_) {}
  }

  Future<void> _login() async {
    final email = _emailCtrl.text.trim();
    final pass = _passCtrl.text.trim();
    if (email.isEmpty || pass.isEmpty) return;
    setState(() => _loading = true);
    try {
      await context.read<AuthService>().login(email, pass);
      if (mounted) _postLogin();
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString().replaceFirst('Exception: ', ''))));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _postLogin() async {
    try {
      final auth = context.read<AuthService>();
      if (!auth.isBiometricEnabledSync() && await auth.hasBiometrics()) {
        final enable = await showDialog<bool>(
          context: context,
          barrierDismissible: false,
          builder: (ctx) => AlertDialog(
            title: const Text('¿Usar huella digital?'),
            content: const Text('¿Deseas activar el inicio de sesión con huella digital?'),
            actions: [
              TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('No')),
              TextButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Sí')),
            ],
          ),
        );
        if (enable == true) {
          if (await auth.authenticateWithBiometrics()) {
            await auth.toggleBiometric(true);
          }
        }
      }
    } catch (_) {}
    if (mounted) _navigateHome();
  }

  Future<void> _biometricLogin() async {
    if (!mounted) return;
    final ok = await context.read<AuthService>().biometricLogin();
    if (ok && mounted) _navigateHome();
  }

  void _navigateHome() {
    final user = context.read<AuthService>().currentUser;
    if (user != null && user.isClient) {
      Navigator.pushReplacementNamed(context, '/portal');
    } else {
      Navigator.pushReplacementNamed(context, '/home');
    }
  }

  @override
  void dispose() {
    _emailCtrl.dispose();
    _passCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(32),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            const VentoLogo(size: 100),
            const SizedBox(height: 32),
            TextField(
              controller: _emailCtrl,
              decoration: const InputDecoration(labelText: 'Email o usuario', border: OutlineInputBorder()),
              textInputAction: TextInputAction.next,
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _passCtrl,
              obscureText: _obscure,
              decoration: InputDecoration(
                labelText: 'Contraseña', border: const OutlineInputBorder(),
                suffixIcon: IconButton(icon: Icon(_obscure ? Icons.visibility_off : Icons.visibility), onPressed: () => setState(() => _obscure = !_obscure)),
              ),
              onSubmitted: (_) => _login(),
            ),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: _loading ? null : _login,
                child: _loading ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2)) : const Text('Iniciar sesión'),
              ),
            ),
            if (_showBio) const SizedBox(height: 12),
            if (_showBio)
              OutlinedButton.icon(
                icon: const Icon(Icons.fingerprint),
                label: const Text('Huella digital'),
                onPressed: _biometricLogin,
              ),
          ]),
        ),
      ),
    );
  }
}
