import { Platform } from 'react-native';

/**
 * FastAPI backend (default http://localhost:8000).
 * Override in mobile/.env → EXPO_PUBLIC_API_URL, then `npx expo start -c`.
 * - Web / iOS Simulator: http://localhost:8000
 * - Android emulator: http://10.0.2.2:8000
 * - Physical device: http://YOUR_PC_LAN_IP:8000
 */
const envBase = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '');
export const API_BASE =
  envBase ||
  Platform.select({
    android: 'http://10.0.2.2:8000',
    ios: 'http://localhost:8000',
    default: 'http://localhost:8000',
  }) ||
  'http://localhost:8000';
