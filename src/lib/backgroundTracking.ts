import * as Location from 'expo-location';
import * as SecureStore from 'expo-secure-store';
import * as TaskManager from 'expo-task-manager';

import { ACTIVE_TRACKING_BOOKING_KEY, AUTH_TOKEN_KEY } from './sessionKeys';

export const BACKGROUND_LOCATION_TASK = 'careconnect-booking-background-location-v1';

interface BackgroundLocationPayload {
  locations?: Location.LocationObject[];
}

TaskManager.defineTask<BackgroundLocationPayload>(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
  if (error || !data?.locations?.length) return;
  const [token, bookingId] = await Promise.all([
    SecureStore.getItemAsync(AUTH_TOKEN_KEY),
    SecureStore.getItemAsync(ACTIVE_TRACKING_BOOKING_KEY)
  ]);
  if (!token || !bookingId) {
    await stopBackgroundTracking();
    return;
  }

  const apiUrl = process.env.EXPO_PUBLIC_API_URL?.replace(/\/+$/, '');
  if (!apiUrl) return;
  const position = data.locations[data.locations.length - 1];
  try {
    const response = await fetch(`${apiUrl}/location/background`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        bookingId,
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy,
        heading: position.coords.heading,
        speed: position.coords.speed
      })
    });
    if (response.status === 401 || response.status === 403 || response.status === 404) await stopBackgroundTracking();
  } catch {
    // Keep tracking registered through temporary network loss; coordinates are never queued to disk.
  }
});

export const startBackgroundTracking = async (bookingId: string) => {
  if (!await TaskManager.isAvailableAsync()) throw new Error('Background tracking requires the CareConnect development build.');
  const foregroundPermission = await Location.requestForegroundPermissionsAsync();
  if (!foregroundPermission.granted) throw new Error('Allow location access while using the app first.');
  const backgroundPermission = await Location.requestBackgroundPermissionsAsync();
  if (!backgroundPermission.granted) throw new Error('Background location permission was not granted. You can still share location while the app is open.');

  await SecureStore.setItemAsync(ACTIVE_TRACKING_BOOKING_KEY, bookingId, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY
  });
  try {
    const alreadyRunning = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    if (alreadyRunning) await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
      accuracy: Location.Accuracy.Balanced,
      distanceInterval: 20,
      timeInterval: 10000,
      deferredUpdatesDistance: 20,
      deferredUpdatesInterval: 10000,
      pausesUpdatesAutomatically: true,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: 'CareConnect appointment tracking',
        notificationBody: 'Your location is being shared with the other appointment participant.'
      }
    });
  } catch (error) {
    await SecureStore.deleteItemAsync(ACTIVE_TRACKING_BOOKING_KEY);
    throw error;
  }
};

export const stopBackgroundTracking = async () => {
  try {
    if (await TaskManager.isAvailableAsync() && await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK)) {
      await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    }
  } finally {
    await SecureStore.deleteItemAsync(ACTIVE_TRACKING_BOOKING_KEY);
  }
};

export const isBackgroundTrackingRegisteredFor = async (bookingId: string) => (
  await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK) &&
  await SecureStore.getItemAsync(ACTIVE_TRACKING_BOOKING_KEY) === bookingId
);