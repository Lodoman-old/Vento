import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../services/api_service.dart';
import '../models/event.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  late DateTime _currentMonth;
  Map<String, List<Map>> _eventsByDay = {};
  List<Map> _selectedDayEvents = [];
  String? _error;
  bool _loading = false;

  @override
  void initState() {
    super.initState();
    _currentMonth = DateTime(DateTime.now().year, DateTime.now().month);
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final data = await ApiService().get('/events/calendar?year=${_currentMonth.year}&month=${_currentMonth.month}');
      final daysMap = data['days'] as Map? ?? data;
      final map = <String, List<Map>>{};
      daysMap.forEach((day, events) {
        map[day] = (events as List).cast<Map>();
      });
      _eventsByDay = map;
      _error = null;
    } catch (e) {
      _error = e.toString().replaceFirst('Exception: ', '');
    }
    if (mounted) setState(() => _loading = false);
  }

  void _prev() { setState(() { _currentMonth = DateTime(_currentMonth.year, _currentMonth.month - 1); }); _load(); }
  void _next() { setState(() { _currentMonth = DateTime(_currentMonth.year, _currentMonth.month + 1); }); _load(); }

  @override
  Widget build(BuildContext context) {
    final titleFmt = DateFormat('MMMM yyyy', 'es').format(_currentMonth);
    final daysInMonth = DateTime(_currentMonth.year, _currentMonth.month + 1, 0).day;
    final firstWeekday = DateTime(_currentMonth.year, _currentMonth.month, 1).weekday % 7;
    final today = DateTime.now();

    return Scaffold(
      appBar: AppBar(title: const Text('Dashboard')),
      body: Column(children: [
        Card(
          margin: const EdgeInsets.all(12),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Column(children: [
              Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                IconButton(onPressed: _prev, icon: const Icon(Icons.chevron_left)),
                Text(titleFmt, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                IconButton(onPressed: _next, icon: const Icon(Icons.chevron_right)),
              ]),
              if (_loading) const LinearProgressIndicator(),
              if (_error != null) Padding(padding: const EdgeInsets.only(top: 4), child: Text(_error!, style: const TextStyle(color: Colors.red, fontSize: 12))),
              GridView.count(
                crossAxisCount: 7,
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                childAspectRatio: 1.1,
                children: [
                  for (final d in ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'])
                    Center(child: Text(d, style: TextStyle(fontWeight: FontWeight.bold, fontSize: 11, color: Colors.grey.shade600))),
                  for (int i = 0; i < firstWeekday; i++) const SizedBox(),
                  for (int day = 1; day <= daysInMonth; day++) ..._buildDay(day, today),
                ],
              ),
            ]),
          ),
        ),
        if (_selectedDayEvents.isNotEmpty)
          Expanded(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('Eventos del día', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Colors.grey.shade700)),
                const SizedBox(height: 4),
                Expanded(
                  child: ListView(
                    children: _selectedDayEvents.map((e) => Card(
                      margin: const EdgeInsets.only(bottom: 6),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      child: ListTile(
                        dense: true,
                        leading: Container(width: 4, height: 24, decoration: BoxDecoration(
                          color: Theme.of(context).colorScheme.primary,
                          borderRadius: BorderRadius.circular(2),
                        )),
                        title: Text(e['name'] ?? '', style: const TextStyle(fontWeight: FontWeight.w500, fontSize: 13)),
                        subtitle: e['venue'] != null ? Text(e['venue'], style: TextStyle(fontSize: 11, color: Colors.grey.shade500)) : null,
                        trailing: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: Theme.of(context).colorScheme.primary.withValues(alpha: 0.1),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Text(e['status'] ?? '', style: TextStyle(fontSize: 10, color: Theme.of(context).colorScheme.primary)),
                        ),
                        onTap: () async {
                          final eventData = await ApiService().get('/events/${e['id']}');
                          if (mounted) Navigator.pushNamed(context, '/event', arguments: Event.fromJson(eventData));
                        },
                      ),
                    )).toList(),
                  ),
                ),
              ]),
            ),
          )
        else
          Expanded(child: Center(child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
            Icon(Icons.touch_app, size: 40, color: Colors.grey.shade300),
            const SizedBox(height: 8),
            const Text('Selecciona un día', style: TextStyle(color: Colors.grey)),
          ]))),
      ]),
    );
  }

  List<Widget> _buildDay(int day, DateTime today) {
    final key = '${_currentMonth.year}-${_currentMonth.month.toString().padLeft(2, '0')}-${day.toString().padLeft(2, '0')}';
    final events = _eventsByDay[key] ?? [];
    final isToday = day == today.day && _currentMonth.month == today.month && _currentMonth.year == today.year;
    final isPast = DateTime(_currentMonth.year, _currentMonth.month, day).isBefore(DateTime.now());

    return [
      GestureDetector(
        onTap: () {
          setState(() {
            _selectedDayEvents = events;
          });
        },
        child: Container(
          margin: const EdgeInsets.all(2),
          decoration: BoxDecoration(
            color: events.isNotEmpty ? Theme.of(context).colorScheme.primary.withValues(alpha: 0.08) : null,
            borderRadius: BorderRadius.circular(8),
            border: isToday ? Border.all(color: Theme.of(context).colorScheme.primary, width: 2) : null,
          ),
          child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
            Text('$day', style: TextStyle(
              fontSize: 13,
              fontWeight: isToday ? FontWeight.bold : FontWeight.normal,
              color: isPast ? Colors.grey.shade400 : null,
            )),
            if (events.isNotEmpty)
              Container(
                margin: const EdgeInsets.only(top: 2),
                width: 6, height: 6,
                decoration: BoxDecoration(
                  color: Theme.of(context).colorScheme.primary,
                  shape: BoxShape.circle,
                ),
              ),
          ]),
        ),
      ),
    ];
  }
}
