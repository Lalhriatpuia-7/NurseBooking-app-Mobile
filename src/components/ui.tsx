import type { ReactNode } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '../lib/theme';

export function Screen({ children, title, subtitle, scroll = true }: { children: ReactNode; title?: string; subtitle?: string; scroll?: boolean }) {
  const content = (
    <View style={styles.content}>
      {title ? <View style={styles.heading}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View> : null}
      {children}
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {scroll ? <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll}>{content}</ScrollView> : content}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        placeholderTextColor="#87938F"
        style={styles.input}
        autoCapitalize={props.keyboardType === 'email-address' ? 'none' : props.autoCapitalize || 'sentences'}
        {...props}
      />
    </View>
  );
}

export function ActionButton({ title, onPress, disabled = false, secondary = false, loading = false }: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  secondary?: boolean;
  loading?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [styles.button, secondary && styles.secondaryButton, (pressed || disabled || loading) && styles.buttonDim]}
    >
      {loading ? <ActivityIndicator color={secondary ? colors.green : colors.paper} /> : <Text style={[styles.buttonText, secondary && styles.secondaryButtonText]}>{title}</Text>}
    </Pressable>
  );
}

export function Panel({ children }: { children: ReactNode }) {
  return <View style={styles.panel}>{children}</View>;
}

export function Notice({ children, tone = 'error' }: { children: ReactNode; tone?: 'error' | 'success' | 'warning' }) {
  const toneStyle = tone === 'success' ? styles.successNotice : tone === 'warning' ? styles.warningNotice : styles.errorNotice;
  return <View accessibilityRole="alert" style={[styles.notice, toneStyle]}><Text style={styles.noticeText}>{children}</Text></View>;
}

export function StatusTag({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'success' | 'warning' }) {
  const toneStyle = tone === 'success' ? styles.successTag : tone === 'warning' ? styles.warningTag : styles.neutralTag;
  return <View style={[styles.tag, toneStyle]}><Text style={styles.tagText}>{children}</Text></View>;
}

export const sharedStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  sectionTitle: { color: colors.ink, fontSize: 18, fontWeight: '700' },
  body: { color: colors.ink, fontSize: 15, lineHeight: 22 },
  muted: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  spacer: { height: 14 }
});

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: colors.canvas },
  scroll: { flexGrow: 1 },
  content: { width: '100%', maxWidth: 680, alignSelf: 'center', padding: 20, gap: 16 },
  heading: { gap: 6, paddingTop: 10, paddingBottom: 4 },
  title: { color: colors.ink, fontSize: 28, fontWeight: '800' },
  subtitle: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  field: { gap: 7 },
  fieldLabel: { color: colors.ink, fontSize: 13, fontWeight: '700' },
  input: { minHeight: 48, borderWidth: 1, borderColor: colors.line, borderRadius: 10, paddingHorizontal: 13, paddingVertical: 11, backgroundColor: colors.paper, color: colors.ink, fontSize: 15 },
  button: { minHeight: 48, paddingHorizontal: 16, borderRadius: 10, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.green },
  secondaryButton: { backgroundColor: colors.greenSoft, borderWidth: 1, borderColor: '#B8DACE' },
  buttonDim: { opacity: 0.65 },
  buttonText: { color: colors.paper, fontSize: 15, fontWeight: '700' },
  secondaryButtonText: { color: colors.green },
  panel: { gap: 12, padding: 16, backgroundColor: colors.paper, borderRadius: 12, borderWidth: 1, borderColor: colors.line },
  notice: { padding: 12, borderRadius: 9, borderWidth: 1 },
  noticeText: { color: colors.ink, fontSize: 13, lineHeight: 18 },
  errorNotice: { backgroundColor: colors.redSoft, borderColor: '#EBC6C6' },
  successNotice: { backgroundColor: colors.greenSoft, borderColor: '#B8DACE' },
  warningNotice: { backgroundColor: colors.amberSoft, borderColor: '#E7D4A6' },
  tag: { alignSelf: 'flex-start', borderRadius: 100, paddingHorizontal: 10, paddingVertical: 5 },
  tagText: { fontSize: 12, fontWeight: '700', color: colors.ink, textTransform: 'capitalize' },
  neutralTag: { backgroundColor: '#E9EEEC' },
  successTag: { backgroundColor: colors.greenSoft },
  warningTag: { backgroundColor: colors.amberSoft }
});