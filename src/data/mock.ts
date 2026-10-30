import { avatarDataUri } from '../utils/format';
import type { DriverProfile, Ride, User } from '../types';

export const mockPassenger: User = {
  id: 'usr_pass_01',
  name: 'Ana Ribeiro',
  email: 'ana@vaimoto.app',
  phone: '(11) 98888-1010',
  role: 'passenger',
  rating: 4.9,
};

export const mockDriver: DriverProfile = {
  id: 'usr_drv_01',
  name: 'Carlos Mendes',
  email: 'carlos@vaimoto.app',
  phone: '(11) 97777-2020',
  role: 'driver',
  rating: 4.8,
  plate: 'MOTO-7X21',
  vehicleModel: 'Honda CG 160',
  isOnline: true,
  todayEarnings: 186.5,
  todayRides: 9,
  color: '#FF6B00',
  avatarUrl: avatarDataUri('Carlos Mendes', '#FF6B00'),
};

export const mockDrivers: DriverProfile[] = [
  mockDriver,
  {
    id: 'usr_drv_02',
    name: 'Lucas Ferreira',
    email: 'lucas@vaimoto.app',
    phone: '(11) 97777-3030',
    role: 'driver',
    rating: 4.7,
    plate: 'MOTO-4K18',
    vehicleModel: 'Yamaha Factor 150',
    isOnline: true,
    todayEarnings: 142,
    todayRides: 7,
    color: '#1A1A2E',
    avatarUrl: avatarDataUri('Lucas Ferreira', '#1A1A2E'),
  },
  {
    id: 'usr_drv_03',
    name: 'Fernanda Souza',
    email: 'fernanda@vaimoto.app',
    phone: '(11) 97777-4040',
    role: 'driver',
    rating: 4.95,
    plate: 'MOTO-9P33',
    vehicleModel: 'Honda Biz 125',
    isOnline: true,
    todayEarnings: 210,
    todayRides: 11,
    color: '#00A844',
    avatarUrl: avatarDataUri('Fernanda Souza', '#00A844'),
  },
  {
    id: 'usr_drv_04',
    name: 'Rafael Dias',
    email: 'rafael@vaimoto.app',
    phone: '(11) 97777-5050',
    role: 'driver',
    rating: 4.6,
    plate: 'MOTO-2M08',
    vehicleModel: 'Honda CG 160',
    isOnline: true,
    todayEarnings: 98,
    todayRides: 5,
    color: '#3D5AFE',
    avatarUrl: avatarDataUri('Rafael Dias', '#3D5AFE'),
  },
];

function ride(
  id: string,
  passengerId: string,
  passengerName: string,
  origin: Ride['origin'],
  destination: Ride['destination'],
  estimatedPrice: number,
  estimatedMinutes: number,
  distanceKm: number
): Ride {
  return {
    id,
    passengerId,
    passengerName,
    origin,
    destination,
    estimatedPrice,
    estimatedMinutes,
    distanceKm,
    status: 'bidding',
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 90_000).toISOString(),
  };
}

export const mockPendingRides: Ride[] = [
  ride(
    'ride_01',
    'usr_pass_02',
    'Juliana Costa',
    { lat: -23.5614, lng: -46.6558, address: 'Av. Paulista, 1578', neighborhood: 'Bela Vista' },
    { lat: -23.5505, lng: -46.6333, address: 'Rua Augusta, 2690', neighborhood: 'Cerqueira Cesar' },
    14.9,
    12,
    3.4
  ),
  ride(
    'ride_02',
    'usr_pass_03',
    'Pedro Lima',
    { lat: -23.567, lng: -46.648, address: 'Rua da Consolacao, 2100', neighborhood: 'Consolacao' },
    { lat: -23.5868, lng: -46.682, address: 'Av. Faria Lima, 2277', neighborhood: 'Pinheiros' },
    22.5,
    18,
    5.8
  ),
  ride(
    'ride_03',
    'usr_pass_04',
    'Marina Alves',
    { lat: -23.5733, lng: -46.6417, address: 'Rua Vergueiro, 1000', neighborhood: 'Liberdade' },
    { lat: -23.5329, lng: -46.6395, address: 'Terminal Tiete', neighborhood: 'Santana' },
    28.0,
    24,
    8.1
  ),
];

export const mockRideHistory: Ride[] = [
  {
    id: 'ride_h1',
    passengerId: 'usr_pass_01',
    passengerName: 'Ana Ribeiro',
    driverId: 'usr_drv_01',
    origin: {
      lat: -23.56,
      lng: -46.65,
      address: 'Rua Oscar Freire, 700',
      neighborhood: 'Jardins',
    },
    destination: {
      lat: -23.57,
      lng: -46.64,
      address: 'Shopping Cidade Sao Paulo',
      neighborhood: 'Bela Vista',
    },
    estimatedPrice: 12.4,
    estimatedMinutes: 10,
    distanceKm: 2.6,
    finalPrice: 12.4,
    status: 'completed',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    expiresAt: new Date(Date.now() - 86400000).toISOString(),
  },
];
