import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:provider/provider.dart';
import 'services/api_service.dart';
import 'services/auth_service.dart';
import 'services/notification_service.dart';
import 'screens/setup_screen.dart';
import 'screens/login_screen.dart';
import 'screens/home_screen.dart';
import 'screens/event_detail_screen.dart';
import 'screens/event_form_screen.dart';
import 'screens/portal_screen.dart';
import 'screens/profile_screen.dart';
import 'screens/dashboard_screen.dart';
import 'screens/catalog_screen.dart';
import 'screens/suppliers_screen.dart';
import 'screens/notifications_screen.dart';
import 'screens/users_screen.dart';
import 'screens/agenda_form_screen.dart';
import 'screens/quote_form_screen.dart';
import 'screens/payment_form_screen.dart';
import 'screens/supplier_form_screen.dart';
import 'screens/catalog_form_screen.dart';
import 'models/event.dart';
import 'dart:convert';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  try {
    await initializeDateFormatting('es_MX');
    Intl.defaultLocale = 'es_MX';
  } catch (_) {}

  final api = ApiService();
  final auth = AuthService();

  try { await api.init(); } catch (_) {}
  try { await auth.init(); } catch (_) {}

  final notif = NotificationService();
  try { await notif.init(); } catch (_) {}

  runApp(MultiProvider(
    providers: [
      Provider<ApiService>.value(value: api),
      ChangeNotifierProvider<AuthService>.value(value: auth),
    ],
    child: const VentoApp(),
  ));

  try { notif.checkAndScheduleAllReminders(); } catch (_) {}

  notif.onNotificationOpened = (data) {
    final eventId = data['event_id'] as String?;
    if (eventId != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        final context = _navKey.currentContext;
        if (context != null) Navigator.pushNamed(context, '/event', arguments: eventId);
      });
    }
  };
}

final _navKey = GlobalKey<NavigatorState>();

class VentoApp extends StatelessWidget {
  const VentoApp({super.key});

  @override
  Widget build(BuildContext context) {
    final api = context.watch<ApiService>();
    return MaterialApp(
      navigatorKey: _navKey,
      title: 'Vento',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorSchemeSeed: const Color(0xFF0F766E),
        useMaterial3: true,
      ),
      initialRoute: api.hasBaseUrl ? '/login' : '/setup',
      onGenerateRoute: (settings) {
        switch (settings.name) {
          case '/setup':
            return MaterialPageRoute(builder: (_) => const SetupScreen());
          case '/login':
            return MaterialPageRoute(builder: (_) => const LoginScreen());
          case '/home':
            return MaterialPageRoute(builder: (_) => const HomeScreen());
          case '/portal':
            return MaterialPageRoute(builder: (_) => const PortalScreen());
          case '/event':
            final args = settings.arguments;
            if (args is Event) {
              return MaterialPageRoute(builder: (_) => EventDetailScreen(event: args));
            }
            return MaterialPageRoute(builder: (_) => EventDetailScreen(event: Event(id: args as String), isLoading: true));
          case '/event/new':
            final event = settings.arguments as Event?;
            return MaterialPageRoute(builder: (_) => EventFormScreen(event: event));
          case '/agenda/new':
            final eventId = settings.arguments as String;
            return MaterialPageRoute(builder: (_) => AgendaFormScreen(eventId: eventId));
          case '/quote/new':
            final eventId = settings.arguments as String;
            return MaterialPageRoute(builder: (_) => QuoteFormScreen(eventId: eventId));
          case '/profile':
            return MaterialPageRoute(builder: (_) => const ProfileScreen());
          case '/dashboard':
            return MaterialPageRoute(builder: (_) => const DashboardScreen());
          case '/catalog':
            return MaterialPageRoute(builder: (_) => const CatalogScreen());
          case '/suppliers':
            return MaterialPageRoute(builder: (_) => const SuppliersScreen());
          case '/notifications':
            return MaterialPageRoute(builder: (_) => const NotificationsScreen());
          case '/users':
            return MaterialPageRoute(builder: (_) => const UsersScreen());
          default:
            return MaterialPageRoute(builder: (_) => const SetupScreen());
        }
      },
    );
  }
}
