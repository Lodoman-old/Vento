import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../models/supplier.dart';


class SuppliersScreen extends StatefulWidget {
  final String eventId;
  const SuppliersScreen({super.key, required this.eventId});

  @override
  State<SuppliersScreen> createState() => _SuppliersScreenState();
}

class _SuppliersScreenState extends State<SuppliersScreen> {
  List<Supplier> _suppliers = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final api = context.read<AuthProvider>().api;
      final data = await api.get('/suppliers?eventId=${widget.eventId}');
      setState(() {
        _suppliers = (data as List).map((e) => Supplier.fromJson(e)).toList();
        _loading = false;
      });
    } catch (_) {
      setState(() => _loading = false);
    }
  }

  Future<void> _reportArrival(String supplierId) async {
    try {
      await context.read<AuthProvider>().api.patch(
        '/suppliers/$supplierId',
        body: {'actualArrivalTime': DateTime.now().toIso8601String()},
      );
      _load();
    } catch (_) {}
  }

  Color _contractColor(String status) {
    switch (status) {
      case 'hired':
        return Colors.green;
      case 'contacted':
        return Colors.amber;
      case 'cancelled':
        return Colors.red;
      default:
        return Colors.grey;
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();

    return Scaffold(
      appBar: AppBar(title: const Text('Proveedores')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _load,
              child: _suppliers.isEmpty
                  ? const Center(child: Text('Sin proveedores', style: TextStyle(color: Colors.grey)))
                  : ListView.builder(
                      padding: const EdgeInsets.all(16),
                      itemCount: _suppliers.length,
                      itemBuilder: (_, i) {
                        final s = _suppliers[i];
                        return Card(
                          child: Padding(
                            padding: const EdgeInsets.all(16),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    Expanded(
                                      child: Text(s.name,
                                          style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 16)),
                                    ),
                                    Chip(
                                      label: Text(s.contractStatus,
                                          style: const TextStyle(fontSize: 11, color: Colors.white)),
                                      backgroundColor: _contractColor(s.contractStatus).withValues(alpha: 0.8),
                                      padding: EdgeInsets.zero,
                                      visualDensity: VisualDensity.compact,
                                      materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 8),
                                if (s.contactName != null)
                                  _info('Contacto', s.contactName!),
                                if (s.phone != null)
                                  _info('Teléfono', s.phone!),
                                if (s.email != null)
                                  _info('Email', s.email!),
                                if (s.budgetAmount > 0)
                                  _info('Presupuesto', '\$${s.budgetAmount.toStringAsFixed(0)}'),
                                if (s.arrivalTime != null)
                                  Padding(
                                    padding: const EdgeInsets.only(top: 4),
                                    child: Row(
                                      children: [
                                        const Icon(Icons.access_time, size: 16, color: Colors.grey),
                                        const SizedBox(width: 4),
                                        Text(
                                          'Llegada: ${s.arrivalTime!.hour.toString().padLeft(2, '0')}:${s.arrivalTime!.minute.toString().padLeft(2, '0')}',
                                          style: const TextStyle(fontSize: 13, color: Colors.grey),
                                        ),
                                        if (s.actualArrivalTime != null) ...[
                                          const SizedBox(width: 16),
                                          const Icon(Icons.check_circle, size: 16, color: Colors.green),
                                          Text(
                                            ' ${s.actualArrivalTime!.hour.toString().padLeft(2, '0')}:${s.actualArrivalTime!.minute.toString().padLeft(2, '0')}',
                                            style: const TextStyle(fontSize: 13, color: Colors.green),
                                          ),
                                        ],
                                      ],
                                    ),
                                  ),
                                if (s.arrivalTime != null &&
                                    s.actualArrivalTime == null &&
                                    auth.isStaff)
                                  Padding(
                                    padding: const EdgeInsets.only(top: 8),
                                    child: SizedBox(
                                      width: double.infinity,
                                      child: ElevatedButton.icon(
                                        onPressed: () => _reportArrival(s.id),
                                        icon: const Icon(Icons.login, size: 18),
                                        label: const Text('Reportar llegada'),
                                        style: ElevatedButton.styleFrom(
                                          backgroundColor: Colors.amber,
                                          foregroundColor: Colors.white,
                                        ),
                                      ),
                                    ),
                                  ),
                              ],
                            ),
                          ),
                        );
                      },
                    ),
            ),
    );
  }

  Widget _info(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(top: 2),
      child: Row(
        children: [
          Text('$label: ', style: const TextStyle(fontSize: 13, color: Colors.grey)),
          Text(value, style: const TextStyle(fontSize: 13)),
        ],
      ),
    );
  }
}
