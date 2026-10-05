import { useState } from 'react';
import { Redirect } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ActionButton, Field, Notice, Screen } from '../components/ui';
import { colors } from '../lib/theme';
import { useAuth } from '../providers/AuthProvider';
import type { UserRole } from '../types/domain';

type AuthMode = 'login' | 'register';
const validUpiId = (value: string) => /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}@[A-Za-z0-9][A-Za-z0-9.-]{0,63}$/.test(value.trim());

export default function AuthRoute() {
  const { user, isReady, startupError, signIn, signUp } = useAuth();
  const [mode, setMode] = useState<AuthMode>('login');
  const [role, setRole] = useState<UserRole>('customer');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [upiId, setUpiId] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (isReady && user) return <Redirect href="/(app)" />;

  const submit = async () => {
    setError('');
    if (!email.trim() || !/^\S+@\S+\.\S+$/.test(email.trim())) return setError('Enter a valid email address.');
    if (password.length < (mode === 'register' ? 8 : 1)) return setError('Password must contain at least 8 characters.');
    if (mode === 'register' && name.trim().length < 2) return setError('Enter your name.');
    if (mode === 'register' && role === 'nurse') {
      if (licenseNumber.trim().length < 3) return setError('Enter your nurse license number.');
      if (!validUpiId(upiId)) return setError('upi not found, please enter valid upi');
    }

    setBusy(true);
    try {
      if (mode === 'login') {
        await signIn(email, password, role);
      } else {
        await signUp({
          name,
          email,
          password,
          role: role as 'customer' | 'nurse',
          phone,
          licenseNumber: role === 'nurse' ? licenseNumber : undefined,
          upiId: role === 'nurse' ? upiId : undefined
        });
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Could not sign in.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen title="CareConnect" subtitle="Care visits, payments, and follow-up in one secure place.">
      {startupError ? <Notice tone="warning">{startupError}</Notice> : null}
      <PanelHeader mode={mode} onModeChange={(nextMode) => { setMode(nextMode); setError(''); }} />
      <View style={styles.roleRow}>
        {(mode === 'login' ? ['customer', 'nurse', 'admin'] as UserRole[] : ['customer', 'nurse'] as UserRole[]).map((value) => (
          <Pressable key={value} onPress={() => setRole(value)} style={[styles.roleOption, role === value && styles.roleSelected]}>
            <Text style={[styles.roleText, role === value && styles.roleTextSelected]}>{value}</Text>
          </Pressable>
        ))}
      </View>
      {mode === 'register' ? <Field label="Full name" value={name} onChangeText={setName} autoComplete="name" /> : null}
      {mode === 'register' ? <Field label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoComplete="tel" /> : null}
      {mode === 'register' && role === 'nurse' ? <Field label="Nurse license number" value={licenseNumber} onChangeText={setLicenseNumber} autoCapitalize="characters" /> : null}
      {mode === 'register' && role === 'nurse' ? <Field label="UPI ID" value={upiId} onChangeText={setUpiId} autoCapitalize="none" autoCorrect={false} /> : null}
      <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoComplete="email" autoCapitalize="none" />
      <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
      {error ? <Notice>{error}</Notice> : null}
      <ActionButton title={mode === 'login' ? 'Sign in' : 'Create account'} onPress={submit} loading={busy} />
    </Screen>
  );
}

function PanelHeader({ mode, onModeChange }: { mode: AuthMode; onModeChange: (mode: AuthMode) => void }) {
  return (
    <View style={styles.modeRow}>
      {(['login', 'register'] as AuthMode[]).map((value) => (
        <Pressable key={value} onPress={() => onModeChange(value)} style={[styles.modeButton, mode === value && styles.modeButtonActive]}>
          <Text style={[styles.modeText, mode === value && styles.modeTextActive]}>{value === 'login' ? 'Sign in' : 'Create account'}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  modeRow: { flexDirection: 'row', padding: 4, backgroundColor: '#E8EFEC', borderRadius: 11 },
  modeButton: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 40, borderRadius: 8 },
  modeButtonActive: { backgroundColor: colors.paper },
  modeText: { color: colors.muted, fontWeight: '600' },
  modeTextActive: { color: colors.ink },
  roleRow: { flexDirection: 'row', gap: 8 },
  roleOption: { flex: 1, minHeight: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 9, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper },
  roleSelected: { borderColor: colors.green, backgroundColor: colors.greenSoft },
  roleText: { color: colors.muted, fontWeight: '600', textTransform: 'capitalize' },
  roleTextSelected: { color: colors.green }
});