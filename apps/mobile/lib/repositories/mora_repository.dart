import '../core/models.dart';
import '../core/network/api_client.dart';
import '../core/config/app_config.dart';
import '../state/app_state.dart';

class MoraRepository {
  MoraRepository({
    required this.apiClient,
    required this.appState,
  });

  final ApiClient apiClient;
  final AppState appState;

  Future<HomeSnapshot> fetchHomeSnapshot() async {
    final results = await Future.wait<Object?>([
      fetchPublicServices(),
      fetchPublicPromotions(),
      fetchPublicStaff(),
      fetchPublicProducts(),
    ]);

    return HomeSnapshot(
      services: results[0] as List<ServiceItem>,
      promotions: results[1] as List<PromotionItem>,
      staff: results[2] as List<StaffMember>,
      products: results[3] as List<ProductItem>,
    );
  }

  Future<BookingCatalog> fetchBookingCatalog() async {
    final results = await Future.wait<Object?>([
      fetchPublicServices(),
      fetchPublicStaff(),
    ]);

    return BookingCatalog(
      services: results[0] as List<ServiceItem>,
      staff: results[1] as List<StaffMember>,
    );
  }

  Future<List<ServiceItem>> fetchPublicServices() async {
    final response = await apiClient.get('/public/services');
    return _unwrapList(response).map(ServiceItem.fromJson).toList(growable: false);
  }

  Future<List<PromotionItem>> fetchPublicPromotions() async {
    final response = await apiClient.get('/public/promotions');
    return _unwrapList(response).map(PromotionItem.fromJson).toList(growable: false);
  }

  Future<List<StaffMember>> fetchPublicStaff() async {
    final response = await apiClient.get('/public/staff');
    return _unwrapList(response).map(StaffMember.fromJson).toList(growable: false);
  }

  Future<List<ProductItem>> fetchPublicProducts() async {
    final response = await apiClient.get('/public/products');
    return _unwrapList(response).map(ProductItem.fromJson).toList(growable: false);
  }

  Future<void> registerClient({
    required String name,
    required String phone,
    required String password,
    String? email,
    String? whatsapp,
    String? birthDate,
    String? docType,
    String? docNumber,
  }) async {
    await apiClient.post(
      '/client-auth/register',
      body: {
        'name': name,
        'phone': phone,
        'password': password,
        if (_hasText(email)) 'email': email,
        if (_hasText(whatsapp)) 'whatsapp': whatsapp,
        if (_hasText(birthDate)) 'birthDate': birthDate,
        if (_hasText(docType)) 'docType': docType,
        if (_hasText(docNumber)) 'docNumber': docNumber,
      },
    );
  }

  Future<ClientSession> loginClient({
    String? phone,
    String? email,
    required String password,
  }) async {
    final response = await apiClient.post(
      '/client-auth/login',
      body: {
        if (_hasText(phone)) 'phone': phone,
        if (_hasText(email)) 'email': email,
        'password': password,
      },
    );

    final map = _unwrapMap(response);
    final token = stringOf(map['token']);
    final session = ClientSession.fromJson(jsonMapOf(map['client']) ?? const {});
    appState.setClientSession(token, session);
    return session;
  }

  Future<ClientRecord> fetchClientProfile() async {
    final response = await apiClient.get('/client-profile', scope: AuthScope.client);
    return ClientRecord.fromJson(_unwrapMap(response));
  }

  Future<ClientRecord> updateClientProfile({
    String? name,
    String? phone,
    String? email,
    String? whatsapp,
    String? birthDate,
    String? docType,
    String? docNumber,
  }) async {
    final response = await apiClient.patch(
      '/client-profile',
      scope: AuthScope.client,
      body: {
        if (_hasText(name)) 'name': name,
        if (_hasText(phone)) 'phone': phone,
        if (_hasText(email)) 'email': email,
        if (_hasText(whatsapp)) 'whatsapp': whatsapp,
        if (_hasText(birthDate)) 'birthDate': birthDate,
        if (_hasText(docType)) 'docType': docType,
        if (_hasText(docNumber)) 'docNumber': docNumber,
      },
    );
    return ClientRecord.fromJson(_unwrapMap(response));
  }

  Future<List<ReservationRecord>> fetchClientReservations() async {
    final response = await apiClient.get('/client-reservations', scope: AuthScope.client);
    return _unwrapList(response).map(ReservationRecord.fromJson).toList(growable: false);
  }

  Future<List<AlbumRecord>> fetchClientAlbums() async {
    final response = await apiClient.get('/client-albums', scope: AuthScope.client);
    return _unwrapList(response).map(AlbumRecord.fromJson).toList(growable: false);
  }

  Future<List<ReviewRecord>> fetchClientReviews() async {
    final response = await apiClient.get('/client-reviews', scope: AuthScope.client);
    return _unwrapList(response).map(ReviewRecord.fromJson).toList(growable: false);
  }

  Future<ClientBundle> fetchClientBundle() async {
    final results = await Future.wait<Object?>([
      fetchClientProfile(),
      fetchClientReservations(),
      fetchClientAlbums(),
      fetchClientReviews(),
    ]);

    return ClientBundle(
      profile: results[0] as ClientRecord,
      reservations: results[1] as List<ReservationRecord>,
      albums: results[2] as List<AlbumRecord>,
      reviews: results[3] as List<ReviewRecord>,
    );
  }

  Future<AvailabilityPayload> fetchClientAvailability({
    required String date,
    required List<int> serviceIds,
    int? staffId,
  }) async {
    final response = await apiClient.get(
      '/client-availability',
      scope: AuthScope.client,
      query: {
        'date': date,
        'serviceIds': serviceIds,
        if (staffId != null && staffId > 0) 'staffId': staffId,
      },
    );

    return AvailabilityPayload.fromJson(jsonMapOf(response) ?? const {});
  }

  Future<ReservationRecord> createClientReservation({
    required List<BookingSelection> details,
    String? notes,
  }) async {
    final response = await apiClient.post(
      '/client-reservations',
      scope: AuthScope.client,
      body: {
        'channel': 'MOVIL',
        if (_hasText(notes)) 'notes': notes,
        'details': details.map((item) => item.toJson()).toList(growable: false),
      },
    );

    return ReservationRecord.fromJson(_unwrapMap(response));
  }

  Future<ReviewRecord> createReview({
    required int reservationId,
    required int rating,
    String? comment,
  }) async {
    final response = await apiClient.post(
      '/client-reviews',
      scope: AuthScope.client,
      body: {
        'reservationId': reservationId,
        'rating': rating,
        if (_hasText(comment)) 'comment': comment,
      },
    );

    return ReviewRecord.fromJson(_unwrapMap(response));
  }

  Future<SaleRecord> createPublicOrder({
    required String customerName,
    required String customerPhone,
    String? customerEmail,
    required String method,
    String? paymentReference,
    String? notes,
    required List<CartEntry> items,
  }) async {
    // If using PASARELA and no paymentReference provided, attempt client-side tokenization
    if (method == 'PASARELA' && (paymentReference == null || paymentReference.isEmpty)) {
      try {
        final publicKey = AppConfig.culqiPublicKey;
        final tokenResp = await _tokenizeCard(publicKey);
        if (tokenResp != null && tokenResp['id'] != null) {
          paymentReference = tokenResp['id'] as String;
        }
      } catch (_) {
        // ignore tokenization failures; server will return requiresGateway
      }
    }
    final response = await apiClient.post(
      '/public/orders',
      body: {
        'customerName': customerName,
        'customerPhone': customerPhone,
        if (_hasText(customerEmail)) 'customerEmail': customerEmail,
        'method': method,
        if (_hasText(paymentReference)) 'paymentReference': paymentReference,
        if (_hasText(notes)) 'notes': notes,
        'items': items
            .map((item) => {'productId': item.productId, 'quantity': item.quantity})
            .toList(growable: false),
      },
    );

    return SaleRecord.fromJson(_unwrapMap(response));
  }

  Future<Map<String, dynamic>?> _tokenizeCard(String publicKey) async {
    // Mobile flow does not collect card details in repository; tokenization
    // should be performed in UI and passed as paymentReference. Return null.
    return null;
  }

  Future<StaffSession> loginStaff({
    required String username,
    required String password,
  }) async {
    final response = await apiClient.post(
      '/auth/login',
      body: {
        'username': username,
        'password': password,
      },
    );

    final map = _unwrapMap(response);
    final token = stringOf(map['token']);
    final session = StaffSession.fromJson(jsonMapOf(map['user']) ?? const {});
    appState.setStaffSession(token, session);
    return session;
  }

  Future<MetricsSummary> fetchMetricsSummary() async {
    final response = await apiClient.get('/metrics/summary', scope: AuthScope.staff);
    return MetricsSummary.fromJson(_unwrapMap(response));
  }

  Future<List<ReservationRecord>> fetchAdminReservations({String? status}) async {
    final response = await apiClient.get(
      '/reservations',
      scope: AuthScope.staff,
      query: {if (_hasText(status)) 'status': status},
    );
    return _unwrapList(response).map(ReservationRecord.fromJson).toList(growable: false);
  }

  Future<ReservationRecord> updateReservationStatus(int id, {required String status, String? notes}) async {
    final response = await apiClient.patch(
      '/reservations/$id',
      scope: AuthScope.staff,
      body: {
        'status': status,
        if (_hasText(notes)) 'notes': notes,
      },
    );
    return ReservationRecord.fromJson(_unwrapMap(response));
  }

  Future<ReservationRecord> cancelReservation(int id, {String? reason}) async {
    final response = await apiClient.post(
      '/reservations/$id/cancel',
      scope: AuthScope.staff,
      body: {if (_hasText(reason)) 'reason': reason},
    );
    return ReservationRecord.fromJson(_unwrapMap(response));
  }

  Future<List<ClientRecord>> fetchClients() async {
    final response = await apiClient.get('/clients', scope: AuthScope.staff);
    return _unwrapList(response).map(ClientRecord.fromJson).toList(growable: false);
  }

  Future<ClientRecord> createClient({
    required String name,
    required String phone,
    String? email,
    String? whatsapp,
    String? birthDate,
    String? docType,
    String? docNumber,
    bool active = true,
  }) async {
    final response = await apiClient.post(
      '/clients',
      scope: AuthScope.staff,
      body: {
        'name': name,
        'phone': phone,
        if (_hasText(email)) 'email': email,
        if (_hasText(whatsapp)) 'whatsapp': whatsapp,
        if (_hasText(birthDate)) 'birthDate': birthDate,
        if (_hasText(docType)) 'docType': docType,
        if (_hasText(docNumber)) 'docNumber': docNumber,
        'active': active,
      },
    );
    return ClientRecord.fromJson(_unwrapMap(response));
  }

  Future<ClientRecord> updateClient(
    int id, {
    String? name,
    String? phone,
    String? email,
    String? whatsapp,
    String? birthDate,
    String? docType,
    String? docNumber,
    bool? active,
  }) async {
    final response = await apiClient.patch(
      '/clients/$id',
      scope: AuthScope.staff,
      body: {
        if (_hasText(name)) 'name': name,
        if (_hasText(phone)) 'phone': phone,
        if (_hasText(email)) 'email': email,
        if (_hasText(whatsapp)) 'whatsapp': whatsapp,
        if (_hasText(birthDate)) 'birthDate': birthDate,
        if (_hasText(docType)) 'docType': docType,
        if (_hasText(docNumber)) 'docNumber': docNumber,
        'active':? active,
      },
    );
    return ClientRecord.fromJson(_unwrapMap(response));
  }

  Future<void> deleteClient(int id) async {
    await apiClient.delete('/clients/$id', scope: AuthScope.staff);
  }

  Future<List<ServiceItem>> fetchAdminServices() async {
    final response = await apiClient.get('/services', scope: AuthScope.staff);
    return _unwrapList(response).map(ServiceItem.fromJson).toList(growable: false);
  }

  Future<ServiceItem> createService({
    required String name,
    String? description,
    required int durationMin,
    required double priceBase,
    bool active = true,
  }) async {
    final response = await apiClient.post(
      '/services',
      scope: AuthScope.staff,
      body: {
        'name': name,
        if (_hasText(description)) 'description': description,
        'durationMin': durationMin,
        'priceBase': priceBase,
        'active': active,
      },
    );

    return ServiceItem.fromJson(_unwrapMap(response));
  }

  Future<ServiceItem> updateService(
    int id, {
    String? name,
    String? description,
    int? durationMin,
    double? priceBase,
    bool? active,
  }) async {
    final response = await apiClient.patch(
      '/services/$id',
      scope: AuthScope.staff,
      body: {
        if (_hasText(name)) 'name': name,
        'description':? description,
        'durationMin':? durationMin,
        'priceBase':? priceBase,
        'active':? active,
      },
    );

    return ServiceItem.fromJson(_unwrapMap(response));
  }

  Future<void> deleteService(int id) async {
    await apiClient.delete('/services/$id', scope: AuthScope.staff);
  }

  Future<List<StaffMember>> fetchAdminStaff() async {
    final response = await apiClient.get('/staff', scope: AuthScope.staff);
    return _unwrapList(response).map(StaffMember.fromJson).toList(growable: false);
  }

  Future<void> saveStaff({
    int? id,
    required String name,
    String? role,
    String? phone,
    bool active = true,
    required List<int> serviceIds,
  }) async {
    final body = {
      'name': name,
      if (_hasText(role)) 'role': role,
      if (_hasText(phone)) 'phone': phone,
      'active': active,
    };

    int staffId = id ?? 0;
    if (id == null) {
      final response = await apiClient.post('/staff', scope: AuthScope.staff, body: body);
      staffId = intOf(_unwrapMap(response)['id']);
    } else {
      await apiClient.patch('/staff/$id', scope: AuthScope.staff, body: body);
      staffId = id;
    }

    await apiClient.put(
      '/staff/$staffId/services',
      scope: AuthScope.staff,
      body: {'serviceIds': serviceIds},
    );
  }

  Future<void> deleteStaff(int id) async {
    await apiClient.delete('/staff/$id', scope: AuthScope.staff);
  }

  Future<List<PromotionItem>> fetchAdminPromotions() async {
    final response = await apiClient.get('/promotions', scope: AuthScope.staff);
    return _unwrapList(response).map(PromotionItem.fromJson).toList(growable: false);
  }

  Future<void> savePromotion({
    int? id,
    required String name,
    required String type,
    double? value,
    required String startDate,
    required String endDate,
    String? channel,
    bool active = true,
    required List<int> serviceIds,
  }) async {
    final body = {
      'name': name,
      'type': type,
      'value':? value,
      'startDate': startDate,
      'endDate': endDate,
      if (_hasText(channel)) 'channel': channel,
      'active': active,
      'serviceIds': serviceIds,
    };

    if (id == null) {
      await apiClient.post('/promotions', scope: AuthScope.staff, body: body);
    } else {
      await apiClient.patch('/promotions/$id', scope: AuthScope.staff, body: body);
    }
  }

  Future<void> deletePromotion(int id) async {
    await apiClient.delete('/promotions/$id', scope: AuthScope.staff);
  }

  Future<List<ProductItem>> fetchAdminProducts() async {
    final response = await apiClient.get('/products', scope: AuthScope.staff);
    return _unwrapList(response).map(ProductItem.fromJson).toList(growable: false);
  }

  Future<void> saveProduct({
    int? id,
    required String name,
    String? description,
    String? category,
    required double price,
    required int stock,
    required bool active,
    required bool featured,
    required List<String> imageUrls,
  }) async {
    final body = {
      'name': name,
      'description':? description,
      'category':? category,
      'price': price,
      'stock': stock,
      'active': active,
      'featured': featured,
      'images': _buildProductImages(imageUrls),
    };

    if (id == null) {
      await apiClient.post('/products', scope: AuthScope.staff, body: body);
    } else {
      await apiClient.patch('/products/$id', scope: AuthScope.staff, body: body);
    }
  }

  Future<void> deleteProduct(int id) async {
    await apiClient.delete('/products/$id', scope: AuthScope.staff);
  }

  Future<List<SaleRecord>> fetchSales() async {
    final response = await apiClient.get('/sales', scope: AuthScope.staff);
    return _unwrapList(response).map(SaleRecord.fromJson).toList(growable: false);
  }

  Future<SaleRecord> updateSalePaymentStatus(int id, {required String paymentStatus, String? paymentReference}) async {
    final response = await apiClient.patch(
      '/sales/$id/payment-status',
      scope: AuthScope.staff,
      body: {
        'paymentStatus': paymentStatus,
        if (_hasText(paymentReference)) 'paymentReference': paymentReference,
      },
    );

    return SaleRecord.fromJson(_unwrapMap(response));
  }

  Future<AdminSnapshot> fetchAdminSnapshot() async {
    final results = await Future.wait<Object?>([
      fetchMetricsSummary(),
      fetchAdminReservations(),
      fetchClients(),
      fetchAdminServices(),
      fetchAdminPromotions(),
      fetchAdminStaff(),
      fetchAdminProducts(),
      fetchSales(),
    ]);

    return AdminSnapshot(
      metrics: results[0] as MetricsSummary,
      reservations: results[1] as List<ReservationRecord>,
      clients: results[2] as List<ClientRecord>,
      services: results[3] as List<ServiceItem>,
      promotions: results[4] as List<PromotionItem>,
      staff: results[5] as List<StaffMember>,
      products: results[6] as List<ProductItem>,
      sales: results[7] as List<SaleRecord>,
    );
  }

  JsonMap _unwrapMap(dynamic response) {
    final map = jsonMapOf(response) ?? const {};
    final data = map.containsKey('data') ? map['data'] : map;
    return jsonMapOf(data) ?? const {};
  }

  List<JsonMap> _unwrapList(dynamic response) {
    final map = jsonMapOf(response) ?? const {};
    final data = map.containsKey('data') ? map['data'] : response;
    return listOfObjects(data);
  }

  bool _hasText(String? value) => value != null && value.trim().isNotEmpty;

  List<JsonMap> _buildProductImages(List<String> urls) {
    final cleanUrls = urls.where(_hasText).map((item) => item.trim()).toList(growable: false);
    return cleanUrls
        .asMap()
        .entries
        .map(
          (entry) => {
            'url': entry.value,
            'isCover': entry.key == 0,
          },
        )
        .toList(growable: false);
  }
}