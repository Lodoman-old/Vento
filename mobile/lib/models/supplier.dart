class Supplier {
  final String id;
  final String supplierId;
  final String name;
  final String? contactName;
  final String? category;
  final String? contractStatus;
  final double budgetAmount;
  final String? arrivalTime;

  Supplier({
    required this.id, required this.supplierId, required this.name, this.contactName, this.category,
    this.contractStatus, this.budgetAmount = 0, this.arrivalTime,
  });

  factory Supplier.fromJson(Map<String, dynamic> json) {
    return Supplier(
      id: json['id'] ?? '',
      supplierId: json['supplier_id'] ?? json['id'] ?? '',
      name: json['name'] ?? '',
      contactName: json['contact_name'],
      category: json['category'],
      contractStatus: json['contract_status'],
      budgetAmount: double.tryParse(json['budget_amount']?.toString() ?? '0') ?? 0,
      arrivalTime: json['arrival_time'],
    );
  }
}
