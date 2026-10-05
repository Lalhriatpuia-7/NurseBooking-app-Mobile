import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Platform, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, type Region } from 'react-native-maps';
import { useFocusEffect } from 'expo-router';
import * as Location from 'expo-location';
import { io, type Socket } from 'socket.io-client';

import { ActionButton, Notice, Panel, Screen, sharedStyles } from '../../components/ui';
import { apiRequest, getSocketServerUrl } from '../../lib/api';
import { isBackgroundTrackingRegisteredFor, startBackgroundTracking, stopBackgroundTracking } from '../../lib/backgroundTracking';
import { colors } from '../../lib/theme';
import { useAuth } from '../../providers/AuthProvider';
import type { LocationPoint, TrackingState } from '../../types/domain';

const distanceBetweenMeters = (first: LocationPoint, second: LocationPoint) => {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const latitudeDelta = radians(second.lat - first.lat);
  const longitudeDelta = radians(second.lng - first.lng);
  const latitudeOne = radians(first.lat);
  const latitudeTwo = radians(second.lat);
  const a = Math.sin(latitudeDelta / 2) ** 2 + Math.cos(latitudeOne) * Math.cos(latitudeTwo) * Math.sin(longitudeDelta / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

export default function TrackingRoute() {
  const { token } = useAuth();
  const socketRef = useRef<Socket | null>(null);
  const [tracking, setTracking] = useState<TrackingState | null>(null);
  const [joined, setJoined] = useState(false);
  const [sharingLocation, setSharingLocation] = useState(false);
  const [backgroundSharing, setBackgroundSharing] = useState(false);
  const [trackingLoaded, setTrackingLoaded] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('Loading');
  const [error, setError] = useState('');

  useFocusEffect(useCallback(() => {
    let isMounted = true;
    let socket: Socket | null = null;
    setError('');
    setJoined(false);
    setTrackingLoaded(false);
    setConnectionStatus('Connecting');

    const connect = async () => {
      try {
        const payload = await apiRequest<{ tracking: TrackingState | null }>('/location/active', { token });
        if (!isMounted) return;
        if (!payload.tracking) {
          setTracking(null);
          setTrackingLoaded(true);
          setConnectionStatus('No active appointment');
          return;
        }
        setTracking(payload.tracking);
        setTrackingLoaded(true);

        socket = io(getSocketServerUrl(), {
          auth: { token },
          reconnection: true,
          reconnectionAttempts: Infinity,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 10000,
          timeout: 10000
        });
        socketRef.current = socket;

        socket.on('connect', () => {
          socket?.emit('tracking:join', { bookingId: payload.tracking?.id }, (result: { ok?: boolean; message?: string }) => {
            if (!isMounted) return;
            setJoined(Boolean(result?.ok));
            setConnectionStatus(result?.ok ? 'Live' : result?.message || 'Access denied');
          });
        });
        socket.on('disconnect', () => {
          if (isMounted) {
            setJoined(false);
            setConnectionStatus('Reconnecting');
          }
        });
        socket.on('connect_error', () => {
          if (isMounted) setConnectionStatus('Reconnecting');
        });
        socket.on('tracking:state', (state: TrackingState) => {
          if (isMounted && state.id === payload.tracking?.id) setTracking(state);
        });
        socket.on('tracking:location', (update: { bookingId: string; userId: string; role: string; location: LocationPoint }) => {
          if (!isMounted || update.bookingId !== payload.tracking?.id) return;
          setTracking((current) => {
            if (!current || current.id !== update.bookingId) return current;
            const participantKey = update.role === 'nurse' ? 'nurse' : 'customer';
            if (current[participantKey].id !== update.userId) return current;
            return { ...current, [participantKey]: { ...current[participantKey], location: update.location } };
          });
        });
      } catch (connectError) {
        if (isMounted) {
          setTrackingLoaded(true);
          setConnectionStatus('Unavailable');
          setError(connectError instanceof Error ? connectError.message : 'Could not load tracking.');
        }
      }
    };

    connect();
    return () => {
      isMounted = false;
      setJoined(false);
      socket?.disconnect();
      socketRef.current = null;
    };
  }, [token]));

  useEffect(() => {
    if (Platform.OS === 'web' || !trackingLoaded) return undefined;
    let isMounted = true;
    const syncBackgroundTask = async () => {
      try {
        if (!tracking?.id) {
          await stopBackgroundTracking();
          if (isMounted) setBackgroundSharing(false);
          return;
        }
        const registered = await isBackgroundTrackingRegisteredFor(tracking.id);
        if (!registered) await stopBackgroundTracking();
        if (isMounted) setBackgroundSharing(registered);
      } catch {
        if (isMounted) setBackgroundSharing(false);
      }
    };
    syncBackgroundTask();
    return () => { isMounted = false; };
  }, [tracking?.id, trackingLoaded]);

  const activeTrackingId = tracking?.id;

  useEffect(() => {
    if (!joined || !sharingLocation || !activeTrackingId || !token) return undefined;
    let isMounted = true;
    let subscription: Location.LocationSubscription | null = null;
    let lastLocation: LocationPoint | null = null;
    let lastSentAt = 0;

    const startGps = async () => {
      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (!permission.granted) throw new Error('Allow location access while using the app to share your position.');

        subscription = await Location.watchPositionAsync({
          accuracy: Location.Accuracy.High,
          distanceInterval: 10,
          timeInterval: 3000,
          mayShowUserSettingsDialog: true
        }, (position) => {
          const coords = position.coords;
          const nextLocation: LocationPoint = { lat: coords.latitude, lng: coords.longitude };
          const movedEnough = !lastLocation || distanceBetweenMeters(lastLocation, nextLocation) >= 15;
          const waitedEnough = Date.now() - lastSentAt >= 5000;
          if (!movedEnough && !waitedEnough) return;

          socketRef.current?.emit('tracking:location', {
            bookingId: activeTrackingId,
            ...nextLocation,
            accuracy: coords.accuracy,
            heading: coords.heading,
            speed: coords.speed
          }, (result: { ok?: boolean; accepted?: boolean; message?: string }) => {
            if (!isMounted) return;
            if (result?.accepted) {
              lastLocation = nextLocation;
              lastSentAt = Date.now();
            } else if (!result?.ok) {
              setError(result?.message || 'Location update rejected.');
            }
          });
        }, (reason) => {
          if (isMounted) setError(reason || 'Could not read this device location.');
        });
      } catch (permissionError) {
        if (isMounted) {
          setSharingLocation(false);
          setError(permissionError instanceof Error ? permissionError.message : 'Location permission is unavailable.');
        }
      }
    };

    startGps();
    return () => {
      isMounted = false;
      subscription?.remove();
    };
  }, [activeTrackingId, joined, sharingLocation, token]);

  const customerLocation = tracking?.customer.location || null;
  const nurseLocation = tracking?.nurse.location || null;
  const validCustomer = Number.isFinite(customerLocation?.lat) && Number.isFinite(customerLocation?.lng);
  const validNurse = Number.isFinite(nurseLocation?.lat) && Number.isFinite(nurseLocation?.lng);
  const center = validCustomer ? customerLocation : validNurse ? nurseLocation : null;
  const region: Region | undefined = center ? { latitude: center.lat, longitude: center.lng, latitudeDelta: 0.025, longitudeDelta: 0.025 } : undefined;

  const toggleBackgroundSharing = () => {
    if (backgroundSharing) {
      stopBackgroundTracking()
        .then(() => setBackgroundSharing(false))
        .catch((stopError) => setError(stopError instanceof Error ? stopError.message : 'Could not stop background sharing.'));
      return;
    }
    Alert.alert(
      'Share location in the background?',
      'While enabled, CareConnect sends your location to the other participant in this confirmed appointment even when you switch apps. The operating system may stop updates if you force-quit the app.',
      [
        { text: 'Not now', style: 'cancel' },
        { text: 'Continue', onPress: () => {
          if (!tracking) return;
          setError('');
          startBackgroundTracking(tracking.id)
            .then(() => setBackgroundSharing(true))
            .catch((startError) => setError(startError instanceof Error ? startError.message : 'Background tracking could not start.'));
        } }
      ]
    );
  };

  return (
    <Screen title="Live tracking" subtitle="Only the customer and nurse on this confirmed appointment can see these locations.">
      <Panel>
        <View style={sharedStyles.row}><Text style={sharedStyles.sectionTitle}>Connection</Text><Text style={styles.status}>{connectionStatus}</Text></View>
        {tracking ? <Text style={sharedStyles.muted}>Booking {tracking.bookingId} · {tracking.customer.name} and {tracking.nurse.name}</Text> : null}
        {error ? <Notice>{error}</Notice> : null}
        {tracking && joined ? <ActionButton
          title={sharingLocation ? 'Stop sharing my location' : 'Share my location'}
          secondary={!sharingLocation}
          onPress={() => { setError(''); setSharingLocation((current) => !current); }}
        /> : null}
        {tracking && joined && Platform.OS !== 'web' ? <ActionButton
          title={backgroundSharing ? 'Stop background sharing' : 'Allow background tracking'}
          secondary={!backgroundSharing}
          onPress={toggleBackgroundSharing}
        /> : null}
        {backgroundSharing ? <Text style={sharedStyles.muted}>Background location is active for this appointment.</Text> : null}
        {!tracking ? <Text style={sharedStyles.muted}>Live tracking is available during a confirmed appointment.</Text> : null}
        {tracking && !joined ? <ActivityIndicator color={colors.green} /> : null}
      </Panel>
      {tracking && region ? <MapView style={styles.map} initialRegion={region} region={region}>
        {customerLocation && validCustomer ? <Marker coordinate={{ latitude: customerLocation.lat, longitude: customerLocation.lng }} title={tracking.customer.name} description="Customer" pinColor="#146B58" /> : null}
        {nurseLocation && validNurse ? <Marker coordinate={{ latitude: nurseLocation.lat, longitude: nurseLocation.lng }} title={tracking.nurse.name} description="Nurse" pinColor="#315CC8" /> : null}
      </MapView> : tracking ? <Panel><Text style={sharedStyles.muted}>Waiting for either participant to share a GPS location.</Text></Panel> : null}
      {tracking ? <Panel>
        <Text style={sharedStyles.sectionTitle}>Participants</Text>
        <Text style={sharedStyles.body}>Customer · {customerLocation ? `${customerLocation.lat.toFixed(5)}, ${customerLocation.lng.toFixed(5)}` : 'Waiting for GPS'}</Text>
        <Text style={sharedStyles.body}>Nurse · {nurseLocation ? `${nurseLocation.lat.toFixed(5)}, ${nurseLocation.lng.toFixed(5)}` : 'Waiting for GPS'}</Text>
        <Text style={sharedStyles.muted}>Location is shared only while this screen is active and the appointment remains confirmed.</Text>
      </Panel> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  status: { color: colors.green, fontWeight: '700', textTransform: 'capitalize' },
  map: { height: 390, borderRadius: 12, overflow: 'hidden' }
});