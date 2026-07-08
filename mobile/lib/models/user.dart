class User {
  final String id;
  final String name;
  final String email;
  final String role;
  final String? photo;

  User({required this.id, required this.name, required this.email, required this.role, this.photo});

  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      id: json['id'] ?? '',
      name: json['name'] ?? json['display_name'] ?? '',
      email: json['email'] ?? '',
      role: json['role'] ?? '',
      photo: json['photo'],
    );
  }

  bool get isAdmin => role == 'administrador';
  bool get isStaff => role == 'staff';
  bool get isClient => role == 'cliente';
}
