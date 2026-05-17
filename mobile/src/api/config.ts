import { Platform } from 'react-native';

/** FastAPI backend — Android emulator uses 10.0.2.2 for host localhost */
export const API_BASE = Platform.select({
  android: 'http://10.0.2.2:8000',
  ios: 'http://localhost:8000',
  default: 'http://localhost:8000',
});
