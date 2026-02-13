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

// Track if this is the initial load
let isInitialLoad = true;

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
      initDashboardEvents(isInitialLoad);
      break;
    case '/inventory':
      initInventoryEvents();
      break;
    case '/add':
      initAddLotEvents();
      break;
  }

  // After first call, it's no longer initial load
  isInitialLoad = false;
}

// Register routes - these return just the view content (no chrome)
route('/', () => DashboardView());
route('/inventory', () => InventoryView());
route('/add', () => AddLotView());

// Initialize router with event callback
initRouter(initEvents);

// Debounce helper to prevent multiple rapid re-renders
let viewChangeTimeout = null;
function scheduleViewChange() {
  if (viewChangeTimeout) clearTimeout(viewChangeTimeout);
  viewChangeTimeout = setTimeout(() => {
    const currentRoute = getCurrentRoute();
    const pageContent = document.getElementById('page-content');

    if (pageContent) {
      // Only update the view content, not the chrome
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
      // Wrap content in page-view div
      pageContent.innerHTML = `<div class="page-view">${content}</div>`;
      initEvents();
    }
  }, 150); // 150ms debounce
}

// Handle Firebase Auth state changes globally to re-render
onAuthStateChanged(auth, () => {
  scheduleViewChange();
});

// Initial render - set up the app structure
function initApp() {
  const app = document.getElementById('app');
  if (!app) return;

  const currentRoute = getCurrentRoute();

  // Create the initial app structure
  app.innerHTML = `
    <div id="page-content"></div>
    ${BottomNav(currentRoute)}
    <div id="modal-container">${LoginModal()}</div>
  `;

  // Initialize view content
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

  // Wrap initial content in page-view div
  const pageContent = document.getElementById('page-content');
  pageContent.innerHTML = `<div class="page-view">${content}</div>`;
  initEvents();

  // Mark app as ready
  app.classList.add('ready');
}

// Handle viewchange events from inventory/dashboard/addlot (e.g. after recording a sale)
// Uses refresh() to update the current view content without transition animations
window.addEventListener('viewchange', () => {
  const pageContent = document.getElementById('page-content');
  if (!pageContent) return;

  const currentRoute = getCurrentRoute();
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
  pageContent.innerHTML = `<div class="page-view">${content}</div>`;
  initEvents();
});

// Initialize app on load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

// Register service worker (handled by vite-plugin-pwa)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Service worker registration failed, but app still works
    });
  });
}

console.log('🚀 ResellTracker initialized');
