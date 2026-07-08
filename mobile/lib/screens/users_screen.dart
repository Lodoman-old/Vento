import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../services/auth_service.dart';

class UsersScreen extends StatefulWidget {
  const UsersScreen({super.key});

  @override
  State<UsersScreen> createState() => _UsersScreenState();
}

class _UsersScreenState extends State<UsersScreen> {
  List _users = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final data = await ApiService().get('/users?limit=500');
      _users = (data['data'] ?? data as List).cast<Map>();
    } catch (_) {}
    if (mounted) setState(() => _loading = false);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Usuarios')),
      body: _loading
        ? const Center(child: CircularProgressIndicator())
        : RefreshIndicator(
            onRefresh: _load,
            child: ListView.builder(
              padding: const EdgeInsets.all(12),
              itemCount: _users.length,
              itemBuilder: (_, i) {
                final u = _users[i];
                return Card(
                  child: ListTile(
                    leading: CircleAvatar(child: Text((u['name'] ?? '?')[0].toUpperCase())),
                    title: Text(u['name'] ?? '', style: const TextStyle(fontWeight: FontWeight.w600)),
                    subtitle: Text('${u['email'] ?? ''} — ${u['role'] ?? ''}', style: const TextStyle(fontSize: 12)),
                    trailing: u['is_active'] == true
                      ? const Icon(Icons.check_circle, color: Colors.green, size: 18)
                      : const Icon(Icons.cancel, color: Colors.red, size: 18),
                  ),
                );
              },
            ),
          ),
    );
  }
}
