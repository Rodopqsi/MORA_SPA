import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../app/theme.dart';
import '../core/config/app_config.dart';
import '../core/models.dart';
import '../core/network/api_client.dart';
import '../core/utils/formatters.dart';
import '../repositories/mora_repository.dart';
import '../state/app_state.dart';

class AdminConsoleScreen extends StatefulWidget {
  const AdminConsoleScreen({super.key, required this.repository});

  final MoraRepository repository;

  @override
  State<AdminConsoleScreen> createState() => _AdminConsoleScreenState();
}

class _AdminConsoleScreenState extends State<AdminConsoleScreen> {
  static const List<String> _reservationStatuses = [
    'PENDIENTE_ADELANTO',
    'CONFIRMADA',
    'EN_PROCESO',
    'ATENDIDA',
    'CANCELADA',
    'NO_SHOW',
    'VENCIDA',
  ];

  static const List<String> _paymentStatuses = ['PENDIENTE', 'CONFIRMADO', 'ANULADO'];

  Future<AdminSnapshot>? _future;
  String? _observedStaffToken;
  bool _loggingIn = false;

  final _usernameController = TextEditingController();
  final _passwordController = TextEditingController();

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final token = context.read<AppState>().staffToken;
    if (token != _observedStaffToken) {
      _observedStaffToken = token;
      _future = token == null ? null : widget.repository.fetchAdminSnapshot();
    }
  }

  @override
  void dispose() {
    _usernameController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _refresh() async {
    final future = widget.repository.fetchAdminSnapshot();
    setState(() => _future = future);
    await future;
  }

  Future<void> _login() async {
    final username = _usernameController.text.trim();
    final password = _passwordController.text.trim();
    if (username.isEmpty || password.isEmpty) {
      _showMessage(context, 'Completa usuario y contrasena.');
      return;
    }

    setState(() => _loggingIn = true);
    try {
      await widget.repository.loginStaff(username: username, password: password);
      if (!mounted) {
        return;
      }
      setState(() => _future = widget.repository.fetchAdminSnapshot());
      _showMessage(context, 'Sesion de staff iniciada.');
    } catch (error) {
      if (mounted) {
        _showMessage(context, _errorMessage(error));
      }
    } finally {
      if (mounted) {
        setState(() => _loggingIn = false);
      }
    }
  }

  Future<void> _withRefresh(Future<void> Function() action, String successMessage) async {
    try {
      await action();
      if (!mounted) {
        return;
      }
      _showMessage(context, successMessage);
      await _refresh();
    } catch (error) {
      if (mounted) {
        _showMessage(context, _errorMessage(error));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final appState = context.watch<AppState>();
    final staff = appState.staffSession;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Consola admin'),
        actions: [
          if (appState.isStaffAuthenticated)
            IconButton(
              tooltip: 'Cerrar sesion',
              onPressed: () {
                context.read<AppState>().clearStaffSession();
                setState(() => _future = null);
              },
              icon: const Icon(Icons.logout_rounded),
            ),
        ],
      ),
      body: SafeArea(
        child: !appState.isStaffAuthenticated
            ? _buildLoginView()
            : FutureBuilder<AdminSnapshot>(
                future: _future,
                builder: (context, snapshot) {
                  if (snapshot.connectionState == ConnectionState.waiting && !snapshot.hasData) {
                    return const Center(child: CircularProgressIndicator());
                  }

                  if (snapshot.hasError && !snapshot.hasData) {
                    return _AdminErrorView(
                      title: 'No se pudo abrir la consola',
                      message: _errorMessage(snapshot.error),
                      onRetry: _refresh,
                    );
                  }

                  final data = snapshot.data;
                  if (data == null) {
                    return _AdminErrorView(
                      title: 'Sin datos administrativos',
                      message: 'La API no devolvio informacion para la consola.',
                      onRetry: _refresh,
                    );
                  }

                  final serviceNameById = {for (final service in data.services) service.id: service.name};

                  return RefreshIndicator(
                    onRefresh: _refresh,
                    child: ListView(
                      physics: const AlwaysScrollableScrollPhysics(),
                      padding: const EdgeInsets.fromLTRB(20, 12, 20, 28),
                      children: [
                        _AdminHero(
                          title: 'Operacion movil para ${staff?.fullName ?? 'staff'}',
                          subtitle:
                              'Esta consola trabaja contra los endpoints autenticados del backend y permite ajustes rapidos sin pasar por el panel web.',
                          metrics: [
                            _AdminMetric(label: 'Reservas hoy', value: '${data.metrics.reservationCount}'),
                            _AdminMetric(label: 'Ingresos', value: formatCurrency(data.metrics.revenue)),
                            _AdminMetric(label: 'Adelantos', value: formatCurrency(data.metrics.advances)),
                            _AdminMetric(label: 'Staff activo', value: '${data.metrics.staffOnDuty}'),
                          ],
                        ),
                        const SizedBox(height: 20),
                        _AdminSection(
                          eyebrow: 'Agenda',
                          title: 'Reservas y proximas atenciones',
                          subtitle: 'Actualiza estados o cancela citas directamente desde el telefono.',
                          child: data.reservations.isEmpty
                              ? const _AdminEmptyCard(
                                  title: 'Sin reservas',
                                  message: 'No hay reservas para administrar ahora mismo.',
                                )
                              : Column(
                                  children: data.reservations.map((reservation) {
                                    return Padding(
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
                                                    '${reservation.code} · ${reservation.clientName}',
                                                    style: Theme.of(context).textTheme.titleMedium,
                                                  ),
                                                ),
                                                _MiniStatusChip(label: formatStatusLabel(reservation.status), status: reservation.status),
                                              ],
                                            ),
                                            const SizedBox(height: 8),
                                            Text(formatDateTime(reservation.start)),
                                            const SizedBox(height: 10),
                                            DropdownButtonFormField<String>(
                                              initialValue: reservation.status,
                                              decoration: const InputDecoration(labelText: 'Estado de la reserva'),
                                              items: _reservationStatuses
                                                  .map((status) => DropdownMenuItem<String>(value: status, child: Text(formatStatusLabel(status))))
                                                  .toList(growable: false),
                                              onChanged: (value) {
                                                if (value == null || value == reservation.status) {
                                                  return;
                                                }
                                                _withRefresh(
                                                  () => widget.repository.updateReservationStatus(reservation.id, status: value),
                                                  'Estado de reserva actualizado.',
                                                );
                                              },
                                            ),
                                            const SizedBox(height: 10),
                                            Row(
                                              children: [
                                                Expanded(
                                                  child: Text(
                                                    reservation.details.isEmpty
                                                        ? 'Sin detalle'
                                                        : reservation.details
                                                            .map((detail) => detail.serviceName.isEmpty ? 'Servicio ${detail.serviceId}' : detail.serviceName)
                                                            .join(' · '),
                                                    style: Theme.of(context).textTheme.bodySmall,
                                                  ),
                                                ),
                                                TextButton.icon(
                                                  onPressed: () async {
                                                    final confirm = await _confirm(context, 'Cancelar esta reserva?');
                                                    if (confirm != true) {
                                                      return;
                                                    }
                                                    await _withRefresh(
                                                      () => widget.repository.cancelReservation(reservation.id, reason: 'Cancelada desde consola movil'),
                                                      'Reserva cancelada.',
                                                    );
                                                  },
                                                  icon: const Icon(Icons.cancel_rounded),
                                                  label: const Text('Cancelar'),
                                                ),
                                              ],
                                            ),
                                          ],
                                        ),
                                      ),
                                    );
                                  }).toList(growable: false),
                                ),
                        ),
                        const SizedBox(height: 20),
                        _AdminSection(
                          eyebrow: 'Catalogo',
                          title: 'Servicios',
                          subtitle: 'CRUD rapido sobre el menu de servicios.',
                          action: FilledButton.icon(
                            onPressed: () async {
                              final payload = await _showServiceDialog(context);
                              if (payload == null) {
                                return;
                              }
                              await _withRefresh(
                                () => widget.repository.createService(
                                  name: payload['name'] as String,
                                  description: payload['description'] as String?,
                                  durationMin: payload['durationMin'] as int,
                                  priceBase: payload['priceBase'] as double,
                                  active: payload['active'] as bool,
                                ),
                                'Servicio creado.',
                              );
                            },
                            icon: const Icon(Icons.add_rounded),
                            label: const Text('Nuevo'),
                          ),
                          child: Column(
                            children: data.services.map((service) {
                              return Padding(
                                padding: const EdgeInsets.only(bottom: 12),
                                child: Container(
                                  padding: const EdgeInsets.all(16),
                                  decoration: sectionDecoration(color: Colors.white),
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Row(
                                        children: [
                                          Expanded(child: Text(service.name, style: Theme.of(context).textTheme.titleMedium)),
                                          _MiniStatusChip(label: service.active ? 'Activo' : 'Inactivo', status: service.active ? 'CONFIRMADA' : 'CANCELADA'),
                                        ],
                                      ),
                                      const SizedBox(height: 6),
                                      Text(service.description.isEmpty ? 'Sin descripcion.' : service.description),
                                      const SizedBox(height: 10),
                                      Wrap(
                                        spacing: 8,
                                        runSpacing: 8,
                                        children: [
                                          _MiniPill(label: '${service.durationMin} min'),
                                          _MiniPill(label: formatCurrency(service.priceBase)),
                                        ],
                                      ),
                                      const SizedBox(height: 10),
                                      Wrap(
                                        spacing: 8,
                                        runSpacing: 8,
                                        children: [
                                          TextButton.icon(
                                            onPressed: () async {
                                              final payload = await _showServiceDialog(context, current: service);
                                              if (payload == null) {
                                                return;
                                              }
                                              await _withRefresh(
                                                () => widget.repository.updateService(
                                                  service.id,
                                                  name: payload['name'] as String,
                                                  description: payload['description'] as String?,
                                                  durationMin: payload['durationMin'] as int,
                                                  priceBase: payload['priceBase'] as double,
                                                  active: payload['active'] as bool,
                                                ),
                                                'Servicio actualizado.',
                                              );
                                            },
                                            icon: const Icon(Icons.edit_rounded),
                                            label: const Text('Editar'),
                                          ),
                                          TextButton.icon(
                                            onPressed: () async {
                                              final confirm = await _confirm(context, 'Desactivar ${service.name}?');
                                              if (confirm != true) {
                                                return;
                                              }
                                              await _withRefresh(
                                                () => widget.repository.deleteService(service.id),
                                                'Servicio desactivado.',
                                              );
                                            },
                                            icon: const Icon(Icons.delete_outline_rounded),
                                            label: const Text('Eliminar'),
                                          ),
                                        ],
                                      ),
                                    ],
                                  ),
                                ),
                              );
                            }).toList(growable: false),
                          ),
                        ),
                        const SizedBox(height: 20),
                        _AdminSection(
                          eyebrow: 'Equipo',
                          title: 'Staff y asignaciones',
                          subtitle: 'Mantiene la relacion entre especialistas y servicios.',
                          action: FilledButton.icon(
                            onPressed: () async {
                              final payload = await _showStaffDialog(context, services: data.services);
                              if (payload == null) {
                                return;
                              }
                              await _withRefresh(
                                () => widget.repository.saveStaff(
                                  name: payload['name'] as String,
                                  role: payload['role'] as String?,
                                  phone: payload['phone'] as String?,
                                  active: payload['active'] as bool,
                                  serviceIds: payload['serviceIds'] as List<int>,
                                ),
                                'Staff creado.',
                              );
                            },
                            icon: const Icon(Icons.person_add_alt_1_rounded),
                            label: const Text('Nuevo'),
                          ),
                          child: Column(
                            children: data.staff.map((member) {
                              final assignedServices = member.serviceIds
                                  .map((id) => serviceNameById[id])
                                  .whereType<String>()
                                  .toList(growable: false);

                              return Padding(
                                padding: const EdgeInsets.only(bottom: 12),
                                child: Container(
                                  padding: const EdgeInsets.all(16),
                                  decoration: sectionDecoration(color: MoraColors.cream),
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Row(
                                        children: [
                                          Expanded(child: Text(member.name, style: Theme.of(context).textTheme.titleMedium)),
                                          _MiniStatusChip(label: member.active ? 'Activo' : 'Inactivo', status: member.active ? 'CONFIRMADA' : 'CANCELADA'),
                                        ],
                                      ),
                                      const SizedBox(height: 6),
                                      Text(member.role.isEmpty ? 'Sin rol definido' : member.role),
                                      const SizedBox(height: 10),
                                      Text(
                                        assignedServices.isEmpty ? 'Sin servicios asignados.' : assignedServices.join(' · '),
                                        style: Theme.of(context).textTheme.bodySmall,
                                      ),
                                      const SizedBox(height: 10),
                                      Wrap(
                                        spacing: 8,
                                        runSpacing: 8,
                                        children: [
                                          TextButton.icon(
                                            onPressed: () async {
                                              final payload = await _showStaffDialog(context, current: member, services: data.services);
                                              if (payload == null) {
                                                return;
                                              }
                                              await _withRefresh(
                                                () => widget.repository.saveStaff(
                                                  id: member.id,
                                                  name: payload['name'] as String,
                                                  role: payload['role'] as String?,
                                                  phone: payload['phone'] as String?,
                                                  active: payload['active'] as bool,
                                                  serviceIds: payload['serviceIds'] as List<int>,
                                                ),
                                                'Staff actualizado.',
                                              );
                                            },
                                            icon: const Icon(Icons.edit_rounded),
                                            label: const Text('Editar'),
                                          ),
                                          TextButton.icon(
                                            onPressed: () async {
                                              final confirm = await _confirm(context, 'Desactivar ${member.name}?');
                                              if (confirm != true) {
                                                return;
                                              }
                                              await _withRefresh(
                                                () => widget.repository.deleteStaff(member.id),
                                                'Staff desactivado.',
                                              );
                                            },
                                            icon: const Icon(Icons.delete_outline_rounded),
                                            label: const Text('Eliminar'),
                                          ),
                                        ],
                                      ),
                                    ],
                                  ),
                                ),
                              );
                            }).toList(growable: false),
                          ),
                        ),
                        const SizedBox(height: 20),
                        _AdminSection(
                          eyebrow: 'Promociones',
                          title: 'Campanas vigentes',
                          subtitle: 'Gestion rapida de promos asociadas a servicios.',
                          action: FilledButton.icon(
                            onPressed: () async {
                              final payload = await _showPromotionDialog(context, services: data.services);
                              if (payload == null) {
                                return;
                              }
                              await _withRefresh(
                                () => widget.repository.savePromotion(
                                  name: payload['name'] as String,
                                  type: payload['type'] as String,
                                  value: payload['value'] as double?,
                                  startDate: payload['startDate'] as String,
                                  endDate: payload['endDate'] as String,
                                  channel: payload['channel'] as String?,
                                  active: payload['active'] as bool,
                                  serviceIds: payload['serviceIds'] as List<int>,
                                ),
                                'Promocion creada.',
                              );
                            },
                            icon: const Icon(Icons.local_offer_rounded),
                            label: const Text('Nueva'),
                          ),
                          child: Column(
                            children: data.promotions.map((promotion) {
                              final labels = promotion.serviceIds.map((id) => serviceNameById[id]).whereType<String>().toList(growable: false);
                              return Padding(
                                padding: const EdgeInsets.only(bottom: 12),
                                child: Container(
                                  padding: const EdgeInsets.all(16),
                                  decoration: sectionDecoration(color: Colors.white),
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Row(
                                        children: [
                                          Expanded(child: Text(promotion.name, style: Theme.of(context).textTheme.titleMedium)),
                                          _MiniStatusChip(label: promotion.active ? 'Activa' : 'Inactiva', status: promotion.active ? 'CONFIRMADA' : 'CANCELADA'),
                                        ],
                                      ),
                                      const SizedBox(height: 8),
                                      Text('${promotion.type} · ${promotion.value > 0 ? formatCurrency(promotion.value) : 'Configurada'}'),
                                      const SizedBox(height: 8),
                                      Text('${formatDate(promotion.startDate)} - ${formatDate(promotion.endDate)}', style: Theme.of(context).textTheme.bodySmall),
                                      if (labels.isNotEmpty) ...[
                                        const SizedBox(height: 8),
                                        Text(labels.join(' · '), style: Theme.of(context).textTheme.bodySmall),
                                      ],
                                      const SizedBox(height: 10),
                                      Wrap(
                                        spacing: 8,
                                        runSpacing: 8,
                                        children: [
                                          TextButton.icon(
                                            onPressed: () async {
                                              final payload = await _showPromotionDialog(context, current: promotion, services: data.services);
                                              if (payload == null) {
                                                return;
                                              }
                                              await _withRefresh(
                                                () => widget.repository.savePromotion(
                                                  id: promotion.id,
                                                  name: payload['name'] as String,
                                                  type: payload['type'] as String,
                                                  value: payload['value'] as double?,
                                                  startDate: payload['startDate'] as String,
                                                  endDate: payload['endDate'] as String,
                                                  channel: payload['channel'] as String?,
                                                  active: payload['active'] as bool,
                                                  serviceIds: payload['serviceIds'] as List<int>,
                                                ),
                                                'Promocion actualizada.',
                                              );
                                            },
                                            icon: const Icon(Icons.edit_rounded),
                                            label: const Text('Editar'),
                                          ),
                                          TextButton.icon(
                                            onPressed: () async {
                                              final confirm = await _confirm(context, 'Desactivar ${promotion.name}?');
                                              if (confirm != true) {
                                                return;
                                              }
                                              await _withRefresh(
                                                () => widget.repository.deletePromotion(promotion.id),
                                                'Promocion desactivada.',
                                              );
                                            },
                                            icon: const Icon(Icons.delete_outline_rounded),
                                            label: const Text('Eliminar'),
                                          ),
                                        ],
                                      ),
                                    ],
                                  ),
                                ),
                              );
                            }).toList(growable: false),
                          ),
                        ),
                        const SizedBox(height: 20),
                        _AdminSection(
                          eyebrow: 'Tienda',
                          title: 'Productos',
                          subtitle: 'CRUD rapido con soporte para imagenes y stock.',
                          action: FilledButton.icon(
                            onPressed: () async {
                              final payload = await _showProductDialog(context);
                              if (payload == null) {
                                return;
                              }
                              await _withRefresh(
                                () => widget.repository.saveProduct(
                                  name: payload['name'] as String,
                                  description: payload['description'] as String?,
                                  category: payload['category'] as String?,
                                  price: payload['price'] as double,
                                  stock: payload['stock'] as int,
                                  active: payload['active'] as bool,
                                  featured: payload['featured'] as bool,
                                  imageUrls: payload['imageUrls'] as List<String>,
                                ),
                                'Producto creado.',
                              );
                            },
                            icon: const Icon(Icons.inventory_2_rounded),
                            label: const Text('Nuevo'),
                          ),
                          child: Column(
                            children: data.products.map((product) {
                              return Padding(
                                padding: const EdgeInsets.only(bottom: 12),
                                child: Container(
                                  padding: const EdgeInsets.all(16),
                                  decoration: sectionDecoration(color: MoraColors.cream),
                                  child: Row(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      SizedBox(width: 94, child: _AdminImagePreview(imageUrl: product.coverUrl, height: 94)),
                                      const SizedBox(width: 12),
                                      Expanded(
                                        child: Column(
                                          crossAxisAlignment: CrossAxisAlignment.start,
                                          children: [
                                            Row(
                                              children: [
                                                Expanded(child: Text(product.name, style: Theme.of(context).textTheme.titleMedium)),
                                                _MiniStatusChip(label: product.active ? 'Activo' : 'Inactivo', status: product.active ? 'CONFIRMADA' : 'CANCELADA'),
                                              ],
                                            ),
                                            const SizedBox(height: 8),
                                            Text(formatCurrency(product.price)),
                                            const SizedBox(height: 8),
                                            Text('Stock ${product.stock} · ${product.category.isEmpty ? 'Sin categoria' : product.category}', style: Theme.of(context).textTheme.bodySmall),
                                            const SizedBox(height: 10),
                                            Wrap(
                                              spacing: 8,
                                              runSpacing: 8,
                                              children: [
                                                TextButton.icon(
                                                  onPressed: () async {
                                                    final payload = await _showProductDialog(context, current: product);
                                                    if (payload == null) {
                                                      return;
                                                    }
                                                    await _withRefresh(
                                                      () => widget.repository.saveProduct(
                                                        id: product.id,
                                                        name: payload['name'] as String,
                                                        description: payload['description'] as String?,
                                                        category: payload['category'] as String?,
                                                        price: payload['price'] as double,
                                                        stock: payload['stock'] as int,
                                                        active: payload['active'] as bool,
                                                        featured: payload['featured'] as bool,
                                                        imageUrls: payload['imageUrls'] as List<String>,
                                                      ),
                                                      'Producto actualizado.',
                                                    );
                                                  },
                                                  icon: const Icon(Icons.edit_rounded),
                                                  label: const Text('Editar'),
                                                ),
                                                TextButton.icon(
                                                  onPressed: () async {
                                                    final confirm = await _confirm(context, 'Desactivar ${product.name}?');
                                                    if (confirm != true) {
                                                      return;
                                                    }
                                                    await _withRefresh(
                                                      () => widget.repository.deleteProduct(product.id),
                                                      'Producto desactivado.',
                                                    );
                                                  },
                                                  icon: const Icon(Icons.delete_outline_rounded),
                                                  label: const Text('Eliminar'),
                                                ),
                                              ],
                                            ),
                                          ],
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              );
                            }).toList(growable: false),
                          ),
                        ),
                        const SizedBox(height: 20),
                        _AdminSection(
                          eyebrow: 'Ventas',
                          title: 'Seguimiento de pedidos',
                          subtitle: 'Ajusta el estado de pago de las ventas creadas por la tienda.',
                          child: data.sales.isEmpty
                              ? const _AdminEmptyCard(title: 'Sin ventas', message: 'Aun no hay pedidos registrados.')
                              : Column(
                                  children: data.sales.map((sale) {
                                    return Padding(
                                      padding: const EdgeInsets.only(bottom: 12),
                                      child: Container(
                                        padding: const EdgeInsets.all(16),
                                        decoration: sectionDecoration(color: Colors.white),
                                        child: Column(
                                          crossAxisAlignment: CrossAxisAlignment.start,
                                          children: [
                                            Row(
                                              children: [
                                                Expanded(child: Text('Venta #${sale.id}', style: Theme.of(context).textTheme.titleMedium)),
                                                _MiniStatusChip(label: formatStatusLabel(sale.paymentStatus), status: sale.paymentStatus),
                                              ],
                                            ),
                                            const SizedBox(height: 8),
                                            Text('${sale.customerName.isEmpty ? 'Cliente' : sale.customerName} · ${formatCurrency(sale.total)}'),
                                            const SizedBox(height: 10),
                                            DropdownButtonFormField<String>(
                                              initialValue: sale.paymentStatus,
                                              decoration: const InputDecoration(labelText: 'Estado de pago'),
                                              items: _paymentStatuses
                                                  .map((status) => DropdownMenuItem<String>(value: status, child: Text(formatStatusLabel(status))))
                                                  .toList(growable: false),
                                              onChanged: (value) {
                                                if (value == null || value == sale.paymentStatus) {
                                                  return;
                                                }
                                                _withRefresh(
                                                  () => widget.repository.updateSalePaymentStatus(sale.id, paymentStatus: value),
                                                  'Estado de venta actualizado.',
                                                );
                                              },
                                            ),
                                          ],
                                        ),
                                      ),
                                    );
                                  }).toList(growable: false),
                                ),
                        ),
                        const SizedBox(height: 20),
                        _AdminSection(
                          eyebrow: 'Clientes',
                          title: 'Base de clientes',
                          subtitle: 'Alta, edicion y desactivacion rapida de clientes.',
                          action: FilledButton.icon(
                            onPressed: () async {
                              final payload = await _showClientDialog(context);
                              if (payload == null) {
                                return;
                              }
                              await _withRefresh(
                                () => widget.repository.createClient(
                                  name: payload['name'] as String,
                                  phone: payload['phone'] as String,
                                  email: payload['email'] as String?,
                                  whatsapp: payload['whatsapp'] as String?,
                                  birthDate: payload['birthDate'] as String?,
                                  docType: payload['docType'] as String?,
                                  docNumber: payload['docNumber'] as String?,
                                  active: payload['active'] as bool,
                                ),
                                'Cliente creado.',
                              );
                            },
                            icon: const Icon(Icons.group_add_rounded),
                            label: const Text('Nuevo'),
                          ),
                          child: Column(
                            children: data.clients.map((client) {
                              return Padding(
                                padding: const EdgeInsets.only(bottom: 12),
                                child: Container(
                                  padding: const EdgeInsets.all(16),
                                  decoration: sectionDecoration(color: MoraColors.cream),
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Row(
                                        children: [
                                          Expanded(child: Text(client.name, style: Theme.of(context).textTheme.titleMedium)),
                                          _MiniStatusChip(label: client.active ? 'Activo' : 'Inactivo', status: client.active ? 'CONFIRMADA' : 'CANCELADA'),
                                        ],
                                      ),
                                      const SizedBox(height: 8),
                                      Text(client.phone),
                                      if (client.email.isNotEmpty) ...[
                                        const SizedBox(height: 4),
                                        Text(client.email, style: Theme.of(context).textTheme.bodySmall),
                                      ],
                                      const SizedBox(height: 10),
                                      Wrap(
                                        spacing: 8,
                                        runSpacing: 8,
                                        children: [
                                          TextButton.icon(
                                            onPressed: () async {
                                              final payload = await _showClientDialog(context, current: client);
                                              if (payload == null) {
                                                return;
                                              }
                                              await _withRefresh(
                                                () => widget.repository.updateClient(
                                                  client.id,
                                                  name: payload['name'] as String,
                                                  phone: payload['phone'] as String,
                                                  email: payload['email'] as String?,
                                                  whatsapp: payload['whatsapp'] as String?,
                                                  birthDate: payload['birthDate'] as String?,
                                                  docType: payload['docType'] as String?,
                                                  docNumber: payload['docNumber'] as String?,
                                                  active: payload['active'] as bool,
                                                ),
                                                'Cliente actualizado.',
                                              );
                                            },
                                            icon: const Icon(Icons.edit_rounded),
                                            label: const Text('Editar'),
                                          ),
                                          TextButton.icon(
                                            onPressed: () async {
                                              final confirm = await _confirm(context, 'Desactivar ${client.name}?');
                                              if (confirm != true) {
                                                return;
                                              }
                                              await _withRefresh(
                                                () => widget.repository.deleteClient(client.id),
                                                'Cliente desactivado.',
                                              );
                                            },
                                            icon: const Icon(Icons.delete_outline_rounded),
                                            label: const Text('Eliminar'),
                                          ),
                                        ],
                                      ),
                                    ],
                                  ),
                                ),
                              );
                            }).toList(growable: false),
                          ),
                        ),
                      ],
                    ),
                  );
                },
              ),
      ),
    );
  }

  Widget _buildLoginView() {
    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 28),
      children: [
        _AdminHero(
          title: 'Acceso staff desde Flutter',
          subtitle:
              'Esta consola usa el mismo flujo de autenticacion del panel web. Inicia sesion con tus credenciales de usuario interno.',
          metrics: const [
            _AdminMetric(label: 'Modo', value: 'Operativo'),
            _AdminMetric(label: 'Fuente', value: 'API real'),
          ],
        ),
        const SizedBox(height: 20),
        _AdminSection(
          eyebrow: 'Login',
          title: 'Entrar al panel movil',
          subtitle: 'Se usara el token staff para cargar modulos administrativos.',
          child: Column(
            children: [
              TextField(controller: _usernameController, decoration: const InputDecoration(labelText: 'Usuario')),
              const SizedBox(height: 12),
              TextField(controller: _passwordController, obscureText: true, decoration: const InputDecoration(labelText: 'Contrasena')),
              const SizedBox(height: 16),
              FilledButton.icon(
                onPressed: _loggingIn ? null : _login,
                icon: _loggingIn
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                      )
                    : const Icon(Icons.admin_panel_settings_rounded),
                label: Text(_loggingIn ? 'Ingresando...' : 'Entrar'),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

Future<bool?> _confirm(BuildContext context, String message) {
  return showDialog<bool>(
    context: context,
    builder: (context) => AlertDialog(
      title: const Text('Confirmacion'),
      content: Text(message),
      actions: [
        TextButton(onPressed: () => Navigator.of(context).pop(false), child: const Text('Cancelar')),
        FilledButton(onPressed: () => Navigator.of(context).pop(true), child: const Text('Continuar')),
      ],
    ),
  );
}

Future<Map<String, dynamic>?> _showServiceDialog(BuildContext context, {ServiceItem? current}) async {
  final nameController = TextEditingController(text: current?.name ?? '');
  final descriptionController = TextEditingController(text: current?.description ?? '');
  final durationController = TextEditingController(text: current == null ? '' : '${current.durationMin}');
  final priceController = TextEditingController(text: current == null ? '' : '${current.priceBase}');
  var active = current?.active ?? true;

  final result = await showDialog<Map<String, dynamic>>(
    context: context,
    builder: (context) {
      return StatefulBuilder(
        builder: (context, setDialogState) {
          return AlertDialog(
            title: Text(current == null ? 'Nuevo servicio' : 'Editar servicio'),
            content: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  TextField(controller: nameController, decoration: const InputDecoration(labelText: 'Nombre')),
                  const SizedBox(height: 12),
                  TextField(controller: descriptionController, maxLines: 3, decoration: const InputDecoration(labelText: 'Descripcion')),
                  const SizedBox(height: 12),
                  TextField(controller: durationController, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Duracion en minutos')),
                  const SizedBox(height: 12),
                  TextField(controller: priceController, keyboardType: const TextInputType.numberWithOptions(decimal: true), decoration: const InputDecoration(labelText: 'Precio base')),
                  const SizedBox(height: 8),
                  SwitchListTile(
                    value: active,
                    contentPadding: EdgeInsets.zero,
                    title: const Text('Activo'),
                    onChanged: (value) => setDialogState(() => active = value),
                  ),
                ],
              ),
            ),
            actions: [
              TextButton(onPressed: () => Navigator.of(context).pop(), child: const Text('Cancelar')),
              FilledButton(
                onPressed: () {
                  final name = nameController.text.trim();
                  final duration = int.tryParse(durationController.text.trim());
                  final price = double.tryParse(priceController.text.trim());
                  if (name.isEmpty || duration == null || price == null) {
                    return;
                  }
                  Navigator.of(context).pop({
                    'name': name,
                    'description': descriptionController.text.trim().isEmpty ? null : descriptionController.text.trim(),
                    'durationMin': duration,
                    'priceBase': price,
                    'active': active,
                  });
                },
                child: const Text('Guardar'),
              ),
            ],
          );
        },
      );
    },
  );

  nameController.dispose();
  descriptionController.dispose();
  durationController.dispose();
  priceController.dispose();
  return result;
}

Future<Map<String, dynamic>?> _showStaffDialog(
  BuildContext context, {
  StaffMember? current,
  required List<ServiceItem> services,
}) async {
  final nameController = TextEditingController(text: current?.name ?? '');
  final roleController = TextEditingController(text: current?.role ?? '');
  final phoneController = TextEditingController(text: current?.phone ?? '');
  var active = current?.active ?? true;
  final selectedServiceIds = {...?current?.serviceIds};

  final result = await showDialog<Map<String, dynamic>>(
    context: context,
    builder: (context) {
      return StatefulBuilder(
        builder: (context, setDialogState) {
          return AlertDialog(
            title: Text(current == null ? 'Nuevo staff' : 'Editar staff'),
            content: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  TextField(controller: nameController, decoration: const InputDecoration(labelText: 'Nombre')),
                  const SizedBox(height: 12),
                  TextField(controller: roleController, decoration: const InputDecoration(labelText: 'Rol')),
                  const SizedBox(height: 12),
                  TextField(controller: phoneController, keyboardType: TextInputType.phone, decoration: const InputDecoration(labelText: 'Telefono')),
                  const SizedBox(height: 8),
                  SwitchListTile(
                    value: active,
                    contentPadding: EdgeInsets.zero,
                    title: const Text('Activo'),
                    onChanged: (value) => setDialogState(() => active = value),
                  ),
                  const SizedBox(height: 8),
                  Align(
                    alignment: Alignment.centerLeft,
                    child: Text('Servicios asignados', style: Theme.of(context).textTheme.titleMedium),
                  ),
                  const SizedBox(height: 10),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: services
                        .map(
                          (service) => FilterChip(
                            selected: selectedServiceIds.contains(service.id),
                            label: Text(service.name),
                            onSelected: (_) {
                              setDialogState(() {
                                if (selectedServiceIds.contains(service.id)) {
                                  selectedServiceIds.remove(service.id);
                                } else {
                                  selectedServiceIds.add(service.id);
                                }
                              });
                            },
                          ),
                        )
                        .toList(growable: false),
                  ),
                ],
              ),
            ),
            actions: [
              TextButton(onPressed: () => Navigator.of(context).pop(), child: const Text('Cancelar')),
              FilledButton(
                onPressed: () {
                  final name = nameController.text.trim();
                  if (name.isEmpty) {
                    return;
                  }
                  Navigator.of(context).pop({
                    'name': name,
                    'role': roleController.text.trim().isEmpty ? null : roleController.text.trim(),
                    'phone': phoneController.text.trim().isEmpty ? null : phoneController.text.trim(),
                    'active': active,
                    'serviceIds': selectedServiceIds.toList(growable: false),
                  });
                },
                child: const Text('Guardar'),
              ),
            ],
          );
        },
      );
    },
  );

  nameController.dispose();
  roleController.dispose();
  phoneController.dispose();
  return result;
}

Future<Map<String, dynamic>?> _showPromotionDialog(
  BuildContext context, {
  PromotionItem? current,
  required List<ServiceItem> services,
}) async {
  final nameController = TextEditingController(text: current?.name ?? '');
  final valueController = TextEditingController(text: current == null ? '' : current.value.toString());
  final startController = TextEditingController(text: current?.startDate == null ? '' : formatInputDate(current!.startDate!));
  final endController = TextEditingController(text: current?.endDate == null ? '' : formatInputDate(current!.endDate!));
  final channelController = TextEditingController(text: current?.channel ?? '');
  var active = current?.active ?? true;
  var type = current?.type ?? 'PORCENTAJE';
  final selectedServiceIds = {...?current?.serviceIds};

  Future<void> pickDate(TextEditingController controller) async {
    final picked = await showDatePicker(
      context: context,
      initialDate: DateTime.now(),
      firstDate: DateTime(2024),
      lastDate: DateTime.now().add(const Duration(days: 365)),
    );
    if (picked != null) {
      controller.text = formatInputDate(picked);
    }
  }

  final result = await showDialog<Map<String, dynamic>>(
    context: context,
    builder: (context) {
      return StatefulBuilder(
        builder: (context, setDialogState) {
          return AlertDialog(
            title: Text(current == null ? 'Nueva promocion' : 'Editar promocion'),
            content: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  TextField(controller: nameController, decoration: const InputDecoration(labelText: 'Nombre')),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<String>(
                    initialValue: type,
                    decoration: const InputDecoration(labelText: 'Tipo'),
                    items: const [
                      DropdownMenuItem<String>(value: 'PORCENTAJE', child: Text('Porcentaje')),
                      DropdownMenuItem<String>(value: 'MONTO', child: Text('Monto')),
                      DropdownMenuItem<String>(value: 'REGALO', child: Text('Regalo')),
                    ],
                    onChanged: (value) => setDialogState(() => type = value ?? 'PORCENTAJE'),
                  ),
                  const SizedBox(height: 12),
                  TextField(controller: valueController, keyboardType: const TextInputType.numberWithOptions(decimal: true), decoration: const InputDecoration(labelText: 'Valor')),
                  const SizedBox(height: 12),
                  TextField(
                    controller: startController,
                    readOnly: true,
                    decoration: InputDecoration(
                      labelText: 'Inicio',
                      suffixIcon: IconButton(onPressed: () => pickDate(startController), icon: const Icon(Icons.calendar_month_rounded)),
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: endController,
                    readOnly: true,
                    decoration: InputDecoration(
                      labelText: 'Fin',
                      suffixIcon: IconButton(onPressed: () => pickDate(endController), icon: const Icon(Icons.calendar_month_rounded)),
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextField(controller: channelController, decoration: const InputDecoration(labelText: 'Canal')),
                  SwitchListTile(
                    value: active,
                    contentPadding: EdgeInsets.zero,
                    title: const Text('Activa'),
                    onChanged: (value) => setDialogState(() => active = value),
                  ),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: services
                        .map(
                          (service) => FilterChip(
                            selected: selectedServiceIds.contains(service.id),
                            label: Text(service.name),
                            onSelected: (_) {
                              setDialogState(() {
                                if (selectedServiceIds.contains(service.id)) {
                                  selectedServiceIds.remove(service.id);
                                } else {
                                  selectedServiceIds.add(service.id);
                                }
                              });
                            },
                          ),
                        )
                        .toList(growable: false),
                  ),
                ],
              ),
            ),
            actions: [
              TextButton(onPressed: () => Navigator.of(context).pop(), child: const Text('Cancelar')),
              FilledButton(
                onPressed: () {
                  final name = nameController.text.trim();
                  if (name.isEmpty || startController.text.trim().isEmpty || endController.text.trim().isEmpty) {
                    return;
                  }
                  Navigator.of(context).pop({
                    'name': name,
                    'type': type,
                    'value': valueController.text.trim().isEmpty ? null : double.tryParse(valueController.text.trim()),
                    'startDate': startController.text.trim(),
                    'endDate': endController.text.trim(),
                    'channel': channelController.text.trim().isEmpty ? null : channelController.text.trim(),
                    'active': active,
                    'serviceIds': selectedServiceIds.toList(growable: false),
                  });
                },
                child: const Text('Guardar'),
              ),
            ],
          );
        },
      );
    },
  );

  nameController.dispose();
  valueController.dispose();
  startController.dispose();
  endController.dispose();
  channelController.dispose();
  return result;
}

Future<Map<String, dynamic>?> _showProductDialog(BuildContext context, {ProductItem? current}) async {
  final nameController = TextEditingController(text: current?.name ?? '');
  final descriptionController = TextEditingController(text: current?.description ?? '');
  final categoryController = TextEditingController(text: current?.category ?? '');
  final priceController = TextEditingController(text: current == null ? '' : current.price.toString());
  final stockController = TextEditingController(text: current == null ? '' : '${current.stock}');
  final imagesController = TextEditingController(text: current == null ? '' : current.images.map((image) => image.url).join('\n'));
  var active = current?.active ?? true;
  var featured = current?.featured ?? false;

  final result = await showDialog<Map<String, dynamic>>(
    context: context,
    builder: (context) {
      return StatefulBuilder(
        builder: (context, setDialogState) {
          return AlertDialog(
            title: Text(current == null ? 'Nuevo producto' : 'Editar producto'),
            content: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  TextField(controller: nameController, decoration: const InputDecoration(labelText: 'Nombre')),
                  const SizedBox(height: 12),
                  TextField(controller: descriptionController, maxLines: 3, decoration: const InputDecoration(labelText: 'Descripcion')),
                  const SizedBox(height: 12),
                  TextField(controller: categoryController, decoration: const InputDecoration(labelText: 'Categoria')),
                  const SizedBox(height: 12),
                  TextField(controller: priceController, keyboardType: const TextInputType.numberWithOptions(decimal: true), decoration: const InputDecoration(labelText: 'Precio')),
                  const SizedBox(height: 12),
                  TextField(controller: stockController, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Stock')),
                  const SizedBox(height: 12),
                  TextField(
                    controller: imagesController,
                    maxLines: 4,
                    decoration: const InputDecoration(labelText: 'URLs de imagen (una por linea)'),
                  ),
                  SwitchListTile(
                    value: active,
                    contentPadding: EdgeInsets.zero,
                    title: const Text('Activo'),
                    onChanged: (value) => setDialogState(() => active = value),
                  ),
                  SwitchListTile(
                    value: featured,
                    contentPadding: EdgeInsets.zero,
                    title: const Text('Destacado'),
                    onChanged: (value) => setDialogState(() => featured = value),
                  ),
                ],
              ),
            ),
            actions: [
              TextButton(onPressed: () => Navigator.of(context).pop(), child: const Text('Cancelar')),
              FilledButton(
                onPressed: () {
                  final name = nameController.text.trim();
                  final price = double.tryParse(priceController.text.trim());
                  final stock = int.tryParse(stockController.text.trim());
                  if (name.isEmpty || price == null || stock == null) {
                    return;
                  }
                  Navigator.of(context).pop({
                    'name': name,
                    'description': descriptionController.text.trim().isEmpty ? null : descriptionController.text.trim(),
                    'category': categoryController.text.trim().isEmpty ? null : categoryController.text.trim(),
                    'price': price,
                    'stock': stock,
                    'active': active,
                    'featured': featured,
                    'imageUrls': imagesController.text
                        .split(RegExp(r'\r?\n'))
                        .map((line) => line.trim())
                        .where((line) => line.isNotEmpty)
                        .toList(growable: false),
                  });
                },
                child: const Text('Guardar'),
              ),
            ],
          );
        },
      );
    },
  );

  nameController.dispose();
  descriptionController.dispose();
  categoryController.dispose();
  priceController.dispose();
  stockController.dispose();
  imagesController.dispose();
  return result;
}

Future<Map<String, dynamic>?> _showClientDialog(BuildContext context, {ClientRecord? current}) async {
  final nameController = TextEditingController(text: current?.name ?? '');
  final phoneController = TextEditingController(text: current?.phone ?? '');
  final emailController = TextEditingController(text: current?.email ?? '');
  final whatsappController = TextEditingController(text: current?.whatsapp ?? '');
  final birthDateController = TextEditingController(text: current?.birthDate == null ? '' : formatInputDate(current!.birthDate!));
  final docTypeController = TextEditingController(text: current?.docType ?? '');
  final docNumberController = TextEditingController(text: current?.docNumber ?? '');
  var active = current?.active ?? true;

  Future<void> pickBirthDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: DateTime.now().subtract(const Duration(days: 365 * 20)),
      firstDate: DateTime(1950),
      lastDate: DateTime.now(),
    );
    if (picked != null) {
      birthDateController.text = formatInputDate(picked);
    }
  }

  final result = await showDialog<Map<String, dynamic>>(
    context: context,
    builder: (context) {
      return StatefulBuilder(
        builder: (context, setDialogState) {
          return AlertDialog(
            title: Text(current == null ? 'Nuevo cliente' : 'Editar cliente'),
            content: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  TextField(controller: nameController, decoration: const InputDecoration(labelText: 'Nombre')),
                  const SizedBox(height: 12),
                  TextField(controller: phoneController, keyboardType: TextInputType.phone, decoration: const InputDecoration(labelText: 'Telefono')),
                  const SizedBox(height: 12),
                  TextField(controller: emailController, keyboardType: TextInputType.emailAddress, decoration: const InputDecoration(labelText: 'Email')),
                  const SizedBox(height: 12),
                  TextField(controller: whatsappController, keyboardType: TextInputType.phone, decoration: const InputDecoration(labelText: 'WhatsApp')),
                  const SizedBox(height: 12),
                  TextField(
                    controller: birthDateController,
                    readOnly: true,
                    decoration: InputDecoration(
                      labelText: 'Fecha de nacimiento',
                      suffixIcon: IconButton(onPressed: pickBirthDate, icon: const Icon(Icons.calendar_month_rounded)),
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextField(controller: docTypeController, decoration: const InputDecoration(labelText: 'Tipo de documento')),
                  const SizedBox(height: 12),
                  TextField(controller: docNumberController, decoration: const InputDecoration(labelText: 'Numero de documento')),
                  SwitchListTile(
                    value: active,
                    contentPadding: EdgeInsets.zero,
                    title: const Text('Activo'),
                    onChanged: (value) => setDialogState(() => active = value),
                  ),
                ],
              ),
            ),
            actions: [
              TextButton(onPressed: () => Navigator.of(context).pop(), child: const Text('Cancelar')),
              FilledButton(
                onPressed: () {
                  final name = nameController.text.trim();
                  final phone = phoneController.text.trim();
                  if (name.isEmpty || phone.isEmpty) {
                    return;
                  }
                  Navigator.of(context).pop({
                    'name': name,
                    'phone': phone,
                    'email': emailController.text.trim().isEmpty ? null : emailController.text.trim(),
                    'whatsapp': whatsappController.text.trim().isEmpty ? null : whatsappController.text.trim(),
                    'birthDate': birthDateController.text.trim().isEmpty ? null : birthDateController.text.trim(),
                    'docType': docTypeController.text.trim().isEmpty ? null : docTypeController.text.trim(),
                    'docNumber': docNumberController.text.trim().isEmpty ? null : docNumberController.text.trim(),
                    'active': active,
                  });
                },
                child: const Text('Guardar'),
              ),
            ],
          );
        },
      );
    },
  );

  nameController.dispose();
  phoneController.dispose();
  emailController.dispose();
  whatsappController.dispose();
  birthDateController.dispose();
  docTypeController.dispose();
  docNumberController.dispose();
  return result;
}

class _AdminHero extends StatelessWidget {
  const _AdminHero({required this.title, required this.subtitle, required this.metrics});

  final String title;
  final String subtitle;
  final List<_AdminMetric> metrics;

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
              width: 108,
              height: 108,
              decoration: BoxDecoration(
                color: MoraColors.plum.withValues(alpha: 0.34),
                shape: BoxShape.circle,
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(22),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: Theme.of(context).textTheme.headlineMedium),
                const SizedBox(height: 10),
                Text(
                  subtitle,
                  style: Theme.of(context).textTheme.bodyLarge?.copyWith(color: MoraColors.muted),
                ),
                const SizedBox(height: 18),
                Wrap(
                  spacing: 12,
                  runSpacing: 12,
                  children: metrics,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _AdminMetric extends StatelessWidget {
  const _AdminMetric({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.76),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: MoraColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(value, style: Theme.of(context).textTheme.titleMedium?.copyWith(color: MoraColors.ink)),
          const SizedBox(height: 4),
          Text(label, style: Theme.of(context).textTheme.bodySmall?.copyWith(color: MoraColors.muted)),
        ],
      ),
    );
  }
}

class _AdminSection extends StatelessWidget {
  const _AdminSection({
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
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(fontWeight: FontWeight.w800, color: MoraColors.cocoa),
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

class _MiniStatusChip extends StatelessWidget {
  const _MiniStatusChip({required this.label, required this.status});

  final String label;
  final String status;

  @override
  Widget build(BuildContext context) {
    final tone = _statusTone(status);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(color: tone.$1, borderRadius: BorderRadius.circular(999)),
      child: Text(label, style: Theme.of(context).textTheme.bodySmall?.copyWith(color: tone.$2, fontWeight: FontWeight.w800)),
    );
  }
}

class _MiniPill extends StatelessWidget {
  const _MiniPill({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(color: MoraColors.sand, borderRadius: BorderRadius.circular(999)),
      child: Text(label, style: Theme.of(context).textTheme.bodySmall?.copyWith(fontWeight: FontWeight.w700)),
    );
  }
}

class _AdminImagePreview extends StatelessWidget {
  const _AdminImagePreview({required this.imageUrl, required this.height});

  final String imageUrl;
  final double height;

  @override
  Widget build(BuildContext context) {
    final resolved = _resolveImageUrl(imageUrl);
    return Container(
      height: height,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(20),
        gradient: const LinearGradient(colors: [Color(0xFFF7D8B7), Color(0xFFEEC59C)]),
      ),
      clipBehavior: Clip.antiAlias,
      child: resolved == null
          ? const Center(child: Icon(Icons.image_outlined, color: MoraColors.cocoa))
          : Image.network(
              resolved,
              fit: BoxFit.cover,
              errorBuilder: (_, _, _) => const Center(child: Icon(Icons.broken_image_outlined, color: MoraColors.cocoa)),
            ),
    );
  }
}

class _AdminEmptyCard extends StatelessWidget {
  const _AdminEmptyCard({required this.title, required this.message});

  final String title;
  final String message;

  @override
  Widget build(BuildContext context) {
    return Container(
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

class _AdminErrorView extends StatelessWidget {
  const _AdminErrorView({required this.title, required this.message, required this.onRetry});

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
              const Icon(Icons.admin_panel_settings_rounded, color: MoraColors.cocoa, size: 42),
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