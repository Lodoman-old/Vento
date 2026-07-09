import 'package:flutter/material.dart';
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
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: ${e.toString().replaceFirst("Exception: ", "")}')));
    } finally {
      if (mounted) setState(() => _saving = false);
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