import 'package:flutter_test/flutter_test.dart';
import 'package:mora_mobile/core/models.dart';

void main() {
  test('AvailabilityPayload parses the real backend payload (no meta)', () {
    final json = {
      'data': [
        {
          'staffId': 1,
          'label': 'Mora Gisela',
          'mode': 'single_staff',
          'slots': [
            {
              'id': 'single-1-2026-06-16T14:00:00.000Z',
              'start': '2026-06-16T09:00:00.000',
              'end': '2026-06-16T10:00:00.000',
              'assignments': <Map<String, dynamic>>[],
            },
          ],
        },
      ],
    };

    final payload = AvailabilityPayload.fromJson(json);

    expect(payload.data, isNotEmpty, reason: 'data should be parsed');
    expect(payload.data.length, 1);
    expect(payload.data.first.label, 'Mora Gisela');
    expect(payload.data.first.slots.length, 1);
    expect(payload.data.first.slots.first.start, isNotNull);
  });
}
