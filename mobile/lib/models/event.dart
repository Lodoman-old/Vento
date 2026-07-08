class Event {
  final String id;
  final String name;
  final String? description;
  final DateTime date;
  final String? venue;
  final double totalBudget;
  final String status;
  final String? clientId;

  Event({
    required this.id, required this.name, this.description, required this.date,
    this.venue, this.totalBudget = 0, required this.status, this.clientId,
  });

  factory Event.fromJson(Map<String, dynamic> json) {
    return Event(
      id: json['id'] ?? '',
      name: json['name'] ?? '',
      description: json['description'],
      date: DateTime.parse(json['date']),
      venue: json['venue'],
      totalBudget: double.tryParse(json['total_budget']?.toString() ?? '0') ?? 0,
      status: json['status'] ?? '',
      clientId: json['client_id'],
    );
  }
}
