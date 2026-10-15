import { mount } from 'svelte';
import './app.css';
import App from './App.svelte';
import { isNative } from './lib/engine/fetcher';

mount(App, { target: document.getElementById('app')! });

// Offline support for the web (PWA) version. The Android app ships its files inside the APK.
if (!isNative() && 'serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
