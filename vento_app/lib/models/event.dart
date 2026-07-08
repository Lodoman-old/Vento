class Event {
  final String id;
  final String name;
  final String? description;
  final DateTime date;
  final String? venue;
  final double totalBudget;
  final String status;
  final String? createdBy;
  final String? clientId;
  final String? coverImage;

  Event({
    required this.id,
    required this.name,
    this.description,
    required this.date,
    this.venue,
    this.totalBudget = 0,
    this.status = 'draft',
    this.createdBy,
    this.clientId,
    this.coverImage,
  });

  factory Event.fromJson(Map<String, dynamic> json) {
    return Event(
      id: json['id'] as String,
      name: json['name'] as String,
      description: json['description'] as String?,
      date: DateTime.parse(json['date'] as String),
      venue: json['venue'] as String?,
      totalBudget: (json['total_budget'] as num?)?.toDouble() ?? 0,
      status: json['status'] as String? ?? 'draft',
      createdBy: json['created_by'] as String?,
      clientId: json['client_id'] as String?,
      coverImage: json['cover_image'] as String?,
    );
  }
}
