import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../services/api_service.dart';

class AgendaFormScreen extends StatefulWidget {
  final String eventId;
  const AgendaFormScreen({super.key, required this.eventId});

  @override
  State<AgendaFormScreen> createState() => _AgendaFormScreenState();
}

class _AgendaFormScreenState extends State<AgendaFormScreen> {
  final _titleCtrl = TextEditingController();
  final _descCtrl = TextEditingController();
  TimeOfDay? _startTime;
  TimeOfDay? _endTime;
  String _category = 'logistica';
  bool _saving = false;
  List<Map> _staff = [];

  @override
  void initState() {
    super.initState();
    _loadStaff();
  }

  Future<void> _loadStaff() async {
    try {
      final data = await ApiService().get('/users?role=staff');
      final list = data['data'] ?? data as List;
      _staff = (list as List).cast<Map>();
    } catch (_) {}
  }

  Future<void> _save() async {
    if (_titleCtrl.text.trim().isEmpty) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Título requerido')));
      return;
    }
    setState(() => _saving = true);
    try {
      await ApiService().post('/agenda', body: {
        'event_id': widget.eventId,
        'title': _titleCtrl.text.trim(),
        'description': _descCtrl.text.trim().isEmpty ? null : _descCtrl.text.trim(),
        'start_time': _startTime != null ? '${_startTime!.hour.toString().padLeft(2, '0')}:${_startTime!.minute.toString().padLeft(2, '0')}' : null,
        'end_time': _endTime != null ? '${_endTime!.hour.toString().padLeft(2, '0')}:${_endTime!.minute.toString().padLeft(2, '0')}' : null,
        'category': _category,
      });
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: ${e.toString().replaceFirst("Exception: ", "")}')));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Nueva tarea')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(children: [
          TextField(controller: _titleCtrl, decoration: const InputDecoration(labelText: 'Título', border: OutlineInputBorder())),
          const SizedBox(height: 12),
          TextField(controller: _descCtrl, decoration: const InputDecoration(labelText: 'Descripción', border: OutlineInputBorder()), maxLines: 3),
          const SizedBox(height: 12),
          Row(children: [
            Expanded(child: OutlinedButton.icon(
              icon: const Icon(Icons.access_time, size: 18),
              label: Text(_startTime != null ? _startTime!.format(context) : 'Inicio'),
              onPressed: () async {
                final t = await showTimePicker(context: context, initialTime: _startTime ?? TimeOfDay.now());
                if (t != null) setState(() => _startTime = t);
              },
            )),
            const SizedBox(width: 8),
            Expanded(child: OutlinedButton.icon(
              icon: const Icon(Icons.access_time, size: 18),
              label: Text(_endTime != null ? _endTime!.format(context) : 'Fin'),
              onPressed: () async {
                final t = await showTimePicker(context: context, initialTime: _endTime ?? TimeOfDay.now());
                if (t != null) setState(() => _endTime = t);
              },
            )),
          ]),
          const SizedBox(height: 12),
          DropdownButtonFormField<String>(
            value: _category,
            decoration: const InputDecoration(labelText: 'Categoría', border: OutlineInputBorder()),
            items: ['logistica', 'ceremonia', 'recepcion', 'musica', 'decoracion', 'comida', 'otros'].map((s) => DropdownMenuItem(value: s, child: Text(s))).toList(),
            onChanged: (v) => setState(() => _category = v!),
          ),
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
