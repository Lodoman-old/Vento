import 'dart:io';
import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:intl/intl.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';
import 'package:share_plus/share_plus.dart';
import '../services/api_service.dart';

class QuoteFormScreen extends StatefulWidget {
  final String eventId;
  const QuoteFormScreen({super.key, required this.eventId});

  @override
  State<QuoteFormScreen> createState() => _QuoteFormScreenState();
}

class _QuoteFormScreenState extends State<QuoteFormScreen> with SingleTickerProviderStateMixin {
  final _clientCtrl = TextEditingController();
  final _searchCtrl = TextEditingController();
  late TabController _tabCtrl;
  List _catalog = [];
  List<_QuoteItem> _selectedItems = [];
  bool _loading = true;
  bool _saving = false;
  String _catFilter = '';

  @override
  void initState() {
    super.initState();
    _tabCtrl = TabController(length: 2, vsync: this);
    _loadCatalog();
  }

  Future<void> _loadCatalog() async {
    try {
      final data = await ApiService().get('/catalog?limit=500');
      _catalog = data is List ? data.cast<Map>() : [];
    } catch (_) {}
    if (mounted) setState(() => _loading = false);
  }

  List get _filteredCatalog {
    var items = _catalog.where((item) {
      if (_catFilter.isNotEmpty && item['category'] != _catFilter) return false;
      if (_searchCtrl.text.isNotEmpty && !(item['name'] ?? '').toString().toLowerCase().contains(_searchCtrl.text.toLowerCase())) return false;
      return true;
    }).toList();
    return items;
  }

  List<String> get _categories {
    final cats = _catalog.map((i) => i['category'] as String? ?? '').toSet().toList()..sort();
    return cats;
  }

  void _addItem(Map item) {
    final name = item['name'];
    final existingIndex = _selectedItems.indexWhere((i) => i.name == name);
    if (existingIndex >= 0) {
      final existing = _selectedItems[existingIndex];
      final newQty = existing.quantity + 1;
      existing.qtyCtrl.text = newQty.toStringAsFixed(0);
      setState(() {});
    } else {
      setState(() {
        _selectedItems.add(_QuoteItem(
          name: name,
          unitPrice: double.tryParse(item['unit_price']?.toString() ?? '') ?? 0,
          initialQty: 1,
        ));
      });
    }
  }

  void _removeItem(int index) {
    _selectedItems[index].dispose();
    setState(() => _selectedItems.removeAt(index));
  }

  double get _total => _selectedItems.fold(0, (sum, item) => sum + item.quantity * item.unitPrice);

  Map? _savedQuote;

  Future<void> _save() async {
    if (_clientCtrl.text.trim().isEmpty) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Nombre del cliente requerido')));
      return;
    }
    setState(() => _saving = true);
    try {
      final items = _selectedItems.map((it) => {
        'item_name': it.name,
        'quantity': it.quantity <= 0 ? 1 : it.quantity,
        'unit_price': it.unitPrice,
      }).toList();
      if (items.isEmpty) {
        if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Agrega al menos un producto')));
        setState(() => _saving = false);
        return;
      }
      final data = await ApiService().post('/quotes', body: {
        'event_id': widget.eventId,
        'client_name': _clientCtrl.text.trim(),
        'items': items,
      });
      _savedQuote = data;
      if (mounted) _showSavedDialog();
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: ${e.toString().replaceFirst("Exception: ", "")}')));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _showSavedDialog() async {
    final result = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Cotizaci\u00f3n guardada'),
        content: const Text('\u00bfQu\u00e9 deseas hacer?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, 'pdf'), child: const Text('Compartir PDF')),
          TextButton(onPressed: () => Navigator.pop(ctx, 'whatsapp'), child: const Text('WhatsApp')),
          TextButton(onPressed: () => Navigator.pop(ctx, 'exit'), child: const Text('Salir')),
        ],
      ),
    );
    if (result == 'pdf') {
      await _generateAndSharePdf();
    } else if (result == 'whatsapp') {
      await _shareWhatsApp();
    }
    if (mounted) Navigator.pop(context, true);
  }

  Future<Uint8List> _buildPdf() async {
    final fm = NumberFormat('#,##0.00', 'es');
    final navy = PdfColor.fromInt(0xFF0F172A);
    final cyan = PdfColor.fromInt(0xFF22D3EE);
    final items = _savedQuote?['items'] as List? ?? [];
    final quote = _savedQuote ?? {};
      final total = double.tryParse(quote['total']?.toString() ?? '0') ?? 0;
    final bold = pw.Font.helveticaBold();
    final normal = pw.Font.helvetica();

    final doc = pw.Document();
    doc.addPage(pw.MultiPage(
      pageFormat: PdfPageFormat.a4,
      margin: const pw.EdgeInsets.all(40),
      build: (ctx) => [
        pw.Row(mainAxisAlignment: pw.MainAxisAlignment.spaceBetween, children: [
          pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
            pw.Text('VENTO', style: pw.TextStyle(font: bold, fontSize: 22, color: cyan)),
            pw.Text('Eventos en perfecta sincron\u00eda', style: pw.TextStyle(font: normal, fontSize: 8, color: PdfColors.grey)),
          ]),
          pw.Text('COTIZACI\u00d3N', style: pw.TextStyle(font: bold, fontSize: 18, color: navy)),
        ]),
        pw.SizedBox(height: 20),
        pw.Text('Cliente: ${_clientCtrl.text.trim()}', style: pw.TextStyle(font: normal, fontSize: 10)),
        pw.SizedBox(height: 20),
        pw.TableHelper.fromTextArray(
          headerStyle: pw.TextStyle(font: bold, fontSize: 9, color: PdfColors.white),
          headerDecoration: pw.BoxDecoration(color: navy),
          rowDecoration: const pw.BoxDecoration(border: pw.Border(bottom: pw.BorderSide(color: PdfColors.grey300, width: 0.5))),
          columnWidths: {0: const pw.FlexColumnWidth(3), 1: const pw.FlexColumnWidth(1), 2: const pw.FlexColumnWidth(1.5), 3: const pw.FlexColumnWidth(1.5)},
          headers: ['Item', 'Cant', 'P/Unit', 'Subtotal'],
          data: items.map((i) => [
            i['itemName'] ?? i['item_name'] ?? '',
            '${(int.tryParse(i['quantity']?.toString() ?? '1') ?? 1).toStringAsFixed(0)}',
            '\$${fm.format(double.tryParse(i['unitPrice']?.toString() ?? i['unit_price']?.toString() ?? '0') ?? 0)}',
            '\$${fm.format(double.tryParse(i['subtotal']?.toString() ?? '0') ?? 0)}',
          ]).toList(),
        ),
        pw.SizedBox(height: 10),
        pw.Row(mainAxisAlignment: pw.MainAxisAlignment.end, children: [
          pw.Text('Total: \$${fm.format(total)}',
              style: pw.TextStyle(font: bold, fontSize: 14, color: navy)),
        ]),
      ],
    ));
    return await doc.save();
  }

  Future<void> _generateAndSharePdf() async {
    try {
      final pdfBytes = await _buildPdf();
      final dir = Directory.systemTemp;
      final file = File('${dir.path}/cotizacion_${_clientCtrl.text.trim().replaceAll(' ', '_')}.pdf');
      await file.writeAsBytes(pdfBytes);
      await Share.shareXFiles([XFile(file.path)], text: 'Cotizaci\u00f3n Vento - ${_clientCtrl.text.trim()}');
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error al generar PDF: $e')));
    }
  }

  Future<void> _shareWhatsApp() async {
    final total = double.tryParse(_savedQuote?['total']?.toString() ?? '0') ?? 0;
    final items = _savedQuote?['items'] as List? ?? [];
    final fm = NumberFormat('#,##0.00', 'es');
    final detail = items.where((i) => i['is_supplier_cost'] != true).map((i) =>
      '${i['item_name'] ?? i['itemName'] ?? ''} x${(int.tryParse(i['quantity']?.toString() ?? '1') ?? 1).toStringAsFixed(0)} = \$${fm.format(double.tryParse(i['subtotal']?.toString() ?? '0') ?? 0)}'
    ).join('\n');
    final supTotal = items.fold<double>(0, (s, i) => s + ((i['is_supplier_cost'] == true) ? (double.tryParse(i['subtotal']?.toString() ?? '0') ?? 0) : 0));
    final detailFinal = supTotal > 0 ? '$detail\n\nCostos de proveedores: \$${fm.format(supTotal)}' : detail;

    // Try to get/create client access credentials
    String portalInfo = '';
    try {
      final existing = await ApiService().get('/events/${widget.eventId}/client-access');
      if (existing is Map && existing['username'] != null) {
        final base = ApiService().baseUrl.replaceAll(RegExp(r':\d+$'), '');
        final portalUrl = '$base:5173/portal';
        portalInfo = '\n\nAccede a tu portal:\n$portalUrl\nUsuario: ${existing['username']}\nContrase\u00f1a: ${existing['password']}';
      }
    } catch (_) {
      try {
        final created = await ApiService().post('/events/${widget.eventId}/client-access');
        if (created is Map && created['username'] != null) {
          final base = ApiService().baseUrl.replaceAll(RegExp(r':\d+$'), '');
          final portalUrl = '$base:5173/portal';
          portalInfo = '\n\nAccede a tu portal:\n$portalUrl\nUsuario: ${created['username']}\nContrase\u00f1a: ${created['password']}';
        }
      } catch (_) {}
    }

    final msg = 'Hola! Te comparto la cotizaci\u00f3n de Vento para "${_clientCtrl.text.trim()}".\n\n'
        '$detailFinal\n\n'
        'Total: \$${fm.format(total)}'
        '$portalInfo';
    try {
      final pdfBytes = await _buildPdf();
      final dir = Directory.systemTemp;
      final file = File('${dir.path}/cotizacion_${_clientCtrl.text.trim().replaceAll(' ', '_')}.pdf');
      await file.writeAsBytes(pdfBytes);
      await Share.shareXFiles([XFile(file.path)], text: msg);
    } catch (_) {
      await Share.share(msg);
    }
  }

  @override
  void dispose() {
    _clientCtrl.dispose();
    _searchCtrl.dispose();
    _tabCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Nueva cotización')),
      body: _loading
        ? const Center(child: CircularProgressIndicator())
        : Column(children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
              child: TextField(
                controller: _clientCtrl,
                decoration: const InputDecoration(labelText: 'Cliente', border: OutlineInputBorder(), isDense: true),
              ),
            ),
            TabBar(
              controller: _tabCtrl,
              labelColor: Theme.of(context).colorScheme.primary,
              unselectedLabelColor: Colors.grey,
              tabs: const [
                Tab(text: 'Catálogo'),
                Tab(text: 'Seleccionados'),
              ],
            ),
            Expanded(
              child: TabBarView(controller: _tabCtrl, children: [
                _catalogTab(),
                _selectedTab(),
              ]),
            ),
          ]),
      floatingActionButton: _selectedItems.isNotEmpty
        ? FloatingActionButton.extended(
            onPressed: _saving ? null : _save,
            icon: _saving ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)) : const Icon(Icons.save),
            label: Text('Guardar (\$${NumberFormat('#,##0.00', 'es').format(_total)})'),
          )
        : null,
    );
  }

  Widget _catalogTab() {
    final filtered = _filteredCatalog;
    final grouped = <String, List>{};
    for (final item in filtered) {
      final cat = item['category'] ?? 'otros';
      grouped.putIfAbsent(cat, () => []).add(item);
    }
    final categories = grouped.keys.toList()..sort();

    return Column(children: [
      Padding(
        padding: const EdgeInsets.fromLTRB(12, 8, 12, 0),
        child: TextField(
          controller: _searchCtrl,
          decoration: const InputDecoration(hintText: 'Buscar...', prefixIcon: Icon(Icons.search, size: 20), border: OutlineInputBorder(), isDense: true),
          onChanged: (_) => setState(() {}),
        ),
      ),
      const SizedBox(height: 6),
      SizedBox(
        height: 32,
        child: ListView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: 12),
          children: [
            FilterChip(label: const Text('Todos', style: TextStyle(fontSize: 11)), selected: _catFilter.isEmpty, onSelected: (_) => setState(() => _catFilter = '')),
            const SizedBox(width: 4),
            ...categories.map((cat) => Padding(
              padding: const EdgeInsets.only(right: 4),
              child: FilterChip(
                label: Text(cat, style: const TextStyle(fontSize: 11)),
                selected: _catFilter == cat,
                onSelected: (_) => setState(() => _catFilter = _catFilter == cat ? '' : cat),
              ),
            )),
          ],
        ),
      ),
      Expanded(
        child: filtered.isEmpty
          ? const Center(child: Text('Sin resultados', style: TextStyle(color: Colors.grey)))
          : ListView.builder(
              padding: const EdgeInsets.fromLTRB(12, 4, 12, 80),
              itemCount: filtered.length,
              itemBuilder: (_, i) {
                final item = filtered[i];
                final imageUrl = item['image_url'] as String?;
                return Card(
                  margin: const EdgeInsets.only(bottom: 6),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  child: ListTile(
                    contentPadding: const EdgeInsets.fromLTRB(8, 4, 8, 4),
                    leading: imageUrl != null
                      ? ClipRRect(
                          borderRadius: BorderRadius.circular(6),
                          child: imageUrl.endsWith('.svg')
                            ? SvgPicture.network(ApiService().imageUrl(imageUrl), width: 48, height: 48, fit: BoxFit.cover)
                            : Image.network(ApiService().imageUrl(imageUrl), width: 48, height: 48, fit: BoxFit.cover, errorBuilder: (_, __, ___) => const Icon(Icons.image, color: Colors.grey)),
                        )
                      : CircleAvatar(backgroundColor: Colors.grey.shade100, radius: 24, child: Icon(Icons.inventory, color: Colors.grey.shade500)),
                    title: Text(item['name'] ?? '', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500)),
                    subtitle: Text('\$${item['unit_price']}', style: TextStyle(fontSize: 11, color: Colors.grey.shade600)),
                    trailing: IconButton(
                      icon: const Icon(Icons.add_circle_outline, size: 22),
                      color: Theme.of(context).colorScheme.primary,
                      onPressed: () => _addItem(item),
                    ),
                  ),
                );
              },
            ),
      ),
    ]);
  }

  Widget _selectedTab() {
    if (_selectedItems.isEmpty) {
      return const Center(child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
        Icon(Icons.shopping_cart_outlined, size: 48, color: Colors.grey),
        SizedBox(height: 8),
        Text('Selecciona productos del catálogo', style: TextStyle(color: Colors.grey)),
      ]));
    }
    return Column(children: [
      Padding(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
        child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
          Text('${_selectedItems.length} producto(s)', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500)),
          Text('\$${NumberFormat('#,##0.00', 'es').format(_total)}', style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: Theme.of(context).colorScheme.primary)),
        ]),
      ),
      Expanded(
        child: ListView.builder(
          padding: const EdgeInsets.fromLTRB(12, 4, 12, 80),
          itemCount: _selectedItems.length,
          itemBuilder: (_, i) {
            final item = _selectedItems[i];
            return Card(
              margin: const EdgeInsets.only(bottom: 6),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              child: Padding(
                padding: const EdgeInsets.all(8),
                child: Row(children: [
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(item.name, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500)),
                      const SizedBox(height: 4),
                      Row(children: [
                          SizedBox(
                            width: 90,
                            child: TextField(
                              controller: item.qtyCtrl,
                              onChanged: (_) => setState(() {}),
                              decoration: const InputDecoration(labelText: 'Cantidad', isDense: true, border: OutlineInputBorder(), contentPadding: EdgeInsets.symmetric(horizontal: 8, vertical: 8)),
                              keyboardType: TextInputType.number,
                              style: const TextStyle(fontSize: 14),
                            ),
                          ),
                        const SizedBox(width: 10),
                        Text('\$${NumberFormat('#,##0.00', 'es').format(item.unitPrice)} c/u', style: TextStyle(fontSize: 11, color: Colors.grey.shade600)),
                      ]),
                    ]),
                  ),
                  Text('\$${NumberFormat('#,##0.00', 'es').format(item.subtotal)}', style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
                  const SizedBox(width: 4),
                  IconButton(icon: const Icon(Icons.close, size: 18), onPressed: () => _removeItem(i)),
                ]),
              ),
            );
          },
        ),
      ),
    ]);
  }
}

class _QuoteItem {
  final String name;
  final double unitPrice;
  final TextEditingController qtyCtrl;

  _QuoteItem({required this.name, required this.unitPrice, int initialQty = 1}) : qtyCtrl = TextEditingController(text: initialQty.toString());

  int get quantity => int.tryParse(qtyCtrl.text) ?? 0;
  double get subtotal => quantity * unitPrice;

  void dispose() => qtyCtrl.dispose();
}
