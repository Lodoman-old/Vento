import 'dart:io';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:share_plus/share_plus.dart';
import '../models/event.dart';
import '../models/agenda_item.dart';
import '../models/supplier.dart';
import '../models/quote.dart';
import '../services/api_service.dart';
import '../services/auth_service.dart';

class PortalScreen extends StatefulWidget {
  const PortalScreen({super.key});

  @override
  State<PortalScreen> createState() => _PortalScreenState();
}

class _PortalScreenState extends State<PortalScreen> {
  Event? _event;
  List<AgendaItem> _agenda = [];
  List<Supplier> _suppliers = [];
  List<Quote> _quotes = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final res = await ApiService().get('/events?page=1&limit=1');
      final events = res['data'] ?? res as List;
      if (events.isEmpty) { setState(() => _loading = false); return; }
      final evt = Event.fromJson(events[0]);
      _event = evt;
      final results = await Future.wait([
        ApiService().get('/agenda?event_id=${evt.id}'),
        ApiService().get('/event-suppliers?event_id=${evt.id}'),
        ApiService().get('/quotes?event_id=${evt.id}'),
      ]);
      _agenda = (results[0] as List).map((e) => AgendaItem.fromJson(e)).toList();
      _suppliers = (results[1] as List).map((e) => Supplier.fromJson(e)).toList();
      final quotesRaw = results[2] as List;
      final quotes = <Quote>[];
      for (final q in quotesRaw) {
        try {
          final detail = await ApiService().get('/quotes/${q['id']}');
          quotes.add(Quote.fromJson(detail));
        } catch (_) {
          quotes.add(Quote.fromJson(q));
        }
      }
      _quotes = quotes;
    } catch (_) {}
    if (mounted) setState(() => _loading = false);
  }

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthService>().currentUser;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Mi evento'),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 8),
            child: Text(user?.name ?? '', style: const TextStyle(fontSize: 12)),
          ),
          IconButton(icon: const Icon(Icons.logout), onPressed: () async {
            await context.read<AuthService>().logout();
            if (mounted) Navigator.pushReplacementNamed(context, '/login');
          }),
        ],
      ),
      body: _loading
        ? const Center(child: CircularProgressIndicator())
        : _event == null
          ? const Center(child: Text('No tienes eventos asignados'))
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(padding: const EdgeInsets.all(16), children: [
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(_event!.name, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
                      const SizedBox(height: 4),
                      Text(DateFormat("d 'de' MMMM yyyy", 'es').format(_event!.date), style: const TextStyle(color: Colors.grey)),
                      if (_event!.venue != null) Text(_event!.venue!, style: const TextStyle(color: Colors.grey)),
                    ]),
                  ),
                ),
                const SizedBox(height: 8),
                Row(children: [
                  Expanded(child: _kpiCard('Agenda', '${_agenda.where((a) => a.isCompleted).length}/${_agenda.length}')),
                  const SizedBox(width: 8),
                  Expanded(child: _kpiCard('Proveedores', '${_suppliers.where((s) => s.contractStatus == 'contratado').length}/${_suppliers.length}')),
                  const SizedBox(width: 8),
                  Expanded(child: _kpiCard('Cotizaciones', '${_quotes.length}')),
                ]),
                const SizedBox(height: 16),
                if (_event!.missingItems.isNotEmpty) ...[
                  Card(
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12), side: BorderSide(color: Colors.red.shade200)),
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                          Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            Text('Faltantes de inventario', style: TextStyle(fontWeight: FontWeight.bold, color: Colors.red.shade600)),
                            Text('Productos no regresados', style: TextStyle(fontSize: 12, color: Colors.grey)),
                          ]),
                          TextButton.icon(
                            onPressed: () => _printFaltantesPdf(),
                            icon: const Icon(Icons.picture_as_pdf, size: 16),
                            label: const Text('Recibo'),
                          ),
                        ]),
                        ..._event!.missingItems.map((f) => Padding(
                          padding: const EdgeInsets.symmetric(vertical: 2),
                          child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                            Expanded(child: Text(f['name']?.toString() ?? '', style: const TextStyle(fontSize: 13))),
                            Text('${f['faltante'] ?? 0}', style: const TextStyle(fontSize: 13, color: Colors.grey)),
                            Text('\$${_fm(f['cost'])}', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500)),
                          ]),
                        )),
                        const Divider(height: 16),
                        Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                          const Text('Total faltantes', style: TextStyle(fontWeight: FontWeight.bold)),
                          Text('\$${_fmtFaltantesTotal()}', style: TextStyle(fontWeight: FontWeight.bold, color: Colors.red.shade600)),
                        ]),
                      ]),
                    ),
                  ),
                ],
                if (_agenda.isNotEmpty) ...[
                  const Text('Agenda', style: TextStyle(fontWeight: FontWeight.w600)),
                  const SizedBox(height: 4),
                  ..._agenda.map((a) => ListTile(
                    dense: true,
                    leading: Icon(a.isCompleted ? Icons.check_circle : Icons.radio_button_unchecked, color: a.isCompleted ? Colors.green : Colors.grey, size: 20),
                    title: Text(a.title, style: const TextStyle(fontSize: 14)),
                    subtitle: a.startTime != null ? Text(DateFormat('HH:mm').format(a.startTime!), style: const TextStyle(fontSize: 12)) : null,
                  )),
                ],
                if (_suppliers.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  const Text('Proveedores', style: TextStyle(fontWeight: FontWeight.w600)),
                  const SizedBox(height: 4),
                  ..._suppliers.map((s) => ListTile(
                    dense: true,
                    title: Text(s.name, style: const TextStyle(fontSize: 14)),
                    subtitle: Text(s.contractStatus ?? '', style: const TextStyle(fontSize: 12)),
                  )),
                ],
                if (_quotes.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  const Text('Cotizaciones', style: TextStyle(fontWeight: FontWeight.w600)),
                  const SizedBox(height: 4),
                  ..._quotes.map((q) => ExpansionTile(
                    title: Text(q.clientName ?? 'Cotización', style: const TextStyle(fontSize: 14)),
                    subtitle: Text('\$${q.total.toStringAsFixed(2)} — ${q.status}', style: const TextStyle(fontSize: 12)),
                    children: [
                      ...q.items.map((item) => ListTile(
                        dense: true,
                        title: Text(item.itemName, style: const TextStyle(fontSize: 13)),
                        trailing: Text('${item.quantity} x \$${item.unitPrice.toStringAsFixed(2)}', style: const TextStyle(fontSize: 12)),
                      )),
                      if (q.status == 'enviado')
                        Padding(
                          padding: const EdgeInsets.all(12),
                          child: Column(children: [
                            SizedBox(width: double.infinity, child: ElevatedButton(
                              style: ElevatedButton.styleFrom(backgroundColor: Colors.amber, foregroundColor: Colors.white),
                              onPressed: () => _showChangeRequestDialog(q),
                              child: const Text('Solicitar cambio'),
                            )),
                            const SizedBox(height: 8),
                            SizedBox(width: double.infinity, child: ElevatedButton(
                              style: ElevatedButton.styleFrom(backgroundColor: Colors.green, foregroundColor: Colors.white),
                              onPressed: () async {
                                try {
                                  await ApiService().patch('/quotes/${q.id}/status', body: {'status': 'aceptado'});
                                  _load();
                                } catch (e) {
                                  if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: ${e.toString().replaceFirst("Exception: ", "")}')));
                                }
                              },
                              child: const Text('Aceptar cotización'),
                            )),
                          ]),
                        ),
                    ],
                  )),
                ],
              ]),
            ),
    );
  }

  void _showChangeRequestDialog(Quote q) {
    final controller = TextEditingController();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Row(children: [
          Icon(Icons.warning_amber_rounded, color: Colors.amber, size: 24),
          SizedBox(width: 8),
          Text('Solicitar cambio', style: TextStyle(fontSize: 18)),
        ]),
        content: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Text('Describe los cambios que deseas:', style: TextStyle(fontSize: 13, color: Colors.black87)),
          const SizedBox(height: 8),
          TextField(
            controller: controller,
            maxLines: 4,
            decoration: const InputDecoration(
              hintText: 'Ej: Cambiar cantidades, agregar productos, solicitar reunión...',
              border: OutlineInputBorder(),
              contentPadding: EdgeInsets.all(12),
            ),
          ),
        ]),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancelar')),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: Colors.amber, foregroundColor: Colors.white),
            onPressed: () async {
              try {
                await ApiService().post('/quotes/${q.id}/request-change', body: {'description': controller.text});
                if (mounted) Navigator.pop(ctx);
                if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Solicitud enviada al organizador')));
              } catch (e) {
                if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: ${e.toString().replaceFirst("Exception: ", "")}')));
              }
            },
            child: const Text('Enviar solicitud'),
          ),
        ],
      ),
    );
  }

  Widget _kpiCard(String label, String value) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
        child: Column(children: [
          Text(value, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
          Text(label, style: const TextStyle(fontSize: 11, color: Colors.grey)),
        ]),
      ),
    );
  }

  String _fm(dynamic n) {
    final v = double.tryParse(n?.toString() ?? '') ?? 0;
    return NumberFormat('#,##0.00', 'es').format(v);
  }

  String _fmtFaltantesTotal() {
    final t = _event!.missingItems.fold<double>(0, (s, f) => s + (double.tryParse(f['cost']?.toString() ?? '0') ?? 0));
    return NumberFormat('#,##0.00', 'es').format(t);
  }

  Future<void> _printFaltantesPdf() async {
    final faltantes = _event!.missingItems;
    final total = faltantes.fold<double>(0, (s, f) => s + (double.tryParse(f['cost']?.toString() ?? '0') ?? 0));
    final nf = NumberFormat('#,##0.00', 'es');
    final doc = pw.Document();
    doc.addPage(pw.Page(
      pageFormat: PdfPageFormat.a4,
      margin: const pw.EdgeInsets.all(40),
      build: (ctx) => pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.stretch, children: [
        pw.Text('REPORTE DE FALTANTES', style: pw.TextStyle(font: pw.Font.helveticaBold(), fontSize: 18, color: PdfColors.red700)),
        pw.SizedBox(height: 4),
        pw.Text('Evento: ${_event!.name}', style: pw.TextStyle(fontSize: 10, color: PdfColors.grey)),
        pw.SizedBox(height: 16),
        pw.Table(
          columnWidths: {0: pw.FlexColumnWidth(3), 1: pw.FlexColumnWidth(1.1), 2: pw.FlexColumnWidth(1.4), 3: pw.FlexColumnWidth(1.1), 4: pw.FlexColumnWidth(1.5)},
          border: pw.TableBorder.all(color: PdfColors.grey300, width: 0.5),
          children: [
            pw.TableRow(decoration: const pw.BoxDecoration(color: PdfColors.grey900), children: [
              _pdfHeader('Producto'), _pdfHeader('Tomados'), _pdfHeader('Regresados'), _pdfHeader('Faltante'), _pdfHeader('Costo'),
            ]),
            ...faltantes.map((f) => pw.TableRow(children: [
              _pdfCell(f['name']?.toString() ?? ''),
              _pdfCell(f['taken']?.toString() ?? '0', center: true),
              _pdfCell(f['returned']?.toString() ?? '0', center: true),
              _pdfCell(f['faltante']?.toString() ?? '0', center: true, red: true),
              _pdfCell('\$${nf.format(double.tryParse(f['cost']?.toString() ?? '0') ?? 0)}', right: true, red: true),
            ])),
            pw.TableRow(children: [
              _pdfCell('Total', bold: true),
              _pdfCell(''), _pdfCell(''), _pdfCell(''),
              _pdfCell('\$${nf.format(total)}', right: true, bold: true, red: true),
            ]),
          ],
        ),
        pw.SizedBox(height: 24),
        pw.Text('Generado por Vento — ${DateFormat("d MMM yyyy, HH:mm", 'es').format(DateTime.now())}', style: pw.TextStyle(fontSize: 8, color: PdfColors.grey400)),
      ]),
    ));
    final bytes = await doc.save();
    final dir = Directory.systemTemp;
    final file = File('${dir.path}/faltantes_${_event!.name}.pdf');
    await file.writeAsBytes(bytes);
    await Share.shareXFiles([XFile(file.path)], text: 'Reporte de faltantes');
  }

  pw.Widget _pdfHeader(String text) {
    return pw.Container(
      padding: const pw.EdgeInsets.all(6),
      child: pw.Text(text, style: pw.TextStyle(fontSize: 9, color: PdfColors.white, fontWeight: pw.FontWeight.bold)),
    );
  }

  pw.Widget _pdfCell(String text, {bool center = false, bool right = false, bool bold = false, bool red = false}) {
    return pw.Container(
      padding: const pw.EdgeInsets.all(6),
      child: pw.Text(text, textAlign: center ? pw.TextAlign.center : (right ? pw.TextAlign.right : pw.TextAlign.left), style: pw.TextStyle(fontSize: 9, fontWeight: bold ? pw.FontWeight.bold : pw.FontWeight.normal, color: red ? PdfColors.red700 : PdfColors.black)),
    );
  }
}
