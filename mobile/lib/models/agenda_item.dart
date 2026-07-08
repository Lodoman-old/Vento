class AgendaItem {
  final String id;
  final String eventId;
  final String title;
  final String? description;
  final DateTime? startTime;
  final DateTime? endTime;
  final String? assignedTo;
  final String? assignedName;
  final String? category;
  bool isCompleted;

  AgendaItem({
    required this.id, required this.eventId, required this.title, this.description,
    this.startTime, this.endTime, this.assignedTo, this.assignedName,
    this.category, this.isCompleted = false,
  });

  factory AgendaItem.fromJson(Map<String, dynamic> json) {
    return AgendaItem(
      id: json['id'] ?? '',
      eventId: json['event_id'] ?? '',
      title: json['title'] ?? '',
      description: json['description'],
      startTime: json['start_time'] != null ? DateTime.parse(json['start_time']) : null,
      endTime: json['end_time'] != null ? DateTime.parse(json['end_time']) : null,
      assignedTo: json['assigned_to'],
      assignedName: json['assigned_name'],
      category: json['category'],
      isCompleted: json['is_completed'] ?? false,
    );
  }
}
