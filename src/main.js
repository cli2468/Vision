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

// Track if we have performed the initial view render
let initialViewRendered = false;
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
  if (isInitialLoad) {
    isInitialLoad = false;
  }
}

// Register routes - these return just the view content (no chrome)
route('/', () => DashboardView());
route('/inventory', () => InventoryView());
route('/add', () => AddLotView());

// Initialize router with event callback
initRouter(initEvents);

// Debounce helper for view changes (auth, navigation, etc)
let viewChangeTimeout = null;
function scheduleViewChange() {
  if (viewChangeTimeout) clearTimeout(viewChangeTimeout);
  viewChangeTimeout = setTimeout(() => {
    const currentRoute = getCurrentRoute();
    const pageContent = document.getElementById('page-content');
    if (!pageContent) return;

    let content;
    switch (currentRoute) {
      case '/': content = DashboardView(); break;
      case '/inventory': content = InventoryView(); break;
      case '/add': content = AddLotView(); break;
      default: content = DashboardView();
    }
    pageContent.innerHTML = `<div class="page-view">${content}</div>`;
    initEvents();
  }, 150);
}

// Listen for the first auth state to trigger initial animations
onAuthStateChanged(auth, () => {
  if (!initialViewRendered) {
    // Initial view content is already in DOM from initApp, 
    // now we just trigger the events/animations once
    initialViewRendered = true;
    initEvents();

    // Safety: ensure app is visible if preloader timings were off
    const app = document.getElementById('app');
    if (app && !app.classList.contains('ready')) app.classList.add('ready');
  } else {
    scheduleViewChange();
  }
});

// Initial render - set up the app structure and initial static content
function initApp() {
  const app = document.getElementById('app');
  if (!app) return;

  const currentRoute = getCurrentRoute();

  // Create shell structure
  app.innerHTML = `
    <div id="page-content"></div>
    ${BottomNav(currentRoute)}
    <div id="modal-container">${LoginModal()}</div>
  `;

  // Pre-render content (HTML only, animations will wait for auth in onAuthStateChanged)
  const pageContent = document.getElementById('page-content');
  let content;
  switch (currentRoute) {
    case '/': content = DashboardView(); break;
    case '/inventory': content = InventoryView(); break;
    case '/add': content = AddLotView(); break;
    default: content = DashboardView();
  }
  pageContent.innerHTML = `<div class="page-view">${content}</div>`;
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
