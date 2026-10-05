export type UserRole = 'customer' | 'nurse' | 'admin';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  phone?: string;
  profileImageUrl?: string;
  bio?: string;
  address?: string;
  city?: string;
}

export interface Nurse {
  _id: string;
  userId: string;
  name: string;
  specialty: string;
  address: string;
  upiId: string;
  rate: number;
  status: 'available' | 'booked';
  verificationStatus: 'pending' | 'verified' | 'rejected';
  licenseNumber: string;
}

export interface Booking {
  _id: string;
  bookingId: string;
  nurseId: string;
  nurseUserId: string;
  nurseName: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  paymentUri: string;
  nurseUpiId: string;
  amount: number;
  customerPaidAmount: number;
  nursePayout: number;
  paymentReference: string;
  paymentStatus: 'not_generated' | 'pending' | 'reported' | 'paid';
  paymentVerifiedAt?: string;
  paymentMethod: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  createdAt: string;
}

export interface TreatmentNote {
  id: string;
  bookingId: string;
  nurseName: string;
  text: string;
  createdAt: string;
}

export interface LocationPoint {
  lat: number;
  lng: number;
  accuracy?: number | null;
  heading?: number | null;
  speed?: number | null;
  updatedAt?: string;
}

export interface TrackingState {
  id: string;
  bookingId: string;
  status: string;
  customer: { id: string; name: string; address: string; location: LocationPoint | null };
  nurse: { id: string; name: string; location: LocationPoint | null };
}