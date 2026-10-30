export type UserRole = 'passenger' | 'driver';

export type RideStatus =
  | 'bidding'
  | 'awarded'
  | 'en_route'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

export type BidStatus = 'pending' | 'accepted' | 'rejected' | 'withdrawn';

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  avatarUrl?: string;
  rating: number;
}

export interface DriverProfile extends User {
  role: 'driver';
  plate: string;
  vehicleModel: string;
  isOnline: boolean;
  todayEarnings: number;
  todayRides: number;
  color: string;
}

export interface LocationPoint {
  lat: number;
  lng: number;
  address: string;
  neighborhood?: string;
}

export interface Ride {
  id: string;
  passengerId: string;
  passengerName: string;
  driverId?: string;
  origin: LocationPoint;
  destination: LocationPoint;
  estimatedPrice: number;
  estimatedMinutes: number;
  distanceKm: number;
  finalPrice?: number;
  acceptedBidId?: string;
  status: RideStatus;
  expiresAt: string;
  createdAt: string;
}

export interface Bid {
  id: string;
  rideId: string;
  driverId: string;
  driverName: string;
  driverRating: number;
  driverPhoto: string;
  driverColor: string;
  amount: number;
  etaMinutes: number;
  status: BidStatus;
  createdAt: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}
