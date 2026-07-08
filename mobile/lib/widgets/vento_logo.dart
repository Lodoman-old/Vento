import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

class VentoLogo extends StatelessWidget {
  final double size;
  const VentoLogo({super.key, this.size = 120});

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        SvgPicture.asset(
          'assets/icon.svg',
          width: size,
          height: size,
        ),
        const SizedBox(height: 4),
        Text(
          'VENTO',
          style: TextStyle(
            fontSize: size * 0.1,
            letterSpacing: size * 0.04,
            fontWeight: FontWeight.bold,
            color: Colors.grey.shade400,
          ),
        ),
      ],
    );
  }
}
