import 'package:flutter/material.dart';

const Color ventoNavy = Color(0xFF0F172A);
const Color ventoCyan = Color(0xFF22D3EE);
const Color ventoLight = Color(0xFFF1F5F9);

final ThemeData ventoTheme = ThemeData(
  useMaterial3: true,
  brightness: Brightness.light,
  colorScheme: ColorScheme.fromSeed(
    seedColor: ventoCyan,
    primary: ventoNavy,
    secondary: ventoCyan,
    surface: ventoLight,
  ),
  scaffoldBackgroundColor: ventoLight,
  appBarTheme: const AppBarTheme(
    backgroundColor: ventoNavy,
    foregroundColor: Colors.white,
    elevation: 0,
    centerTitle: true,
  ),
  elevatedButtonTheme: ElevatedButtonThemeData(
    style: ElevatedButton.styleFrom(
      backgroundColor: ventoCyan,
      foregroundColor: ventoNavy,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(10),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
      textStyle: const TextStyle(
        fontWeight: FontWeight.w600,
        fontSize: 15,
      ),
    ),
  ),
  cardTheme: CardThemeData(
    elevation: 0,
    shape: RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(12),
      side: BorderSide(color: Colors.grey.shade200),
    ),
    margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
  ),
  inputDecorationTheme: InputDecorationTheme(
    border: OutlineInputBorder(
      borderRadius: BorderRadius.circular(10),
      borderSide: BorderSide(color: Colors.grey.shade300),
    ),
    enabledBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(10),
      borderSide: BorderSide(color: Colors.grey.shade300),
    ),
    focusedBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(10),
      borderSide: const BorderSide(color: ventoCyan, width: 2),
    ),
    contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
  ),
);
