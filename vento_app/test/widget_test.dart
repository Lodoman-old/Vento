import 'package:flutter_test/flutter_test.dart';
import 'package:vento_app/main.dart';

void main() {
  testWidgets('App loads login screen', (WidgetTester tester) async {
    await tester.pumpWidget(const VentoApp());
    expect(find.text('Vento'), findsOneWidget);
  });
}
