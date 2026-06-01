import 'package:intl/intl.dart';

NumberFormat get _currency => NumberFormat.currency(locale: 'es_PE', symbol: 'S/ ');
DateFormat get _date => DateFormat('d MMM y', 'es_PE');
DateFormat get _dateTime => DateFormat('d MMM y, h:mm a', 'es_PE');
DateFormat get _time => DateFormat('h:mm a', 'es_PE');
DateFormat get _inputDate => DateFormat('yyyy-MM-dd');

String formatCurrency(double value) => _currency.format(value);

String formatDate(DateTime? value, {String fallback = 'Sin fecha'}) {
  if (value == null) {
    return fallback;
  }
  return _date.format(value);
}

String formatDateTime(DateTime? value, {String fallback = 'Sin fecha'}) {
  if (value == null) {
    return fallback;
  }
  return _dateTime.format(value);
}

String formatTime(DateTime? value, {String fallback = '--:--'}) {
  if (value == null) {
    return fallback;
  }
  return _time.format(value);
}

String formatInputDate(DateTime value) => _inputDate.format(value);

String formatStatusLabel(String status) {
  if (status.trim().isEmpty) {
    return 'Sin estado';
  }

  return status
      .toLowerCase()
      .replaceAll('_', ' ')
      .split(' ')
      .where((segment) => segment.isNotEmpty)
      .map((segment) => '${segment[0].toUpperCase()}${segment.substring(1)}')
      .join(' ');
}