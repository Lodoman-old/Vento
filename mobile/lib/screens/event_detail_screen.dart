import 'dart:io';
import 'package:flutter/material.dart';
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
import '../services/notification_service.dart';
import 'payment_form_screen.dart';

class EventDetailScreen extends StatefulWidget {
  final Event event;
  final bool isLoading;
  const EventDetailScreen({super.key, required this.event, this.isLoading = false});

  @override
  State<EventDetailScreen> createState() => _EventDetailScreenState();
}

class _EventDetailScreenState extends State<EventDetailScreen> with SingleTickerProviderStateMixin {
  late TabController _tabCtrl;
  List<AgendaItem> _agenda = [];
  List<Supplier> _suppliers = [];
  List<Quote> _quotes = [];
  bool _loading = true;
  List<Map> _inventory = [];
  bool _loadingInventory = false;
  String? _error;
  Map<String, dynamic>? _eventData;

  @override
  void initState() {
    super.initState();
    _tabCtrl = TabController(length: 4, vsync: this);
    _tabCtrl.addListener(() {
      if (_tabCtrl.index == 3 && _inventory.isEmpty && !_loadingInventory) _loadInventory();
    });
    if (widget.isLoading) { _fetchEvent(); } else { _load(); }
    _scheduleReminders();
  }

  Future<void> _fetchEvent() async {
    try {
      final data = await ApiService().get('/events/${widget.event.id}');
      if (mounted) setState(() => _eventData = data);
    } catch (_) {}
    _load();
  }

  Future<void> _load() async {
    final id = widget.event.id;
    try {
      setState(() => _loading = true);
      final results = await Future.wait([
        ApiService().get('/agenda?event_id=$id'),
        ApiService().get('/event-suppliers?event_id=$id'),
        ApiService().get('/quotes?event_id=$id'),
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
      _error = null;
    } catch (e) {
      _error = e.toString().replaceFirst('Exception: ', '');
    }
    if (mounted) setState(() => _loading = false);
  }

  Future<void> _loadInventory() async {
    setState(() => _loadingInventory = true);
    try {
      final data = await ApiService().get('/events/${widget.event.id}/inventory');
      _inventory = data is List ? data.cast<Map>() : [];
    } catch (_) {}
    if (mounted) setState(() => _loadingInventory = false);
  }

  void _scheduleReminders() {
    final data = _eventData;
    final name = data != null ? (data['name'] as String? ?? widget.event.name) : widget.event.name;
    final date = data != null ? (data['date'] != null ? DateTime.parse(data['date']) : widget.event.date) : widget.event.date;
    NotificationService().scheduleEventReminders(widget.event.id, name, date);
  }

  Future<void> _toggleAgenda(AgendaItem item) async {
    try {
      await ApiService().patch('/agenda/${item.id}', body: {
        'is_completed': !item.isCompleted,
      });
      setState(() => item.isCompleted = !item.isCompleted);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: ${e.toString().replaceFirst("Exception: ", "")}')));
      }
    }
  }

  Future<void> _deleteAgenda(AgendaItem item) async {
    final ok = await showDialog<bool>(context: context, builder: (ctx) => AlertDialog(
      title: const Text('Eliminar tarea'),
      content: Text('¿Eliminar "${item.title}"?'),
      actions: [
        TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancelar')),
        TextButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Eliminar', style: TextStyle(color: Colors.red))),
      ],
    ));
    if (ok != true) return;
    try {
      await ApiService().delete('/agenda/${item.id}');
      _load();
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: ${e.toString().replaceFirst("Exception: ", "")}')));
    }
  }

  @override
  void dispose() {
    _tabCtrl.dispose();
    super.dispose();
  }

  String _statusColor(String status) {
    switch (status) {
      case 'activo': return 'FF22C55E';
      case 'borrador': return 'FF64748B';
      case 'completado': return 'FF3B82F6';
      case 'cancelado': return 'FFEF4444';
      default: return 'FF64748B';
    }
  }

  String _statusLabel(String status) {
    switch (status) {
      case 'borrador': return 'Borrador';
      case 'activo': return 'Activo';
      case 'completado': return 'Completado';
      case 'cancelado': return 'Cancelado';
      default: return status;
    }
  }

  @override
  Widget build(BuildContext context) {
    final eventData = _eventData ?? <String, dynamic>{};
    final eName = eventData['name'] as String? ?? widget.event.name;
    final eDate = eventData['date'] != null ? DateTime.parse(eventData['date']) : widget.event.date;
    final eVenue = eventData['venue'] as String? ?? widget.event.venue;
    final eStatus = eventData['status'] as String? ?? widget.event.status;
    final dateFmt = DateFormat("d 'de' MMMM yyyy', 'HH:mm", 'es').format(eDate);
    final completed = _agenda.where((a) => a.isCompleted).length;
    final hired = _suppliers.where((s) => s.contractStatus == 'contratado').length;
    final statusColorHex = _statusColor(eStatus);

    return Scaffold(
      appBar: AppBar(
        title: Text(eName, style: const TextStyle(fontSize: 16)),
        actions: [
          IconButton(
            icon: const Icon(Icons.edit, size: 20),
            tooltip: 'Editar evento',
            onPressed: () async {
              final result = await Navigator.pushNamed(context, '/event/new', arguments: widget.event);
              if (result == true) _load();
            },
          ),
        ],
      ),
      body: _loading
        ? const Center(child: CircularProgressIndicator())
        : _error != null
          ? Center(child: Text(_error!, style: const TextStyle(color: Colors.red)))
          : Column(children: [
              Container(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 12),
                color: Theme.of(context).colorScheme.surface,
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Row(children: [
                    Expanded(child: Text(dateFmt, style: const TextStyle(fontSize: 13, color: Colors.grey))),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: Color(int.parse('0x${statusColorHex}0C')),
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Text(_statusLabel(eStatus), style: TextStyle(fontSize: 11, fontWeight: FontWeight.w500, color: Color(int.parse('0xFF$statusColorHex')))),
                    ),
                  ]),
                  if (eVenue != null) Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: Row(children: [
                      Icon(Icons.location_on_outlined, size: 14, color: Colors.grey.shade500),
                      const SizedBox(width: 4),
                      Text(eVenue, style: const TextStyle(fontSize: 13, color: Colors.grey)),
                    ]),
                  ),
                  const SizedBox(height: 10),
                  Wrap(spacing: 6, runSpacing: 4, children: [
                    _chip(Icons.checklist, 'Agenda', '$completed/${_agenda.length}'),
                    _chip(Icons.business, 'Proveedores', '$hired/${_suppliers.length}'),
                    _chip(Icons.description, 'Cotizaciones', '${_quotes.length}'),
                  ]),
                ]),
              ),
              TabBar(
                controller: _tabCtrl,
                labelColor: Theme.of(context).colorScheme.primary,
                unselectedLabelColor: Colors.grey,
                indicatorColor: Theme.of(context).colorScheme.primary,
                tabs: const [
                  Tab(icon: Icon(Icons.checklist, size: 18), text: 'Agenda'),
                  Tab(icon: Icon(Icons.business, size: 18), text: 'Proveedores'),
                  Tab(icon: Icon(Icons.description, size: 18), text: 'Cotizaciones'),
                  Tab(icon: Icon(Icons.inventory, size: 18), text: 'Inventario'),
                ],
              ),
              Expanded(
                child: TabBarView(controller: _tabCtrl, children: [
                  _buildWithFab(_agendaTab(), Icons.add, () async {
                    final result = await Navigator.pushNamed(context, '/agenda/new', arguments: widget.event.id);
                    if (result == true) _load();
                  }),
                  _buildWithFab(_suppliersTab(), Icons.add, _assignSupplier),
                  _buildWithFab(_quotesTab(), Icons.add, () async {
                    final result = await Navigator.pushNamed(context, '/quote/new', arguments: widget.event.id);
                    if (result == true) _load();
                  }),
                  _inventoryTab(),
                ]),
              ),
            ]),
    );
  }

  Widget _buildWithFab(Widget child, IconData icon, VoidCallback onPressed) {
    final bottomPad = MediaQuery.of(context).padding.bottom;
    return Stack(children: [
      child,
      Positioned(bottom: 16 + bottomPad, right: 16, child: FloatingActionButton.small(onPressed: onPressed, child: Icon(icon))),
    ]);
  }

  Widget _chip(IconData icon, String label, String count) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: Colors.grey.shade50,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        Icon(icon, size: 14, color: Colors.grey.shade600),
        const SizedBox(width: 4),
        Text('$label $count', style: TextStyle(fontSize: 11, color: Colors.grey.shade700)),
      ]),
    );
  }

  Widget _agendaTab() {
    if (_agenda.isEmpty) return ListView(children: [const SizedBox(height: 100), Center(child: Column(children: [
      Icon(Icons.checklist, size: 48, color: Colors.grey.shade200),
      const SizedBox(height: 8),
      const Text('Sin tareas', style: TextStyle(color: Colors.grey)),
    ]))]);
    return ListView.builder(
      padding: const EdgeInsets.fromLTRB(12, 12, 12, 80),
      itemCount: _agenda.length,
      itemBuilder: (_, i) {
        final a = _agenda[i];
        return Card(
          margin: const EdgeInsets.only(bottom: 8),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          child: InkWell(
            borderRadius: BorderRadius.circular(12),
            onTap: () => _toggleAgenda(a),
            child: Padding(
              padding: const EdgeInsets.fromLTRB(4, 8, 8, 8),
              child: Row(children: [
                Icon(a.isCompleted ? Icons.check_circle : Icons.radio_button_unchecked, color: a.isCompleted ? Colors.green : Colors.grey.shade400),
                const SizedBox(width: 8),
                Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(a.title, style: TextStyle(fontWeight: FontWeight.w500, decoration: a.isCompleted ? TextDecoration.lineThrough : null, color: a.isCompleted ? Colors.grey : null)),
                  Text('${a.assignedName ?? "Sin asignar"}${a.startTime != null ? " — ${DateFormat('HH:mm').format(a.startTime!)}" : ""}', style: TextStyle(fontSize: 11, color: Colors.grey.shade500)),
                ])),
                IconButton(
                  icon: Icon(Icons.delete_outline, size: 18, color: Colors.grey.shade400),
                  onPressed: () => _deleteAgenda(a),
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
                ),
              ]),
            ),
          ),
        );
      },
    );
  }

  Future<void> _assignSupplier() async {
    try {
      final catalog = await ApiService().get('/supplier-catalog');
      final catalogList = (catalog is List ? catalog.cast<Map>() : (catalog['data'] as List? ?? []).cast<Map>());
      final unassigned = catalogList.where((c) => !_suppliers.any((s) => s.supplierId == c['id'])).toList();
      if (unassigned.isEmpty) {
        if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Todos los proveedores ya están asignados')));
        return;
      }
      final selected = await showDialog<Map>(
        context: context,
        builder: (ctx) => SimpleDialog(
          title: const Text('Asignar proveedor'),
          children: unassigned.map((s) => SimpleDialogOption(
            onPressed: () => Navigator.pop(ctx, s),
            child: ListTile(
              dense: true,
              title: Text(s['name'] ?? '', style: const TextStyle(fontSize: 14)),
              subtitle: Text(s['category'] ?? '', style: TextStyle(fontSize: 11, color: Colors.grey.shade500)),
            ),
          )).toList(),
        ),
      );
      if (selected == null) return;
      await ApiService().post('/event-suppliers', body: {
        'event_id': widget.event.id,
        'supplier_id': selected['id'],
      });
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Proveedor asignado')));
      _load();
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: ${e.toString().replaceFirst("Exception: ", "")}')));
    }
  }

  Future<void> _advanceSupplier(Supplier s) async {
    String? newStatus;
    if (s.contractStatus == 'pendiente') newStatus = 'contactado';
    else if (s.contractStatus == 'contactado') newStatus = 'contratado';
    else return;
    try {
      await ApiService().patch('/event-suppliers/${s.id}', body: {'contract_status': newStatus});
      _load();
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: ${e.toString().replaceFirst("Exception: ", "")}')));
    }
  }

  Future<void> _reportArrival(Supplier s) async {
    try {
      final now = DateTime.now().toUtc().toIso8601String();
      await ApiService().patch('/event-suppliers/${s.id}', body: {'actual_arrival_time': now});
      _load();
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: ${e.toString().replaceFirst("Exception: ", "")}')));
    }
  }

  Widget _suppliersTab() {
    if (_suppliers.isEmpty) return ListView(children: [const SizedBox(height: 100), Center(child: Column(children: [
      Icon(Icons.business, size: 48, color: Colors.grey.shade200),
      const SizedBox(height: 8),
      const Text('Sin proveedores', style: TextStyle(color: Colors.grey)),
    ]))]);
    final statusMap = {'pendiente': 'Pendiente', 'contactado': 'Contactado', 'contratado': 'Contratado'};
    final statusColorMap = {'pendiente': Colors.grey, 'contactado': Colors.orange, 'contratado': Colors.green};
    final nextAction = {'pendiente': 'Contactar', 'contactado': 'Contratar'};
    return ListView.builder(
      padding: const EdgeInsets.fromLTRB(12, 12, 12, 12),
      itemCount: _suppliers.length,
      itemBuilder: (_, i) {
        final s = _suppliers[i];
        return Card(
          margin: const EdgeInsets.only(bottom: 8),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                CircleAvatar(backgroundColor: Colors.grey.shade100, child: Icon(Icons.business, size: 20, color: Colors.grey.shade600)),
                const SizedBox(width: 8),
                Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(s.name, style: const TextStyle(fontWeight: FontWeight.w500, fontSize: 14)),
                  if (s.category != null) Text(s.category!, style: TextStyle(fontSize: 11, color: Colors.grey.shade500)),
                ])),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: (statusColorMap[s.contractStatus] ?? Colors.grey).withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(statusMap[s.contractStatus] ?? s.contractStatus ?? '', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w500, color: statusColorMap[s.contractStatus] ?? Colors.grey)),
                ),
              ]),
              const SizedBox(height: 8),
              if (s.contractStatus == 'contratado' && s.arrivalTime == null)
                SizedBox(width: double.infinity, child: OutlinedButton(
                  onPressed: () => _reportArrival(s),
                  child: const Text('Reportar llegada', style: TextStyle(fontSize: 12)),
                )),
              if (nextAction[s.contractStatus] != null)
                SizedBox(width: double.infinity, child: ElevatedButton(
                  onPressed: () => _advanceSupplier(s),
                  child: Text(nextAction[s.contractStatus]!, style: const TextStyle(fontSize: 12)),
                )),
              if (s.arrivalTime != null)
                Text('Llegada pactada: ${s.arrivalTime}', style: TextStyle(fontSize: 11, color: Colors.grey.shade600, fontWeight: FontWeight.w500)),
              if (s.budgetAmount > 0)
                Text('Presupuesto: \$${NumberFormat('#,##0.00', 'es').format(s.budgetAmount)}', style: TextStyle(fontSize: 11, color: Colors.grey.shade600)),
              if (widget.event.status != 'completado')
                Row(mainAxisAlignment: MainAxisAlignment.end, children: [
                  TextButton.icon(
                    icon: const Icon(Icons.edit, size: 16),
                    label: const Text('Editar', style: TextStyle(fontSize: 12)),
                    onPressed: () => _editSupplier(s),
                  ),
                ]),
            ]),
          ),
        );
      },
    );
  }

  Future<void> _editSupplier(Supplier s) async {
    final budgetCtrl = TextEditingController(text: s.budgetAmount > 0 ? s.budgetAmount.toString() : '');
    final arrivalCtrl = TextEditingController(text: s.arrivalTime ?? '');
    await showDialog(context: context, builder: (ctx) => AlertDialog(
      title: Text('Editar: ${s.name}'),
      content: Column(mainAxisSize: MainAxisSize.min, children: [
        TextField(controller: budgetCtrl, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Presupuesto', border: OutlineInputBorder())),
        const SizedBox(height: 8),
        TextField(controller: arrivalCtrl, decoration: const InputDecoration(labelText: 'Llegada pactada (YYYY-MM-DD HH:MM)', border: OutlineInputBorder())),
      ]),
      actions: [
        TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancelar')),
        ElevatedButton(onPressed: () async {
          Navigator.pop(ctx);
          final data = <String, dynamic>{};
          if (budgetCtrl.text.isNotEmpty) data['budget_amount'] = double.tryParse(budgetCtrl.text) ?? 0;
          if (arrivalCtrl.text.isNotEmpty) data['arrival_time'] = arrivalCtrl.text;
          if (data.isEmpty) return;
          await _updateSupplierData(s.id, data);
        }, child: const Text('Guardar')),
      ],
    ));
  }

  Future<void> _updateSupplierData(String supId, Map<String, dynamic> data) async {
    try {
      await ApiService().patch('/event-suppliers/$supId', body: data);
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Proveedor actualizado')));
      _load();
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: ${e.toString().replaceFirst("Exception: ", "")}')));
    }
  }

  Widget _quotesTab() {
    if (_quotes.isEmpty) return ListView(children: [const SizedBox(height: 100), Center(child: Column(children: [
      Icon(Icons.description, size: 48, color: Colors.grey.shade200),
      const SizedBox(height: 8),
      const Text('Sin cotizaciones', style: TextStyle(color: Colors.grey)),
    ]))]);
    return ListView.builder(
      padding: const EdgeInsets.fromLTRB(12, 12, 12, 80),
      itemCount: _quotes.length,
      itemBuilder: (_, i) {
        final q = _quotes[i];
        final statusLabels = {'borrador': 'Borrador', 'enviado': 'Enviado', 'aceptado': 'Aceptado', 'rechazado': 'Rechazado'};
        final statusColorsMap = {'borrador': Colors.grey, 'enviado': Colors.blue, 'aceptado': Colors.green, 'rechazado': Colors.red};
        return Card(
          margin: const EdgeInsets.only(bottom: 8),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          child: Column(children: [
            ListTile(
              contentPadding: const EdgeInsets.fromLTRB(16, 4, 16, 0),
              leading: CircleAvatar(backgroundColor: Colors.grey.shade100, child: Icon(Icons.description, size: 20, color: Colors.grey.shade600)),
              title: Text(q.clientName ?? 'Cotización', style: const TextStyle(fontWeight: FontWeight.w500, fontSize: 14)),
              subtitle: Text('\$${q.total.toStringAsFixed(2)}', style: TextStyle(fontSize: 13, color: Colors.grey.shade600)),
              trailing: Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: (statusColorsMap[q.status] ?? Colors.grey).withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(statusLabels[q.status] ?? q.status, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w500, color: statusColorsMap[q.status] ?? Colors.grey)),
              ),
            ),
            // Action buttons
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 0, 12, 4),
              child: Wrap(spacing: 6, runSpacing: 4, children: [
                if (q.status == 'borrador')
                  _actionBtn('Enviar', Colors.blue, () => _updateQuoteStatus(q.id, 'enviado')),
                if (q.status == 'borrador')
                  _actionBtn('Aceptar', Colors.green, () => _updateQuoteStatus(q.id, 'aceptado')),
                if (q.status == 'borrador')
                  _actionBtn('Rechazar', Colors.red, () => _updateQuoteStatus(q.id, 'rechazado')),
                if (q.status == 'borrador')
                  _actionBtn('Editar', Colors.grey, () async {
                    final result = await Navigator.pushNamed(context, '/quote/new', arguments: widget.event.id);
                    if (result == true) _load();
                  }),
                _actionBtn('PDF', Colors.teal, () => _quotePdf(q)),
                if (q.clientPhone != null && q.clientPhone!.isNotEmpty)
                  _actionBtn('WhatsApp', Colors.green, () => _quoteWhatsApp(q)),
                _actionBtn('Eliminar', Colors.red.shade400, () => _deleteQuote(q.id)),
              ]),
            ),
            ExpansionTile(
              tilePadding: const EdgeInsets.fromLTRB(16, 0, 16, 4),
              childrenPadding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
              shape: const Border(),
              collapsedShape: const Border(),
              title: const Text('Detalle', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w500)),
              children: [
                ...q.items.map((item) => Padding(
                  padding: const EdgeInsets.symmetric(vertical: 2),
                  child: Row(children: [
                    Expanded(child: Text(item.itemName, style: const TextStyle(fontSize: 13))),
                    Text('${item.quantity} × \$${item.unitPrice.toStringAsFixed(2)}', style: TextStyle(fontSize: 12, color: Colors.grey.shade600)),
                  ]),
                )),
                const Divider(height: 16),
                Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                  const Text('Pagos', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                  TextButton.icon(
                    icon: const Icon(Icons.add, size: 16),
                    label: const Text('Pago', style: TextStyle(fontSize: 12)),
                    onPressed: () async {
                      final planned = q.payments.where((p) => p.method == 'enganche' || p.method == 'mensualidad').toList();
                      final result = await Navigator.push(context, MaterialPageRoute(builder: (_) => PaymentFormScreen(quoteId: q.id, plannedPayments: planned)));
                      if (result == true) _load();
                    },
                  ),
                ]),
                if (q.payments.isEmpty)
                  const Text('Sin pagos registrados', style: TextStyle(fontSize: 11, color: Colors.grey)),
                ...q.payments.map((p) {
                  final isPlanned = p.method == 'enganche' || p.method == 'mensualidad';
                  final paid = p.paidAmount ?? 0;
                  final rest = p.amount - paid;
                  return Padding(
                    padding: const EdgeInsets.symmetric(vertical: 2),
                    child: Row(children: [
                      Expanded(
                        child: Row(children: [
                          Text(p.notes ?? p.method ?? '', style: TextStyle(fontSize: 12, color: Colors.grey.shade600)),
                          if (isPlanned && paid > 0)
                            Text(' (\$${paid.toStringAsFixed(2)} pagado)', style: TextStyle(fontSize: 11, color: Colors.green.shade600)),
                        ]),
                      ),
                      Text('\$${p.amount.toStringAsFixed(2)}', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w500, color: isPlanned && rest <= 0 ? Colors.green.shade700 : null)),
                    ]),
                  );
                }),
                if (q.payments.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: Text(
                      'Total pagado: \$${q.payments.where((p) => p.method != 'enganche' && p.method != 'mensualidad').fold(0.0, (sum, p) => sum + p.amount).toStringAsFixed(2)}',
                      style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Colors.green.shade700),
                    ),
                  ),
              ],
            ),
          ]),
        );
      },
    );
  }

  Widget _actionBtn(String label, Color color, VoidCallback onPressed) {
    return SizedBox(
      height: 26,
      child: TextButton(
        style: TextButton.styleFrom(
          padding: const EdgeInsets.symmetric(horizontal: 8),
          backgroundColor: color.withValues(alpha: 0.1),
          foregroundColor: color,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
          textStyle: const TextStyle(fontSize: 10, fontWeight: FontWeight.w500),
        ),
        onPressed: onPressed,
        child: Text(label),
      ),
    );
  }

  Future<void> _updateQuoteStatus(String quoteId, String status) async {
    try {
      await ApiService().patch('/quotes/$quoteId/status', body: {'status': status});
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Cotización marcada como $status')));
      _load();
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: ${e.toString().replaceFirst("Exception: ", "")}')));
    }
  }

  Future<void> _deleteQuote(String quoteId) async {
    final ok = await showDialog<bool>(context: context, builder: (ctx) => AlertDialog(
      title: const Text('Eliminar cotización'),
      content: const Text('¿Eliminar esta cotización?'),
      actions: [
        TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancelar')),
        TextButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Eliminar', style: TextStyle(color: Colors.red))),
      ],
    ));
    if (ok != true) return;
    try {
      await ApiService().delete('/quotes/$quoteId');
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Cotización eliminada')));
      _load();
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: ${e.toString().replaceFirst("Exception: ", "")}')));
    }
  }

  Future<void> _quotePdf(Quote q) async {
    try {
      final detail = await ApiService().get('/quotes/${q.id}');
      final items = (detail['items'] as List?)?.cast<Map>() ?? [];
      final payments = (detail['payments'] as List?)?.cast<Map>() ?? [];
      final company = await ApiService().get('/settings');
      final fm = NumberFormat('#,##0.00', 'es');
      final df = DateFormat('dd/MM/yyyy');
      final navy = PdfColor.fromInt(0xFF0F172A);

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
            pw.Text('COTIZACIÓN', style: pw.TextStyle(font: pw.Font.helveticaBold(), fontSize: 18, color: navy)),
          ]),
          pw.SizedBox(height: 20),
          pw.Text('Cliente: ${q.clientName ?? "—"}', style: pw.TextStyle(font: pw.Font.helvetica(), fontSize: 10)),
          pw.SizedBox(height: 20),
          pw.TableHelper.fromTextArray(
            headerStyle: pw.TextStyle(font: pw.Font.helveticaBold(), fontSize: 9, color: PdfColors.white),
            headerDecoration: pw.BoxDecoration(color: navy),
            rowDecoration: const pw.BoxDecoration(border: pw.Border(bottom: pw.BorderSide(color: PdfColors.grey300, width: 0.5))),
            columnWidths: {0: const pw.FlexColumnWidth(3), 1: const pw.FlexColumnWidth(1), 2: const pw.FlexColumnWidth(1.5), 3: const pw.FlexColumnWidth(1.5)},
            headers: ['Item', 'Cant', 'P/Unit', 'Subtotal'],
            data: items.map((i) => [
              i['item_name'] ?? i['itemName'] ?? '',
              '${int.tryParse(i['quantity']?.toString() ?? '1') ?? 1}',
              '\$${fm.format(double.tryParse(i['unit_price']?.toString() ?? i['unitPrice']?.toString() ?? '0') ?? 0)}',
              '\$${fm.format(double.tryParse(i['subtotal']?.toString() ?? '0') ?? 0)}',
            ]).toList(),
          ),
          pw.SizedBox(height: 10),
          pw.Row(mainAxisAlignment: pw.MainAxisAlignment.end, children: [
            pw.Text('Total: \$${fm.format(q.total)}', style: pw.TextStyle(font: pw.Font.helveticaBold(), fontSize: 14, color: navy)),
          ]),
          if (payments.isNotEmpty) ...[
            pw.SizedBox(height: 24),
            pw.Text('Plan de pagos', style: pw.TextStyle(font: pw.Font.helveticaBold(), fontSize: 12, color: navy)),
            pw.SizedBox(height: 8),
            pw.TableHelper.fromTextArray(
              headerStyle: pw.TextStyle(font: pw.Font.helveticaBold(), fontSize: 8, color: PdfColors.white),
              headerDecoration: pw.BoxDecoration(color: navy),
              rowDecoration: const pw.BoxDecoration(border: pw.Border(bottom: pw.BorderSide(color: PdfColors.grey300, width: 0.5))),
              columnWidths: {0: const pw.FlexColumnWidth(2), 1: const pw.FlexColumnWidth(1.5), 2: const pw.FlexColumnWidth(2.5)},
              headers: ['Fecha', 'Monto', 'Concepto'],
              data: payments.map((p) {
                final date = p['payment_date'] != null ? DateTime.tryParse(p['payment_date'].toString()) : null;
                return [
                  date != null ? df.format(date) : '—',
                  '\$${fm.format(double.tryParse(p['amount']?.toString() ?? '0') ?? 0)}',
                  p['notes'] ?? p['method'] ?? '—',
                ];
              }).toList(),
            ),
          ],
        ],
      ));
      final pdfBytes = await doc.save();
      final dir = Directory.systemTemp;
      final file = File('${dir.path}/cotizacion_${(q.clientName ?? 'cliente').replaceAll(' ', '_')}.pdf');
      await file.writeAsBytes(pdfBytes);
      await Share.shareXFiles([XFile(file.path)], text: 'Cotización Vento - ${q.clientName ?? ""}');
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error al generar PDF: $e')));
    }
  }

  Future<void> _quoteWhatsApp(Quote q) async {
    try {
      final detail = await ApiService().get('/quotes/${q.id}');
      final items = (detail['items'] as List?)?.cast<Map>() ?? [];
      final fm = NumberFormat('#,##0.00', 'es');
      double _parseSubtotal(dynamic v) => double.tryParse(v?.toString() ?? '0') ?? 0;
      final detailStr = items.where((i) => i['is_supplier_cost'] != true).map((i) =>
        '${i['item_name'] ?? i['itemName'] ?? ''} x${(int.tryParse(i['quantity']?.toString() ?? '1') ?? 1).toStringAsFixed(0)} = \$${fm.format(_parseSubtotal(i['subtotal']))}'
      ).join('\n');
      final supTotal = items.fold<double>(0, (s, i) => s + ((i['is_supplier_cost'] == true) ? _parseSubtotal(i['subtotal']) : 0));
      final detailFinal = supTotal > 0 ? '$detailStr\n\nCostos de proveedores: \$${fm.format(supTotal)}' : detailStr;

      String portalInfo = '';
      try {
        final existing = await ApiService().get('/events/${widget.event.id}/client-access');
        if (existing is Map && existing['username'] != null) {
          final portalUrl = ApiService().baseUrl.contains('onrender.com')
              ? 'https://vento-web.onrender.com/portal'
              : '${ApiService().baseUrl.replaceAll(RegExp(r':\d+$'), '')}:5173/portal';
          portalInfo = '\n\nAccede a tu portal:\n$portalUrl\nUsuario: ${existing['username']}\nContraseña: ${existing['password']}';
        }
      } catch (_) {
        try {
          final created = await ApiService().post('/events/${widget.event.id}/client-access');
          if (created is Map && created['username'] != null) {
            final portalUrl = ApiService().baseUrl.contains('onrender.com')
                ? 'https://vento-web.onrender.com/portal'
                : '${ApiService().baseUrl.replaceAll(RegExp(r':\d+$'), '')}:5173/portal';
            portalInfo = '\n\nAccede a tu portal:\n$portalUrl\nUsuario: ${created['username']}\nContraseña: ${created['password']}';
          }
        } catch (_) {}
      }

      final msg = 'Hola! Te comparto la cotización de Vento para "${q.clientName ?? "tu evento"}".\n\n'
          '$detailFinal\n\n'
          'Total: \$${fm.format(q.total)}'
          '$portalInfo';
      await Share.share(msg);
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: ${e.toString().replaceFirst("Exception: ", "")}')));
    }
  }

  Widget _inventoryTab() {
    if (_loadingInventory) return const Center(child: CircularProgressIndicator());
    if (_inventory.isEmpty) {
      return ListView(children: [
        const SizedBox(height: 100),
        Center(child: Column(children: [
          Icon(Icons.inventory, size: 48, color: Colors.grey.shade200),
          const SizedBox(height: 8),
          const Text('No hay cotización aceptada', style: TextStyle(color: Colors.grey)),
          const SizedBox(height: 4),
          Text('Acepta una cotización para generar el inventario', style: TextStyle(fontSize: 12, color: Colors.grey.shade400)),
        ])),
      ]);
    }
    final isAdmin = AuthService().currentUser?.isAdmin ?? false;
    return ListView.builder(
      padding: const EdgeInsets.all(12),
      itemCount: _inventory.length,
      itemBuilder: (_, i) {
        final item = _inventory[i];
        final name = item['name'] ?? '';
        final quantity = int.tryParse(item['quantity']?.toString() ?? '0') ?? 0;
        final llevado = int.tryParse(item['llevado']?.toString() ?? '0') ?? 0;
        final needsReturn = item['needs_return'] == true;
        final quoteItemId = item['quote_item_id']?.toString();
        return Card(
          margin: const EdgeInsets.only(bottom: 8),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                Expanded(
                  child: Row(children: [
                    if (needsReturn)
                      Container(
                        margin: const EdgeInsets.only(right: 6),
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                        decoration: BoxDecoration(color: Colors.amber.shade100, borderRadius: BorderRadius.circular(8)),
                        child: Text('Regresa', style: TextStyle(fontSize: 10, color: Colors.amber.shade800, fontWeight: FontWeight.w600)),
                      ),
                    Text(name, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
                  ]),
                ),
                Row(children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                    decoration: BoxDecoration(color: Colors.cyan.shade50, borderRadius: BorderRadius.circular(12)),
                    child: Text('$quantity pz', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Colors.cyan.shade800)),
                  ),
                  if (llevado > 0)
                    Container(
                      margin: const EdgeInsets.only(left: 4),
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                      decoration: BoxDecoration(color: Colors.amber.shade50, borderRadius: BorderRadius.circular(12)),
                      child: Text('$llevado en montaje', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Colors.amber.shade800)),
                    ),
                ]),
              ]),
              const SizedBox(height: 8),
              Row(children: [
                _actionBtn('Llevar', Colors.amber, llevado >= quantity, () => _inventoryMovement(name, quantity - llevado, 'llevado')),
                const SizedBox(width: 6),
                _actionBtn('Regresar', Colors.green, llevado <= 0, () => _inventoryMovement(name, llevado, 'regresado')),
                if (quoteItemId != null && isAdmin) ...[
                  const Spacer(),
                  _actionBtn('Editar', Colors.blue, false, () => _editInventoryItem(quoteItemId, name, quantity)),
                  const SizedBox(width: 6),
                  _actionBtn('Eliminar', Colors.red, false, () => _deleteInventoryItem(quoteItemId, name)),
                ],
              ]),
            ]),
          ),
        );
      },
    );
  }

  Widget _actionBtn(String label, Color color, bool disabled, VoidCallback onPressed) {
    return SizedBox(
      height: 28,
      child: TextButton(
        style: TextButton.styleFrom(
          padding: const EdgeInsets.symmetric(horizontal: 8),
          backgroundColor: color.withValues(alpha: 0.1),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
        ),
        onPressed: disabled ? null : onPressed,
        child: Text(label, style: TextStyle(fontSize: 10, color: color, fontWeight: FontWeight.w600)),
      ),
    );
  }

  Future<void> _inventoryMovement(String itemName, int quantity, String type) async {
    try {
      await ApiService().post('/events/${widget.event.id}/inventory-movement', body: {
        'item_name': itemName,
        'quantity': quantity,
        'movement_type': type,
      });
      _loadInventory();
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e')));
    }
  }

  Future<void> _editInventoryItem(String quoteItemId, String currentName, int currentQty) async {
    final qtyCtrl = TextEditingController(text: currentQty.toString());
    final nameCtrl = TextEditingController(text: currentName);
    final result = await showDialog<Map>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Editar producto'),
        content: Column(mainAxisSize: MainAxisSize.min, children: [
          TextField(controller: nameCtrl, decoration: const InputDecoration(labelText: 'Nombre', border: OutlineInputBorder())),
          const SizedBox(height: 12),
          TextField(controller: qtyCtrl, decoration: const InputDecoration(labelText: 'Cantidad', border: OutlineInputBorder()), keyboardType: TextInputType.number),
        ]),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancelar')),
          ElevatedButton(onPressed: () => Navigator.pop(context, {'item_name': nameCtrl.text, 'quantity': int.tryParse(qtyCtrl.text) ?? 1}), child: const Text('Guardar')),
        ],
      ),
    );
    if (result == null) return;
    try {
      await ApiService().put('/quote-items/$quoteItemId', body: result);
      _loadInventory();
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Producto actualizado')));
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e')));
    }
  }

  Future<void> _deleteInventoryItem(String quoteItemId, String name) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Eliminar producto'),
        content: Text('¿Eliminar "$name" del inventario?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancelar')),
          ElevatedButton(onPressed: () => Navigator.pop(context, true), style: ElevatedButton.styleFrom(backgroundColor: Colors.red), child: const Text('Eliminar', style: TextStyle(color: Colors.white))),
        ],
      ),
    );
    if (confirm != true) return;
    try {
      await ApiService().delete('/quote-items/$quoteItemId');
      _loadInventory();
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Producto eliminado')));
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e')));
    }
  }
}
