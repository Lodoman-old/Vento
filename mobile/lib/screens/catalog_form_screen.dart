import 'dart:io';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import '../services/api_service.dart';

class CatalogFormScreen extends StatefulWidget {
  final Map? item;
  const CatalogFormScreen({super.key, this.item});

  @override
  State<CatalogFormScreen> createState() => _CatalogFormScreenState();
}

class _CatalogFormScreenState extends State<CatalogFormScreen> {
  final _nameCtrl = TextEditingController();
  final _priceCtrl = TextEditingController();
  final _descCtrl = TextEditingController();
  final _stockCtrl = TextEditingController();
  final _picker = ImagePicker();
  String _category = 'mobiliario';
  String _unitType = 'pieza';
  String? _imageUrl;
  File? _selectedImage;
  bool _saving = false;
  bool _uploading = false;

  @override
  void initState() {
    super.initState();
    final item = widget.item;
    if (item != null) {
      _nameCtrl.text = item['name'] ?? '';
      _priceCtrl.text = item['unit_price']?.toString() ?? '';
      _descCtrl.text = item['description'] ?? '';
      _stockCtrl.text = item['stock_available']?.toString() ?? '';
      _category = item['category'] ?? 'mobiliario';
      _unitType = item['unit_type'] ?? 'pieza';
      _imageUrl = item['image_url'] as String?;
    }
  }

  Future<void> _pickImage(ImageSource source) async {
    final picked = await _picker.pickImage(source: source, maxWidth: 800, imageQuality: 80);
    if (picked != null) setState(() => _selectedImage = File(picked.path));
  }

  Future<void> _save() async {
    if (_nameCtrl.text.trim().isEmpty) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Nombre requerido')));
      return;
    }
    setState(() => _saving = true);
    try {
      String? uploadedUrl = _imageUrl;
      if (_selectedImage != null) {
        setState(() => _uploading = true);
        uploadedUrl = await ApiService().uploadFile('/upload', _selectedImage!.path, fields: {'type': 'catalog'});
      }

      final body = {
        'name': _nameCtrl.text.trim(),
        'category': _category,
        'unit_type': _unitType,
        'unit_price': double.tryParse(_priceCtrl.text.trim()) ?? 0,
        'description': _descCtrl.text.trim().isEmpty ? null : _descCtrl.text.trim(),
        'stock_available': int.tryParse(_stockCtrl.text.trim()) ?? 0,
        if (uploadedUrl != null && _selectedImage != null) 'image_url': uploadedUrl,
      };
      if (widget.item != null) {
        await ApiService().put('/catalog/${widget.item!['id']}', body: body);
      } else {
        await ApiService().post('/catalog', body: body);
      }
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: ${e.toString().replaceFirst("Exception: ", "")}')));
    } finally {
      if (mounted) setState(() { _saving = false; _uploading = false; });
    }
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _priceCtrl.dispose();
    _descCtrl.dispose();
    _stockCtrl.dispose();
    super.dispose();
  }

  void _showImagePicker(BuildContext context) {
    showModalBottomSheet(
      context: context,
      builder: (_) => SafeArea(
        child: Wrap(children: [
          ListTile(leading: const Icon(Icons.camera_alt), title: const Text('Cámara'), onTap: () { Navigator.pop(context); _pickImage(ImageSource.camera); }),
          ListTile(leading: const Icon(Icons.photo_library), title: const Text('Galería'), onTap: () { Navigator.pop(context); _pickImage(ImageSource.gallery); }),
          if (_selectedImage != null || _imageUrl != null)
            ListTile(leading: const Icon(Icons.delete, color: Colors.red), title: const Text('Eliminar foto', style: TextStyle(color: Colors.red)), onTap: () { Navigator.pop(context); setState(() { _selectedImage = null; _imageUrl = null; }); }),
        ]),
      ),
    );
  }

  Widget _imagePlaceholder() {
    return const Column(mainAxisAlignment: MainAxisAlignment.center, children: [
      Icon(Icons.image, size: 40, color: Colors.grey),
      SizedBox(height: 4),
      Text('Tocar para agregar foto', style: TextStyle(fontSize: 12, color: Colors.grey)),
    ]);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(widget.item != null ? 'Editar producto' : 'Nuevo producto')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(children: [
          // Foto del producto
          GestureDetector(
            onTap: () => _showImagePicker(context),
            child: Container(
              width: double.infinity, height: 160,
              decoration: BoxDecoration(
                color: Colors.grey.shade100, borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.grey.shade300),
              ),
              child: _selectedImage != null
                ? ClipRRect(borderRadius: BorderRadius.circular(12), child: Image.file(_selectedImage!, width: double.infinity, height: 160, fit: BoxFit.cover))
                : _imageUrl != null
                  ? ClipRRect(borderRadius: BorderRadius.circular(12), child: Image.network('${ApiService().baseUrl}$_imageUrl', width: double.infinity, height: 160, fit: BoxFit.cover, errorBuilder: (_, __, ___) => _imagePlaceholder()))
                  : _imagePlaceholder(),
            ),
          ),
          const SizedBox(height: 6),
          _uploading
            ? const Row(mainAxisAlignment: MainAxisAlignment.center, children: [SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 1.5)), SizedBox(width: 6), Text('Subiendo imagen...', style: TextStyle(fontSize: 12, color: Colors.grey))])
            : TextButton.icon(
                onPressed: () => _showImagePicker(context),
                icon: const Icon(Icons.camera_alt, size: 16),
                label: const Text('Tomar o seleccionar foto', style: TextStyle(fontSize: 12)),
              ),
          const SizedBox(height: 12),
          TextField(controller: _nameCtrl, decoration: const InputDecoration(labelText: 'Nombre', border: OutlineInputBorder())),
          const SizedBox(height: 12),
          Row(children: [
            Expanded(child: DropdownButtonFormField<String>(
              value: _category,
              decoration: const InputDecoration(labelText: 'Categoría', border: OutlineInputBorder(), isDense: true),
              items: ['mobiliario', 'manteleria', 'loza', 'comida', 'bebida', 'decoracion', 'sonido', 'iluminacion', 'otros'].map((s) => DropdownMenuItem(value: s, child: Text(s))).toList(),
              onChanged: (v) => setState(() => _category = v!),
            )),
            const SizedBox(width: 8),
            Expanded(child: DropdownButtonFormField<String>(
              value: _unitType,
              decoration: const InputDecoration(labelText: 'Unidad', border: OutlineInputBorder(), isDense: true),
              items: ['pieza', 'persona', 'metro', 'juego', 'kg', 'litro'].map((s) => DropdownMenuItem(value: s, child: Text(s))).toList(),
              onChanged: (v) => setState(() => _unitType = v!),
            )),
          ]),
          const SizedBox(height: 12),
          TextField(controller: _priceCtrl, decoration: const InputDecoration(labelText: 'Precio unitario', border: OutlineInputBorder()), keyboardType: TextInputType.number),
          const SizedBox(height: 12),
          TextField(controller: _stockCtrl, decoration: const InputDecoration(labelText: 'Stock (opcional)', border: OutlineInputBorder()), keyboardType: TextInputType.number),
          const SizedBox(height: 12),
          TextField(controller: _descCtrl, decoration: const InputDecoration(labelText: 'Descripción (opcional)', border: OutlineInputBorder()), maxLines: 3),
          const SizedBox(height: 24),
          SizedBox(width: double.infinity, child: ElevatedButton(
            onPressed: _saving ? null : _save,
            child: _saving ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2)) : const Text('Guardar'),
          )),
        ]),
      ),
    );
  }
}
