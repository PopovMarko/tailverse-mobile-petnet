import { MAX_RADIUS_M, MIN_RADIUS_M, regionRadiusM } from '../src/utils/geo';

test('regionRadiusM covers the corners of the visible region', () => {
  // At the equator 0.02° × 0.02° is ~2.2 km square, so the half-diagonal is ~1.57 km.
  const radius = regionRadiusM({
    latitude: 0,
    longitude: 0,
    latitudeDelta: 0.02,
    longitudeDelta: 0.02,
  });
  expect(radius).toBeGreaterThan(1500);
  expect(radius).toBeLessThan(1650);
});

test('regionRadiusM narrows longitude away from the equator', () => {
  const region = { longitude: 0, latitudeDelta: 0, longitudeDelta: 0.02 };
  const atEquator = regionRadiusM({ ...region, latitude: 0 });
  const atMoscow = regionRadiusM({ ...region, latitude: 55.75 });
  expect(atMoscow).toBeLessThan(atEquator * 0.6);
});

test('regionRadiusM is clamped to what the backend accepts', () => {
  const zoomedIn = {
    latitude: 0,
    longitude: 0,
    latitudeDelta: 0,
    longitudeDelta: 0,
  };
  const zoomedOut = {
    latitude: 0,
    longitude: 0,
    latitudeDelta: 40,
    longitudeDelta: 40,
  };
  expect(regionRadiusM(zoomedIn)).toBe(MIN_RADIUS_M);
  expect(regionRadiusM(zoomedOut)).toBe(MAX_RADIUS_M);
});
