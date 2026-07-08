import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import '../models/event.dart';
import '../services/api_service.dart';
import '../services/auth_service.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  List<Event> _events = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final data = await ApiService().get('/events?limit=100');
      final list = data['data'] ?? data as List;
      _events = (list as List).map((e) => Event.fromJson(e)).toList();
      _error = null;
    } catch (e) {
      _error = e.toString().replaceFirst('Exception: ', '');
    }
    if (mounted) setState(() => _loading = false);
  }

  Future<void> _deleteEvent(String id) async {
    final ok = await showDialog<bool>(context: context, builder: (ctx) => AlertDialog(
      title: const Text('Eliminar evento'),
      content: const Text('¿Eliminar este evento permanentemente?'),
      actions: [
        TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancelar')),
        TextButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Eliminar', style: TextStyle(color: Colors.red))),
      ],
    ));
    if (ok != true) return;
    try {
      await ApiService().delete('/events/$id');
      _load();
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: ${e.toString().replaceFirst("Exception: ", "")}')));
    }
  }

  String _statusColor(String status) {
    switch (status) {
      case 'activo': return 'FF22C55E';
      case 'borrador': return 'FF64748B';
      case 'completado': return 'FF3B82F6';
      case 'cancelado': return 'FFEF4444';
      default: return 'FF64748B';
    }
  }

  String _statusLabel(String status) {
    switch (status) {
      case 'borrador': return 'Borrador';
      case 'activo': return 'Activo';
      case 'completado': return 'Completado';
      case 'cancelado': return 'Cancelado';
      default: return status;
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthService>().currentUser;
    final isAdmin = user?.role == 'admin';
    return Scaffold(
      appBar: AppBar(title: const Text('Vento')),
      drawer: Drawer(
        child: ListView(
          padding: EdgeInsets.zero,
          children: [
            DrawerHeader(
              decoration: const BoxDecoration(color: Color(0xFF0F766E)),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisAlignment: MainAxisAlignment.end, children: [
                CircleAvatar(
                  backgroundColor: Colors.white,
                  child: Text(user?.name.isNotEmpty == true ? user!.name[0].toUpperCase() : '?', style: const TextStyle(color: Color(0xFF0F766E), fontWeight: FontWeight.bold)),
                ),
                const SizedBox(height: 8),
                Text(user?.name ?? '', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                Text(user?.email ?? '', style: const TextStyle(color: Colors.white70, fontSize: 12)),
                Text(user?.role ?? '', style: const TextStyle(color: Colors.white60, fontSize: 11)),
              ]),
            ),
            _drawerItem(Icons.dashboard, 'Dashboard', '/dashboard'),
            _drawerItem(Icons.event, 'Eventos', null, selected: true),
            _drawerItem(Icons.inventory, 'Catálogo', '/catalog'),
            _drawerItem(Icons.business, 'Proveedores', '/suppliers'),
            _drawerItem(Icons.notifications, 'Notificaciones', '/notifications'),
            if (isAdmin) _drawerItem(Icons.people, 'Usuarios', '/users'),
            const Divider(),
            _drawerItem(Icons.settings, 'Configuración', '/profile'),
            const Divider(),
            ListTile(
              leading: const Icon(Icons.logout, color: Colors.red),
              title: const Text('Cerrar sesión', style: TextStyle(color: Colors.red)),
              onTap: () async {
                Navigator.pop(context);
                await context.read<AuthService>().logout();
                if (mounted) Navigator.pushReplacementNamed(context, '/login');
              },
            ),
          ],
        ),
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
            ? Center(child: Text(_error!, style: const TextStyle(color: Colors.red)))
            : _events.isEmpty
              ? ListView(children: [const SizedBox(height: 200), Center(child: Column(children: [
                  Icon(Icons.event, size: 48, color: Colors.grey.shade300),
                  const SizedBox(height: 8),
                  const Text('No hay eventos', style: TextStyle(color: Colors.grey)),
                ]))])
              : ListView.builder(
                  padding: const EdgeInsets.fromLTRB(12, 12, 12, 80),
                  itemCount: _events.length,
                  itemBuilder: (_, i) {
                    final e = _events[i];
                    final dateFmt = DateFormat('d MMM yyyy', 'es').format(e.date);
                    final statusColorHex = _statusColor(e.status);
                    final isAdmin = user?.role == 'admin';

                    return Card(
                      margin: const EdgeInsets.only(bottom: 8),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12), side: BorderSide(color: Colors.grey.shade200)),
                      child: InkWell(
                        borderRadius: BorderRadius.circular(12),
                        onTap: () async {
                          await Navigator.pushNamed(context, '/event', arguments: e);
                          _load();
                        },
                        child: Padding(
                          padding: const EdgeInsets.all(14),
                          child: Row(children: [
                            Expanded(
                              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                Text(e.name, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15), maxLines: 1, overflow: TextOverflow.ellipsis),
                                const SizedBox(height: 4),
                                Text('$dateFmt${e.venue != null ? " — ${e.venue}" : ""}', style: TextStyle(fontSize: 12, color: Colors.grey.shade600)),
                              ]),
                            ),
                            const SizedBox(width: 8),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                              decoration: BoxDecoration(
                                color: Color(int.parse('0x${statusColorHex}0C')),
                                borderRadius: BorderRadius.circular(20),
                              ),
                              child: Text(_statusLabel(e.status), style: TextStyle(fontSize: 11, fontWeight: FontWeight.w500, color: Color(int.parse('0xFF${statusColorHex}'.replaceAll('0xFF', '0xFF'))))),
                            ),
                            if (isAdmin) ...[
                              const SizedBox(width: 4),
                              IconButton(
                                icon: Icon(Icons.edit_outlined, size: 16, color: Colors.grey.shade400),
                                onPressed: () async {
                                  final result = await Navigator.pushNamed(context, '/event/new', arguments: e);
                                  if (result == true) _load();
                                },
                                padding: EdgeInsets.zero,
                                constraints: const BoxConstraints(minWidth: 28, minHeight: 28),
                              ),
                              IconButton(
                                icon: Icon(Icons.delete_outline, size: 16, color: Colors.grey.shade400),
                                onPressed: () => _deleteEvent(e.id),
                                padding: EdgeInsets.zero,
                                constraints: const BoxConstraints(minWidth: 28, minHeight: 28),
                              ),
                            ],
                          ]),
                        ),
                      ),
                    );
                  },
                ),
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () async {
          final result = await Navigator.pushNamed(context, '/event/new');
          if (result == true) _load();
        },
        child: const Icon(Icons.add),
      ),
    );
  }

  Widget _drawerItem(IconData icon, String label, String? route, {bool selected = false}) {
    return ListTile(
      leading: Icon(icon),
      title: Text(label),
      selected: selected,
      selectedTileColor: Theme.of(context).colorScheme.primary.withValues(alpha: 0.08),
      onTap: route != null ? () {
        Navigator.pop(context);
        Navigator.pushNamed(context, route);
      } : null,
    );
  }
}
