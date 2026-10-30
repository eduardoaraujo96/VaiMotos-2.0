import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.vaimotos.app',
  appName: 'VaiMoto',
  webDir: 'dist',
  android: {
    allowMixedContent: false,
    backgroundColor: '#0F0F14',
  },
  plugins: {
    Geolocation: {
      timeout: 15000,
    },
  },
};

export default config;
