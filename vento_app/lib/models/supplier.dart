class Supplier {
  final String id;
  final String eventId;
  final String name;
  final String? contactName;
  final String? phone;
  final String? email;
  final String category;
  final String? serviceDescription;
  final String contractStatus;
  final double budgetAmount;
  final double paidAmount;
  final DateTime? arrivalTime;
  final DateTime? actualArrivalTime;
  final String? notes;

  Supplier({
    required this.id,
    required this.eventId,
    required this.name,
    this.contactName,
    this.phone,
    this.email,
    this.category = 'other',
    this.serviceDescription,
    this.contractStatus = 'pending',
    this.budgetAmount = 0,
    this.paidAmount = 0,
    this.arrivalTime,
    this.actualArrivalTime,
    this.notes,
  });

  factory Supplier.fromJson(Map<String, dynamic> json) {
    return Supplier(
      id: json['id'] as String,
      eventId: json['event_id'] as String,
      name: json['name'] as String,
      contactName: json['contact_name'] as String?,
      phone: json['phone'] as String?,
      email: json['email'] as String?,
      category: json['category'] as String? ?? 'other',
      serviceDescription: json['service_description'] as String?,
      contractStatus: json['contract_status'] as String? ?? 'pending',
      budgetAmount: (json['budget_amount'] as num?)?.toDouble() ?? 0,
      paidAmount: (json['paid_amount'] as num?)?.toDouble() ?? 0,
      arrivalTime: json['arrival_time'] != null ? DateTime.parse(json['arrival_time'] as String) : null,
      actualArrivalTime: json['actual_arrival_time'] != null ? DateTime.parse(json['actual_arrival_time'] as String) : null,
      notes: json['notes'] as String?,
    );
  }
}
