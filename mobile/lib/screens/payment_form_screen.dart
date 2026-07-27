import 'dart:io';
import 'package:flutter/material.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:share_plus/share_plus.dart';
import 'package:intl/intl.dart';
import '../models/quote.dart';
import '../services/api_service.dart';

class PaymentFormScreen extends StatefulWidget {
  final String quoteId;
  final List<Payment> plannedPayments;
  const PaymentFormScreen({super.key, required this.quoteId, this.plannedPayments = const []});

  @override
  State<PaymentFormScreen> createState() => _PaymentFormScreenState();
}

class _PaymentFormScreenState extends State<PaymentFormScreen> {
  final _amountCtrl = TextEditingController();
  final _refCtrl = TextEditingController();
  final _notesCtrl = TextEditingController();
  String _method = 'efectivo';
  String _appliedTo = '';
  bool _saving = false;

  Future<void> _save() async {
    final amount = double.tryParse(_amountCtrl.text.trim());
    if (amount == null || amount <= 0) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Monto inválido')));
      return;
    }
    setState(() => _saving = true);
    try {
      final body = {
        'quote_id': widget.quoteId,
        'amount': amount,
        'method': _method,
        'reference': _refCtrl.text.trim().isEmpty ? null : _refCtrl.text.trim(),
        'notes': _notesCtrl.text.trim().isEmpty ? null : _notesCtrl.text.trim(),
      };
      if (_appliedTo.isNotEmpty) body['applied_to'] = _appliedTo;
      await ApiService().post('/payments', body: body);
      await _generateReceipt(amount);
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: ${e.toString().replaceFirst("Exception: ", "")}')));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _generateReceipt(double amount) async {
    try {
      final quote = await ApiService().get('/quotes/${widget.quoteId}');
      final company = await ApiService().get('/settings');
      final payments = (quote['payments'] as List?)?.cast<Map>() ?? [];
      final totalPaid = payments.fold<double>(0, (s, p) => s + (p['paid_amount'] ?? p['paidAmount'] ?? 0));
      final balance = (quote['total'] ?? 0) - totalPaid;
      final navy = PdfColor.fromInt(0xFF0F172A);
      final fm = NumberFormat('#,##0.00', 'es');

      final doc = pw.Document();
      doc.addPage(pw.MultiPage(
        pageFormat: PdfPageFormat.a4,
        margin: const pw.EdgeInsets.all(40),
        build: (ctx) => [
          pw.Row(mainAxisAlignment: pw.MainAxisAlignment.spaceBetween, children: [
            pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
              pw.Text('VENTO', style: pw.TextStyle(font: pw.Font.helveticaBold(), fontSize: 22, color: PdfColor.fromInt(0xFF22D3EE))),
              pw.Text(company?['company_name'] ?? '', style: pw.TextStyle(font: pw.Font.helvetica(), fontSize: 9, color: PdfColors.grey)),
            ]),
            pw.Text('RECIBO DE PAGO', style: pw.TextStyle(font: pw.Font.helveticaBold(), fontSize: 18, color: navy)),
          ]),
          pw.SizedBox(height: 20),
          pw.Text('Cliente: ${quote['client_name'] ?? "—"}', style: pw.TextStyle(font: pw.Font.helvetica(), fontSize: 10)),
          pw.Text('Fecha: ${DateFormat('dd/MM/yyyy HH:mm').format(DateTime.now())}', style: pw.TextStyle(font: pw.Font.helvetica(), fontSize: 10)),
          pw.SizedBox(height: 20),
          pw.TableHelper.fromTextArray(
            headerStyle: pw.TextStyle(font: pw.Font.helveticaBold(), fontSize: 9, color: PdfColors.white),
            headerDecoration: pw.BoxDecoration(color: navy),
            rowDecoration: const pw.BoxDecoration(border: pw.Border(bottom: pw.BorderSide(color: PdfColors.grey300, width: 0.5))),
            columnWidths: {0: const pw.FlexColumnWidth(2), 1: const pw.FlexColumnWidth(1.5), 2: const pw.FlexColumnWidth(2.5)},
            headers: ['Monto', 'Método', 'Concepto'],
            data: [[
              '\$${fm.format(amount)}',
              _method,
              _notesCtrl.text.trim().isNotEmpty ? _notesCtrl.text.trim() : (_refCtrl.text.trim().isNotEmpty ? _refCtrl.text.trim() : 'Pago'),
            ]],
          ),
          pw.SizedBox(height: 10),
          pw.Row(mainAxisAlignment: pw.MainAxisAlignment.end, children: [
            pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.end, children: [
              pw.Text('Total cotizado: \$${fm.format(quote['total'] ?? 0)}', style: pw.TextStyle(font: pw.Font.helvetica(), fontSize: 10)),
              pw.Text('Total pagado: \$${fm.format(totalPaid + amount)}', style: pw.TextStyle(font: pw.Font.helvetica(), fontSize: 10, color: PdfColor.fromInt(0xFF16A34A))),
              if (balance - amount > 0)
                pw.Text('Saldo pendiente: \$${fm.format(balance - amount)}', style: pw.TextStyle(font: pw.Font.helvetica(), fontSize: 10, color: PdfColor.fromInt(0xFFD97706))),
            ]),
          ]),
          pw.SizedBox(height: 40),
          pw.Row(mainAxisAlignment: pw.MainAxisAlignment.spaceAround, children: [
            pw.Column(children: [
              pw.Container(width: 150, height: 1, color: PdfColors.grey400),
              pw.SizedBox(height: 4),
              pw.Text('Firma del cliente', style: pw.TextStyle(font: pw.Font.helvetica(), fontSize: 8, color: PdfColors.grey)),
            ]),
            pw.Column(children: [
              pw.Container(width: 150, height: 1, color: PdfColors.grey400),
              pw.SizedBox(height: 4),
              pw.Text('Firma del organizador', style: pw.TextStyle(font: pw.Font.helvetica(), fontSize: 8, color: PdfColors.grey)),
            ]),
          ]),
        ],
      ));
      final pdfBytes = await doc.save();
      final dir = Directory.systemTemp;
      final file = File('${dir.path}/recibo_pago_${DateFormat('yyyyMMdd_HHmmss').format(DateTime.now())}.pdf');
      await file.writeAsBytes(pdfBytes);
      await Share.shareXFiles([XFile(file.path)], text: 'Recibo de pago Vento');
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Pago registrado pero error al generar PDF: $e')));
    }
  }

  @override
  void dispose() {
    _amountCtrl.dispose();
    _refCtrl.dispose();
    _notesCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final realPlanned = widget.plannedPayments.where((p) => (p.paidAmount ?? 0) < p.amount).toList();
    return Scaffold(
      appBar: AppBar(title: const Text('Registrar pago')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(children: [
          DropdownButtonFormField<String>(
            value: _appliedTo,
            decoration: const InputDecoration(labelText: 'Aplicar a', border: OutlineInputBorder()),
            items: [
              const DropdownMenuItem(value: '', child: Text('Pago especial (sin plan)')),
              ...realPlanned.map((p) {
                final rest = p.amount - (p.paidAmount ?? 0);
                return DropdownMenuItem(
                  value: p.id,
                  child: Text('${p.notes ?? p.method ?? ''} — \$${p.amount.toStringAsFixed(2)} (restan \$${rest.toStringAsFixed(2)})', style: const TextStyle(fontSize: 13)),
                );
              }),
            ],
            onChanged: (v) => setState(() => _appliedTo = v!),
          ),
          const SizedBox(height: 12),
          TextField(controller: _amountCtrl, decoration: const InputDecoration(labelText: 'Monto', border: OutlineInputBorder()), keyboardType: TextInputType.number),
          const SizedBox(height: 12),
          DropdownButtonFormField<String>(
            value: _method,
            decoration: const InputDecoration(labelText: 'Método', border: OutlineInputBorder()),
            items: ['efectivo', 'transferencia', 'tarjeta', 'depósito'].map((s) => DropdownMenuItem(value: s, child: Text(s))).toList(),
            onChanged: (v) => setState(() => _method = v!),
          ),
          const SizedBox(height: 12),
          TextField(controller: _refCtrl, decoration: const InputDecoration(labelText: 'Referencia (opcional)', border: OutlineInputBorder())),
          const SizedBox(height: 12),
          TextField(controller: _notesCtrl, decoration: const InputDecoration(labelText: 'Notas (opcional)', border: OutlineInputBorder()), maxLines: 2),
          const SizedBox(height: 24),
          SizedBox(width: double.infinity, child: ElevatedButton(
            onPressed: _saving ? null : _save,
            child: _saving ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2)) : const Text('Registrar pago'),
          )),
        ]),
      ),
    );
  }
}