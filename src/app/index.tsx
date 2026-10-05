import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useAuth } from '../providers/AuthProvider';
import { colors } from '../lib/theme';

export default function IndexRoute() {
  const { user, isReady } = useAuth();
  if (!isReady) return <View style={styles.loading}><ActivityIndicator color={colors.green} size="large" /></View>;
  return <Redirect href={user ? '/(app)' : '/auth'} />;
}

const styles = StyleSheet.create({ loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.canvas } });