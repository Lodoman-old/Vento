import 'package:flutter/material.dart';
import '../services/api_service.dart';

class SupplierFormScreen extends StatefulWidget {
  final Map? supplier;
  const SupplierFormScreen({super.key, this.supplier});

  @override
  State<SupplierFormScreen> createState() => _SupplierFormScreenState();
}

class _SupplierFormScreenState extends State<SupplierFormScreen> {
  final _nameCtrl = TextEditingController();
  final _contactCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();
  final _emailCtrl = TextEditingController();
  final _descCtrl = TextEditingController();
  String _category = 'logistica';
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    final s = widget.supplier;
    if (s != null) {
      _nameCtrl.text = s['name'] ?? '';
      _contactCtrl.text = s['contact_name'] ?? '';
      _phoneCtrl.text = s['phone'] ?? '';
      _emailCtrl.text = s['email'] ?? '';
      _descCtrl.text = s['service_description'] ?? '';
      _category = s['category'] ?? 'logistica';
    }
  }

  Future<void> _save() async {
    if (_nameCtrl.text.trim().isEmpty) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Nombre requerido')));
      return;
    }
    setState(() => _saving = true);
    try {
      final body = {
        'name': _nameCtrl.text.trim(),
        'contact_name': _contactCtrl.text.trim().isEmpty ? null : _contactCtrl.text.trim(),
        'phone': _phoneCtrl.text.trim().isEmpty ? null : _phoneCtrl.text.trim(),
        'email': _emailCtrl.text.trim().isEmpty ? null : _emailCtrl.text.trim(),
        'category': _category,
        'service_description': _descCtrl.text.trim().isEmpty ? null : _descCtrl.text.trim(),
      };
      if (widget.supplier != null) {
        await ApiService().put('/supplier-catalog/${widget.supplier!['id']}', body: body);
      } else {
        await ApiService().post('/supplier-catalog', body: body);
      }
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: ${e.toString().replaceFirst("Exception: ", "")}')));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _contactCtrl.dispose();
    _phoneCtrl.dispose();
    _emailCtrl.dispose();
    _descCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(widget.supplier != null ? 'Editar proveedor' : 'Nuevo proveedor')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(children: [
          TextField(controller: _nameCtrl, decoration: const InputDecoration(labelText: 'Nombre', border: OutlineInputBorder())),
          const SizedBox(height: 12),
          TextField(controller: _contactCtrl, decoration: const InputDecoration(labelText: 'Contacto (opcional)', border: OutlineInputBorder())),
          const SizedBox(height: 12),
          TextField(controller: _phoneCtrl, decoration: const InputDecoration(labelText: 'Teléfono (opcional)', border: OutlineInputBorder()), keyboardType: TextInputType.phone),
          const SizedBox(height: 12),
          TextField(controller: _emailCtrl, decoration: const InputDecoration(labelText: 'Email (opcional)', border: OutlineInputBorder()), keyboardType: TextInputType.emailAddress),
          const SizedBox(height: 12),
          DropdownButtonFormField<String>(
            value: _category,
            decoration: const InputDecoration(labelText: 'Categoría', border: OutlineInputBorder()),
            items: ['logistica', 'musica', 'decoracion', 'catering', 'fotografia', 'transporte', 'entretenimiento', 'otros'].map((s) => DropdownMenuItem(value: s, child: Text(s))).toList(),
            onChanged: (v) => setState(() => _category = v!),
          ),
          const SizedBox(height: 12),
          TextField(controller: _descCtrl, decoration: const InputDecoration(labelText: 'Descripción (opcional)', border: OutlineInputBorder()), maxLines: 3),
          const SizedBox(height: 24),
          SizedBox(width: double.infinity, child: ElevatedButton(
            onPressed: _saving ? null : _save,
            child: _saving ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2)) : const Text('Guardar'),
          )),
        ]),
      ),
    );
  }
}
