import 'dart:convert';
import 'package:web_socket_channel/web_socket_channel.dart';

class SocketService {
  WebSocketChannel? _channel;
  final Function(Map<String, dynamic>)? onAgendaUpdated;
  final Function(Map<String, dynamic>)? onSupplierUpdated;

  SocketService({this.onAgendaUpdated, this.onSupplierUpdated});

  void connect(String token) {
    final uri = Uri.parse('ws://10.0.2.2:4000/socket.io/?token=$token');
    _channel = WebSocketChannel.connect(uri);
    _channel!.stream.listen(_handleMessage);
  }

  void _handleMessage(dynamic data) {
    try {
      final msg = jsonDecode(data as String);
      if (msg is! Map) return;
      // Parse Socket.io protocol
      if (msg['type'] == 'agenda:updated' && onAgendaUpdated != null) {
        onAgendaUpdated!(msg['data']);
      }
      if (msg['type'] == 'supplier:updated' && onSupplierUpdated != null) {
        onSupplierUpdated!(msg['data']);
      }
    } catch (_) {}
  }

  void joinEvent(String eventId) {
    _channel?.sink.add(jsonEncode({
      'event': 'join:event',
      'data': eventId,
    }));
  }

  void dispose() {
    _channel?.sink.close();
  }
}
