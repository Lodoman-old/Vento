import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/auth_service.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  bool _biometricEnabled = false;
  bool _hasBiometrics = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final auth = context.read<AuthService>();
    setState(() {
      _biometricEnabled = auth.isBiometricEnabledSync();
      _hasBiometrics = auth.hasBiometricsSync();
    });
  }

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthService>().currentUser;
    return Scaffold(
      appBar: AppBar(title: const Text('Configuración')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(children: [
                CircleAvatar(radius: 30, child: Text(user?.name.isNotEmpty == true ? user!.name[0].toUpperCase() : '?')),
                const SizedBox(height: 8),
                Text(user?.name ?? '', style: const TextStyle(fontWeight: FontWeight.bold)),
                Text(user?.email ?? '', style: const TextStyle(color: Colors.grey, fontSize: 13)),
                Text(user?.role ?? '', style: const TextStyle(color: Colors.grey, fontSize: 12)),
              ]),
            ),
          ),
          const SizedBox(height: 16),
          if (_hasBiometrics)
            SwitchListTile(
              title: const Text('Huella digital'),
              subtitle: const Text('Iniciar sesión con huella'),
              value: _biometricEnabled,
              onChanged: (v) async {
                final auth = context.read<AuthService>();
                if (v && !await auth.authenticateWithBiometrics()) return;
                await auth.toggleBiometric(v);
                setState(() => _biometricEnabled = v);
              },
            ),
          const SizedBox(height: 16),
          TextButton.icon(
            icon: const Icon(Icons.logout, color: Colors.red),
            label: const Text('Cerrar sesión', style: TextStyle(color: Colors.red)),
            onPressed: () async {
              await context.read<AuthService>().logout();
              if (mounted) Navigator.pushReplacementNamed(context, '/login');
            },
          ),
        ],
      ),
    );
  }
}
