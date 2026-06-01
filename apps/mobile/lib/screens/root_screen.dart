import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../app/theme.dart';
import '../core/config/app_config.dart';
import '../core/models.dart';
import '../core/network/api_client.dart';
import '../core/utils/formatters.dart';
import '../repositories/mora_repository.dart';
import '../state/app_state.dart';
import 'admin_console_screen.dart';

class RootScreen extends StatefulWidget {
  const RootScreen({super.key, required this.repository});

  final MoraRepository repository;

  @override
  State<RootScreen> createState() => _RootScreenState();
}

class _RootScreenState extends State<RootScreen> {
  int _selectedIndex = 0;

  void _jumpTo(int index) {
    setState(() => _selectedIndex = index);
  }

  @override
  Widget build(BuildContext context) {
    final appState = context.watch<AppState>();
    final pages = [
      HomeTab(repository: widget.repository, onNavigate: _jumpTo),
      BookingTab(repository: widget.repository, onNavigate: _jumpTo),
      ShopTab(repository: widget.repository),
      AccountTab(repository: widget.repository, onNavigate: _jumpTo, isActive: _selectedIndex == 3),
    ];

    final titles = ['Mora', 'Reserva', 'Boutique', 'Mi cuenta'];

    return Scaffold(
      appBar: AppBar(
        title: Text(titles[_selectedIndex]),
        actions: [
          IconButton(
            tooltip: 'Mi cuenta',
            onPressed: () => _jumpTo(3),
            icon: const Icon(Icons.person_rounded),
          ),
        ],
      ),
      body: SafeArea(
        child: IndexedStack(
          index: _selectedIndex,
          children: pages,
        ),
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _selectedIndex,
        onDestinationSelected: _jumpTo,
        destinations: [
          const NavigationDestination(icon: Icon(Icons.home_rounded), label: 'Inicio'),
          const NavigationDestination(icon: Icon(Icons.event_available_rounded), label: 'Reservar'),
          NavigationDestination(
            icon: appState.cartCount > 0
                ? Badge.count(count: appState.cartCount, child: const Icon(Icons.shopping_bag_rounded))
                : const Icon(Icons.shopping_bag_rounded),
            label: 'Tienda',
          ),
          const NavigationDestination(icon: Icon(Icons.account_circle_rounded), label: 'Cuenta'),
        ],
      ),
    );
  }
}

class HomeTab extends StatefulWidget {
  const HomeTab({
    super.key,
    required this.repository,
    required this.onNavigate,
  });

  final MoraRepository repository;
  final ValueChanged<int> onNavigate;

  @override
  State<HomeTab> createState() => _HomeTabState();
}

class _HomeTabState extends State<HomeTab> {
  late Future<HomeSnapshot> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<HomeSnapshot> _load() async {
    final snapshot = await widget.repository.fetchHomeSnapshot();
    if (mounted) {
      context.read<AppState>().reconcileCart(snapshot.products);
    }
    return snapshot;
  }

  Future<void> _refresh() async {
    final future = _load();
    setState(() {
      _future = future;
    });
    await future;
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<HomeSnapshot>(
      future: _future,
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting && !snapshot.hasData) {
          return const Center(child: CircularProgressIndicator());
        }

        if (snapshot.hasError && !snapshot.hasData) {
          return _AsyncErrorView(
            title: 'No se pudo cargar la portada',
            message: _errorMessage(snapshot.error),
            onRetry: _refresh,
          );
        }

        final data = snapshot.data;
        if (data == null) {
          return _AsyncErrorView(
            title: 'No hay datos para mostrar',
            message: 'La API no devolvio informacion para la portada.',
            onRetry: _refresh,
          );
        }

        final products = data.products.where((item) => item.active).toList(growable: false);
        final featuredProducts = products.where((item) => item.featured).toList(growable: false);
        final spotlightProducts = (featuredProducts.isEmpty ? products : featuredProducts).take(4).toList(growable: false);
        final spotlightServices = data.services.take(3).toList(growable: false);
        final spotlightStaff = data.staff.take(3).toList(growable: false);
        final activePromotions = data.promotions.where((promo) => promo.active).toList(growable: false);
        final heroPromotionCount = activePromotions.isEmpty ? data.promotions.length : activePromotions.length;
        final spotlightPromotion = activePromotions.isNotEmpty
            ? activePromotions.first
            : data.promotions.isNotEmpty
                ? data.promotions.first
                : null;

        return RefreshIndicator(
          onRefresh: _refresh,
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 28),
            children: [
              _HeroPanel(
                eyebrow: 'Mora signature',
                title: 'Reserva y compra con una vista mas clara.',
                subtitle: 'La app movil ahora prioriza lo importante y conserva la misma logica en tiempo real que la web.',
                actions: [
                  FilledButton.icon(
                    onPressed: () => widget.onNavigate(1),
                    icon: const Icon(Icons.event_available_rounded),
                    label: const Text('Reservar'),
                  ),
                  OutlinedButton.icon(
                    onPressed: () => widget.onNavigate(3),
                    icon: const Icon(Icons.person_outline_rounded),
                    label: const Text('Mi cuenta'),
                  ),
                ],
                footer: Wrap(
                  spacing: 12,
                  runSpacing: 12,
                  children: [
                    _MetricChip(icon: Icons.content_cut_rounded, label: '${data.services.length} servicios'),
                    _MetricChip(icon: Icons.local_offer_outlined, label: '$heroPromotionCount promos'),
                    _MetricChip(icon: Icons.shopping_bag_outlined, label: '${products.length} productos'),
                  ],
                ),
              ),
              const SizedBox(height: 18),
              _SectionCard(
                eyebrow: 'Accesos',
                title: 'Empieza por aqui',
                subtitle: 'Menos lectura y tres entradas directas para completar la tarea que viniste a hacer.',
                child: Column(
                  children: [
                    _QuickActionTile(
                      icon: Icons.event_available_rounded,
                      title: 'Nueva reserva',
                      subtitle: 'Disponibilidad real y confirmacion clara en pocos pasos.',
                      onTap: () => widget.onNavigate(1),
                    ),
                    const SizedBox(height: 12),
                    _QuickActionTile(
                      icon: Icons.shopping_bag_outlined,
                      title: 'Boutique Mora',
                      subtitle: 'Productos destacados y carrito persistente sin ruido visual.',
                      onTap: () => widget.onNavigate(2),
                    ),
                    const SizedBox(height: 12),
                    _QuickActionTile(
                      icon: Icons.person_outline_rounded,
                      title: 'Mi cuenta',
                      subtitle: 'Historial, albumes, resenas y acceso al panel desde una sola vista.',
                      onTap: () => widget.onNavigate(3),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 18),
              _SectionCard(
                eyebrow: 'Seleccion',
                title: 'Lo mas buscado hoy',
                subtitle: 'Un resumen ligero de servicios, promo activa y especialistas visibles.',
                child: spotlightServices.isEmpty
                    ? const _EmptyInfoCard(
                        title: 'Sin destacados por ahora',
                        message: 'La portada mostrara servicios y promos apenas vuelvan a estar activos.',
                      )
                    : Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          SizedBox(
                            height: 192,
                            child: ListView.separated(
                              scrollDirection: Axis.horizontal,
                              itemCount: spotlightServices.length,
                              separatorBuilder: (_, _) => const SizedBox(width: 12),
                              itemBuilder: (context, index) => _CompactServiceCard(service: spotlightServices[index]),
                            ),
                          ),
                          if (spotlightPromotion != null) ...[
                            const SizedBox(height: 16),
                            _CompactPromotionBanner(promotion: spotlightPromotion),
                          ],
                          if (spotlightStaff.isNotEmpty) ...[
                            const SizedBox(height: 16),
                            Wrap(
                              spacing: 12,
                              runSpacing: 12,
                              children: spotlightStaff
                                  .map((member) => _CompactStaffChip(member: member))
                                  .toList(growable: false),
                            ),
                          ],
                        ],
                      ),
              ),
              const SizedBox(height: 18),
              _SectionCard(
                eyebrow: 'Boutique',
                title: 'Compra rapido',
                subtitle: 'Favoritos sincronizados con menos texto y el mismo stock real.',
                action: TextButton(
                  onPressed: () => widget.onNavigate(2),
                  child: const Text('Abrir'),
                ),
                child: spotlightProducts.isEmpty
                    ? const _EmptyInfoCard(
                        title: 'Sin productos visibles',
                        message: 'Cuando el catalogo tenga stock activo, apareceran aqui tus destacados.',
                      )
                    : SizedBox(
                        height: 244,
                        child: ListView.separated(
                          scrollDirection: Axis.horizontal,
                          itemCount: spotlightProducts.length,
                          separatorBuilder: (_, _) => const SizedBox(width: 12),
                          itemBuilder: (context, index) => _CompactProductCard(product: spotlightProducts[index]),
                        ),
                      ),
              ),
            ],
          ),
        );
      },
    );
  }
}

class BookingTab extends StatefulWidget {
  const BookingTab({
    super.key,
    required this.repository,
    required this.onNavigate,
  });

  final MoraRepository repository;
  final ValueChanged<int> onNavigate;

  @override
  State<BookingTab> createState() => _BookingTabState();
}

class _BookingTabState extends State<BookingTab> {
  late Future<BookingCatalog> _catalogFuture;
  final List<int> _selectedServiceIds = <int>[];
  final TextEditingController _notesController = TextEditingController();

  int _selectedStaffId = 0;
  DateTime? _selectedDate;
  AvailabilityPayload? _availability;
  _SelectableSlot? _selectedSlot;
  String? _availabilityError;
  bool _loadingSlots = false;
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    _catalogFuture = widget.repository.fetchBookingCatalog();
  }

  @override
  void dispose() {
    _notesController.dispose();
    super.dispose();
  }

  Future<void> _refresh() async {
    final future = widget.repository.fetchBookingCatalog();
    setState(() => _catalogFuture = future);
    await future;
  }

  void _toggleService(int serviceId) {
    setState(() {
      if (_selectedServiceIds.contains(serviceId)) {
        _selectedServiceIds.remove(serviceId);
      } else {
        _selectedServiceIds.add(serviceId);
      }
      _availability = null;
      _selectedSlot = null;
      _availabilityError = null;
    });
  }

  Future<void> _pickDate() async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: _selectedDate ?? now,
      firstDate: now,
      lastDate: now.add(const Duration(days: 90)),
    );

    if (picked == null) {
      return;
    }

    setState(() {
      _selectedDate = picked;
      _selectedSlot = null;
      _availability = null;
      _availabilityError = null;
    });
  }

  Future<void> _searchSlots() async {
    final appState = context.read<AppState>();
    if (!appState.isClientAuthenticated) {
      _showMessage(context, 'Inicia sesion para consultar horarios reales y reservar.');
      widget.onNavigate(3);
      return;
    }

    if (_selectedServiceIds.isEmpty) {
      _showMessage(context, 'Selecciona al menos un servicio.');
      return;
    }

    if (_selectedDate == null) {
      _showMessage(context, 'Elige una fecha primero.');
      return;
    }

    setState(() {
      _loadingSlots = true;
      _availabilityError = null;
      _selectedSlot = null;
    });

    try {
      final payload = await widget.repository.fetchClientAvailability(
        date: formatInputDate(_selectedDate!),
        serviceIds: _selectedServiceIds,
        staffId: _selectedStaffId > 0 ? _selectedStaffId : null,
      );

      if (!mounted) {
        return;
      }

      setState(() {
        _availability = payload;
      });
    } catch (error) {
      if (!mounted) {
        return;
      }

      setState(() {
        _availabilityError = _errorMessage(error);
        _availability = null;
      });
    } finally {
      if (mounted) {
        setState(() => _loadingSlots = false);
      }
    }
  }

  Future<void> _submitReservation(List<ServiceItem> services) async {
    final appState = context.read<AppState>();
    if (!appState.isClientAuthenticated) {
      _showMessage(context, 'Inicia sesion para confirmar tu reserva.');
      widget.onNavigate(3);
      return;
    }

    final slot = _selectedSlot;
    if (slot == null) {
      _showMessage(context, 'Selecciona un horario disponible.');
      return;
    }

    final details = _buildBookingSelection(slot, services);
    if (details.isEmpty) {
      _showMessage(context, 'No se pudo construir la reserva con el horario elegido.');
      return;
    }

    setState(() => _submitting = true);

    try {
      final reservation = await widget.repository.createClientReservation(
        details: details,
        notes: _notesController.text.trim().isEmpty ? null : _notesController.text.trim(),
      );

      if (!mounted) {
        return;
      }

      setState(() {
        _availability = null;
        _selectedSlot = null;
        _selectedServiceIds.clear();
        _selectedStaffId = 0;
        _selectedDate = null;
        _notesController.clear();
      });

      _showMessage(context, 'Reserva ${reservation.code} creada correctamente.');
      widget.onNavigate(3);
    } catch (error) {
      if (!mounted) {
        return;
      }
      _showMessage(context, _errorMessage(error));
    } finally {
      if (mounted) {
        setState(() => _submitting = false);
      }
    }
  }

  List<BookingSelection> _buildBookingSelection(_SelectableSlot choice, List<ServiceItem> services) {
    if (choice.slot.assignments.isNotEmpty) {
      return choice.slot.assignments
          .where((item) => item.start != null)
          .map(
            (item) => BookingSelection(
              serviceId: item.serviceId,
              staffId: item.staffId,
              start: item.start!,
            ),
          )
          .toList(growable: false);
    }

    if (choice.entry.staffId == null || choice.slot.start == null) {
      return const [];
    }

    final serviceById = {for (final service in services) service.id: service};
    final details = <BookingSelection>[];
    var cursor = choice.slot.start!;

    for (final serviceId in _selectedServiceIds) {
      final service = serviceById[serviceId];
      if (service == null) {
        continue;
      }
      details.add(
        BookingSelection(
          serviceId: service.id,
          staffId: choice.entry.staffId!,
          start: cursor,
        ),
      );
      cursor = cursor.add(Duration(minutes: service.durationMin));
    }

    return details;
  }

  @override
  Widget build(BuildContext context) {
    final appState = context.watch<AppState>();

    return FutureBuilder<BookingCatalog>(
      future: _catalogFuture,
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting && !snapshot.hasData) {
          return const Center(child: CircularProgressIndicator());
        }

        if (snapshot.hasError && !snapshot.hasData) {
          return _AsyncErrorView(
            title: 'No se pudo preparar la reserva',
            message: _errorMessage(snapshot.error),
            onRetry: _refresh,
          );
        }

        final catalog = snapshot.data;
        if (catalog == null) {
          return _AsyncErrorView(
            title: 'Catalogo vacio',
            message: 'No hay servicios ni especialistas para reservar.',
            onRetry: _refresh,
          );
        }

        final selectedServices = catalog.services.where((item) => _selectedServiceIds.contains(item.id)).toList(growable: false);
        final total = selectedServices.fold<double>(0, (sum, item) => sum + item.priceBase);
        final totalMinutes = selectedServices.fold<int>(0, (sum, item) => sum + item.durationMin);

        return RefreshIndicator(
          onRefresh: _refresh,
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 28),
            children: [
              _HeroPanel(
                eyebrow: 'Reserva real',
                title: 'Horarios calculados con la agenda del salon.',
                subtitle:
                    'La app consulta el motor de disponibilidad del backend, respeta avance minimo y arma reservas con un solo o varios especialistas.',
                actions: [
                  if (!appState.isClientAuthenticated)
                    FilledButton.icon(
                      onPressed: () => widget.onNavigate(3),
                      icon: const Icon(Icons.login_rounded),
                      label: const Text('Iniciar sesion'),
                    ),
                ],
                footer: Wrap(
                  spacing: 12,
                  runSpacing: 12,
                  children: [
                    _MetricChip(label: appState.isClientAuthenticated ? 'Sesion activa' : 'Necesitas autenticarte'),
                    _MetricChip(label: '${catalog.services.length} servicios listos'),
                    _MetricChip(label: '${catalog.staff.length} especialistas sincronizados'),
                  ],
                ),
              ),
              const SizedBox(height: 20),
              _SectionCard(
                eyebrow: 'Paso 1',
                title: 'Define tu visita',
                subtitle: 'Puedes reservar varios servicios en una sola operacion.',
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Column(
                      children: catalog.services
                          .map(
                            (service) => Padding(
                              padding: const EdgeInsets.only(bottom: 12),
                              child: _BookingServiceTile(
                                service: service,
                                selected: _selectedServiceIds.contains(service.id),
                                onTap: () => _toggleService(service.id),
                              ),
                            ),
                          )
                          .toList(growable: false),
                    ),
                    const SizedBox(height: 16),
                    DropdownButtonFormField<int>(
                      initialValue: _selectedStaffId,
                      decoration: const InputDecoration(labelText: 'Especialista preferido'),
                      items: [
                        const DropdownMenuItem<int>(value: 0, child: Text('Cualquiera del equipo')),
                        ...catalog.staff.map(
                          (staff) => DropdownMenuItem<int>(
                            value: staff.id,
                            child: Text(staff.name),
                          ),
                        ),
                      ],
                      onChanged: (value) {
                        setState(() {
                          _selectedStaffId = value ?? 0;
                          _availability = null;
                          _selectedSlot = null;
                        });
                      },
                    ),
                    const SizedBox(height: 16),
                    OutlinedButton.icon(
                      onPressed: _pickDate,
                      icon: const Icon(Icons.calendar_month_rounded),
                      label: Text(_selectedDate == null ? 'Elegir fecha' : formatDate(_selectedDate)),
                    ),
                    if (selectedServices.isNotEmpty) ...[
                      const SizedBox(height: 16),
                      Container(
                        padding: const EdgeInsets.all(16),
                        decoration: sectionDecoration(color: MoraColors.cream),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('Resumen estimado', style: Theme.of(context).textTheme.titleMedium),
                            const SizedBox(height: 8),
                            Text('${selectedServices.length} servicio(s) · $totalMinutes min · ${formatCurrency(total)}'),
                          ],
                        ),
                      ),
                    ],
                    const SizedBox(height: 16),
                    FilledButton.icon(
                      onPressed: _loadingSlots ? null : _searchSlots,
                      icon: _loadingSlots
                          ? const SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                            )
                          : const Icon(Icons.search_rounded),
                      label: Text(_loadingSlots ? 'Buscando...' : 'Buscar horarios'),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),
              _SectionCard(
                eyebrow: 'Paso 2',
                title: 'Selecciona un horario real',
                subtitle: 'Los resultados salen del endpoint de disponibilidad del cliente.',
                child: _buildAvailabilityContent(context, selectedServices),
              ),
              const SizedBox(height: 20),
              _SectionCard(
                eyebrow: 'Paso 3',
                title: 'Confirma tu visita',
                subtitle: 'Puedes dejar observaciones para el equipo antes de reservar.',
                child: Column(
                  children: [
                    TextField(
                      controller: _notesController,
                      maxLines: 4,
                      decoration: const InputDecoration(
                        labelText: 'Notas para la reserva',
                        hintText: 'Ejemplo: necesito matizar, prefiero turno temprano o tengo una sensibilidad especifica.',
                      ),
                    ),
                    const SizedBox(height: 16),
                    FilledButton.icon(
                      onPressed: _submitting ? null : () => _submitReservation(catalog.services),
                      icon: _submitting
                          ? const SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                            )
                          : const Icon(Icons.check_circle_rounded),
                      label: Text(_submitting ? 'Confirmando...' : 'Reservar cita'),
                    ),
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildAvailabilityContent(BuildContext context, List<ServiceItem> selectedServices) {
    if (_availabilityError != null) {
      return _EmptyInfoCard(title: 'No se pudieron cargar horarios', message: _availabilityError!);
    }

    if (_availability == null) {
      return const _EmptyInfoCard(
        title: 'Busca disponibilidad',
        message: 'Selecciona servicios y fecha para consultar horarios disponibles.',
      );
    }

    if (_availability!.data.isEmpty) {
      return _EmptyInfoCard(
        title: 'Sin horarios por ahora',
        message: 'Motivo: ${formatStatusLabel(_availability!.meta.reason)}.',
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            _MetricChip(label: '${_availability!.meta.totalDurationMin} min totales'),
            _MetricChip(label: _availability!.meta.mode == 'multi_staff' ? 'Cobertura multi staff' : 'Cobertura individual'),
          ],
        ),
        const SizedBox(height: 16),
        ..._availability!.data.map(
          (entry) => Padding(
            padding: const EdgeInsets.only(bottom: 14),
            child: Container(
              padding: const EdgeInsets.all(16),
              decoration: sectionDecoration(color: MoraColors.cream),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(child: Text(entry.label, style: Theme.of(context).textTheme.titleMedium)),
                      _MetricChip(label: entry.mode == 'multi_staff' ? 'Equipo' : 'Staff unico'),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Wrap(
                    spacing: 10,
                    runSpacing: 10,
                    children: entry.slots.map((slot) {
                      final option = _SelectableSlot(entry: entry, slot: slot);
                      final selected = _selectedSlot?.key == option.key;
                      return ChoiceChip(
                        selected: selected,
                        showCheckmark: false,
                        backgroundColor: Colors.white,
                        selectedColor: MoraColors.coral,
                        side: BorderSide(color: selected ? MoraColors.coral : MoraColors.border),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                        labelStyle: Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: selected ? Colors.white : MoraColors.ink,
                              fontWeight: FontWeight.w700,
                            ),
                        label: Text('${formatTime(slot.start)} - ${formatTime(slot.end)}'),
                        onSelected: (_) => setState(() => _selectedSlot = option),
                      );
                    }).toList(growable: false),
                  ),
                  if (_selectedSlot?.entry.label == entry.label && _selectedSlot?.slot.assignments.isNotEmpty == true) ...[
                    const SizedBox(height: 12),
                    Text('Asignacion automatica', style: Theme.of(context).textTheme.titleMedium),
                    const SizedBox(height: 8),
                    ..._selectedSlot!.slot.assignments.map(
                      (assignment) {
                        final service = selectedServices.cast<ServiceItem?>().firstWhere(
                              (item) => item?.id == assignment.serviceId,
                              orElse: () => null,
                            );
                        return Padding(
                          padding: const EdgeInsets.only(bottom: 6),
                          child: Text(
                            '${service?.name ?? 'Servicio'} · ${formatTime(assignment.start)}',
                            style: Theme.of(context).textTheme.bodySmall,
                          ),
                        );
                      },
                    ),
                  ],
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class ShopTab extends StatefulWidget {
  const ShopTab({super.key, required this.repository});

  final MoraRepository repository;

  @override
  State<ShopTab> createState() => _ShopTabState();
}

class _ShopTabState extends State<ShopTab> {
  late Future<List<ProductItem>> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<List<ProductItem>> _load() async {
    final products = await widget.repository.fetchPublicProducts();
    if (mounted) {
      context.read<AppState>().reconcileCart(products);
    }
    return products;
  }

  Future<void> _refresh() async {
    final future = _load();
    setState(() => _future = future);
    await future;
  }

  Future<void> _openCheckout() async {
    final appState = context.read<AppState>();
    if (appState.cart.isEmpty) {
      _showMessage(context, 'Tu carrito esta vacio.');
      return;
    }

    final sale = await showModalBottomSheet<SaleRecord>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _CheckoutSheet(repository: widget.repository),
    );

    if (!mounted || sale == null) {
      return;
    }

    _showMessage(context, 'Pedido #${sale.id} registrado. Estado: ${formatStatusLabel(sale.paymentStatus)}.');
  }

  @override
  Widget build(BuildContext context) {
    final appState = context.watch<AppState>();

    return FutureBuilder<List<ProductItem>>(
      future: _future,
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting && !snapshot.hasData) {
          return const Center(child: CircularProgressIndicator());
        }

        if (snapshot.hasError && !snapshot.hasData) {
          return _AsyncErrorView(
            title: 'No se pudo cargar la boutique',
            message: _errorMessage(snapshot.error),
            onRetry: _refresh,
          );
        }

        final products = snapshot.data;
        if (products == null) {
          return _AsyncErrorView(
            title: 'Catalogo vacio',
            message: 'No hay productos sincronizados en este momento.',
            onRetry: _refresh,
          );
        }

        return RefreshIndicator(
          onRefresh: _refresh,
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 28),
            children: [
              _HeroPanel(
                eyebrow: 'Boutique Mora',
                title: 'Carrito persistente y pedido directo al backend.',
                subtitle:
                    'El stock se sincroniza desde la API y el checkout registra ventas reales con estado de pago pendiente o confirmado.',
                actions: [
                  FilledButton.icon(
                    onPressed: _openCheckout,
                    icon: const Icon(Icons.shopping_cart_checkout_rounded),
                    label: const Text('Finalizar pedido'),
                  ),
                ],
                footer: Wrap(
                  spacing: 12,
                  runSpacing: 12,
                  children: [
                    _MetricChip(label: '${appState.cartCount} item(s) en carrito'),
                    _MetricChip(label: formatCurrency(appState.cartTotal)),
                    _MetricChip(label: '${products.length} productos listados'),
                  ],
                ),
              ),
              const SizedBox(height: 20),
              if (products.isEmpty)
                const _EmptyInfoCard(
                  title: 'Sin productos',
                  message: 'Cuando la tienda tenga inventario activo, aparecera aqui.',
                )
              else
                ...products.map(
                  (product) => Padding(
                    padding: const EdgeInsets.only(bottom: 14),
                    child: Container(
                      padding: const EdgeInsets.all(16),
                      decoration: sectionDecoration(color: Colors.white),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          SizedBox(
                            width: 108,
                            child: _ImagePreview(imageUrl: product.coverUrl, height: 108),
                          ),
                          const SizedBox(width: 14),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Wrap(
                                  spacing: 8,
                                  runSpacing: 8,
                                  children: [
                                    Text(product.name, style: Theme.of(context).textTheme.titleMedium),
                                    if (product.featured) const _MetricChip(label: 'Destacado'),
                                  ],
                                ),
                                const SizedBox(height: 6),
                                Text(
                                  product.description.isEmpty ? 'Producto sincronizado desde el panel de administracion.' : product.description,
                                  style: Theme.of(context).textTheme.bodyMedium,
                                ),
                                const SizedBox(height: 12),
                                Wrap(
                                  spacing: 8,
                                  runSpacing: 8,
                                  children: [
                                    _MetricChip(label: product.category.isEmpty ? 'Sin categoria' : product.category),
                                    _MetricChip(label: 'Stock ${product.stock}'),
                                  ],
                                ),
                                const SizedBox(height: 14),
                                Row(
                                  children: [
                                    Expanded(
                                      child: Text(formatCurrency(product.price), style: Theme.of(context).textTheme.titleMedium),
                                    ),
                                    FilledButton(
                                      onPressed: product.stock > 0
                                          ? () {
                                              context.read<AppState>().addToCart(product);
                                              _showMessage(context, '${product.name} agregado al carrito.');
                                            }
                                          : null,
                                      child: Text(product.stock > 0 ? 'Agregar' : 'Sin stock'),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
            ],
          ),
        );
      },
    );
  }
}

class AccountTab extends StatefulWidget {
  const AccountTab({
    super.key,
    required this.repository,
    required this.onNavigate,
    required this.isActive,
  });

  final MoraRepository repository;
  final ValueChanged<int> onNavigate;
  final bool isActive;

  @override
  State<AccountTab> createState() => _AccountTabState();
}

class _AccountTabState extends State<AccountTab> with WidgetsBindingObserver {
  Future<ClientBundle>? _bundleFuture;
  String? _observedClientToken;
  int? _profileSeedId;

  bool _registerMode = false;
  bool _authSubmitting = false;
  bool _savingProfile = false;
  bool _postingReview = false;

  final _loginIdentifierController = TextEditingController();
  final _loginPasswordController = TextEditingController();

  final _registerNameController = TextEditingController();
  final _registerPhoneController = TextEditingController();
  final _registerEmailController = TextEditingController();
  final _registerPasswordController = TextEditingController();
  final _registerWhatsappController = TextEditingController();
  final _registerBirthDateController = TextEditingController();
  final _registerDocTypeController = TextEditingController();
  final _registerDocNumberController = TextEditingController();

  final _profileNameController = TextEditingController();
  final _profilePhoneController = TextEditingController();
  final _profileEmailController = TextEditingController();
  final _profileWhatsappController = TextEditingController();
  final _profileBirthDateController = TextEditingController();
  final _profileDocTypeController = TextEditingController();
  final _profileDocNumberController = TextEditingController();

  final _reviewCommentController = TextEditingController();
  int? _selectedReviewReservationId;
  int _selectedRating = 5;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final token = context.read<AppState>().clientToken;
    if (token != _observedClientToken) {
      _observedClientToken = token;
      _bundleFuture = token == null ? null : widget.repository.fetchClientBundle();
    }
  }

  @override
  void didUpdateWidget(covariant AccountTab oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (!oldWidget.isActive && widget.isActive && context.read<AppState>().isClientAuthenticated) {
      _refreshBundle();
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed && widget.isActive && context.read<AppState>().isClientAuthenticated) {
      _refreshBundle();
    }
  }

  Future<void> _refreshBundle() async {
    if (!mounted || !context.read<AppState>().isClientAuthenticated) {
      return;
    }

    final future = widget.repository.fetchClientBundle();
    setState(() => _bundleFuture = future);

    try {
      await future;
    } catch (_) {
      // The FutureBuilder handles the error state for the active screen.
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _loginIdentifierController.dispose();
    _loginPasswordController.dispose();
    _registerNameController.dispose();
    _registerPhoneController.dispose();
    _registerEmailController.dispose();
    _registerPasswordController.dispose();
    _registerWhatsappController.dispose();
    _registerBirthDateController.dispose();
    _registerDocTypeController.dispose();
    _registerDocNumberController.dispose();
    _profileNameController.dispose();
    _profilePhoneController.dispose();
    _profileEmailController.dispose();
    _profileWhatsappController.dispose();
    _profileBirthDateController.dispose();
    _profileDocTypeController.dispose();
    _profileDocNumberController.dispose();
    _reviewCommentController.dispose();
    super.dispose();
  }

  Future<void> _login() async {
    final identifier = _loginIdentifierController.text.trim();
    final password = _loginPasswordController.text.trim();
    if (identifier.isEmpty || password.isEmpty) {
      _showMessage(context, 'Completa tu telefono o email y la contrasena.');
      return;
    }

    setState(() => _authSubmitting = true);
    try {
      await widget.repository.loginClient(
        phone: identifier.contains('@') ? null : identifier,
        email: identifier.contains('@') ? identifier : null,
        password: password,
      );
      if (!mounted) {
        return;
      }
      setState(() => _bundleFuture = widget.repository.fetchClientBundle());
      _showMessage(context, 'Sesion iniciada correctamente.');
    } catch (error) {
      if (mounted) {
        _showMessage(context, _errorMessage(error));
      }
    } finally {
      if (mounted) {
        setState(() => _authSubmitting = false);
      }
    }
  }

  Future<void> _register() async {
    final name = _registerNameController.text.trim();
    final phone = _registerPhoneController.text.trim();
    final password = _registerPasswordController.text.trim();
    if (name.isEmpty || phone.isEmpty || password.length < 6) {
      _showMessage(context, 'Nombre, telefono y contrasena valida son obligatorios.');
      return;
    }

    setState(() => _authSubmitting = true);
    try {
      await widget.repository.registerClient(
        name: name,
        phone: phone,
        password: password,
        email: _registerEmailController.text.trim(),
        whatsapp: _registerWhatsappController.text.trim(),
        birthDate: _registerBirthDateController.text.trim(),
        docType: _registerDocTypeController.text.trim(),
        docNumber: _registerDocNumberController.text.trim(),
      );

      await widget.repository.loginClient(
        phone: phone,
        email: _registerEmailController.text.trim().isEmpty ? null : _registerEmailController.text.trim(),
        password: password,
      );

      if (!mounted) {
        return;
      }
      setState(() => _bundleFuture = widget.repository.fetchClientBundle());
      _showMessage(context, 'Cuenta creada y sesion iniciada.');
    } catch (error) {
      if (mounted) {
        _showMessage(context, _errorMessage(error));
      }
    } finally {
      if (mounted) {
        setState(() => _authSubmitting = false);
      }
    }
  }

  Future<void> _saveProfile() async {
    setState(() => _savingProfile = true);
    try {
      await widget.repository.updateClientProfile(
        name: _profileNameController.text.trim(),
        phone: _profilePhoneController.text.trim(),
        email: _profileEmailController.text.trim(),
        whatsapp: _profileWhatsappController.text.trim(),
        birthDate: _profileBirthDateController.text.trim(),
        docType: _profileDocTypeController.text.trim(),
        docNumber: _profileDocNumberController.text.trim(),
      );

      if (!mounted) {
        return;
      }

      setState(() => _bundleFuture = widget.repository.fetchClientBundle());
      _showMessage(context, 'Perfil actualizado.');
    } catch (error) {
      if (mounted) {
        _showMessage(context, _errorMessage(error));
      }
    } finally {
      if (mounted) {
        setState(() => _savingProfile = false);
      }
    }
  }

  Future<void> _publishReview() async {
    if (_selectedReviewReservationId == null) {
      _showMessage(context, 'Selecciona una reserva atendida.');
      return;
    }

    setState(() => _postingReview = true);
    try {
      await widget.repository.createReview(
        reservationId: _selectedReviewReservationId!,
        rating: _selectedRating,
        comment: _reviewCommentController.text.trim(),
      );

      if (!mounted) {
        return;
      }

      _reviewCommentController.clear();
      setState(() {
        _selectedReviewReservationId = null;
        _selectedRating = 5;
        _bundleFuture = widget.repository.fetchClientBundle();
      });
      _showMessage(context, 'Resena enviada.');
    } catch (error) {
      if (mounted) {
        _showMessage(context, _errorMessage(error));
      }
    } finally {
      if (mounted) {
        setState(() => _postingReview = false);
      }
    }
  }

  Future<void> _pickBirthDate(TextEditingController controller) async {
    final picked = await showDatePicker(
      context: context,
      initialDate: DateTime.now().subtract(const Duration(days: 365 * 20)),
      firstDate: DateTime(1950),
      lastDate: DateTime.now(),
    );

    if (picked != null) {
      controller.text = formatInputDate(picked);
    }
  }

  void _seedProfile(ClientRecord profile) {
    if (_profileSeedId == profile.id) {
      return;
    }

    _profileSeedId = profile.id;
    _profileNameController.text = profile.name;
    _profilePhoneController.text = profile.phone;
    _profileEmailController.text = profile.email;
    _profileWhatsappController.text = profile.whatsapp;
    _profileBirthDateController.text = profile.birthDate == null ? '' : formatInputDate(profile.birthDate!);
    _profileDocTypeController.text = profile.docType;
    _profileDocNumberController.text = profile.docNumber;
  }

  @override
  Widget build(BuildContext context) {
    final appState = context.watch<AppState>();
    if (!appState.isClientAuthenticated) {
      return ListView(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 28),
        children: [
          _HeroPanel(
            eyebrow: 'Cuenta Mora',
            title: 'Ingresa para ver tu perfil, tus citas y tu historial.',
            subtitle:
                'La autenticacion de cliente usa los mismos endpoints que el sitio web y guarda el token de forma persistente en el dispositivo.',
            actions: [
              FilledButton.icon(
                onPressed: () => setState(() => _registerMode = false),
                icon: const Icon(Icons.login_rounded),
                label: const Text('Entrar'),
              ),
              OutlinedButton.icon(
                onPressed: () => setState(() => _registerMode = true),
                icon: const Icon(Icons.person_add_alt_1_rounded),
                label: const Text('Crear cuenta'),
              ),
            ],
          ),
          const SizedBox(height: 20),
          _SectionCard(
            eyebrow: _registerMode ? 'Registro' : 'Login',
            title: _registerMode ? 'Crea tu cuenta en segundos' : 'Accede a tu cuenta',
            subtitle: _registerMode
                ? 'Tus datos quedaran listos para reservar, comprar y revisar tu historial.'
                : 'Usa tu telefono o tu email junto a tu contrasena.',
            child: _registerMode ? _buildRegisterForm() : _buildLoginForm(),
          ),
        ],
      );
    }

    return FutureBuilder<ClientBundle>(
      future: _bundleFuture,
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting && !snapshot.hasData) {
          return const Center(child: CircularProgressIndicator());
        }

        if (snapshot.hasError && !snapshot.hasData) {
          return _AsyncErrorView(
            title: 'No se pudo cargar tu cuenta',
            message: _errorMessage(snapshot.error),
            onRetry: _refreshBundle,
          );
        }

        final bundle = snapshot.data;
        if (bundle == null) {
          return _AsyncErrorView(
            title: 'Cuenta vacia',
            message: 'No fue posible cargar tus datos.',
            onRetry: _refreshBundle,
          );
        }

        _seedProfile(bundle.profile);

        final nextReservation = bundle.reservations
            .where((item) => item.start != null && item.start!.isAfter(DateTime.now()) && !item.status.contains('CANCEL'))
            .toList(growable: false)
          ..sort((left, right) => left.start!.compareTo(right.start!));

        final reviewedReservations = bundle.reviews.map((item) => item.reservationId).toSet();
        final reviewableReservations = bundle.reservations
            .where((item) => item.status == 'ATENDIDA' && !reviewedReservations.contains(item.id))
            .toList(growable: false);

        _selectedReviewReservationId ??= reviewableReservations.isNotEmpty ? reviewableReservations.first.id : null;

        return RefreshIndicator(
          onRefresh: _refreshBundle,
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 28),
            children: [
              _HeroPanel(
                eyebrow: 'Mi cuenta',
                title: 'Hola, ${bundle.profile.name}.',
                subtitle: nextReservation.isEmpty
                    ? 'No tienes una visita futura registrada. Desde aqui puedes reservar, actualizar tu perfil y revisar tu historial.'
                    : 'Tu proxima visita es ${formatDateTime(nextReservation.first.start)}.',
                actions: [
                  FilledButton.icon(
                    onPressed: () => widget.onNavigate(1),
                    icon: const Icon(Icons.event_available_rounded),
                    label: const Text('Nueva reserva'),
                  ),
                  OutlinedButton.icon(
                    onPressed: () {
                      Navigator.of(context).push(
                        MaterialPageRoute(
                          builder: (_) => AdminConsoleScreen(repository: widget.repository),
                        ),
                      );
                    },
                    icon: const Icon(Icons.admin_panel_settings_rounded),
                    label: const Text('Admin movil'),
                  ),
                ],
                footer: Wrap(
                  spacing: 12,
                  runSpacing: 12,
                  children: [
                    _MetricChip(label: '${bundle.reservations.length} reservas'),
                    _MetricChip(label: '${bundle.albums.length} albumes'),
                    _MetricChip(label: '${bundle.reviews.length} resenas'),
                  ],
                ),
              ),
              const SizedBox(height: 20),
              _SectionCard(
              eyebrow: 'Perfil',
              title: 'Tus datos de contacto',
              subtitle: 'Estos datos se sincronizan contra el endpoint protegido del cliente.',
              child: Column(
                children: [
                  TextField(controller: _profileNameController, decoration: const InputDecoration(labelText: 'Nombre completo')),
                  const SizedBox(height: 12),
                  TextField(controller: _profilePhoneController, keyboardType: TextInputType.phone, decoration: const InputDecoration(labelText: 'Telefono')),
                  const SizedBox(height: 12),
                  TextField(controller: _profileEmailController, keyboardType: TextInputType.emailAddress, decoration: const InputDecoration(labelText: 'Email')),
                  const SizedBox(height: 12),
                  TextField(controller: _profileWhatsappController, keyboardType: TextInputType.phone, decoration: const InputDecoration(labelText: 'WhatsApp')),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _profileBirthDateController,
                    readOnly: true,
                    decoration: InputDecoration(
                      labelText: 'Fecha de nacimiento',
                      suffixIcon: IconButton(
                        onPressed: () => _pickBirthDate(_profileBirthDateController),
                        icon: const Icon(Icons.calendar_month_rounded),
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextField(controller: _profileDocTypeController, decoration: const InputDecoration(labelText: 'Tipo de documento')),
                  const SizedBox(height: 12),
                  TextField(controller: _profileDocNumberController, decoration: const InputDecoration(labelText: 'Numero de documento')),
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      Expanded(
                        child: FilledButton.icon(
                          onPressed: _savingProfile ? null : _saveProfile,
                          icon: _savingProfile
                              ? const SizedBox(
                                  width: 18,
                                  height: 18,
                                  child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                                )
                              : const Icon(Icons.save_rounded),
                          label: Text(_savingProfile ? 'Guardando...' : 'Guardar cambios'),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),
              _SectionCard(
              eyebrow: 'Reservas',
              title: 'Historial y proximas visitas',
              subtitle: 'Tu cronologia se alimenta del endpoint de reservas del cliente.',
              child: bundle.reservations.isEmpty
                  ? const _EmptyInfoCard(
                      title: 'Sin reservas registradas',
                      message: 'Cuando confirmes una cita, aparecera aqui junto con su estado.',
                    )
                  : Column(
                      children: bundle.reservations
                          .map(
                            (reservation) => Padding(
                              padding: const EdgeInsets.only(bottom: 12),
                              child: Container(
                                padding: const EdgeInsets.all(16),
                                decoration: sectionDecoration(color: MoraColors.cream),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Row(
                                      children: [
                                        Expanded(child: Text(reservation.code, style: Theme.of(context).textTheme.titleMedium)),
                                        _StatusChip(label: formatStatusLabel(reservation.status), status: reservation.status),
                                      ],
                                    ),
                                    const SizedBox(height: 8),
                                    Text(formatDateTime(reservation.start), style: Theme.of(context).textTheme.bodyLarge),
                                    const SizedBox(height: 8),
                                    Text(
                                      reservation.details.isEmpty
                                          ? 'Sin detalle asociado'
                                          : reservation.details.map((item) => item.serviceName.isEmpty ? 'Servicio ${item.serviceId}' : item.serviceName).join(' · '),
                                      style: Theme.of(context).textTheme.bodySmall,
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          )
                          .toList(growable: false),
                    ),
            ),
            const SizedBox(height: 20),
              _SectionCard(
              eyebrow: 'Albumes',
              title: 'Tus resultados y registros',
              subtitle: 'Se cargan desde el endpoint protegido del cliente.',
              child: bundle.albums.isEmpty
                  ? const _EmptyInfoCard(
                      title: 'Sin albumes aun',
                      message: 'Cuando el equipo registre material, aparecera aqui.',
                    )
                  : SizedBox(
                      height: 220,
                      child: ListView.separated(
                        scrollDirection: Axis.horizontal,
                        itemCount: bundle.albums.length,
                        separatorBuilder: (_, _) => const SizedBox(width: 12),
                        itemBuilder: (context, index) {
                          final album = bundle.albums[index];
                          final photo = album.photos.isEmpty ? '' : album.photos.first.url;
                          return Container(
                            width: 220,
                            padding: const EdgeInsets.all(14),
                            decoration: sectionDecoration(color: Colors.white),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                _ImagePreview(imageUrl: photo, height: 120),
                                const SizedBox(height: 12),
                                Text(album.title, style: Theme.of(context).textTheme.titleMedium),
                                const SizedBox(height: 6),
                                Text(album.description.isEmpty ? 'Registro visual en tu cuenta.' : album.description, style: Theme.of(context).textTheme.bodySmall),
                              ],
                            ),
                          );
                        },
                      ),
                    ),
            ),
            const SizedBox(height: 20),
              _SectionCard(
              eyebrow: 'Resenas',
              title: 'Tu feedback tambien vive en la app',
              subtitle: 'Puedes registrar resenas sobre citas atendidas.',
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (reviewableReservations.isNotEmpty) ...[
                    DropdownButtonFormField<int>(
                      initialValue: _selectedReviewReservationId,
                      decoration: const InputDecoration(labelText: 'Reserva atendida'),
                      items: reviewableReservations
                          .map(
                            (reservation) => DropdownMenuItem<int>(
                              value: reservation.id,
                              child: Text('${reservation.code} · ${formatDate(reservation.start)}'),
                            ),
                          )
                          .toList(growable: false),
                      onChanged: (value) => setState(() => _selectedReviewReservationId = value),
                    ),
                    const SizedBox(height: 12),
                    DropdownButtonFormField<int>(
                      initialValue: _selectedRating,
                      decoration: const InputDecoration(labelText: 'Calificacion'),
                      items: List.generate(
                        5,
                        (index) => DropdownMenuItem<int>(
                          value: index + 1,
                          child: Text('${index + 1} estrella(s)'),
                        ),
                      ),
                      onChanged: (value) => setState(() => _selectedRating = value ?? 5),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: _reviewCommentController,
                      maxLines: 3,
                      decoration: const InputDecoration(labelText: 'Comentario'),
                    ),
                    const SizedBox(height: 14),
                    FilledButton.icon(
                      onPressed: _postingReview ? null : _publishReview,
                      icon: _postingReview
                          ? const SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                            )
                          : const Icon(Icons.rate_review_rounded),
                      label: Text(_postingReview ? 'Enviando...' : 'Publicar resena'),
                    ),
                    const SizedBox(height: 16),
                  ],
                  if (bundle.reviews.isEmpty)
                    const _EmptyInfoCard(
                      title: 'Sin resenas todavia',
                      message: 'Tus comentarios apareceran aqui despues de enviarlos.',
                    )
                  else
                    ...bundle.reviews.map(
                      (review) => Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: Container(
                          padding: const EdgeInsets.all(16),
                          decoration: sectionDecoration(color: MoraColors.cream),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Expanded(
                                    child: Text(
                                      'Reserva #${review.reservationId}',
                                      style: Theme.of(context).textTheme.titleMedium,
                                    ),
                                  ),
                                  _StatusChip(label: formatStatusLabel(review.status), status: review.status),
                                ],
                              ),
                              const SizedBox(height: 8),
                              Text('Calificacion: ${review.rating}/5', style: Theme.of(context).textTheme.bodyLarge),
                              if (review.comment.isNotEmpty) ...[
                                const SizedBox(height: 8),
                                Text(review.comment, style: Theme.of(context).textTheme.bodyMedium),
                              ],
                            ],
                          ),
                        ),
                      ),
                    ),
                  const SizedBox(height: 8),
                  OutlinedButton.icon(
                    onPressed: () {
                      context.read<AppState>().clearClientSession();
                      setState(() => _bundleFuture = null);
                    },
                    icon: const Icon(Icons.logout_rounded),
                    label: const Text('Cerrar sesion'),
                  ),
                ],
              ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildLoginForm() {
    return Column(
      children: [
        TextField(
          controller: _loginIdentifierController,
          keyboardType: TextInputType.emailAddress,
          decoration: const InputDecoration(labelText: 'Telefono o email'),
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _loginPasswordController,
          obscureText: true,
          decoration: const InputDecoration(labelText: 'Contrasena'),
        ),
        const SizedBox(height: 16),
        FilledButton.icon(
          onPressed: _authSubmitting ? null : _login,
          icon: _authSubmitting
              ? const SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                )
              : const Icon(Icons.login_rounded),
          label: Text(_authSubmitting ? 'Ingresando...' : 'Entrar'),
        ),
      ],
    );
  }

  Widget _buildRegisterForm() {
    return Column(
      children: [
        TextField(controller: _registerNameController, decoration: const InputDecoration(labelText: 'Nombre completo')),
        const SizedBox(height: 12),
        TextField(controller: _registerPhoneController, keyboardType: TextInputType.phone, decoration: const InputDecoration(labelText: 'Telefono')),
        const SizedBox(height: 12),
        TextField(controller: _registerEmailController, keyboardType: TextInputType.emailAddress, decoration: const InputDecoration(labelText: 'Email')),
        const SizedBox(height: 12),
        TextField(controller: _registerPasswordController, obscureText: true, decoration: const InputDecoration(labelText: 'Contrasena')),
        const SizedBox(height: 12),
        TextField(controller: _registerWhatsappController, keyboardType: TextInputType.phone, decoration: const InputDecoration(labelText: 'WhatsApp')),
        const SizedBox(height: 12),
        TextField(
          controller: _registerBirthDateController,
          readOnly: true,
          decoration: InputDecoration(
            labelText: 'Fecha de nacimiento',
            suffixIcon: IconButton(
              onPressed: () => _pickBirthDate(_registerBirthDateController),
              icon: const Icon(Icons.calendar_month_rounded),
            ),
          ),
        ),
        const SizedBox(height: 12),
        TextField(controller: _registerDocTypeController, decoration: const InputDecoration(labelText: 'Tipo de documento')),
        const SizedBox(height: 12),
        TextField(controller: _registerDocNumberController, decoration: const InputDecoration(labelText: 'Numero de documento')),
        const SizedBox(height: 16),
        FilledButton.icon(
          onPressed: _authSubmitting ? null : _register,
          icon: _authSubmitting
              ? const SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                )
              : const Icon(Icons.person_add_alt_1_rounded),
          label: Text(_authSubmitting ? 'Creando cuenta...' : 'Crear cuenta'),
        ),
      ],
    );
  }
}

class _CheckoutSheet extends StatefulWidget {
  const _CheckoutSheet({required this.repository});

  final MoraRepository repository;

  @override
  State<_CheckoutSheet> createState() => _CheckoutSheetState();
}

class _CheckoutSheetState extends State<_CheckoutSheet> {
  late final TextEditingController _nameController;
  late final TextEditingController _phoneController;
  late final TextEditingController _emailController;
  final TextEditingController _referenceController = TextEditingController();
  final TextEditingController _notesController = TextEditingController();
  String _method = 'EFECTIVO';
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    final session = context.read<AppState>().clientSession;
    _nameController = TextEditingController(text: session?.name ?? '');
    _phoneController = TextEditingController(text: session?.phone ?? '');
    _emailController = TextEditingController(text: session?.email ?? '');
  }

  @override
  void dispose() {
    _nameController.dispose();
    _phoneController.dispose();
    _emailController.dispose();
    _referenceController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final appState = context.read<AppState>();
    if (appState.cart.isEmpty) {
      _showMessage(context, 'Tu carrito esta vacio.');
      return;
    }

    if (_nameController.text.trim().isEmpty || _phoneController.text.trim().isEmpty) {
      _showMessage(context, 'Nombre y telefono son obligatorios.');
      return;
    }

    setState(() => _submitting = true);
    try {
      final sale = await widget.repository.createPublicOrder(
        customerName: _nameController.text.trim(),
        customerPhone: _phoneController.text.trim(),
        customerEmail: _emailController.text.trim(),
        method: _method,
        paymentReference: _referenceController.text.trim(),
        notes: _notesController.text.trim(),
        items: appState.cart,
      );

      appState.clearCart();
      if (!mounted) {
        return;
      }

      Navigator.of(context).pop(sale);
    } catch (error) {
      if (mounted) {
        _showMessage(context, _errorMessage(error));
      }
    } finally {
      if (mounted) {
        setState(() => _submitting = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final appState = context.watch<AppState>();

    return SafeArea(
      child: Container(
        decoration: const BoxDecoration(
          color: MoraColors.blush,
          borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
        ),
        padding: EdgeInsets.fromLTRB(20, 18, 20, MediaQuery.of(context).viewInsets.bottom + 20),
        child: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 52,
                  height: 5,
                  decoration: BoxDecoration(
                    color: MoraColors.border,
                    borderRadius: BorderRadius.circular(999),
                  ),
                ),
              ),
              const SizedBox(height: 18),
              Text('Finalizar pedido', style: Theme.of(context).textTheme.headlineMedium),
              const SizedBox(height: 8),
              Text('Este checkout registra una venta real en el backend y descuenta stock.', style: Theme.of(context).textTheme.bodyMedium),
              const SizedBox(height: 18),
              if (appState.cart.isEmpty)
                const _EmptyInfoCard(title: 'Carrito vacio', message: 'Agrega productos antes de continuar.')
              else ...[
                ...appState.cart.map(
                  (item) => Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: Container(
                      padding: const EdgeInsets.all(14),
                      decoration: sectionDecoration(color: Colors.white),
                      child: Row(
                        children: [
                          SizedBox(width: 78, child: _ImagePreview(imageUrl: item.coverUrl, height: 78)),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(item.name, style: Theme.of(context).textTheme.titleMedium),
                                const SizedBox(height: 6),
                                Text(formatCurrency(item.price), style: Theme.of(context).textTheme.bodySmall),
                                const SizedBox(height: 8),
                                Row(
                                  children: [
                                    IconButton(
                                      onPressed: () => context.read<AppState>().updateCartQuantity(item.productId, item.quantity - 1),
                                      icon: const Icon(Icons.remove_circle_outline_rounded),
                                    ),
                                    Text('${item.quantity}', style: Theme.of(context).textTheme.titleMedium),
                                    IconButton(
                                      onPressed: item.quantity >= item.stock
                                          ? null
                                          : () => context.read<AppState>().updateCartQuantity(item.productId, item.quantity + 1),
                                      icon: const Icon(Icons.add_circle_outline_rounded),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                          ),
                          Text(formatCurrency(item.subtotal), style: Theme.of(context).textTheme.titleMedium),
                        ],
                      ),
                    ),
                  ),
                ),
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: sectionDecoration(color: MoraColors.cream),
                  child: Row(
                    children: [
                      Expanded(child: Text('Total', style: Theme.of(context).textTheme.titleMedium)),
                      Text(formatCurrency(appState.cartTotal), style: Theme.of(context).textTheme.titleLarge),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                TextField(controller: _nameController, decoration: const InputDecoration(labelText: 'Nombre')),
                const SizedBox(height: 12),
                TextField(controller: _phoneController, keyboardType: TextInputType.phone, decoration: const InputDecoration(labelText: 'Telefono')),
                const SizedBox(height: 12),
                TextField(controller: _emailController, keyboardType: TextInputType.emailAddress, decoration: const InputDecoration(labelText: 'Email')),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  initialValue: _method,
                  decoration: const InputDecoration(labelText: 'Metodo de pago'),
                  items: const [
                    DropdownMenuItem<String>(value: 'EFECTIVO', child: Text('Efectivo')),
                    DropdownMenuItem<String>(value: 'YAPE', child: Text('Yape')),
                    DropdownMenuItem<String>(value: 'PASARELA', child: Text('Pasarela')),
                  ],
                  onChanged: (value) => setState(() => _method = value ?? 'EFECTIVO'),
                ),
                const SizedBox(height: 12),
                TextField(controller: _referenceController, decoration: const InputDecoration(labelText: 'Referencia de pago')),
                const SizedBox(height: 12),
                TextField(controller: _notesController, maxLines: 3, decoration: const InputDecoration(labelText: 'Notas del pedido')),
                if (_method == 'PASARELA') ...[
                  const SizedBox(height: 12),
                  const _EmptyInfoCard(
                    title: 'Orden registrada como pendiente',
                    message: 'La API marca este pedido para seguimiento de pasarela desde el panel.',
                  ),
                ],
                const SizedBox(height: 16),
                FilledButton.icon(
                  onPressed: _submitting ? null : _submit,
                  icon: _submitting
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                        )
                      : const Icon(Icons.payments_rounded),
                  label: Text(_submitting ? 'Procesando...' : 'Registrar pedido'),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _HeroPanel extends StatelessWidget {
  const _HeroPanel({
    required this.eyebrow,
    required this.title,
    required this.subtitle,
    this.actions = const [],
    this.footer,
  });

  final String eyebrow;
  final String title;
  final String subtitle;
  final List<Widget> actions;
  final Widget? footer;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        gradient: moraHeroGradient,
        borderRadius: BorderRadius.circular(30),
        border: Border.all(color: MoraColors.border),
        boxShadow: const [
          BoxShadow(color: Color(0x14C65A7D), blurRadius: 28, offset: Offset(0, 14)),
        ],
      ),
      child: Stack(
        children: [
          Positioned(
            top: -28,
            right: -12,
            child: Container(
              width: 110,
              height: 110,
              decoration: BoxDecoration(
                color: MoraColors.plum.withValues(alpha: 0.36),
                shape: BoxShape.circle,
              ),
            ),
          ),
          Positioned(
            bottom: -32,
            left: -10,
            child: Container(
              width: 96,
              height: 96,
              decoration: BoxDecoration(
                color: MoraColors.rose.withValues(alpha: 0.55),
                shape: BoxShape.circle,
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(22),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.82),
                    borderRadius: BorderRadius.circular(999),
                    border: Border.all(color: MoraColors.border),
                  ),
                  child: Text(
                    eyebrow.toUpperCase(),
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: MoraColors.cocoa,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 0.9,
                        ),
                  ),
                ),
                const SizedBox(height: 14),
                Text(title, style: Theme.of(context).textTheme.displaySmall),
                const SizedBox(height: 10),
                Text(
                  subtitle,
                  style: Theme.of(context).textTheme.bodyLarge?.copyWith(color: MoraColors.muted),
                ),
                if (actions.isNotEmpty) ...[
                  const SizedBox(height: 18),
                  Wrap(spacing: 12, runSpacing: 12, children: actions),
                ],
                if (footer != null) ...[
                  const SizedBox(height: 18),
                  footer!,
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _SectionCard extends StatelessWidget {
  const _SectionCard({
    required this.eyebrow,
    required this.title,
    required this.subtitle,
    required this.child,
    this.action,
  });

  final String eyebrow;
  final String title;
  final String subtitle;
  final Widget child;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: sectionDecoration(color: Colors.white),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      eyebrow.toUpperCase(),
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            fontWeight: FontWeight.w800,
                            letterSpacing: 1,
                            color: MoraColors.cocoa,
                          ),
                    ),
                    const SizedBox(height: 6),
                    Text(title, style: Theme.of(context).textTheme.titleLarge),
                    const SizedBox(height: 6),
                    Text(subtitle, style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: MoraColors.muted)),
                  ],
                ),
              ),
              // ignore: use_null_aware_elements
              if (action != null) action!,
            ],
          ),
          const SizedBox(height: 18),
          child,
        ],
      ),
    );
  }
}

class _MetricChip extends StatelessWidget {
  const _MetricChip({required this.label, this.icon});

  final String label;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: MoraColors.sand.withValues(alpha: 0.72),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: MoraColors.border),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 15, color: MoraColors.cocoa),
            const SizedBox(width: 6),
          ],
          Text(
            label,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: MoraColors.ink,
                  fontWeight: FontWeight.w700,
                ),
          ),
        ],
      ),
    );
  }
}

class _QuickActionTile extends StatelessWidget {
  const _QuickActionTile({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(22),
        child: Ink(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(22),
            border: Border.all(color: MoraColors.border),
          ),
          child: Row(
            children: [
              Container(
                width: 46,
                height: 46,
                decoration: BoxDecoration(
                  color: MoraColors.sand,
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Icon(icon, color: MoraColors.cocoa),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title, style: Theme.of(context).textTheme.titleMedium),
                    const SizedBox(height: 4),
                    Text(subtitle, style: Theme.of(context).textTheme.bodySmall),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              const Icon(Icons.arrow_forward_rounded, color: MoraColors.cocoa, size: 18),
            ],
          ),
        ),
      ),
    );
  }
}

class _BookingServiceTile extends StatelessWidget {
  const _BookingServiceTile({
    required this.service,
    required this.selected,
    required this.onTap,
  });

  final ServiceItem service;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final titleColor = selected ? Colors.white : MoraColors.ink;
    final subtitleColor = selected ? Colors.white.withValues(alpha: 0.84) : MoraColors.muted;

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(22),
        child: Ink(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: selected ? MoraColors.coral : Colors.white,
            borderRadius: BorderRadius.circular(22),
            border: Border.all(color: selected ? MoraColors.coral : MoraColors.border),
            boxShadow: selected
                ? const [
                    BoxShadow(
                      color: Color(0x1FC65A7D),
                      blurRadius: 22,
                      offset: Offset(0, 10),
                    ),
                  ]
                : null,
          ),
          child: Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: selected ? Colors.white.withValues(alpha: 0.18) : MoraColors.sand,
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Icon(
                  selected ? Icons.check_rounded : Icons.spa_outlined,
                  color: selected ? Colors.white : MoraColors.cocoa,
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      service.name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(color: titleColor),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      service.description.isEmpty ? 'Servicio disponible para reserva inmediata.' : service.description,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(color: subtitleColor),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 12),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    formatCurrency(service.priceBase),
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(color: titleColor),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '${service.durationMin} min',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(color: subtitleColor),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _CompactServiceCard extends StatelessWidget {
  const _CompactServiceCard({required this.service});

  final ServiceItem service;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 176,
      padding: const EdgeInsets.all(14),
      decoration: sectionDecoration(color: Colors.white),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: MoraColors.sand,
              borderRadius: BorderRadius.circular(14),
            ),
            child: const Icon(Icons.spa_outlined, color: MoraColors.cocoa),
          ),
          const SizedBox(height: 12),
          Text(
            service.name,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.titleMedium,
          ),
          const SizedBox(height: 6),
          Text(
            service.description.isEmpty ? 'Disponibilidad real.' : service.description,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.bodySmall,
          ),
          const Spacer(),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
            decoration: BoxDecoration(
              color: MoraColors.sand.withValues(alpha: 0.72),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: MoraColors.border),
            ),
            child: Text(
              '${service.durationMin} min · ${formatCurrency(service.priceBase)}',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: MoraColors.cocoa,
                    fontWeight: FontWeight.w700,
                  ),
            ),
          ),
        ],
      ),
    );
  }
}

class _CompactPromotionBanner extends StatelessWidget {
  const _CompactPromotionBanner({required this.promotion});

  final PromotionItem promotion;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFFFFFCFD), MoraColors.rose, MoraColors.gold],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: MoraColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  'Promo activa',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: MoraColors.cocoa,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 0.9,
                      ),
                ),
              ),
              _StatusChip(
                label: promotion.active ? 'Activa' : 'Programada',
                status: promotion.active ? 'CONFIRMADA' : 'PENDIENTE',
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(promotion.name, style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 6),
          Text(
            promotion.type == 'PORCENTAJE'
                ? '${promotion.value.toStringAsFixed(0)}% de beneficio'
                : promotion.type == 'MONTO'
                    ? '${formatCurrency(promotion.value)} de descuento'
                    : 'Beneficio especial configurado',
            style: Theme.of(context).textTheme.bodyLarge?.copyWith(fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 6),
          Text('Vigente hasta ${formatDate(promotion.endDate)}', style: Theme.of(context).textTheme.bodySmall),
        ],
      ),
    );
  }
}

class _CompactStaffChip extends StatelessWidget {
  const _CompactStaffChip({required this.member});

  final StaffMember member;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 160,
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: sectionDecoration(color: Colors.white),
        child: Row(
          children: [
            CircleAvatar(
              radius: 22,
              backgroundColor: MoraColors.sand,
              child: Text(
                _initialsFor(member.name),
                style: const TextStyle(fontWeight: FontWeight.w800, color: MoraColors.cocoa),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    member.name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  const SizedBox(height: 2),
                  Text(
                    member.role.isEmpty ? 'Especialista Mora' : member.role,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _CompactProductCard extends StatelessWidget {
  const _CompactProductCard({required this.product});

  final ProductItem product;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 184,
      padding: const EdgeInsets.all(14),
      decoration: sectionDecoration(color: Colors.white),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _ImagePreview(imageUrl: product.coverUrl, height: 82),
          const SizedBox(height: 10),
          Text(
            product.name,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.titleMedium,
          ),
          const SizedBox(height: 4),
          Text(
            product.category.isEmpty ? 'Categoria Mora' : product.category,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.bodySmall,
          ),
          const Spacer(),
          Row(
            children: [
              Expanded(
                child: Text(
                  formatCurrency(product.price),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.titleMedium,
                ),
              ),
              const SizedBox(width: 8),
              FilledButton(
                onPressed: product.stock > 0
                    ? () {
                        context.read<AppState>().addToCart(product);
                        _showMessage(context, '${product.name} agregado al carrito.');
                      }
                    : null,
                style: FilledButton.styleFrom(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                  minimumSize: Size.zero,
                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                ),
                child: Text(product.stock > 0 ? 'Agregar' : 'Stock'),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _StatusChip extends StatelessWidget {
  const _StatusChip({required this.label, required this.status});

  final String label;
  final String status;

  @override
  Widget build(BuildContext context) {
    final tone = _statusTone(status);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: tone.$1,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        style: Theme.of(context).textTheme.bodySmall?.copyWith(color: tone.$2, fontWeight: FontWeight.w800),
      ),
    );
  }
}

class _ImagePreview extends StatelessWidget {
  const _ImagePreview({required this.imageUrl, required this.height});

  final String imageUrl;
  final double height;

  @override
  Widget build(BuildContext context) {
    final resolved = _resolveImageUrl(imageUrl);
    return Container(
      height: height,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(22),
        gradient: const LinearGradient(
          colors: [Color(0xFFFFFCFD), MoraColors.rose],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
      clipBehavior: Clip.antiAlias,
      child: resolved == null
          ? const Center(child: Icon(Icons.image_not_supported_rounded, color: MoraColors.cocoa, size: 32))
          : Image.network(
              resolved,
              fit: BoxFit.cover,
              errorBuilder: (_, _, _) => const Center(
                child: Icon(Icons.broken_image_outlined, color: MoraColors.cocoa, size: 32),
              ),
            ),
    );
  }
}

class _EmptyInfoCard extends StatelessWidget {
  const _EmptyInfoCard({required this.title, required this.message});

  final String title;
  final String message;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: sectionDecoration(color: MoraColors.cream),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 8),
          Text(message, style: Theme.of(context).textTheme.bodyMedium),
        ],
      ),
    );
  }
}

class _AsyncErrorView extends StatelessWidget {
  const _AsyncErrorView({
    required this.title,
    required this.message,
    required this.onRetry,
  });

  final String title;
  final String message;
  final Future<void> Function() onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Container(
          padding: const EdgeInsets.all(22),
          decoration: sectionDecoration(color: Colors.white),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.cloud_off_rounded, size: 42, color: MoraColors.cocoa),
              const SizedBox(height: 12),
              Text(title, style: Theme.of(context).textTheme.titleLarge, textAlign: TextAlign.center),
              const SizedBox(height: 8),
              Text(message, style: Theme.of(context).textTheme.bodyMedium, textAlign: TextAlign.center),
              const SizedBox(height: 16),
              FilledButton(onPressed: onRetry, child: const Text('Reintentar')),
            ],
          ),
        ),
      ),
    );
  }
}

class _SelectableSlot {
  const _SelectableSlot({required this.entry, required this.slot});

  final AvailabilityEntry entry;
  final AvailabilitySlot slot;

  String get key => '${entry.label}:${slot.id}';
}

String _errorMessage(Object? error) {
  if (error is ApiException) {
    return error.message;
  }
  if (error is Exception) {
    return error.toString().replaceFirst('Exception: ', '');
  }
  return 'Ocurrio un error inesperado.';
}

void _showMessage(BuildContext context, String message) {
  ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
}

String? _resolveImageUrl(String rawUrl) {
  if (rawUrl.trim().isEmpty || rawUrl.startsWith('data:image/')) {
    return null;
  }

  if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) {
    return rawUrl;
  }

  if (rawUrl.startsWith('/')) {
    return '${AppConfig.mediaBaseUrl}$rawUrl';
  }

  return null;
}

String _initialsFor(String value) {
  final parts = value.trim().split(RegExp(r'\s+')).where((part) => part.isNotEmpty).toList(growable: false);
  if (parts.isEmpty) {
    return 'MM';
  }

  return parts.take(2).map((part) => part[0].toUpperCase()).join();
}

(Color, Color) _statusTone(String status) {
  final upper = status.toUpperCase();
  if (upper.contains('CONFIRM') || upper.contains('ATEND') || upper.contains('APROBAD')) {
    return (const Color(0xFFDDF5E3), MoraColors.success);
  }
  if (upper.contains('PEND') || upper.contains('PROCES') || upper.contains('NO_SHOW')) {
    return (const Color(0xFFFFF1D6), MoraColors.warning);
  }
  return (const Color(0xFFF1E6DF), MoraColors.muted);
}