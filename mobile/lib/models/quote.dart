class Payment {
  final String id;
  final double amount;
  final String? method;
  final String? reference;
  final String? notes;

  Payment({required this.id, required this.amount, this.method, this.reference, this.notes});

  factory Payment.fromJson(Map<String, dynamic> json) {
    return Payment(
      id: json['id'] ?? '',
      amount: double.tryParse(json['amount']?.toString() ?? '0') ?? 0,
      method: json['method'],
      reference: json['reference'],
      notes: json['notes'],
    );
  }
}

class QuoteItem {
  final String id;
  final String itemName;
  final int quantity;
  final double unitPrice;
  final double subtotal;

  QuoteItem({required this.id, required this.itemName, required this.quantity, required this.unitPrice, required this.subtotal});

  factory QuoteItem.fromJson(Map<String, dynamic> json) {
    return QuoteItem(
      id: json['id'] ?? '',
      itemName: json['item_name'] ?? '',
      quantity: json['quantity'] ?? 0,
      unitPrice: double.tryParse(json['unit_price']?.toString() ?? '0') ?? 0,
      subtotal: double.tryParse(json['subtotal']?.toString() ?? '0') ?? 0,
    );
  }
}

class Quote {
  final String id;
  final String? clientName;
  final String? clientPhone;
  final double total;
  final String status;
  final List<QuoteItem> items;
  final List<Payment> payments;

  Quote({required this.id, this.clientName, this.clientPhone, this.total = 0, this.status = '', this.items = const [], this.payments = const []});

  factory Quote.fromJson(Map<String, dynamic> json) {
    return Quote(
      id: json['id'] ?? '',
      clientName: json['client_name'],
      clientPhone: json['client_phone'],
      total: double.tryParse(json['total']?.toString() ?? '0') ?? 0,
      status: json['status'] ?? '',
      items: (json['items'] as List?)?.map((i) => QuoteItem.fromJson(i)).toList() ?? [],
      payments: (json['payments'] as List?)?.map((p) => Payment.fromJson(p)).toList() ?? [],
    );
  }
}
