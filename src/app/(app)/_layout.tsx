import { Redirect, Tabs } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '../../providers/AuthProvider';
import { apiRequest } from '../../lib/api';
import { saveLocalTreatmentNote } from '../../lib/localNotes';
import { colors } from '../../lib/theme';
import type { TreatmentNote } from '../../types/domain';

export default function AppLayout() {
  const { user, token, isReady } = useAuth();
  const [noteDeliveryMessage, setNoteDeliveryMessage] = useState('');
  const pollRunning = useRef(false);
  const [activeTabTitle, setActiveTabTitle] = useState('CareConnect');

  useEffect(() => {
    if (!user || !token || user.role !== 'customer') return undefined;
    let isMounted = true;

    const receiveNotes = async () => {
      if (pollRunning.current) return;
      pollRunning.current = true;
      try {
        const payload = await apiRequest<{ notes: TreatmentNote[] }>('/dashboard/customer/treatment-notes/inbox', { token });
        if (!payload.notes.length) return;
        for (const note of payload.notes) await saveLocalTreatmentNote(user.id, note);
        await apiRequest('/dashboard/customer/treatment-notes/acknowledge', {
          method: 'POST',
          token,
          body: JSON.stringify({ noteIds: payload.notes.map((note) => note.id) })
        });
        if (isMounted) setNoteDeliveryMessage(`${payload.notes.length} treatment note${payload.notes.length === 1 ? '' : 's'} saved on this device.`);
      } catch {
        if (isMounted) setNoteDeliveryMessage('Could not securely save a treatment note. Keep the app open and check device storage.');
      } finally {
        pollRunning.current = false;
      }
    };

    receiveNotes();
    const timer = setInterval(receiveNotes, 5000);
    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, [token, user]);

  const onTabPress = useCallback((title: string) => setActiveTabTitle(title), []);

  if (!isReady) return <View style={styles.loading}><ActivityIndicator color={colors.green} size="large" /></View>;
  if (!user) return <Redirect href="/auth" />;

  return (
    <View style={styles.container}>
      <Tabs screenOptions={{
        headerTitle: activeTabTitle,
        headerStyle: { backgroundColor: colors.paper },
        headerTitleStyle: { color: colors.ink, fontWeight: '700' },
        tabBarActiveTintColor: colors.green,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.paper, borderTopColor: colors.line },
        sceneStyle: { backgroundColor: colors.canvas }
      }}>
        <Tabs.Screen name="index" options={{ title: user.role === 'nurse' ? 'My work' : user.role === 'admin' ? 'Overview' : 'CareConnect' }} listeners={{ tabPress: () => onTabPress(user.role === 'nurse' ? 'My work' : user.role === 'admin' ? 'Overview' : 'CareConnect') }} />
        <Tabs.Screen name="tracking" options={{ title: 'Tracking', href: user.role === 'admin' ? null : undefined }} listeners={{ tabPress: () => onTabPress('Tracking') }} />
        <Tabs.Screen name="notes" options={{ title: 'Notes', href: user.role === 'admin' ? null : undefined }} listeners={{ tabPress: () => onTabPress(user.role === 'nurse' ? 'Shared notes' : 'Treatment notes') }} />
        <Tabs.Screen name="profile" options={{ title: 'Profile', href: user.role === 'admin' ? null : undefined }} listeners={{ tabPress: () => onTabPress('Profile') }} />
        <Tabs.Screen name="admin" options={{ title: 'Administration', href: user.role === 'admin' ? undefined : null }} listeners={{ tabPress: () => onTabPress('Administration') }} />
      </Tabs>
      {noteDeliveryMessage ? <View style={styles.deliveryBanner}><Text style={styles.deliveryText}>{noteDeliveryMessage}</Text></View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.canvas },
  deliveryBanner: { paddingHorizontal: 14, paddingVertical: 9, backgroundColor: colors.greenSoft, borderTopWidth: 1, borderColor: colors.line },
  deliveryText: { color: colors.green, fontSize: 12, fontWeight: '600', textAlign: 'center' }
});