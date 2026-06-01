import 'dart:convert';

import 'package:http/http.dart' as http;

import '../../state/app_state.dart';
import '../config/app_config.dart';
import '../models.dart';

enum AuthScope { none, client, staff }

class ApiException implements Exception {
  const ApiException({
    required this.message,
    required this.statusCode,
    required this.code,
  });

  final String message;
  final int statusCode;
  final String code;

  @override
  String toString() => message;
}

class ApiClient {
  ApiClient({
    required this.appState,
    http.Client? httpClient,
  }) : _httpClient = httpClient ?? http.Client();

  final AppState appState;
  final http.Client _httpClient;

  Future<dynamic> get(
    String path, {
    AuthScope scope = AuthScope.none,
    Map<String, dynamic>? query,
  }) {
    return _request('GET', path, scope: scope, query: query);
  }

  Future<dynamic> post(
    String path, {
    AuthScope scope = AuthScope.none,
    Object? body,
    Map<String, dynamic>? query,
  }) {
    return _request('POST', path, scope: scope, query: query, body: body);
  }

  Future<dynamic> patch(
    String path, {
    AuthScope scope = AuthScope.none,
    Object? body,
    Map<String, dynamic>? query,
  }) {
    return _request('PATCH', path, scope: scope, query: query, body: body);
  }

  Future<dynamic> put(
    String path, {
    AuthScope scope = AuthScope.none,
    Object? body,
    Map<String, dynamic>? query,
  }) {
    return _request('PUT', path, scope: scope, query: query, body: body);
  }

  Future<dynamic> delete(
    String path, {
    AuthScope scope = AuthScope.none,
    Object? body,
    Map<String, dynamic>? query,
  }) {
    return _request('DELETE', path, scope: scope, query: query, body: body);
  }

  Future<dynamic> _request(
    String method,
    String path, {
    required AuthScope scope,
    Map<String, dynamic>? query,
    Object? body,
  }) async {
    final uri = _buildUri(path, query: query);
    final headers = <String, String>{
      'Accept': 'application/json',
      if (body != null) 'Content-Type': 'application/json',
      ..._authHeaders(scope),
    };

    late http.Response response;
    final payload = body == null ? null : jsonEncode(body);

    switch (method) {
      case 'GET':
        response = await _httpClient.get(uri, headers: headers);
        break;
      case 'POST':
        response = await _httpClient.post(uri, headers: headers, body: payload);
        break;
      case 'PATCH':
        response = await _httpClient.patch(uri, headers: headers, body: payload);
        break;
      case 'PUT':
        response = await _httpClient.put(uri, headers: headers, body: payload);
        break;
      case 'DELETE':
        response = await _httpClient.delete(uri, headers: headers, body: payload);
        break;
      default:
        throw ArgumentError('Unsupported method $method');
    }

    final decoded = _decodeResponse(response);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      final map = jsonMapOf(decoded);
      final error = jsonMapOf(map?['error']);
      throw ApiException(
        message: stringOf(error?['message'], 'No se pudo completar la solicitud.'),
        statusCode: response.statusCode,
        code: stringOf(error?['code'], 'request_error'),
      );
    }

    return decoded;
  }

  Uri _buildUri(String path, {Map<String, dynamic>? query}) {
    final normalizedPath = path.startsWith('/') ? path : '/$path';
    final base = AppConfig.apiBaseUrl.endsWith('/')
        ? AppConfig.apiBaseUrl.substring(0, AppConfig.apiBaseUrl.length - 1)
        : AppConfig.apiBaseUrl;
    final uri = Uri.parse('$base$normalizedPath');

    if (query == null || query.isEmpty) {
      return uri;
    }

    final queryParameters = <String, String>{};
    for (final entry in query.entries) {
      final value = entry.value;
      if (value == null) {
        continue;
      }
      if (value is List) {
        queryParameters[entry.key] = value.join(',');
      } else {
        queryParameters[entry.key] = value.toString();
      }
    }

    return uri.replace(queryParameters: queryParameters.isEmpty ? null : queryParameters);
  }

  Map<String, String> _authHeaders(AuthScope scope) {
    final token = switch (scope) {
      AuthScope.none => null,
      AuthScope.client => appState.clientToken,
      AuthScope.staff => appState.staffToken,
    };

    if (token == null || token.isEmpty) {
      return const {};
    }

    return {'Authorization': 'Bearer $token'};
  }

  dynamic _decodeResponse(http.Response response) {
    if (response.bodyBytes.isEmpty) {
      return null;
    }

    final text = utf8.decode(response.bodyBytes).trim();
    if (text.isEmpty) {
      return null;
    }

    return jsonDecode(text);
  }
}