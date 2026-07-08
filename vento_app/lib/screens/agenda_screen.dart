import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../models/agenda_item.dart';
import '../theme.dart';

class AgendaScreen extends StatefulWidget {
  final String eventId;
  const AgendaScreen({super.key, required this.eventId});

  @override
  State<AgendaScreen> createState() => _AgendaScreenState();
}

class _AgendaScreenState extends State<AgendaScreen> {
  List<AgendaItem> _items = [];
  bool _loading = true;
  String _filter = '';

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final api = context.read<AuthProvider>().api;
      final data = await api.get('/agenda?eventId=${widget.eventId}');
      setState(() {
        _items = (data as List).map((e) => AgendaItem.fromJson(e)).toList();
        _loading = false;
      });
    } catch (_) {
      setState(() => _loading = false);
    }
  }

  Future<void> _toggleComplete(AgendaItem item) async {
    try {
      await context.read<AuthProvider>().api.patch(
        '/agenda/${item.id}',
        body: {'isCompleted': !item.isCompleted},
      );
      setState(() => item.isCompleted = !item.isCompleted);
    } catch (_) {}
  }

  List<AgendaItem> get _filtered {
    if (_filter.isEmpty) return _items;
    return _items.where((i) => i.category == _filter).toList();
  }

  int get _completedCount => _filtered.where((i) => i.isCompleted).length;

  @override
  Widget build(BuildContext context) {
    context.watch<AuthProvider>();

    return Scaffold(
      appBar: AppBar(title: const Text('Agenda')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : Column(
              children: [
                // Barra de progreso
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('$_completedCount / ${_filtered.length} completados',
                          style: const TextStyle(fontSize: 13, color: Colors.grey)),
                      const SizedBox(height: 6),
                      ClipRRect(
                        borderRadius: BorderRadius.circular(4),
                        child: LinearProgressIndicator(
                          value: _filtered.isEmpty ? 0 : _completedCount / _filtered.length,
                          backgroundColor: Colors.grey.shade200,
                          valueColor: const AlwaysStoppedAnimation(ventoCyan),
                          minHeight: 6,
                        ),
                      ),
                    ],
                  ),
                ),

                // Filtros
                SizedBox(
                  height: 40,
                  child: ListView(
                    scrollDirection: Axis.horizontal,
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                    children: ['', 'logistics', 'ceremony', 'food', 'music', 'other']
                        .map((cat) => Padding(
                              padding: const EdgeInsets.only(right: 6),
                              child: ChoiceChip(
                                label: Text(cat.isEmpty ? 'Todas' : cat, style: const TextStyle(fontSize: 12)),
                                selected: _filter == cat,
                                onSelected: (_) => setState(() => _filter = cat),
                                selectedColor: ventoCyan,
                                labelStyle: TextStyle(
                                  color: _filter == cat ? ventoNavy : null,
                                ),
                                visualDensity: VisualDensity.compact,
                              ),
                            ))
                        .toList(),
                  ),
                ),

                // Lista
                Expanded(
                  child: RefreshIndicator(
                    onRefresh: _load,
                    child: _items.isEmpty
                        ? const Center(child: Text('Sin tareas', style: TextStyle(color: Colors.grey)))
                        : ListView.builder(
                            padding: const EdgeInsets.all(16),
                            itemCount: _filtered.length,
                            itemBuilder: (_, i) {
                              final item = _filtered[i];
                              return Card(
                                child: ListTile(
                                  leading: GestureDetector(
                                    onTap: () => _toggleComplete(item),
                                    child: Container(
                                      width: 24,
                                      height: 24,
                                      decoration: BoxDecoration(
                                        shape: BoxShape.circle,
                                        color: item.isCompleted ? Colors.green : Colors.transparent,
                                        border: Border.all(
                                          color: item.isCompleted ? Colors.green : Colors.grey.shade400,
                                          width: 2,
                                        ),
                                      ),
                                      child: item.isCompleted
                                          ? const Icon(Icons.check, size: 14, color: Colors.white)
                                          : null,
                                    ),
                                  ),
                                  title: Text(
                                    item.title,
                                    style: TextStyle(
                                      fontWeight: FontWeight.w500,
                                      decoration: item.isCompleted ? TextDecoration.lineThrough : null,
                                      color: item.isCompleted ? Colors.grey : null,
                                    ),
                                  ),
                                  subtitle: Text(
                                    '${item.startTime.hour.toString().padLeft(2, '0')}:${item.startTime.minute.toString().padLeft(2, '0')}'
                                    '${item.assignedName != null ? ' — ${item.assignedName}' : ''}',
                                    style: const TextStyle(fontSize: 12),
                                  ),
                                  trailing: Chip(
                                    label: Text(item.category, style: const TextStyle(fontSize: 10, color: Colors.grey)),
                                    backgroundColor: Colors.grey.shade100,
                                    padding: EdgeInsets.zero,
                                    visualDensity: VisualDensity.compact,
                                    materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                                  ),
                                ),
                              );
                            },
                          ),
                  ),
                ),
              ],
            ),
    );
  }
}
