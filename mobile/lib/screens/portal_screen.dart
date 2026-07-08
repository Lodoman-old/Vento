import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
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
        ApiService().get('/agenda?eventId=${evt.id}'),
        ApiService().get('/event-suppliers?eventId=${evt.id}'),
        ApiService().get('/quotes?eventId=${evt.id}'),
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
                    children: q.items.map((item) => ListTile(
                      dense: true,
                      title: Text(item.itemName, style: const TextStyle(fontSize: 13)),
                      trailing: Text('${item.quantity} x \$${item.unitPrice.toStringAsFixed(2)}', style: const TextStyle(fontSize: 12)),
                    )).toList(),
                  )),
                ],
              ]),
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
}
