class AgendaItem {
  final String id;
  final String eventId;
  final String title;
  final String? description;
  final DateTime startTime;
  final DateTime? endTime;
  final String? assignedTo;
  final String? assignedName;
  final String category;
  bool isCompleted;
  final DateTime? completedAt;
  String? notes;

  AgendaItem({
    required this.id,
    required this.eventId,
    required this.title,
    this.description,
    required this.startTime,
    this.endTime,
    this.assignedTo,
    this.assignedName,
    this.category = 'other',
    this.isCompleted = false,
    this.completedAt,
    this.notes,
  });

  factory AgendaItem.fromJson(Map<String, dynamic> json) {
    return AgendaItem(
      id: json['id'] as String,
      eventId: json['event_id'] as String,
      title: json['title'] as String,
      description: json['description'] as String?,
      startTime: DateTime.parse(json['start_time'] as String),
      endTime: json['end_time'] != null ? DateTime.parse(json['end_time'] as String) : null,
      assignedTo: json['assigned_to'] as String?,
      assignedName: json['assigned_name'] as String?,
      category: json['category'] as String? ?? 'other',
      isCompleted: json['is_completed'] as bool? ?? false,
      completedAt: json['completed_at'] != null ? DateTime.parse(json['completed_at'] as String) : null,
      notes: json['notes'] as String?,
    );
  }
}
