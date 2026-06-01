import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../core/models.dart';

class AppState extends ChangeNotifier {
  AppState._(this._prefs);

  static const _clientTokenKey = 'mora.clientToken';
  static const _clientSessionKey = 'mora.clientSession';
  static const _staffTokenKey = 'mora.staffToken';
  static const _staffSessionKey = 'mora.staffSession';
  static const _cartKey = 'mora.cart';

  final SharedPreferences _prefs;

  String? clientToken;
  ClientSession? clientSession;
  String? staffToken;
  StaffSession? staffSession;
  List<CartEntry> cart = const [];

  static Future<AppState> bootstrap() async {
    final prefs = await SharedPreferences.getInstance();
    final state = AppState._(prefs);
    state._restore();
    return state;
  }

  bool get isClientAuthenticated => clientToken != null && clientToken!.isNotEmpty;
  bool get isStaffAuthenticated => staffToken != null && staffToken!.isNotEmpty;
  int get cartCount => cart.fold(0, (sum, item) => sum + item.quantity);
  double get cartTotal => cart.fold(0, (sum, item) => sum + item.subtotal);

  void _restore() {
    clientToken = _prefs.getString(_clientTokenKey);
    staffToken = _prefs.getString(_staffTokenKey);

    final rawClientSession = _prefs.getString(_clientSessionKey);
    if (rawClientSession != null && rawClientSession.isNotEmpty) {
      clientSession = ClientSession.fromJson(Map<String, dynamic>.from(jsonDecode(rawClientSession) as Map));
    }

    final rawStaffSession = _prefs.getString(_staffSessionKey);
    if (rawStaffSession != null && rawStaffSession.isNotEmpty) {
      staffSession = StaffSession.fromJson(Map<String, dynamic>.from(jsonDecode(rawStaffSession) as Map));
    }

    final rawCart = _prefs.getString(_cartKey);
    if (rawCart != null && rawCart.isNotEmpty) {
      cart = (jsonDecode(rawCart) as List)
          .map((item) => CartEntry.fromJson(Map<String, dynamic>.from(item as Map)))
          .toList(growable: true);
    } else {
      cart = <CartEntry>[];
    }
  }

  void setClientSession(String token, ClientSession session) {
    clientToken = token;
    clientSession = session;
    _prefs.setString(_clientTokenKey, token);
    _prefs.setString(_clientSessionKey, jsonEncode(session.toJson()));
    notifyListeners();
  }

  void clearClientSession() {
    clientToken = null;
    clientSession = null;
    _prefs.remove(_clientTokenKey);
    _prefs.remove(_clientSessionKey);
    notifyListeners();
  }

  void setStaffSession(String token, StaffSession session) {
    staffToken = token;
    staffSession = session;
    _prefs.setString(_staffTokenKey, token);
    _prefs.setString(_staffSessionKey, jsonEncode(session.toJson()));
    notifyListeners();
  }

  void clearStaffSession() {
    staffToken = null;
    staffSession = null;
    _prefs.remove(_staffTokenKey);
    _prefs.remove(_staffSessionKey);
    notifyListeners();
  }

  void addToCart(ProductItem product) {
    final index = cart.indexWhere((item) => item.productId == product.id);
    if (index == -1) {
      cart = [...cart, CartEntry.fromProduct(product)];
    } else {
      final existing = cart[index];
      final nextQuantity = existing.quantity + 1;
      if (product.stock > 0 && nextQuantity > product.stock) {
        return;
      }
      final updated = existing.copyWith(
        quantity: nextQuantity,
        price: product.price,
        name: product.name,
        coverUrl: product.coverUrl,
        stock: product.stock,
      );
      cart = [...cart]..[index] = updated;
    }
    _persistCart();
    notifyListeners();
  }

  void updateCartQuantity(int productId, int quantity) {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }

    final index = cart.indexWhere((item) => item.productId == productId);
    if (index == -1) {
      return;
    }

    final current = cart[index];
    final clamped = current.stock > 0 && quantity > current.stock ? current.stock : quantity;
    cart = [...cart]..[index] = current.copyWith(quantity: clamped);
    _persistCart();
    notifyListeners();
  }

  void removeFromCart(int productId) {
    cart = cart.where((item) => item.productId != productId).toList(growable: true);
    _persistCart();
    notifyListeners();
  }

  void clearCart() {
    cart = <CartEntry>[];
    _persistCart();
    notifyListeners();
  }

  void reconcileCart(Iterable<ProductItem> products) {
    final productById = {for (final product in products) product.id: product};
    final nextCart = <CartEntry>[];

    for (final item in cart) {
      final product = productById[item.productId];
      if (product == null || !product.active || product.stock <= 0) {
        continue;
      }

      nextCart.add(
        item.copyWith(
          name: product.name,
          price: product.price,
          coverUrl: product.coverUrl,
          stock: product.stock,
          quantity: item.quantity > product.stock ? product.stock : item.quantity,
        ),
      );
    }

    cart = nextCart;
    _persistCart();
    notifyListeners();
  }

  void _persistCart() {
    _prefs.setString(_cartKey, jsonEncode(cart.map((item) => item.toJson()).toList(growable: false)));
  }
}