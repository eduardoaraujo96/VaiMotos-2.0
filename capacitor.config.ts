import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.vaimotos.app',
  appName: 'VaiMoto',
  webDir: 'dist',
  android: {
    allowMixedContent: false,
    backgroundColor: '#0F0F14',
  },
  server: {
    androidScheme: 'https',
  },
  plugins: {
    Geolocation: {
      timeout: 20000,
    },
  },
};

export default config;
