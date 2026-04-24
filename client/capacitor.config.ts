import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.komsukomsu.app',
  appName: 'Komşu Komşu',
  webDir: 'dist/public',
  server: {
    androidScheme: 'http',
    cleartext: true
  }
};

export default config;
