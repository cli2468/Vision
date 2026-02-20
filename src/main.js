// ResellTracker - Main Application Entry Point

import './styles/main.css';
import './styles/desktop.css';
import { route, initRouter, getCurrentRoute } from './router.js';
import { DashboardView, initDashboardEvents } from './views/DashboardView.js';
import { InventoryView, initInventoryEvents } from './views/InventoryView.js';
import { AddLotView, initAddLotEvents } from './views/AddLotView.js';
import { SalesView, initSalesEvents } from './views/SalesView.js';
import { SettingsView, initSettingsEvents } from './views/SettingsView.js';
import { BottomNav, initBottomNavEvents } from './components/BottomNav.js';
import { Sidebar, initSidebarEvents, toggleSidebar, isSidebarCollapsed, updateSidebarAuthState } from './components/Sidebar.js';
import { DesktopDashboardView, initDesktopDashboardEvents } from './views/DesktopDashboardView.js';
import { LoginModal, initLoginModalEvents } from './components/LoginModal.js';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './services/firebase.js';
import { initRippleEffects } from './utils/animations.js';
import { initDemoTour } from './components/demoTour.js';

// Track if we have performed the initial view render
let initialViewRendered = false;
let isInitialLoad = true;

// Helper to detect desktop viewport
function isDesktop() {
  return window.innerWidth >= 1024;
}

// Initialize event handlers for current view
function initEvents() {
  const currentRoute = getCurrentRoute();

  // Always init global components (both mobile and desktop)
  initBottomNavEvents();
  initSidebarEvents();
  initLoginModalEvents();
  initRippleEffects();

  // Route-specific events
  if (isDesktop() && currentRoute === '/') {
    // Use desktop dashboard events on desktop
    initDesktopDashboardEvents(isInitialLoad);
    initDashboardEvents(isInitialLoad);
  } else {
    // Mobile or non-dashboard routes
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
      case '/sales':
        initSalesEvents();
        break;
      case '/settings':
        initSettingsEvents();
        break;
    }
  }

  // After first call, it's no longer initial load
  if (isInitialLoad) {
    isInitialLoad = false;
  }
}

// Register routes - these return just the view content (no chrome)
// Use getViewContent() to handle desktop vs mobile layout
route('/', () => getViewContent('/'));
route('/inventory', () => getViewContent('/inventory'));
route('/add', () => getViewContent('/add'));
route('/sales', () => getViewContent('/sales'));
route('/settings', () => getViewContent('/settings'));

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

    const content = getViewContent(currentRoute);
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

    const app = document.getElementById('app');
    if (app) app.classList.add('is-initial-load');

    initEvents();

    // Safety: ensure app is visible if preloader timings were off
    if (app && !app.classList.contains('ready')) app.classList.add('ready');

    // Remove the initial load class after the preloader finishes (approx 800-1000ms)
    setTimeout(() => {
      if (app) app.classList.remove('is-initial-load');
    }, 1000);
  } else {
    scheduleViewChange();
  }

  // Re-render auth-dependent UI like the Sidebar
  if (isDesktop()) {
    updateSidebarAuthState();
  }
});

// Get the appropriate view content based on route and device
function getViewContent(currentRoute) {
  // On desktop dashboard, use the desktop-optimized layout
  if (isDesktop() && currentRoute === '/') {
    return DesktopDashboardView();
  }

  // Otherwise use standard mobile views
  switch (currentRoute) {
    case '/':
      return DashboardView();
    case '/inventory':
      return InventoryView();
    case '/add':
      return AddLotView();
    case '/sales':
      return SalesView();
    case '/settings':
      return SettingsView();
    default:
      return DashboardView();
  }
}

// Initial render - set up the app structure and initial static content
function initApp() {
  // Demo Mode Activation for First Time Visitors
  if (!localStorage.getItem('hasVisited')) {
    localStorage.setItem('hasVisited', 'true');
    localStorage.setItem('demoMode', 'true');
    localStorage.setItem('dashboardCurrentRange', 'all');
  }

  // Global helper to exit demo mode cleanly
  window.exitDemoMode = () => {
    localStorage.removeItem('demoMode');
    localStorage.removeItem('resell_demo_lots');
    localStorage.removeItem('demoTourStep');
    // Set to all to avoid blank screen on empty state after exit
    localStorage.setItem('dashboardCurrentRange', 'all');
    window.location.reload();
  };

  const app = document.getElementById('app');
  if (!app) return;

  const currentRoute = getCurrentRoute();

  // Set responsive state classes
  app.classList.toggle('is-desktop', isDesktop());
  app.classList.toggle('is-mobile', !isDesktop());

  const demoBadge = localStorage.getItem('demoMode') === 'true' ? `
    <div class="demo-badge" onclick="window.exitDemoMode()">
      DEMO MODE &middot; <span>Exit</span>
    </div>
  ` : '';

  let demoToast = '';
  if (localStorage.getItem('demoMode') === 'true' && !sessionStorage.getItem('demoToastShown')) {
    demoToast = `
        <div class="demo-toast" id="demo-toast">
          <span>Interactive demo data loaded.</span>
          <button onclick="document.getElementById('demo-toast').remove()">✕</button>
        </div>
      `;
    sessionStorage.setItem('demoToastShown', 'true');
    // Auto dismiss after 5 seconds
    setTimeout(() => {
      const toast = document.getElementById('demo-toast');
      if (toast) {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
      }
    }, 5000);
  }

  // Create shell structure with both mobile and desktop navigation
  app.innerHTML = `
    ${demoBadge}
    ${demoToast}
    ${Sidebar(currentRoute)}
    <div id="page-content"></div>
    ${BottomNav(currentRoute)}
    <div id="modal-container">${LoginModal()}</div>
  `;

  // Pre-render content (HTML only, animations will wait for auth in onAuthStateChanged)
  const pageContent = document.getElementById('page-content');
  const content = getViewContent(currentRoute);
  pageContent.innerHTML = `<div class="page-view">${content}</div>`;

  // Start demo tour if applicable
  initDemoTour();
}

// Handle window resize to switch between mobile and desktop layouts
let resizeTimeout;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => {
    const app = document.getElementById('app');
    if (!app) return;

    const wasDesktop = app.classList.contains('is-desktop');
    const isDesktopNow = isDesktop();

    // Update responsive state classes
    app.classList.toggle('is-desktop', isDesktopNow);
    app.classList.toggle('is-mobile', !isDesktopNow);

    // Only re-render if crossing the breakpoint
    if (wasDesktop !== isDesktopNow) {
      const currentRoute = getCurrentRoute();
      const pageContent = document.getElementById('page-content');
      if (pageContent) {
        const content = getViewContent(currentRoute);
        pageContent.innerHTML = `<div class="page-view">${content}</div>`;
        initEvents();
      }
    }
  }, 250);
});

// Handle viewchange events from inventory/dashboard/addlot (e.g. after recording a sale)
// Uses refresh() to update the current view content without transition animations
window.addEventListener('viewchange', () => {
  const pageContent = document.getElementById('page-content');
  if (!pageContent) return;

  const currentRoute = getCurrentRoute();

  // Apply appropriate layout class for responsive handling
  const app = document.getElementById('app');
  if (app) {
    app.classList.toggle('is-desktop', isDesktop());
    app.classList.toggle('is-mobile', !isDesktop());
  }

  const content = getViewContent(currentRoute);
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
