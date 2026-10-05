import { useCallback, useState } from 'react';
import { Alert, Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Redirect, useFocusEffect } from 'expo-router';
import * as Location from 'expo-location';
import QRCode from 'react-native-qrcode-svg';

import { ActionButton, Field, Notice, Panel, Screen, StatusTag, sharedStyles } from '../../components/ui';
import { apiRequest } from '../../lib/api';
import { colors } from '../../lib/theme';
import { useAuth } from '../../providers/AuthProvider';
import type { Booking, Nurse } from '../../types/domain';

interface CustomerDashboardData {
  bookings: Booking[];
  availableNurses: Nurse[];
  nurseDirectory: Nurse[];
}

interface NurseDashboardData {
  nurse: Nurse;
  bookings: Booking[];
  earnings: { daily: Record<string, number>; monthly: Record<string, number>; yearly: Record<string, number> };
}

export default function DashboardRoute() {
  const { user } = useAuth();
  if (user?.role === 'admin') return <Redirect href="/(app)/admin" />;
  if (user?.role === 'nurse') return <NurseDashboard />;
  return <CustomerDashboard />;
}

function CustomerDashboard() {
  const { token, user } = useAuth();
  const [data, setData] = useState<CustomerDashboardData>({ bookings: [], availableNurses: [], nurseDirectory: [] });
  const [selectedNurse, setSelectedNurse] = useState<Nurse | null>(null);
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerPhone, setCustomerPhone] = useState(user?.phone || '');
  const [paymentReference, setPaymentReference] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    const payload = await apiRequest<CustomerDashboardData>('/dashboard/customer', { token });
    setData(payload);
  }, [token]);

  useFocusEffect(useCallback(() => {
    load().catch((loadError) => setError(loadError.message));
    const timer = setInterval(() => load().catch(() => {}), 10000);
    return () => clearInterval(timer);
  }, [load]));

  const bookNurse = async () => {
    if (!selectedNurse || customerAddress.trim().length < 5) {
      setError('Enter the appointment address.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) throw new Error('Allow location access to create the appointment.');
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const checkout = await apiRequest<{ booking: Booking }>('/bookings/checkout', {
        method: 'POST',
        token,
        body: JSON.stringify({
          nurseId: selectedNurse._id,
          customerPhone,
          customerAddress: customerAddress.trim(),
          customerLocation: `${position.coords.latitude}, ${position.coords.longitude}`
        })
      });
      await apiRequest('/bookings/confirm', {
        method: 'POST',
        token,
        body: JSON.stringify({ bookingId: checkout.booking.bookingId, paymentMethod: 'Direct UPI' })
      });
      setNotice(`Appointment booked with ${selectedNurse.name}.`);
      setSelectedNurse(null);
      setCustomerAddress('');
      await load();
    } catch (bookError) {
      setError(bookError instanceof Error ? bookError.message : 'Could not book this nurse.');
    } finally {
      setSubmitting(false);
    }
  };

  const reportPayment = async (booking: Booking) => {
    setSubmitting(true);
    setError('');
    try {
      await apiRequest(`/dashboard/customer/bookings/${booking._id}/payment-report`, {
        method: 'POST',
        token,
        body: JSON.stringify({ paymentReference })
      });
      setPaymentReference('');
      setNotice('Payment reference sent to the nurse for verification.');
      await load();
    } catch (reportError) {
      setError(reportError instanceof Error ? reportError.message : 'Could not report the payment.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen title="Find care" subtitle="Book a verified nurse and coordinate your appointment.">
      {notice ? <Notice tone="success">{notice}</Notice> : null}
      {error ? <Notice>{error}</Notice> : null}
      <View style={sharedStyles.row}><Text style={sharedStyles.sectionTitle}>Available nurses</Text><StatusTag>{data.availableNurses.length} available</StatusTag></View>
      {data.availableNurses.length ? data.availableNurses.map((nurse) => (
        <Panel key={nurse._id}>
          <View style={sharedStyles.row}><Text style={styles.cardTitle}>{nurse.name}</Text><StatusTag tone="success">Verified</StatusTag></View>
          <Text style={sharedStyles.muted}>{nurse.specialty} · ₹{nurse.rate} per visit</Text>
          <Text style={sharedStyles.muted}>{nurse.address}</Text>
          <ActionButton title="Book this nurse" secondary onPress={() => { setError(''); setSelectedNurse(nurse); }} />
        </Panel>
      )) : <Panel><Text style={sharedStyles.muted}>No nurses are available right now.</Text></Panel>}

      <Text style={sharedStyles.sectionTitle}>Appointments</Text>
      {data.bookings.length ? data.bookings.map((booking) => (
        <Panel key={booking._id}>
          <View style={sharedStyles.row}><Text style={styles.cardTitle}>{booking.nurseName}</Text><StatusTag tone={booking.status === 'confirmed' ? 'success' : 'warning'}>{booking.status}</StatusTag></View>
          <Text style={sharedStyles.muted}>{booking.customerAddress}</Text>
          {booking.paymentUri ? <BookingPayment booking={booking} reference={paymentReference} onReferenceChange={setPaymentReference} onReport={() => reportPayment(booking)} busy={submitting} /> : <Text style={sharedStyles.muted}>Waiting for the nurse to prepare the direct UPI bill.</Text>}
        </Panel>
      )) : <Panel><Text style={sharedStyles.muted}>Your appointments will appear here.</Text></Panel>}

      <Modal visible={Boolean(selectedNurse)} transparent animationType="slide" onRequestClose={() => setSelectedNurse(null)}>
        <View style={styles.modalShade}><View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Book {selectedNurse?.name}</Text>
          <Text style={sharedStyles.muted}>₹{selectedNurse?.rate} per visit</Text>
          <Field label="Phone" value={customerPhone} onChangeText={setCustomerPhone} keyboardType="phone-pad" />
          <Field label="Appointment address" value={customerAddress} onChangeText={setCustomerAddress} multiline numberOfLines={3} />
          {error ? <Notice>{error}</Notice> : null}
          <ActionButton title="Confirm appointment" onPress={bookNurse} loading={submitting} />
          <ActionButton title="Cancel" secondary onPress={() => setSelectedNurse(null)} />
        </View></View>
      </Modal>
    </Screen>
  );
}

function BookingPayment({ booking, reference, onReferenceChange, onReport, busy }: {
  booking: Booking;
  reference: string;
  onReferenceChange: (value: string) => void;
  onReport: () => void;
  busy: boolean;
}) {
  const openUpiApp = async () => {
    try {
      await Linking.openURL(booking.paymentUri);
    } catch {
      Alert.alert('No UPI app found', 'Scan the QR code with a UPI app on another device.');
    }
  };

  if (booking.paymentStatus === 'paid') return (
    <View style={styles.paymentState}>
      <StatusTag tone="success">Nurse confirmed receipt</StatusTag>
      <Text style={sharedStyles.muted}>₹{booking.customerPaidAmount} · Reference {booking.paymentReference}</Text>
      <Text style={sharedStyles.muted}>Verified {booking.paymentVerifiedAt ? new Date(booking.paymentVerifiedAt).toLocaleString() : 'by nurse'}</Text>
    </View>
  );
  if (booking.paymentStatus === 'reported') return (
    <View style={styles.paymentState}>
      <StatusTag tone="warning">Awaiting nurse verification</StatusTag>
      <Text style={sharedStyles.muted}>Submitted reference: {booking.paymentReference}</Text>
    </View>
  );

  return (
    <View style={styles.paymentState}>
      <Text style={styles.cardTitle}>Pay ₹{booking.customerPaidAmount}</Text>
      <Text style={sharedStyles.muted}>To {booking.nurseName} · {booking.nurseUpiId}</Text>
      <View style={styles.qrWrap}><QRCode value={booking.paymentUri} size={190} /></View>
      <ActionButton title="Open a UPI app" secondary onPress={openUpiApp} />
      <Text style={sharedStyles.muted}>After paying, enter the transaction reference. The nurse must verify receipt.</Text>
      <Field label="UPI transaction reference" value={reference} onChangeText={onReferenceChange} autoCapitalize="characters" />
      <ActionButton title="Report payment" onPress={onReport} disabled={reference.trim().length < 6} loading={busy} />
    </View>
  );
}

function NurseDashboard() {
  const { token } = useAuth();
  const [data, setData] = useState<NurseDashboardData | null>(null);
  const [rate, setRate] = useState('');
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [earningsRange, setEarningsRange] = useState<'daily' | 'monthly' | 'yearly'>('monthly');

  const load = useCallback(async () => {
    const payload = await apiRequest<NurseDashboardData>('/dashboard/nurse', { token });
    setData(payload);
    setRate(String(payload.nurse.rate));
  }, [token]);

  useFocusEffect(useCallback(() => {
    load().catch((loadError) => setError(loadError.message));
    const timer = setInterval(() => load().catch(() => {}), 10000);
    return () => clearInterval(timer);
  }, [load]));

  const setAvailability = async () => {
    if (!data) return;
    setError('');
    try {
      const nextStatus = data.nurse.status === 'available' ? 'booked' : 'available';
      await apiRequest('/dashboard/nurse/status', { method: 'PUT', token, body: JSON.stringify({ status: nextStatus }) });
      await load();
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : 'Could not update availability.');
    }
  };

  const updateRate = async () => {
    setError('');
    try {
      await apiRequest('/dashboard/nurse/rate', { method: 'PUT', token, body: JSON.stringify({ rate: Number(rate) }) });
      setNotice('Rate updated.');
      await load();
    } catch (rateError) {
      setError(rateError instanceof Error ? rateError.message : 'Could not update the rate.');
    }
  };

  const completeAppointment = async (booking: Booking) => {
    setBusyId(booking._id);
    setError('');
    try {
      await apiRequest(`/dashboard/nurse/bookings/${booking._id}/complete`, { method: 'PUT', token });
      setNotice('Appointment marked complete.');
      await load();
    } catch (completeError) {
      setError(completeError instanceof Error ? completeError.message : 'Could not complete the appointment.');
    } finally {
      setBusyId('');
    }
  };

  const sendBill = async (booking: Booking) => {
    setBusyId(booking._id);
    setError('');
    try {
      const payload = await apiRequest<{ payment: { amount: number; recipientUpiId: string }; message: string }>(`/dashboard/nurse/bookings/${booking._id}/bill`, { method: 'POST', token });
      setNotice(`UPI bill created for ₹${payload.payment.amount} to ${payload.payment.recipientUpiId}.`);
      await load();
    } catch (billError) {
      setError(billError instanceof Error ? billError.message : 'Could not generate the bill.');
    } finally {
      setBusyId('');
    }
  };

  const reviewPayment = async (booking: Booking, decision: 'confirm' | 'reject') => {
    const endpoint = decision === 'confirm' ? 'payment-confirm' : 'payment-reject';
    setBusyId(booking._id);
    setError('');
    try {
      const payload = await apiRequest<{ message: string }>(`/dashboard/nurse/bookings/${booking._id}/${endpoint}`, { method: 'POST', token });
      setNotice(payload.message);
      await load();
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : 'Could not review payment.');
    } finally {
      setBusyId('');
    }
  };

  const sendTreatmentNote = async (booking: Booking) => {
    const text = String(noteDrafts[booking._id] || '').trim();
    if (text.length < 3) return setError('Treatment note must be at least 3 characters.');
    setBusyId(booking._id);
    setError('');
    try {
      const payload = await apiRequest<{ message: string }>(`/dashboard/nurse/bookings/${booking._id}/treatment-notes`, { method: 'POST', token, body: JSON.stringify({ text }) });
      setNoteDrafts((current) => ({ ...current, [booking._id]: '' }));
      setNotice(payload.message);
    } catch (noteError) {
      setError(noteError instanceof Error ? noteError.message : 'Could not send treatment note.');
    } finally {
      setBusyId('');
    }
  };

  if (!data) return <Screen title="My work"><Text style={sharedStyles.muted}>Loading nurse dashboard…</Text>{error ? <Notice>{error}</Notice> : null}</Screen>;
  return (
    <Screen title={`Good day, ${data.nurse.name.split(' ')[0]}`} subtitle="Manage appointments, direct UPI bills, and visit notes.">
      {notice ? <Notice tone="success">{notice}</Notice> : null}{error ? <Notice>{error}</Notice> : null}
      <Panel>
        <View style={sharedStyles.row}><View><Text style={styles.cardTitle}>{data.nurse.name}</Text><Text style={sharedStyles.muted}>UPI · {data.nurse.upiId}</Text></View><StatusTag tone={data.nurse.status === 'available' ? 'success' : 'warning'}>{data.nurse.status}</StatusTag></View>
        <ActionButton title={data.nurse.status === 'available' ? 'Set unavailable' : 'Set available'} secondary onPress={setAvailability} />
        <Field label="Visit rate (₹)" value={rate} onChangeText={setRate} keyboardType="decimal-pad" editable={data.nurse.status !== 'available'} />
        <ActionButton title="Update rate" secondary onPress={updateRate} disabled={data.nurse.status === 'available'} />
        {data.nurse.status === 'available' ? <Text style={sharedStyles.muted}>Set unavailable before changing your visit rate.</Text> : null}
      </Panel>
      <Panel>
        <View style={sharedStyles.row}><Text style={sharedStyles.sectionTitle}>Verified earnings</Text><Text style={styles.cardTitle}>₹{Object.values(data.earnings[earningsRange] || {}).reduce((sum, value) => sum + value, 0).toFixed(2)}</Text></View>
        <View style={styles.buttonRow}>{(['daily', 'monthly', 'yearly'] as const).map((value) => <Pressable key={value} onPress={() => setEarningsRange(value)} style={[styles.rangeOption, earningsRange === value && styles.rangeSelected]}><Text style={[styles.rangeText, earningsRange === value && styles.rangeTextSelected]}>{value}</Text></Pressable>)}</View>
        {Object.entries(data.earnings[earningsRange] || {}).sort(([first], [second]) => second.localeCompare(first)).slice(0, 7).map(([period, amount]) => <View key={period} style={sharedStyles.row}><Text style={sharedStyles.muted}>{period}</Text><Text style={sharedStyles.body}>₹{amount.toFixed(2)}</Text></View>)}
        <Text style={sharedStyles.muted}>Only nurse-confirmed UPI receipts are included.</Text>
      </Panel>
      <Text style={sharedStyles.sectionTitle}>Work history · {data.bookings.length}</Text>
      {data.bookings.map((booking) => (
        <Panel key={booking._id}>
          <View style={sharedStyles.row}><Text style={styles.cardTitle}>{booking.customerName}</Text><StatusTag>{booking.status}</StatusTag></View>
          <Text style={sharedStyles.muted}>{booking.customerAddress} · {booking.customerPhone}</Text>
          <Text style={sharedStyles.muted}>{booking.paymentStatus === 'paid' ? `₹${booking.nursePayout} received` : booking.paymentStatus === 'reported' ? 'Customer reported payment' : 'Payment pending'}</Text>
          {booking.paymentStatus === 'reported' ? <>
            <Text style={sharedStyles.muted}>UPI reference: {booking.paymentReference}. Check your bank/UPI app before confirming.</Text>
            <View style={styles.buttonRow}><ActionButton title="Confirm received" onPress={() => reviewPayment(booking, 'confirm')} loading={busyId === booking._id} /><ActionButton title="Reject" secondary onPress={() => reviewPayment(booking, 'reject')} /></View>
          </> : null}
          {booking.status === 'confirmed' && !['reported', 'paid'].includes(booking.paymentStatus) ? <ActionButton title={booking.paymentUri ? 'View UPI bill' : 'Generate UPI bill'} secondary onPress={() => sendBill(booking)} loading={busyId === booking._id} /> : null}
          {['confirmed', 'completed'].includes(booking.status) ? <>
            {booking.status === 'confirmed' ? <ActionButton title="Mark appointment complete" secondary onPress={() => completeAppointment(booking)} loading={busyId === booking._id} /> : null}
            <Field label="Treatment note" value={noteDrafts[booking._id] || ''} onChangeText={(text) => setNoteDrafts((current) => ({ ...current, [booking._id]: text }))} multiline numberOfLines={3} maxLength={4000} />
            <ActionButton title="Send note to customer" secondary onPress={() => sendTreatmentNote(booking)} loading={busyId === booking._id} />
            <Text style={sharedStyles.muted}>The customer app must be open. Notes are relayed temporarily and stored locally on the customer device.</Text>
          </> : null}
        </Panel>
      ))}
      {!data.bookings.length ? <Panel><Text style={sharedStyles.muted}>New appointments will appear here.</Text></Panel> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  cardTitle: { color: colors.ink, fontSize: 16, fontWeight: '700', flexShrink: 1 },
  modalShade: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#13201D77' },
  modalCard: { gap: 14, padding: 20, paddingBottom: 32, borderTopLeftRadius: 18, borderTopRightRadius: 18, backgroundColor: colors.canvas },
  modalTitle: { color: colors.ink, fontSize: 21, fontWeight: '800' },
  paymentState: { gap: 10, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.line },
  qrWrap: { alignSelf: 'center', padding: 12, backgroundColor: colors.paper, borderRadius: 12 },
  buttonRow: { flexDirection: 'row', gap: 10 },
  rangeOption: { paddingHorizontal: 11, paddingVertical: 7, borderRadius: 20, backgroundColor: '#E9EEEC' },
  rangeSelected: { backgroundColor: colors.greenSoft },
  rangeText: { color: colors.muted, textTransform: 'capitalize', fontSize: 12, fontWeight: '600' },
  rangeTextSelected: { color: colors.green }
});