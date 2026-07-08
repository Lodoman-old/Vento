import 'package:flutter_test/flutter_test.dart';
import 'package:vento_app/main.dart';

void main() {
  testWidgets('App renders setup screen initially', (WidgetTester tester) async {
    await tester.pumpWidget(const VentoApp());
    expect(find.text('Vento'), findsWidgets);
  });
}
