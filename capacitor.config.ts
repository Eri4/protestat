import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'al.protestat.app',
  appName: 'Protestat',
  webDir: 'dist',
  plugins: {
    // Native networking: lets the phone read public feeds that send no CORS headers.
    CapacitorHttp: { enabled: true },
  },
  android: { allowMixedContent: false },
};

export default config;
