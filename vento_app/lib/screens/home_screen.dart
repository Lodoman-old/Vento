import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../models/event.dart';
import 'agenda_screen.dart';
import 'suppliers_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  List<Event> _events = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadEvents();
  }

  Future<void> _loadEvents() async {
    try {
      final data = await context.read<AuthProvider>().api.get('/events');
      setState(() {
        _events = (data as List).map((e) => Event.fromJson(e)).toList();
        _loading = false;
      });
    } catch (_) {
      setState(() => _loading = false);
    }
  }

  Color _statusColor(String status) {
    switch (status) {
      case 'active':
        return Colors.green;
      case 'draft':
        return Colors.grey;
      case 'completed':
        return Colors.blue;
      case 'cancelled':
        return Colors.red;
      default:
        return Colors.grey;
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Vento'),
        actions: [
          PopupMenuButton<String>(
            icon: const CircleAvatar(
              radius: 16,
              backgroundColor: ventoCyan,
              child: Icon(Icons.person, size: 18, color: ventoNavy),
            ),
            onSelected: (v) {
              if (v == 'logout') auth.logout();
            },
            itemBuilder: (_) => [
              PopupMenuItem<String>(
                enabled: false,
                child: Text('${auth.user?['name']} (${auth.user?['role']})'),
              ),
              const PopupMenuDivider(),
              const PopupMenuItem<String>(
                value: 'logout',
                child: Text('Cerrar sesión'),
              ),
            ],
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _loadEvents,
              child: ListView.builder(
                padding: const EdgeInsets.all(16),
                itemCount: _events.length + 1,
                itemBuilder: (_, i) {
                  if (i == 0) {
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Mis eventos',
                              style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.bold)),
                          const SizedBox(height: 4),
                          Text('${_events.length} eventos',
                              style: const TextStyle(color: Colors.grey)),
                        ],
                      ),
                    );
                  }
                  final e = _events[i - 1];
                  return Card(
                    child: ListTile(
                      title: Text(e.name, style: const TextStyle(fontWeight: FontWeight.w600)),
                      subtitle: Text(
                        '${e.date.day}/${e.date.month}/${e.date.year}${e.venue != null ? ' — ${e.venue}' : ''}',
                        style: const TextStyle(fontSize: 13),
                      ),
                      trailing: Chip(
                        label: Text(e.status, style: const TextStyle(fontSize: 11, color: Colors.white)),
                        backgroundColor: _statusColor(e.status).withValues(alpha: 0.8),
                        padding: EdgeInsets.zero,
                        materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                        visualDensity: VisualDensity.compact,
                      ),
                      onTap: () => _showEventMenu(e),
                    ),
                  );
                },
              ),
            ),
    );
  }

  void _showEventMenu(Event e) {
    showModalBottomSheet(
      context: context,
      builder: (_) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              title: Text(e.name, style: const TextStyle(fontWeight: FontWeight.bold)),
              subtitle: Text(e.venue ?? 'Sin venue'),
            ),
            const Divider(),
            ListTile(
              leading: const Icon(Icons.checklist),
              title: const Text('Agenda'),
              onTap: () {
                Navigator.pop(context);
                Navigator.push(context, MaterialPageRoute(
                  builder: (_) => AgendaScreen(eventId: e.id),
                ));
              },
            ),
            ListTile(
              leading: const Icon(Icons.business),
              title: const Text('Proveedores'),
              onTap: () {
                Navigator.pop(context);
                Navigator.push(context, MaterialPageRoute(
                  builder: (_) => SuppliersScreen(eventId: e.id),
                ));
              },
            ),
          ],
        ),
      ),
    );
  }
}

const Color ventoCyan = Color(0xFF22D3EE);
const Color ventoNavy = Color(0xFF0F172A);
