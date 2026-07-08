import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../services/api_service.dart';
import '../models/event.dart';

class EventFormScreen extends StatefulWidget {
  final Event? event;
  const EventFormScreen({super.key, this.event});

  @override
  State<EventFormScreen> createState() => _EventFormScreenState();
}

class _EventFormScreenState extends State<EventFormScreen> {
  final _nameCtrl = TextEditingController();
  final _venueCtrl = TextEditingController();
  final _budgetCtrl = TextEditingController();
  final _descriptionCtrl = TextEditingController();
  DateTime? _date;
  TimeOfDay? _time;
  String _status = 'borrador';
  bool _saving = false;
  String? _dateConflict;
  List<Map> _clients = [];

  @override
  void initState() {
    super.initState();
    final e = widget.event;
    if (e != null) {
      _nameCtrl.text = e.name;
      _venueCtrl.text = e.venue ?? '';
      _budgetCtrl.text = e.totalBudget != 0 ? e.totalBudget.toString() : '';
      _descriptionCtrl.text = e.description ?? '';
      _date = e.date;
      _time = TimeOfDay.fromDateTime(e.date);
      _status = e.status;
    }
    _loadClients();
  }

  Future<void> _loadClients() async {
    try {
      final data = await ApiService().get('/users?role=cliente');
      final list = data['data'] ?? data as List;
      _clients = (list as List).cast<Map>();
    } catch (_) {}
  }

  Future<void> _checkConflict() async {
    if (_date == null) return;
    try {
      final data = await ApiService().get('/events/calendar?year=${_date!.year}&month=${_date!.month}');
      final key = DateFormat('yyyy-MM-dd').format(_date!);
      final events = (data as Map)[key] as List?;
      if (events != null && events.isNotEmpty) {
        final count = events.length;
        setState(() => _dateConflict = '$count evento(s) ya registrado(s) en esta fecha');
      } else {
        setState(() => _dateConflict = null);
      }
    } catch (_) {
      setState(() => _dateConflict = null);
    }
  }

  Future<void> _save() async {
    if (_nameCtrl.text.trim().isEmpty || _date == null) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Nombre y fecha requeridos')));
      return;
    }
    setState(() => _saving = true);
    try {
      final dateStr = '${DateFormat('yyyy-MM-dd').format(_date!)} ${_time != null ? '${_time!.hour.toString().padLeft(2, '0')}:${_time!.minute.toString().padLeft(2, '0')}:00' : '00:00:00'}';
      final body = {
        'name': _nameCtrl.text.trim(),
        'date': dateStr,
        'venue': _venueCtrl.text.trim().isEmpty ? null : _venueCtrl.text.trim(),
        'status': _status,
        'budget': _budgetCtrl.text.trim().isEmpty ? null : double.parse(_budgetCtrl.text.trim()),
        'description': _descriptionCtrl.text.trim().isEmpty ? null : _descriptionCtrl.text.trim(),
      };
      if (widget.event != null) {
        await ApiService().put('/events/${widget.event!.id}', body: body);
      } else {
        await ApiService().post('/events', body: body);
      }
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: ${e.toString().replaceFirst("Exception: ", "")}')));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _pickDate() async {
    final d = await showDatePicker(context: context, firstDate: DateTime(2020), lastDate: DateTime(2035), locale: const Locale('es'));
    if (d != null) {
      setState(() => _date = d);
      _checkConflict();
    }
  }

  Future<void> _pickTime() async {
    final t = await showTimePicker(context: context, initialTime: _time ?? TimeOfDay.now());
    if (t != null) setState(() => _time = t);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(widget.event != null ? 'Editar evento' : 'Nuevo evento')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(children: [
          TextField(controller: _nameCtrl, decoration: const InputDecoration(labelText: 'Nombre', border: OutlineInputBorder())),
          const SizedBox(height: 12),
          Row(children: [
            Expanded(child: OutlinedButton.icon(
              icon: const Icon(Icons.calendar_today, size: 18),
              label: Text(_date != null ? DateFormat('d/M/yyyy').format(_date!) : 'Fecha'),
              onPressed: _pickDate,
            )),
            const SizedBox(width: 8),
            Expanded(child: OutlinedButton.icon(
              icon: const Icon(Icons.access_time, size: 18),
              label: Text(_time != null ? _time!.format(context) : 'Hora'),
              onPressed: _pickTime,
            )),
          ]),
          if (_dateConflict != null) Padding(
            padding: const EdgeInsets.only(top: 4),
            child: Text(_dateConflict!, style: const TextStyle(color: Colors.orange, fontSize: 12)),
          ),
          const SizedBox(height: 12),
          TextField(controller: _venueCtrl, decoration: const InputDecoration(labelText: 'Lugar', border: OutlineInputBorder())),
          const SizedBox(height: 12),
          DropdownButtonFormField<String>(
            value: _status,
            decoration: const InputDecoration(labelText: 'Estado', border: OutlineInputBorder()),
            items: ['borrador', 'activo', 'completado', 'cancelado'].map((s) => DropdownMenuItem(value: s, child: Text(s))).toList(),
            onChanged: (v) => setState(() => _status = v!),
          ),
          const SizedBox(height: 12),
          TextField(controller: _budgetCtrl, decoration: const InputDecoration(labelText: 'Presupuesto', border: OutlineInputBorder()), keyboardType: TextInputType.number),
          const SizedBox(height: 12),
          TextField(controller: _descriptionCtrl, decoration: const InputDecoration(labelText: 'Descripción', border: OutlineInputBorder()), maxLines: 3),
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
