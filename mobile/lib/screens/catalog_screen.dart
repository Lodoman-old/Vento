import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import '../services/api_service.dart';
import 'catalog_form_screen.dart';

class CatalogScreen extends StatefulWidget {
  const CatalogScreen({super.key});

  @override
  State<CatalogScreen> createState() => _CatalogScreenState();
}

class _CatalogScreenState extends State<CatalogScreen> {
  List _items = [];
  bool _loading = true;
  bool _showAll = false;
  final _searchCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final url = _showAll ? '/catalog?limit=500&showAll=true' : '/catalog?limit=500';
      final data = await ApiService().get(url);
      _items = data is List ? data.cast<Map>() : (data['data'] as List? ?? []).cast<Map>();
    } catch (_) {}
    if (mounted) setState(() => _loading = false);
  }

  Future<void> _toggleActive(String id, bool active) async {
    try {
      await ApiService().put('/catalog/$id', body: {'isActive': !active});
      _load();
    } catch (_) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Error al cambiar estado')));
    }
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
      appBar: AppBar(title: const Text('Catálogo')),
      body: Column(children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(8, 8, 8, 0),
          child: Row(children: [
            Expanded(child: TextField(
              controller: _searchCtrl,
              decoration: const InputDecoration(hintText: 'Buscar...', prefixIcon: Icon(Icons.search), border: OutlineInputBorder(), isDense: true),
              onChanged: (_) => setState(() {}),
            )),
            const SizedBox(width: 4),
            TextButton(
              style: TextButton.styleFrom(padding: const EdgeInsets.symmetric(horizontal: 8)),
              child: Text(_showAll ? 'Activos' : 'Ver todos', style: const TextStyle(fontSize: 11)),
              onPressed: () { setState(() => _showAll = !_showAll); _load(); },
            ),
          ]),
        ),
        Expanded(
          child: _loading
            ? const Center(child: CircularProgressIndicator())
            : filtered.isEmpty
              ? const Center(child: Text('Sin resultados'))
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView.builder(
                    padding: const EdgeInsets.fromLTRB(12, 8, 12, 80),
                    itemCount: filtered.length + categories.length,
                    itemBuilder: (_, i) {
                      int idx = i;
                      for (final cat in categories) {
                        if (idx == 0) {
                          return _categoryHeader(cat);
                        }
                        idx--;
                        final items = grouped[cat]!;
                        if (idx < items.length) {
                          return _itemCard(items[idx]);
                        }
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
          final result = await Navigator.push(context, MaterialPageRoute(builder: (_) => const CatalogFormScreen()));
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

  Widget _itemCard(Map item) {
    final active = item['is_active'] != false;
    final imageUrl = item['image_url'] as String?;
    return Card(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: ListTile(
        leading: imageUrl != null
          ? ClipRRect(
              borderRadius: BorderRadius.circular(4),
              child: imageUrl.endsWith('.svg')
                ? SvgPicture.network(ApiService().imageUrl(imageUrl), width: 44, height: 44, fit: BoxFit.cover, placeholderBuilder: (_) => const Icon(Icons.image, color: Colors.grey))
                : Image.network(ApiService().imageUrl(imageUrl), width: 44, height: 44, fit: BoxFit.cover, errorBuilder: (_, __, ___) => const Icon(Icons.image, color: Colors.grey)))
          : CircleAvatar(backgroundColor: Colors.grey.shade100, child: Icon(Icons.inventory, color: Colors.grey.shade600)),
        title: Text(item['name'] ?? '', style: TextStyle(fontWeight: FontWeight.w500, fontSize: 14, color: active ? null : Colors.grey)),
        subtitle: Text('${item['unit_type'] ?? ''}${item['unit_price'] != null ? ' — \$${item['unit_price']}' : ''}', style: TextStyle(fontSize: 11, color: Colors.grey.shade500)),
        trailing: Row(mainAxisSize: MainAxisSize.min, children: [
          IconButton(
            icon: Icon(active ? Icons.visibility : Icons.visibility_off, size: 18, color: active ? Colors.grey.shade400 : Colors.red.shade300),
            onPressed: () => _toggleActive(item['id'], active),
          ),
          IconButton(icon: Icon(Icons.edit, size: 18, color: Colors.grey.shade400), onPressed: () async {
            final result = await Navigator.push(context, MaterialPageRoute(builder: (_) => CatalogFormScreen(item: item)));
            if (result == true) _load();
          }),
        ]),
      ),
    );
  }
}
