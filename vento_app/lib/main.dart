import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'providers/auth_provider.dart';
import 'screens/login_screen.dart';
import 'screens/home_screen.dart';
import 'theme.dart';

void main() {
  runApp(
    ChangeNotifierProvider(
      create: (_) => AuthProvider(),
      child: const VentoApp(),
    ),
  );
}

class VentoApp extends StatelessWidget {
  const VentoApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Vento',
      debugShowCheckedModeBanner: false,
      theme: ventoTheme,
      home: Consumer<AuthProvider>(
        builder: (_, auth, __) {
          if (auth.isLoading) {
            return const Scaffold(
              body: Center(child: CircularProgressIndicator()),
            );
          }
          if (auth.user != null) {
            return const HomeScreen();
          }
          return const LoginScreen();
        },
      ),
    );
  }
}
