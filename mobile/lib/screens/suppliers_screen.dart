import 'package:flutter/material.dart';
import '../services/api_service.dart';
import 'supplier_form_screen.dart';

class SuppliersScreen extends StatefulWidget {
  const SuppliersScreen({super.key});

  @override
  State<SuppliersScreen> createState() => _SuppliersScreenState();
}

class _SuppliersScreenState extends State<SuppliersScreen> {
  List _items = [];
  bool _loading = true;
  final _searchCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final data = await ApiService().get('/supplier-catalog?limit=500');
      _items = data is List ? data.cast<Map>() : (data['data'] as List? ?? []).cast<Map>();
    } catch (_) {}
    if (mounted) setState(() => _loading = false);
  }

  Future<void> _delete(String id) async {
    final ok = await showDialog<bool>(context: context, builder: (ctx) => AlertDialog(
      title: const Text('Eliminar'),
      content: const Text('¿Eliminar este proveedor?'),
      actions: [
        TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancelar')),
        TextButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Eliminar', style: TextStyle(color: Colors.red))),
      ],
    ));
    if (ok != true) return;
    try { await ApiService().delete('/supplier-catalog/$id'); _load(); }
    catch (e) { if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error'))); }
  }

  @override
  Widget build(BuildContext context) {
    final filtered = _searchCtrl.text.isEmpty ? _items : _items.where((e) =>
      (e['name'] ?? '').toString().toLowerCase().contains(_searchCtrl.text.toLowerCase())
    ).toList();
    final grouped = <String, List>{};
    for (final item in filtered) {
      final cat = item['category'] ?? 'otros';
      grouped.putIfAbsent(cat, () => []).add(item);
    }
    final categories = grouped.keys.toList()..sort();

    return Scaffold(
      appBar: AppBar(title: const Text('Proveedores')),
      body: Column(children: [
        Padding(
          padding: const EdgeInsets.all(8),
          child: TextField(
            controller: _searchCtrl,
            decoration: const InputDecoration(hintText: 'Buscar...', prefixIcon: Icon(Icons.search), border: OutlineInputBorder()),
            onChanged: (_) => setState(() {}),
          ),
        ),
        Expanded(
          child: _loading
            ? const Center(child: CircularProgressIndicator())
            : filtered.isEmpty
              ? const Center(child: Text('Sin proveedores'))
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView.builder(
                    padding: const EdgeInsets.fromLTRB(12, 8, 12, 80),
                    itemCount: filtered.length + categories.length,
                    itemBuilder: (_, i) {
                      int idx = i;
                      for (final cat in categories) {
                        if (idx == 0) return _categoryHeader(cat);
                        idx--;
                        final items = grouped[cat]!;
                        if (idx < items.length) return _supplierCard(items[idx]);
                        idx -= items.length;
                      }
                      return null;
                    },
                  ),
                ),
        ),
      ]),
      floatingActionButton: FloatingActionButton(
        onPressed: () async {
          final result = await Navigator.push(context, MaterialPageRoute(builder: (_) => const SupplierFormScreen()));
          if (result == true) _load();
        },
        child: const Icon(Icons.add),
      ),
    );
  }

  Widget _categoryHeader(String cat) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(4, 12, 4, 4),
      child: Text(cat[0].toUpperCase() + cat.substring(1), style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Colors.grey.shade600)),
    );
  }

  Widget _supplierCard(Map s) {
    return Card(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: ListTile(
        leading: CircleAvatar(backgroundColor: Colors.grey.shade100, child: Icon(Icons.business, color: Colors.grey.shade600)),
        title: Text(s['name'] ?? '', style: const TextStyle(fontWeight: FontWeight.w500, fontSize: 14)),
        subtitle: s['contact_name'] != null ? Text(s['contact_name'], style: TextStyle(fontSize: 11, color: Colors.grey.shade500)) : null,
        trailing: Row(mainAxisSize: MainAxisSize.min, children: [
          IconButton(icon: Icon(Icons.edit, size: 18, color: Colors.grey.shade400), onPressed: () async {
            final result = await Navigator.push(context, MaterialPageRoute(builder: (_) => SupplierFormScreen(supplier: s)));
            if (result == true) _load();
          }),
          IconButton(icon: Icon(Icons.delete_outline, size: 18, color: Colors.red.shade300), onPressed: () => _delete(s['id'])),
        ]),
      ),
    );
  }
}
