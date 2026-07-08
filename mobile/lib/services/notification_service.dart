import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'api_service.dart';

class NotificationService {
  static final NotificationService _instance = NotificationService._();
  factory NotificationService() => _instance;
  NotificationService._();

  final FlutterLocalNotificationsPlugin _plugin = FlutterLocalNotificationsPlugin();
  bool _initialized = false;

  Future<void> init() async {
    if (_initialized) return;
    const androidSettings = AndroidInitializationSettings('@mipmap/ic_launcher');
    const iosSettings = DarwinInitializationSettings();
    await _plugin.initialize(const InitializationSettings(android: androidSettings, iOS: iosSettings));
    _initialized = true;
  }

  Future<void> showNotification(int id, String title, String body) async {
    await _plugin.show(
      id, title, body,
      const NotificationDetails(
        android: AndroidNotificationDetails('vento_channel', 'Vento', importance: Importance.high),
        iOS: DarwinNotificationDetails(),
      ),
    );
  }

  Future<void> scheduleEventReminders(String eventId, String eventName, DateTime eventDate) async {
    final prefs = await SharedPreferences.getInstance();
    final key = 'reminder_${eventId}_scheduled';
    if (prefs.getBool(key) == true) return;

    final now = DateTime.now();
    final reminders = [
      {'id': '${eventId}_7d', 'when': eventDate.subtract(const Duration(days: 7)), 'title': 'Falta 1 semana', 'body': 'El evento "$eventName" es en una semana'},
      {'id': '${eventId}_3d', 'when': eventDate.subtract(const Duration(days: 3)), 'title': 'Faltan 3 días', 'body': 'El evento "$eventName" es en 3 días'},
      {'id': '${eventId}_1d', 'when': eventDate.subtract(const Duration(days: 1)), 'title': 'Mañana es el evento', 'body': '"$eventName" es mañana'},
    ];

    for (final r in reminders) {
      final when = r['when'] as DateTime;
      final diff = when.difference(now);
      if (diff.inSeconds > 0) {
        // Use a simple delayed notification for now
        // In production, use android_alarm_manager or workmanager for precise scheduling
        Future.delayed(diff, () {
          showNotification(r['id'].hashCode, r['title'] as String, r['body'] as String);
        });
      }
    }

    await prefs.setBool(key, true);
  }

  Future<void> checkAndScheduleAllReminders() async {
    try {
      final api = ApiService();
      final data = await api.get('/events?limit=100');
      final events = data['data'] as List? ?? data as List? ?? [];
      for (final e in events) {
        final eventDate = DateTime.parse(e['date']);
        scheduleEventReminders(e['id'], e['name'], eventDate);
      }
    } catch (_) {}
  }
}
