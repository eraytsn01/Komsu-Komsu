import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.example.app',
  appName: 'Komşu Komşu',
  webDir: 'dist/public',
  server: {
    androidScheme: 'http'
  }
};

export default config;
