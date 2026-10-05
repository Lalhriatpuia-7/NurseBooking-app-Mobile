import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { Redirect, useFocusEffect, useRouter } from 'expo-router';

import { ActionButton, Notice, Panel, Screen, StatusTag, sharedStyles } from '../../components/ui';
import { apiRequest } from '../../lib/api';
import { colors } from '../../lib/theme';
import { useAuth } from '../../providers/AuthProvider';
import type { Nurse, User } from '../../types/domain';

interface AdminDashboardData {
  summary: { totalUsers: number; totalCustomers: number; totalNurses: number; totalBookings: number };
  nurses: (Nurse & { email: string; phone: string })[];
  users: (User & { _id: string; isActive: boolean; createdAt: string })[];
}

export default function AdminRoute() {
  const { token, user, signOut } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<AdminDashboardData | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'verified' | 'rejected'>('pending');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyId, setBusyId] = useState('');

  const load = useCallback(async () => {
    const payload = await apiRequest<AdminDashboardData>('/dashboard/admin', { token });
    setData(payload);
  }, [token]);

  useFocusEffect(useCallback(() => {
    load().catch((loadError) => setError(loadError.message));
    const timer = setInterval(() => load().catch(() => {}), 15000);
    return () => clearInterval(timer);
  }, [load]));

  if (user?.role !== 'admin') return <Redirect href="/(app)" />;
  if (!data) return <Screen title="Administration"><Text style={sharedStyles.muted}>Loading platform data…</Text>{error ? <Notice>{error}</Notice> : null}</Screen>;

  const updateVerification = async (nurse: Nurse, verificationStatus: Nurse['verificationStatus']) => {
    setBusyId(nurse._id);
    setError('');
    try {
      await apiRequest(`/nurses/${nurse._id}/verification`, { method: 'PUT', token, body: JSON.stringify({ verificationStatus }) });
      setNotice(`${nurse.name} marked ${verificationStatus}.`);
      await load();
    } catch (verifyError) {
      setError(verifyError instanceof Error ? verifyError.message : 'Could not update verification.');
    } finally {
      setBusyId('');
    }
  };

  const toggleAccount = async (account: AdminDashboardData['users'][number]) => {
    setBusyId(account._id);
    setError('');
    try {
      await apiRequest(`/dashboard/admin/users/${account._id}/status`, { method: 'PUT', token, body: JSON.stringify({ isActive: !account.isActive }) });
      setNotice(`${account.name}'s account ${account.isActive ? 'disabled' : 'enabled'}.`);
      await load();
    } catch (accountError) {
      setError(accountError instanceof Error ? accountError.message : 'Could not update the account.');
    } finally {
      setBusyId('');
    }
  };

  const nurses = data.nurses.filter((nurse) => filter === 'all' || nurse.verificationStatus === filter);

  return (
    <Screen title="Administration" subtitle="Review nurse credentials and manage account access.">
      {notice ? <Notice tone="success">{notice}</Notice> : null}{error ? <Notice>{error}</Notice> : null}
      <View style={sharedStyles.row}>
        {[
          ['Users', data.summary.totalUsers],
          ['Nurses', data.summary.totalNurses],
          ['Bookings', data.summary.totalBookings]
        ].map(([label, value]) => <Panel key={String(label)}><Text style={styles.metricValue}>{value}</Text><Text style={sharedStyles.muted}>{label}</Text></Panel>)}
      </View>
      <Text style={sharedStyles.sectionTitle}>Nurse approvals</Text>
      <View style={styles.filters}>
        {(['pending', 'verified', 'rejected', 'all'] as const).map((value) => <Text key={value} onPress={() => setFilter(value)} style={[styles.filter, filter === value && styles.filterSelected]}>{value}</Text>)}
      </View>
      {nurses.map((nurse) => <Panel key={nurse._id}>
        <View style={sharedStyles.row}><Text style={styles.cardTitle}>{nurse.name}</Text><StatusTag tone={nurse.verificationStatus === 'verified' ? 'success' : nurse.verificationStatus === 'pending' ? 'warning' : 'neutral'}>{nurse.verificationStatus}</StatusTag></View>
        <Text style={sharedStyles.muted}>{nurse.specialty} · {nurse.licenseNumber}</Text>
        <Text style={sharedStyles.muted}>{nurse.email} · UPI {nurse.upiId || 'missing'}</Text>
        {nurse.verificationStatus !== 'verified' ? <ActionButton title="Verify nurse" onPress={() => updateVerification(nurse, 'verified')} loading={busyId === nurse._id} /> : null}
        {nurse.verificationStatus !== 'rejected' ? <ActionButton title="Reject nurse" secondary onPress={() => updateVerification(nurse, 'rejected')} loading={busyId === nurse._id} /> : null}
      </Panel>)}
      {!nurses.length ? <Panel><Text style={sharedStyles.muted}>No nurses match this status.</Text></Panel> : null}
      <Text style={sharedStyles.sectionTitle}>Accounts</Text>
      {data.users.map((account) => <Panel key={account._id}>
        <View style={sharedStyles.row}><Text style={styles.cardTitle}>{account.name}</Text><StatusTag tone={account.isActive ? 'success' : 'warning'}>{account.isActive ? 'active' : 'disabled'}</StatusTag></View>
        <Text style={sharedStyles.muted}>{account.role} · {account.email}</Text>
        <ActionButton title={account.isActive ? 'Disable account' : 'Enable account'} secondary disabled={account._id === user.id} loading={busyId === account._id} onPress={() => toggleAccount(account)} />
      </Panel>)}
      <ActionButton title="Sign out" secondary onPress={() => signOut().then(() => router.replace('/auth')).catch((signOutError) => setError(signOutError.message))} />
    </Screen>
  );
}

const styles = {
  metricValue: { color: colors.green, fontSize: 23, fontWeight: '800' as const },
  filters: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 8 },
  filter: { overflow: 'hidden' as const, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 18, backgroundColor: '#E9EEEC', color: colors.muted, textTransform: 'capitalize' as const, fontWeight: '600' as const },
  filterSelected: { backgroundColor: colors.greenSoft, color: colors.green },
  cardTitle: { color: colors.ink, fontSize: 16, fontWeight: '700' as const }
};