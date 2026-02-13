// ResellTracker - Main Application Entry Point

import './styles/main.css';
import { route, initRouter, getCurrentRoute } from './router.js';
import { DashboardView, initDashboardEvents } from './views/DashboardView.js';
import { InventoryView, initInventoryEvents } from './views/InventoryView.js';
import { AddLotView, initAddLotEvents } from './views/AddLotView.js';
import { BottomNav, initBottomNavEvents } from './components/BottomNav.js';
import { LoginModal, initLoginModalEvents } from './components/LoginModal.js';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './services/firebase.js';
import { initRippleEffects } from './utils/animations.js';

// Render the full app layout
function renderApp(viewContent, activeRoute) {
  return viewContent + BottomNav(activeRoute) + LoginModal();
}

// Initialize event handlers for current view
function initEvents() {
  const currentRoute = getCurrentRoute();

  // Always init global components
  initBottomNavEvents();
  initLoginModalEvents();
  initRippleEffects();

  // Route-specific events
  switch (currentRoute) {
    case '/':
      initDashboardEvents();
      break;
    case '/inventory':
      initInventoryEvents();
      break;
    case '/add':
      initAddLotEvents();
      break;
  }
}

// Register routes
route('/', () => renderApp(DashboardView(), '/'));
route('/inventory', () => renderApp(InventoryView(), '/inventory'));
route('/add', () => renderApp(AddLotView(), '/add'));

// Initialize router with event callback
initRouter(initEvents);

// Debounce helper to prevent multiple rapid re-renders
let viewChangeTimeout = null;
function scheduleViewChange() {
  if (viewChangeTimeout) clearTimeout(viewChangeTimeout);
  viewChangeTimeout = setTimeout(() => {
    const currentRoute = getCurrentRoute();
    const app = document.getElementById('app');

    let content;
    switch (currentRoute) {
      case '/':
        content = DashboardView();
        break;
      case '/inventory':
        content = InventoryView();
        break;
      case '/add':
        content = AddLotView();
        break;
      default:
        content = DashboardView();
    }

    if (app) {
      app.innerHTML = renderApp(content, currentRoute);
      initEvents();
      // Fade in the app after first render
      if (!app.classList.contains('ready')) {
        requestAnimationFrame(() => app.classList.add('ready'));
      }
    }
  }, 150); // 150ms debounce - batches auth + sync events into single render
}

// Handle custom view change events (for modals, state updates, etc.)
window.addEventListener('viewchange', scheduleViewChange);

// Handle Firebase Auth state changes globally to re-render
onAuthStateChanged(auth, () => {
  scheduleViewChange();
});

// Register service worker (handled by vite-plugin-pwa)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Service worker registration failed, but app still works
    });
  });
}

console.log('🚀 ResellTracker initialized');
