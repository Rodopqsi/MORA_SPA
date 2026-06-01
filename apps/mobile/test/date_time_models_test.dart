import 'package:flutter_test/flutter_test.dart';

import 'package:mora_mobile/core/models.dart';

void main() {
  test('dateTimeOf converts API UTC datetimes to local time', () {
    const raw = '2026-06-01T15:00:00.000Z';

    final parsed = dateTimeOf(raw);

    expect(parsed, isNotNull);
    expect(parsed!.isUtc, isFalse);
    expect(parsed, DateTime.parse(raw).toLocal());
  });

  test('BookingSelection serializes using the local wall-clock time', () {
    final utcStart = DateTime.utc(2026, 6, 1, 15, 0);
    final selection = BookingSelection(serviceId: 1, staffId: 2, start: utcStart);

    expect(selection.toJson()['start'], utcStart.toLocal().toIso8601String());
  });
}