import 'package:flutter/material.dart';
import '../services/api_service.dart';

class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  List _notifs = [];
  bool _loading = true;
  String? _eventFilter;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      String url = '/notifications?limit=100';
      if (_eventFilter != null) url += '&eventId=$_eventFilter';
      final data = await ApiService().get(url);
      _notifs = (data['data'] ?? data as List).cast<Map>();
    } catch (_) {}
    if (mounted) setState(() => _loading = false);
  }

  Future<void> _markRead(String id) async {
    try {
      await ApiService().patch('/notifications/$id/read');
      _load();
    } catch (_) {}
  }

  IconData _icon(String? type) {
    switch (type) {
      case 'agenda': return Icons.checklist;
      case 'supplier': return Icons.person;
      case 'quote': return Icons.description;
      case 'checklist': return Icons.list_alt;
      case 'evento': return Icons.event;
      case 'cliente': return Icons.person_add;
      default: return Icons.notifications;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Notificaciones')),
      body: Column(children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
          child: Row(children: [
            const Text('Filtrar: ', style: TextStyle(fontSize: 12)),
            Expanded(child: TextField(
              decoration: const InputDecoration(hintText: 'ID del evento', isDense: true, border: OutlineInputBorder()),
              onSubmitted: (v) { _eventFilter = v.isEmpty ? null : v; _load(); },
            )),
            IconButton(icon: const Icon(Icons.clear), onPressed: () { _eventFilter = null; _load(); }),
          ]),
        ),
        Expanded(
          child: _loading
            ? const Center(child: CircularProgressIndicator())
            : _notifs.isEmpty
              ? const Center(child: Text('Sin notificaciones'))
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView.builder(
                    padding: const EdgeInsets.all(8),
                    itemCount: _notifs.length,
                    itemBuilder: (_, i) {
                      final n = _notifs[i];
                      return Card(
                        color: n['is_read'] == true ? null : Theme.of(context).colorScheme.primary.withValues(alpha: 0.05),
                        child: ListTile(
                          leading: Icon(_icon(n['type']), color: Theme.of(context).colorScheme.primary),
                          title: Text(n['message'] ?? '', style: const TextStyle(fontSize: 13)),
                          subtitle: n['event_name'] != null ? Text(n['event_name'], style: const TextStyle(fontSize: 11, color: Colors.grey)) : null,
                          trailing: n['is_read'] == true ? null : const Icon(Icons.circle, size: 8, color: Colors.blue),
                          onTap: n['is_read'] == true ? null : () => _markRead(n['id']),
                        ),
                      );
                    },
                  ),
                ),
        ),
      ]),
    );
  }
}
