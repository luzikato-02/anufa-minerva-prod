import 'package:anufa_minerva_mobile/features/tension/recording/weaving_screen.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('merge message names what happened to the readings, with plurals', () {
    expect(weavingMergeMessage(2, 1, 3), 'Session loaded: kept 2 newer readings from this device, used 1 newer reading from the server, added 3 readings missing on one side.');
  });

  test('merge message leaves out parts that did not happen', () {
    expect(weavingMergeMessage(0, 0, 1), 'Session loaded: added 1 reading missing on one side.');
    expect(weavingMergeMessage(1, 0, 0), 'Session loaded: kept 1 newer reading from this device.');
  });
}
