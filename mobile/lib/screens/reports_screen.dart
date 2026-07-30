import 'dart:io';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:share_plus/share_plus.dart';
import '../services/api_service.dart';
import '../services/auth_service.dart';

class ReportsScreen extends StatefulWidget {
  const ReportsScreen({super.key});

  @override
  State<ReportsScreen> createState() => _ReportsScreenState();
}

class _ReportsScreenState extends State<ReportsScreen> with SingleTickerProviderStateMixin {
  late TabController _tabCtrl;
  List<Map> _events = [];
  List<Map> _clients = [];
  List<Map> _suppliers = [];
  List<Map> _catalog = [];
  Map? _financial;
  List<String> _categories = [];
  bool _loading = false;
  String _start = '${DateTime.now().year}-01-01';
  String _end = DateFormat('yyyy-MM-dd').format(DateTime.now());
  String _catFilter = '';

  @override
  void initState() {
    super.initState();
    _tabCtrl = TabController(length: 5, vsync: this);
    _tabCtrl.addListener(() { if (!_tabCtrl.indexIsChanging) _loadTab(); });
    ApiService().get('/reports/categories').then((d) {
      if (mounted) setState(() => _categories = List<String>.from(d));
    });
    _loadTab();
  }

  Future<void> _loadTab() async {
    setState(() => _loading = true);
    try {
      final api = ApiService();
      switch (_tabCtrl.index) {
        case 0:
          final d = await api.get('/reports/events?start=$_start&end=$_end');
          _events = List<Map>.from(d['data'] ?? d);
          break;
        case 1:
          final d = await api.get('/reports/clients');
          _clients = List<Map>.from(d['data'] ?? d);
          break;
        case 2:
          final url = _catFilter.isEmpty ? '/reports/suppliers' : '/reports/suppliers?category=$_catFilter';
          final d = await api.get(url);
          _suppliers = List<Map>.from(d['data'] ?? d);
          break;
        case 3:
          final url = _catFilter.isEmpty ? '/reports/catalog' : '/reports/catalog?category=$_catFilter';
          final d = await api.get(url);
          _catalog = List<Map>.from(d['data'] ?? d);
          break;
        case 4:
          _financial = await api.get('/reports/financial?start=$_start&end=$_end');
          break;
      }
    } catch (_) {}
    if (mounted) setState(() => _loading = false);
  }

  String _fm(dynamic n) {
    if (n == null) return '\$0.00';
    final num = double.tryParse(n.toString()) ?? 0;
    return '\$${NumberFormat('#,##0.00', 'es').format(num)}';
  }

  String _fmDate(String? d) {
    if (d == null) return '—';
    return DateFormat('d MMM yyyy', 'es').format(DateTime.parse(d));
  }

  Future<void> _printCatalog() async {
    if (_catalog.isEmpty) return;
    final fm = NumberFormat('#,##0.00', 'es');
    final doc = pw.Document();
    doc.addPage(pw.MultiPage(
      pageFormat: PdfPageFormat.a4,
      margin: const pw.EdgeInsets.all(30),
      build: (ctx) {
        final rows = <pw.TableRow>[];
        for (int i = 0; i < _catalog.length; i += 2) {
          final a = _catalog[i];
          final b = i + 1 < _catalog.length ? _catalog[i + 1] : null;
          rows.add(pw.TableRow(
            children: [
              _catalogCard(a),
              if (b != null) _catalogCard(b) else pw.Container(),
            ],
          ));
        }
        return [
          pw.Text('CAT\u00c1LOGO VENTO', style: pw.TextStyle(font: pw.Font.helveticaBold(), fontSize: 18)),
          pw.Text('Selecciona los items de tu preferencia', style: pw.TextStyle(font: pw.Font.helvetica(), fontSize: 10, color: PdfColors.grey)),
          pw.SizedBox(height: 16),
          pw.Table(children: rows),
        ];
      },
    ));
    final bytes = await doc.save();
    final dir = Directory.systemTemp;
    final file = File('${dir.path}/catalogo_vento.pdf');
    await file.writeAsBytes(bytes);
    await Share.shareXFiles([XFile(file.path)], text: 'Catálogo Vento');
  }

  pw.Widget _catalogCard(Map item) {
    return pw.Container(
      padding: const pw.EdgeInsets.all(8),
      margin: const pw.EdgeInsets.all(4),
      decoration: pw.BoxDecoration(
        border: pw.Border.all(color: PdfColors.grey300, width: 0.5),
        borderRadius: const pw.BorderRadius.all(pw.Radius.circular(8)),
      ),
      child: pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
        pw.Text(item['name'] ?? '', style: pw.TextStyle(font: pw.Font.helveticaBold(), fontSize: 9)),
        pw.Text(item['category'] ?? '', style: pw.TextStyle(font: pw.Font.helvetica(), fontSize: 8, color: PdfColors.grey)),
        pw.SizedBox(height: 4),
        pw.Text('\$${fm.format(double.tryParse(item['unit_price']?.toString() ?? '0') ?? 0)}',
          style: pw.TextStyle(font: pw.Font.helveticaBold(), fontSize: 10, color: PdfColor.fromInt(0xFF22D3EE))),
        pw.SizedBox(height: 4),
        pw.Container(
          width: 16, height: 16,
          decoration: pw.BoxDecoration(
            border: pw.Border.all(color: PdfColors.grey400),
            borderRadius: const pw.BorderRadius.all(pw.Radius.circular(2)),
          ),
        ),
        pw.SizedBox(height: 2),
        pw.Text('Seleccionar', style: pw.TextStyle(font: pw.Font.helvetica(), fontSize: 7, color: PdfColors.grey)),
      ]),
    );
  }

  @override
  void dispose() {
    _tabCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isAdmin = context.watch<AuthService>().currentUser?.role == 'administrador';
    if (!isAdmin) {
      return Scaffold(appBar: AppBar(title: const Text('Reportes')), body: const Center(child: Text('Solo administradores')));
    }
    return Scaffold(
      appBar: AppBar(
        title: const Text('Reportes'),
        actions: [
          if (_tabCtrl.index == 3 && _catalog.isNotEmpty)
            IconButton(icon: const Icon(Icons.print), onPressed: _printCatalog),
        ],
        bottom: TabBar(
          controller: _tabCtrl,
          isScrollable: true,
          labelStyle: const TextStyle(fontSize: 12),
          tabs: const [
            Tab(text: 'Eventos'),
            Tab(text: 'Clientes'),
            Tab(text: 'Proveedores'),
            Tab(text: 'Catálogo'),
            Tab(text: 'Financiero'),
          ],
        ),
      ),
      body: _loading
        ? const Center(child: CircularProgressIndicator())
        : TabBarView(controller: _tabCtrl, children: [
            _eventsTab(),
            _clientsTab(),
            _suppliersTab(),
            _catalogTab(),
            _financialTab(),
          ]),
    );
  }

  Widget _dateFilter() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      child: Row(children: [
        const Text('Del:', style: TextStyle(fontSize: 12)),
        const SizedBox(width: 4),
        Expanded(child: TextField(
          decoration: const InputDecoration(isDense: true, border: OutlineInputBorder()),
          style: const TextStyle(fontSize: 12),
          controller: TextEditingController(text: _start),
          onSubmitted: (v) { _start = v; _loadTab(); },
        )),
        const SizedBox(width: 8),
        const Text('Al:', style: TextStyle(fontSize: 12)),
        const SizedBox(width: 4),
        Expanded(child: TextField(
          decoration: const InputDecoration(isDense: true, border: OutlineInputBorder()),
          style: const TextStyle(fontSize: 12),
          controller: TextEditingController(text: _end),
          onSubmitted: (v) { _end = v; _loadTab(); },
        )),
      ]),
    );
  }

  Widget _eventsTab() {
    return Column(children: [
      _dateFilter(),
      Expanded(child: _events.isEmpty
        ? const Center(child: Text('Sin eventos en este periodo'))
        : RefreshIndicator(
            onRefresh: _loadTab,
            child: ListView.builder(
              padding: const EdgeInsets.all(8),
              itemCount: _events.length + 1,
              itemBuilder: (_, i) {
                if (i == 0) {
                  final totalQuoted = _events.fold<double>(0, (s, e) => s + (double.tryParse(e['quoted_total']?.toString() ?? '0') ?? 0));
                  final totalPaid = _events.fold<double>(0, (s, e) => s + (double.tryParse(e['paid_total']?.toString() ?? '0') ?? 0));
                  final totalPending = _events.fold<double>(0, (s, e) => s + (double.tryParse(e['pending_total']?.toString() ?? '0') ?? 0));
                  return Card(
                    color: const Color(0xFF0F172A),
                    child: Padding(
                      padding: const EdgeInsets.all(12),
                      child: Row(children: [
                        Expanded(child: Text('Cotiz: ${_fm(totalQuoted)}', style: const TextStyle(color: Colors.cyan, fontSize: 11))),
                        Expanded(child: Text('Pag: ${_fm(totalPaid)}', style: const TextStyle(color: Colors.green, fontSize: 11))),
                        Expanded(child: Text('Pend: ${_fm(totalPending)}', style: const TextStyle(color: Colors.amber, fontSize: 11))),
                      ]),
                    ),
                  );
                }
                final e = _events[i - 1];
                final pending = double.tryParse(e['pending_total']?.toString() ?? '0') ?? 0;
                return Card(
                  child: ListTile(
                    title: Text(e['name'] ?? '', style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
                    subtitle: Text('${_fmDate(e['date'])} — ${e['status'] ?? ""}', style: const TextStyle(fontSize: 11)),
                    trailing: Column(mainAxisAlignment: MainAxisAlignment.center, crossAxisAlignment: CrossAxisAlignment.end, children: [
                      Text(_fm(e['quoted_total']), style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                      Text('Pag: ${_fm(e['paid_total'])}', style: const TextStyle(fontSize: 9, color: Colors.green)),
                      if (pending > 0) Text('Pend: ${_fm(pending)}', style: const TextStyle(fontSize: 9, color: Colors.amber)),
                    ]),
                  ),
                );
              },
            ),
          )),
    ]);
  }

  Widget _clientsTab() {
    return RefreshIndicator(
      onRefresh: _loadTab,
      child: _clients.isEmpty
        ? const Center(child: Text('Sin clientes'))
        : ListView.builder(
            padding: const EdgeInsets.all(8),
            itemCount: _clients.length + 1,
            itemBuilder: (_, i) {
              if (i == 0) {
                final total = _clients.fold<double>(0, (s, c) => s + (double.tryParse(c['total_spent']?.toString() ?? '0') ?? 0));
                final paid = _clients.fold<double>(0, (s, c) => s + (double.tryParse(c['total_paid']?.toString() ?? '0') ?? 0));
                return Card(
                  color: const Color(0xFF0F172A),
                  child: Padding(
                    padding: const EdgeInsets.all(12),
                    child: Row(children: [
                      Expanded(child: Text('Clientes: ${_clients.length}', style: const TextStyle(color: Colors.white, fontSize: 12))),
                      Expanded(child: Text('Gast: ${_fm(total)}', style: const TextStyle(color: Colors.cyan, fontSize: 11))),
                      Expanded(child: Text('Pag: ${_fm(paid)}', style: const TextStyle(color: Colors.green, fontSize: 11))),
                    ]),
                  ),
                );
              }
              final c = _clients[i - 1];
              return Card(
                child: ListTile(
                  title: Text(c['display_name'] ?? '', style: const TextStyle(fontSize: 14)),
                  subtitle: Text('${c['email'] ?? ""}  ${c['phone'] ?? ""}', style: const TextStyle(fontSize: 11)),
                  trailing: Column(mainAxisAlignment: MainAxisAlignment.center, crossAxisAlignment: CrossAxisAlignment.end, children: [
                    Text('${c['event_count']} eventos', style: const TextStyle(fontSize: 12)),
                    Text(_fm(c['total_spent']), style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                  ]),
                ),
              );
            },
          ),
    );
  }

  Widget _suppliersTab() {
    return Column(children: [
      Padding(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        child: SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(children: [
            _catChip('', 'Todas'),
            ..._categories.map((c) => _catChip(c, c)),
          ]),
        ),
      ),
      Expanded(
        child: RefreshIndicator(
          onRefresh: _loadTab,
          child: _suppliers.isEmpty
            ? const Center(child: Text('Sin proveedores'))
            : ListView.builder(
                padding: const EdgeInsets.all(8),
                itemCount: _suppliers.length,
                itemBuilder: (_, i) {
                  final s = _suppliers[i];
                  return Card(
                    child: ListTile(
                      title: Text(s['name'] ?? '', style: const TextStyle(fontSize: 14)),
                      subtitle: Text('${s['category'] ?? ""} — ${s['contact_name'] ?? ""} ${s['phone'] ?? ""}', style: const TextStyle(fontSize: 11)),
                      trailing: Column(mainAxisAlignment: MainAxisAlignment.center, crossAxisAlignment: CrossAxisAlignment.end, children: [
                        Text('${s['event_count']} eventos', style: const TextStyle(fontSize: 11)),
                        Text(_fm(s['total_budgeted']), style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                      ]),
                    ),
                  );
                },
              ),
        ),
      ),
    ]);
  }

  Widget _catalogTab() {
    return Column(children: [
      Padding(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        child: SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(children: [
            _catChip('', 'Todas'),
            ..._categories.map((c) => _catChip(c, c)),
          ]),
        ),
      ),
      Expanded(
        child: RefreshIndicator(
          onRefresh: _loadTab,
          child: _catalog.isEmpty
            ? const Center(child: Text('Sin items'))
            : GridView.builder(
                padding: const EdgeInsets.all(8),
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 2,
                  childAspectRatio: 0.75,
                  crossAxisSpacing: 8,
                  mainAxisSpacing: 8,
                ),
                itemCount: _catalog.length,
                itemBuilder: (_, i) {
                  final item = _catalog[i];
                  return Card(
                    clipBehavior: Clip.antiAlias,
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      if (item['image_url'] != null && item['image_url'].toString().isNotEmpty)
                        Image.network(item['image_url'], height: 100, width: double.infinity, fit: BoxFit.cover, errorBuilder: (_, __, ___) => _placeholderImage())
                      else
                        _placeholderImage(),
                      Padding(
                        padding: const EdgeInsets.all(8),
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Text(item['name'] ?? '', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600), maxLines: 1, overflow: TextOverflow.ellipsis),
                          Text(item['category'] ?? '', style: const TextStyle(fontSize: 10, color: Colors.grey)),
                          Text(_fm(item['unit_price']), style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: const Color(0xFF22D3EE))),
                        ]),
                      ),
                    ]),
                  );
                },
              ),
        ),
      ),
    ]);
  }

  Widget _placeholderImage() {
    return Container(height: 100, width: double.infinity, color: Colors.grey.shade100,
      child: const Center(child: Icon(Icons.inventory, color: Colors.grey)));
  }

  Widget _catChip(String value, String label) {
    final selected = _catFilter == value;
    return Padding(
      padding: const EdgeInsets.only(right: 4),
      child: FilterChip(
        label: Text(label, style: TextStyle(fontSize: 11, color: selected ? Colors.white : null)),
        selected: selected,
        onSelected: (_) { setState(() => _catFilter = value); _loadTab(); },
        visualDensity: VisualDensity.compact,
      ),
    );
  }

  Widget _financialTab() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(12),
      child: Column(children: [
        _dateFilter(),
        const SizedBox(height: 8),
        if (_financial == null) const Text('Sin datos') else Column(children: [
          Row(children: [
            _statCard('Pagos', _financial!['payment_count'].toString(), Colors.green),
            _statCard('Recibido', _fm(_financial!['total_received']), const Color(0xFF0F172A)),
          ]),
          Row(children: [
            _statCard('Cotiz. pagadas', _financial!['quotes_with_payment'].toString(), const Color(0xFF22D3EE)),
            _statCard('Cotizado total', _fm(_financial!['total_quoted']), Colors.amber.shade700),
          ]),
          const SizedBox(height: 16),
          const Text('Por método de pago', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
          const SizedBox(height: 8),
          ...(_financial!['by_method'] as List?)?.map((m) => Card(
            child: ListTile(
              title: Text(m['method'] ?? '', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500)),
              trailing: Text(_fm(m['total']), style: const TextStyle(fontWeight: FontWeight.bold)),
              subtitle: Text('${m['count']} pagos', style: const TextStyle(fontSize: 11)),
            ),
          )).toList() ?? [],
        ]),
      ]),
    );
  }

  Widget _statCard(String label, String value, Color color) {
    return Expanded(
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(label, style: TextStyle(fontSize: 11, color: Colors.grey.shade600)),
            const SizedBox(height: 4),
            Text(value, style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: color)),
          ]),
        ),
      ),
    );
  }
}
