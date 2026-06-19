import 'config/app_config.dart' as cfg;

typedef JsonMap = Map<String, dynamic>;

JsonMap? jsonMapOf(dynamic value) {
  if (value is Map<String, dynamic>) {
    return value;
  }
  if (value is Map) {
    return value.map((key, item) => MapEntry(key.toString(), item));
  }
  return null;
}

List<JsonMap> listOfObjects(dynamic value) {
  if (value is! List) {
    return const [];
  }

  return value
      .map(jsonMapOf)
      .whereType<JsonMap>()
      .toList(growable: false);
}

String stringOf(dynamic value, [String fallback = '']) {
  if (value == null) {
    return fallback;
  }
  return value.toString();
}

int intOf(dynamic value, [int fallback = 0]) {
  if (value is int) {
    return value;
  }
  if (value is num) {
    return value.toInt();
  }
  if (value is String) {
    return int.tryParse(value) ?? fallback;
  }
  return fallback;
}

double doubleOf(dynamic value, [double fallback = 0]) {
  if (value is double) {
    return value;
  }
  if (value is num) {
    return value.toDouble();
  }
  if (value is String) {
    return double.tryParse(value) ?? fallback;
  }
  return fallback;
}

bool boolOf(dynamic value, [bool fallback = false]) {
  if (value is bool) {
    return value;
  }
  if (value is num) {
    return value != 0;
  }
  if (value is String) {
    final normalized = value.trim().toLowerCase();
    if (normalized == 'true' || normalized == '1') {
      return true;
    }
    if (normalized == 'false' || normalized == '0') {
      return false;
    }
  }
  return fallback;
}

DateTime? dateTimeOf(dynamic value) {
  if (value is DateTime) {
    return value.toLocal();
  }
  if (value == null) {
    return null;
  }
  return DateTime.tryParse(value.toString())?.toLocal();
}

class ClientSession {
  const ClientSession({
    required this.id,
    required this.name,
    required this.phone,
    this.email,
  });

  final int id;
  final String name;
  final String phone;
  final String? email;

  factory ClientSession.fromJson(JsonMap json) {
    return ClientSession(
      id: intOf(json['id']),
      name: stringOf(json['name'], 'Cliente'),
      phone: stringOf(json['phone']),
      email: json['email']?.toString(),
    );
  }

  JsonMap toJson() {
    return {
      'id': id,
      'name': name,
      'phone': phone,
      'email': email,
    };
  }
}

class StaffSession {
  const StaffSession({
    required this.id,
    required this.username,
    required this.fullName,
    required this.roles,
  });

  final int id;
  final String username;
  final String fullName;
  final List<String> roles;

  bool get isAdmin => roles.contains('ADMIN');

  factory StaffSession.fromJson(JsonMap json) {
    return StaffSession(
      id: intOf(json['id']),
      username: stringOf(json['username']),
      fullName: stringOf(json['fullName'], stringOf(json['username'], 'Staff')),
      roles: (json['roles'] as List?)?.map((item) => item.toString()).toList(growable: false) ?? const [],
    );
  }

  JsonMap toJson() {
    return {
      'id': id,
      'username': username,
      'fullName': fullName,
      'roles': roles,
    };
  }
}

class ServiceItem {
  const ServiceItem({
    required this.id,
    required this.name,
    required this.description,
    required this.durationMin,
    required this.priceBase,
    required this.active,
  });

  final int id;
  final String name;
  final String description;
  final int durationMin;
  final double priceBase;
  final bool active;

  factory ServiceItem.fromJson(JsonMap json) {
    return ServiceItem(
      id: intOf(json['id']),
      name: stringOf(json['name'], 'Servicio'),
      description: stringOf(json['description']),
      durationMin: intOf(json['durationMin']),
      priceBase: doubleOf(json['priceBase']),
      active: boolOf(json['active'], true),
    );
  }
}

class PromotionItem {
  const PromotionItem({
    required this.id,
    required this.name,
    required this.type,
    required this.value,
    required this.startDate,
    required this.endDate,
    required this.channel,
    required this.active,
    required this.serviceIds,
  });

  final int id;
  final String name;
  final String type;
  final double value;
  final DateTime? startDate;
  final DateTime? endDate;
  final String channel;
  final bool active;
  final List<int> serviceIds;

  factory PromotionItem.fromJson(JsonMap json) {
    final services = listOfObjects(json['services']);
    final explicitIds = (json['serviceIds'] as List?)?.map((item) => intOf(item)).where((id) => id > 0).toList();

    return PromotionItem(
      id: intOf(json['id']),
      name: stringOf(json['name'], 'Promocion'),
      type: stringOf(json['type'], 'PORCENTAJE'),
      value: doubleOf(json['value']),
      startDate: dateTimeOf(json['startDate']),
      endDate: dateTimeOf(json['endDate']),
      channel: stringOf(json['channel']),
      active: boolOf(json['active'], true),
      serviceIds: explicitIds ?? services.map((item) => intOf(item['serviceId'] ?? item['id'])).where((id) => id > 0).toList(growable: false),
    );
  }
}

class StaffMember {
  const StaffMember({
    required this.id,
    required this.name,
    required this.role,
    required this.phone,
    required this.active,
    required this.serviceIds,
  });

  final int id;
  final String name;
  final String role;
  final String phone;
  final bool active;
  final List<int> serviceIds;

  factory StaffMember.fromJson(JsonMap json) {
    final explicitIds = (json['serviceIds'] as List?)?.map((item) => intOf(item)).where((id) => id > 0).toList();
    final services = listOfObjects(json['services']);

    return StaffMember(
      id: intOf(json['id']),
      name: stringOf(json['name'], 'Especialista'),
      role: stringOf(json['role'], 'Especialista Mora'),
      phone: stringOf(json['phone']),
      active: boolOf(json['active'], true),
      serviceIds: explicitIds ?? services.map((item) => intOf(item['serviceId'] ?? jsonMapOf(item['service'])?['id'])).where((id) => id > 0).toList(growable: false),
    );
  }
}

class ProductImage {
  const ProductImage({
    required this.url,
    required this.fileName,
    required this.isCover,
    required this.order,
  });

  final String url;
  final String fileName;
  final bool isCover;
  final int order;

  factory ProductImage.fromJson(JsonMap json) {
    return ProductImage(
      url: cfg.resolveMediaUrl(stringOf(json['url'])),
      fileName: stringOf(json['fileName']),
      isCover: boolOf(json['isCover']),
      order: intOf(json['order']),
    );
  }
}

class ProductItem {
  const ProductItem({
    required this.id,
    required this.name,
    required this.description,
    required this.category,
    required this.price,
    required this.stock,
    required this.active,
    required this.featured,
    required this.images,
  });

  final int id;
  final String name;
  final String description;
  final String category;
  final double price;
  final int stock;
  final bool active;
  final bool featured;
  final List<ProductImage> images;

  String get coverUrl {
    final cover = images.cast<ProductImage?>().firstWhere(
          (item) => item?.isCover ?? false,
          orElse: () => images.isEmpty ? null : images.first,
        );
    return cover?.url ?? '';
  }

  factory ProductItem.fromJson(JsonMap json) {
    return ProductItem(
      id: intOf(json['id']),
      name: stringOf(json['name'], 'Producto'),
      description: stringOf(json['description']),
      category: stringOf(json['category']),
      price: doubleOf(json['price']),
      stock: intOf(json['stock']),
      active: boolOf(json['active'], true),
      featured: boolOf(json['featured']),
      images: listOfObjects(json['images']).map(ProductImage.fromJson).toList(growable: false),
    );
  }
}

class CartEntry {
  const CartEntry({
    required this.productId,
    required this.name,
    required this.price,
    required this.quantity,
    required this.coverUrl,
    required this.stock,
  });

  final int productId;
  final String name;
  final double price;
  final int quantity;
  final String coverUrl;
  final int stock;

  double get subtotal => price * quantity;

  factory CartEntry.fromProduct(ProductItem product, {int quantity = 1}) {
    return CartEntry(
      productId: product.id,
      name: product.name,
      price: product.price,
      quantity: quantity,
      coverUrl: product.coverUrl,
      stock: product.stock,
    );
  }

  factory CartEntry.fromJson(JsonMap json) {
    return CartEntry(
      productId: intOf(json['productId']),
      name: stringOf(json['name']),
      price: doubleOf(json['price']),
      quantity: intOf(json['quantity'], 1),
      coverUrl: cfg.resolveMediaUrl(stringOf(json['coverUrl'])),
      stock: intOf(json['stock']),
    );
  }

  CartEntry copyWith({
    int? productId,
    String? name,
    double? price,
    int? quantity,
    String? coverUrl,
    int? stock,
  }) {
    return CartEntry(
      productId: productId ?? this.productId,
      name: name ?? this.name,
      price: price ?? this.price,
      quantity: quantity ?? this.quantity,
      coverUrl: coverUrl ?? this.coverUrl,
      stock: stock ?? this.stock,
    );
  }

  JsonMap toJson() {
    return {
      'productId': productId,
      'name': name,
      'price': price,
      'quantity': quantity,
      'coverUrl': coverUrl,
      'stock': stock,
    };
  }
}

class BookingSelection {
  const BookingSelection({
    required this.serviceId,
    required this.staffId,
    required this.start,
  });

  final int serviceId;
  final int staffId;
  final DateTime start;

  JsonMap toJson() {
    return {
      'serviceId': serviceId,
      'staffId': staffId,
      'start': start.toLocal().toIso8601String(),
    };
  }
}

class AvailabilityAssignment {
  const AvailabilityAssignment({
    required this.serviceId,
    required this.staffId,
    required this.start,
    required this.end,
  });

  final int serviceId;
  final int staffId;
  final DateTime? start;
  final DateTime? end;

  factory AvailabilityAssignment.fromJson(JsonMap json) {
    return AvailabilityAssignment(
      serviceId: intOf(json['serviceId']),
      staffId: intOf(json['staffId']),
      start: dateTimeOf(json['start']),
      end: dateTimeOf(json['end']),
    );
  }
}

class AvailabilitySlot {
  const AvailabilitySlot({
    required this.id,
    required this.start,
    required this.end,
    required this.assignments,
  });

  final String id;
  final DateTime? start;
  final DateTime? end;
  final List<AvailabilityAssignment> assignments;

  factory AvailabilitySlot.fromJson(JsonMap json) {
    return AvailabilitySlot(
      id: stringOf(json['id']),
      start: dateTimeOf(json['start']),
      end: dateTimeOf(json['end']),
      assignments: listOfObjects(json['assignments']).map(AvailabilityAssignment.fromJson).toList(growable: false),
    );
  }
}

class AvailabilityEntry {
  const AvailabilityEntry({
    required this.staffId,
    required this.label,
    required this.mode,
    required this.slots,
  });

  final int? staffId;
  final String label;
  final String mode;
  final List<AvailabilitySlot> slots;

  factory AvailabilityEntry.fromJson(JsonMap json) {
    return AvailabilityEntry(
      staffId: json['staffId'] == null ? null : intOf(json['staffId']),
      label: stringOf(json['label'], 'Disponibilidad'),
      mode: stringOf(json['mode'], 'single_staff'),
      slots: listOfObjects(json['slots']).map(AvailabilitySlot.fromJson).toList(growable: false),
    );
  }
}

class AvailabilityMeta {
  const AvailabilityMeta({
    required this.mode,
    required this.reason,
    required this.totalDurationMin,
  });

  final String mode;
  final String reason;
  final int totalDurationMin;

  factory AvailabilityMeta.fromJson(JsonMap json) {
    return AvailabilityMeta(
      mode: stringOf(json['mode'], 'single_staff'),
      reason: stringOf(json['reason']),
      totalDurationMin: intOf(json['totalDurationMin']),
    );
  }
}

class AvailabilityPayload {
  const AvailabilityPayload({
    required this.data,
    required this.meta,
  });

  final List<AvailabilityEntry> data;
  final AvailabilityMeta meta;

  factory AvailabilityPayload.fromJson(JsonMap json) {
    return AvailabilityPayload(
      data: listOfObjects(json['data']).map(AvailabilityEntry.fromJson).toList(growable: false),
      meta: AvailabilityMeta.fromJson(jsonMapOf(json['meta']) ?? const {}),
    );
  }
}

class ReservationDetail {
  const ReservationDetail({
    required this.id,
    required this.serviceId,
    required this.staffId,
    required this.start,
    required this.end,
    required this.priceList,
    required this.subtotal,
    required this.serviceName,
    required this.staffName,
  });

  final int id;
  final int serviceId;
  final int staffId;
  final DateTime? start;
  final DateTime? end;
  final double priceList;
  final double subtotal;
  final String serviceName;
  final String staffName;

  factory ReservationDetail.fromJson(JsonMap json) {
    return ReservationDetail(
      id: intOf(json['id']),
      serviceId: intOf(json['serviceId']),
      staffId: intOf(json['staffId']),
      start: dateTimeOf(json['start']),
      end: dateTimeOf(json['end']),
      priceList: doubleOf(json['priceList']),
      subtotal: doubleOf(json['subtotal']),
      serviceName: stringOf(jsonMapOf(json['service'])?['name']),
      staffName: stringOf(jsonMapOf(json['staff'])?['name']),
    );
  }
}

class ReservationRecord {
  const ReservationRecord({
    required this.id,
    required this.code,
    required this.status,
    required this.channel,
    required this.start,
    required this.end,
    required this.notes,
    required this.clientId,
    required this.clientName,
    required this.details,
  });

  final int id;
  final String code;
  final String status;
  final String channel;
  final DateTime? start;
  final DateTime? end;
  final String notes;
  final int clientId;
  final String clientName;
  final List<ReservationDetail> details;

  factory ReservationRecord.fromJson(JsonMap json) {
    final client = jsonMapOf(json['client']);

    return ReservationRecord(
      id: intOf(json['id']),
      code: stringOf(json['code'], 'RSV-${intOf(json['id'])}'),
      status: stringOf(json['status'], 'PENDIENTE_ADELANTO'),
      channel: stringOf(json['channel'], 'WEB'),
      start: dateTimeOf(json['start']),
      end: dateTimeOf(json['end']),
      notes: stringOf(json['notes']),
      clientId: intOf(json['clientId']),
      clientName: stringOf(client?['name'], 'Cliente Mora'),
      details: listOfObjects(json['details']).map(ReservationDetail.fromJson).toList(growable: false),
    );
  }
}

class ClientRecord {
  const ClientRecord({
    required this.id,
    required this.name,
    required this.phone,
    required this.email,
    required this.whatsapp,
    required this.birthDate,
    required this.docType,
    required this.docNumber,
    required this.active,
    required this.createdAt,
    required this.lastLoginAt,
  });

  final int id;
  final String name;
  final String phone;
  final String email;
  final String whatsapp;
  final DateTime? birthDate;
  final String docType;
  final String docNumber;
  final bool active;
  final DateTime? createdAt;
  final DateTime? lastLoginAt;

  factory ClientRecord.fromJson(JsonMap json) {
    return ClientRecord(
      id: intOf(json['id']),
      name: stringOf(json['name'], 'Cliente Mora'),
      phone: stringOf(json['phone']),
      email: stringOf(json['email']),
      whatsapp: stringOf(json['whatsapp']),
      birthDate: dateTimeOf(json['birthDate']),
      docType: stringOf(json['docType']),
      docNumber: stringOf(json['docNumber']),
      active: boolOf(json['active'], true),
      createdAt: dateTimeOf(json['createdAt']),
      lastLoginAt: dateTimeOf(json['lastLoginAt']),
    );
  }
}

class AlbumPhoto {
  const AlbumPhoto({
    required this.id,
    required this.url,
    required this.caption,
  });

  final int id;
  final String url;
  final String caption;

  factory AlbumPhoto.fromJson(JsonMap json) {
    return AlbumPhoto(
      id: intOf(json['id']),
      url: cfg.resolveMediaUrl(stringOf(json['url'])),
      caption: stringOf(json['caption']),
    );
  }
}

class AlbumRecord {
  const AlbumRecord({
    required this.id,
    required this.title,
    required this.description,
    required this.createdAt,
    required this.photos,
  });

  final int id;
  final String title;
  final String description;
  final DateTime? createdAt;
  final List<AlbumPhoto> photos;

  factory AlbumRecord.fromJson(JsonMap json) {
    return AlbumRecord(
      id: intOf(json['id']),
      title: stringOf(json['name'] ?? json['title'], 'Album ${intOf(json['id'])}'),
      description: stringOf(json['description'] ?? json['notes']),
      createdAt: dateTimeOf(json['createdAt']),
      photos: listOfObjects(json['photos']).map(AlbumPhoto.fromJson).toList(growable: false),
    );
  }
}

class ReviewRecord {
  const ReviewRecord({
    required this.id,
    required this.reservationId,
    required this.rating,
    required this.comment,
    required this.status,
    required this.createdAt,
  });

  final int id;
  final int reservationId;
  final int rating;
  final String comment;
  final String status;
  final DateTime? createdAt;

  factory ReviewRecord.fromJson(JsonMap json) {
    return ReviewRecord(
      id: intOf(json['id']),
      reservationId: intOf(json['reservationId']),
      rating: intOf(json['rating']),
      comment: stringOf(json['comment']),
      status: stringOf(json['status'], 'PENDIENTE'),
      createdAt: dateTimeOf(json['createdAt']),
    );
  }
}

class SaleDetail {
  const SaleDetail({
    required this.id,
    required this.productId,
    required this.productName,
    required this.quantity,
    required this.unitPrice,
    required this.subtotal,
    required this.coverUrl,
  });

  final int id;
  final int productId;
  final String productName;
  final int quantity;
  final double unitPrice;
  final double subtotal;
  final String coverUrl;

  factory SaleDetail.fromJson(JsonMap json) {
    final product = jsonMapOf(json['product']);
    final images = listOfObjects(product?['images']);
    final cover = images.cast<JsonMap?>().firstWhere(
          (item) => boolOf(item?['isCover']),
          orElse: () => images.isEmpty ? null : images.first,
        );

    return SaleDetail(
      id: intOf(json['id']),
      productId: intOf(json['productId']),
      productName: stringOf(product?['name'], 'Producto'),
      quantity: intOf(json['quantity'], 1),
      unitPrice: doubleOf(json['unitPrice']),
      subtotal: doubleOf(json['subtotal']),
      coverUrl: cfg.resolveMediaUrl(stringOf(cover?['url'])),
    );
  }
}

class SaleRecord {
  const SaleRecord({
    required this.id,
    required this.total,
    required this.date,
    required this.method,
    required this.paymentStatus,
    required this.customerName,
    required this.customerPhone,
    required this.customerEmail,
    required this.details,
  });

  final int id;
  final double total;
  final DateTime? date;
  final String method;
  final String paymentStatus;
  final String customerName;
  final String customerPhone;
  final String customerEmail;
  final List<SaleDetail> details;

  factory SaleRecord.fromJson(JsonMap json) {
    return SaleRecord(
      id: intOf(json['id']),
      total: doubleOf(json['total']),
      date: dateTimeOf(json['date'] ?? json['createdAt']),
      method: stringOf(json['method'], 'EFECTIVO'),
      paymentStatus: stringOf(json['paymentStatus'], 'PENDIENTE'),
      customerName: stringOf(json['customerName']),
      customerPhone: stringOf(json['customerPhone']),
      customerEmail: stringOf(json['customerEmail']),
      details: listOfObjects(json['details']).map(SaleDetail.fromJson).toList(growable: false),
    );
  }
}

class MetricsSummary {
  const MetricsSummary({
    required this.reservationCount,
    required this.revenue,
    required this.advances,
    required this.staffOnDuty,
    required this.upcoming,
  });

  final int reservationCount;
  final double revenue;
  final double advances;
  final int staffOnDuty;
  final List<ReservationRecord> upcoming;

  factory MetricsSummary.fromJson(JsonMap json) {
    return MetricsSummary(
      reservationCount: intOf(json['reservationCount']),
      revenue: doubleOf(json['revenue']),
      advances: doubleOf(json['advances']),
      staffOnDuty: intOf(json['staffOnDuty']),
      upcoming: listOfObjects(json['upcoming']).map(ReservationRecord.fromJson).toList(growable: false),
    );
  }
}

class BookingCatalog {
  const BookingCatalog({
    required this.services,
    required this.staff,
  });

  final List<ServiceItem> services;
  final List<StaffMember> staff;
}

class HomeSnapshot {
  const HomeSnapshot({
    required this.services,
    required this.promotions,
    required this.staff,
    required this.products,
  });

  final List<ServiceItem> services;
  final List<PromotionItem> promotions;
  final List<StaffMember> staff;
  final List<ProductItem> products;
}

class ClientBundle {
  const ClientBundle({
    required this.profile,
    required this.reservations,
    required this.albums,
    required this.reviews,
  });

  final ClientRecord profile;
  final List<ReservationRecord> reservations;
  final List<AlbumRecord> albums;
  final List<ReviewRecord> reviews;
}

class AdminSnapshot {
  const AdminSnapshot({
    required this.metrics,
    required this.reservations,
    required this.clients,
    required this.services,
    required this.promotions,
    required this.staff,
    required this.products,
    required this.sales,
  });

  final MetricsSummary metrics;
  final List<ReservationRecord> reservations;
  final List<ClientRecord> clients;
  final List<ServiceItem> services;
  final List<PromotionItem> promotions;
  final List<StaffMember> staff;
  final List<ProductItem> products;
  final List<SaleRecord> sales;
}