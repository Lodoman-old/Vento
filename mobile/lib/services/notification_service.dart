import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'api_service.dart';
import 'dart:convert';

class NotificationService {
  static final NotificationService _instance = NotificationService._();
  factory NotificationService() => _instance;
  NotificationService._();

  final FlutterLocalNotificationsPlugin _plugin = FlutterLocalNotificationsPlugin();
  bool _initialized = false;
  String? _fcmToken;
  Function(Map<String, dynamic>)? onNotificationOpened;

  Future<void> init() async {
    if (_initialized) return;

    await Firebase.initializeApp();

    const androidSettings = AndroidInitializationSettings('@mipmap/ic_launcher');
    const iosSettings = DarwinInitializationSettings();
    await _plugin.initialize(
      const InitializationSettings(android: androidSettings, iOS: iosSettings),
      onDidReceiveNotificationResponse: (response) {
        final payload = response.payload;
        if (payload != null) {
          try {
            final data = jsonDecode(payload) as Map<String, dynamic>;
            onNotificationOpened?.call(data);
          } catch (_) {}
        }
      },
    );

    final messaging = FirebaseMessaging.instance;

    await messaging.requestPermission(
      alert: true, badge: true, sound: true,
    );

    _fcmToken = await messaging.getToken();
    _saveToken(_fcmToken);

    messaging.onTokenRefresh.listen(_saveToken);

    FirebaseMessaging.onMessage.listen(_handleForegroundMessage);

    FirebaseMessaging.onMessageOpenedApp.listen((message) {
      final data = message.data;
      if (data.isNotEmpty) onNotificationOpened?.call(data);
    });

    final initialMessage = await messaging.getInitialMessage();
    if (initialMessage != null) {
      final data = initialMessage.data;
      if (data.isNotEmpty) onNotificationOpened?.call(data);
    }

    _initialized = true;
  }

  Future<void> _saveToken(String? token) async {
    if (token == null) return;
    try {
      await ApiService().post('/notifications/register-token', body: {
        'token': token,
        'platform': 'android',
      });
    } catch (_) {}
  }

  Future<void> _handleForegroundMessage(RemoteMessage message) async {
    final notification = message.notification;
    if (notification != null) {
      await showNotification(
        message.messageId.hashCode,
        notification.title ?? '',
        notification.body ?? '',
        payload: message.data.isNotEmpty ? jsonEncode(message.data) : null,
      );
    }
  }

  Future<void> showNotification(int id, String title, String body, {String? payload}) async {
    await _plugin.show(
      id, title, body,
      NotificationDetails(
        android: AndroidNotificationDetails(
          'vento_channel', 'Vento',
          importance: Importance.high,
          priority: Priority.high,
        ),
        iOS: DarwinNotificationDetails(),
      ),
      payload: payload,
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
