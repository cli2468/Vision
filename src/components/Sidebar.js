// Desktop Sidebar Navigation Component

import { navigate } from '../router.js';
import { resetAddLotState } from '../views/AddLotView.js';
import { auth, logout } from '../services/firebase.js';

let isCollapsed = false;

export function Sidebar(activeRoute = '/') {
  const user = auth.currentUser;

  const menuItems = [
    { route: '/', label: 'Dashboard', icon: 'dashboard' },
    { route: '/add', label: 'Add', icon: 'add' },
    { route: '/inventory', label: 'Inventory', icon: 'inventory' },
    { route: '/sales', label: 'Sales', icon: 'sales' },
    { route: '/settings', label: 'Help', icon: 'help' }
  ];

  const iconSvgs = {
    dashboard: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9" rx="1"></rect><rect x="14" y="3" width="7" height="5" rx="1"></rect><rect x="14" y="12" width="7" height="9" rx="1"></rect><rect x="3" y="16" width="7" height="5" rx="1"></rect></svg>`,
    inventory: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline></svg>`,
    sales: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>`,
    help: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.82 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`,
    logout: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>`,
    login: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path><polyline points="10 17 15 12 10 7"></polyline><line x1="15" y1="12" x2="3" y2="12"></line></svg>`,
    add: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`,
    collapse: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><line x1="9" y1="3" x2="9" y2="21"/></svg>`,
    expand: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><line x1="9" y1="3" x2="9" y2="21"/></svg>`
  };

  const menuHtml = menuItems.map(item => `
    <button 
      class="sidebar-nav-item ${activeRoute === item.route ? 'active' : ''}" 
      data-route="${item.route}"
      title="${item.label}"
    >
      <span class="sidebar-nav-icon">${iconSvgs[item.icon]}</span>
      <span class="sidebar-nav-label">${item.label}</span>
    </button>
  `).join('');

  const toggleIcon = isCollapsed ? iconSvgs.expand : iconSvgs.collapse;

  // Determine auth button content based on user state
  const authHtml = user ? `
    <button class="sidebar-nav-item sidebar-logout-btn" id="sidebar-logout-btn" title="Log out">
      <span class="sidebar-nav-icon">${iconSvgs.logout}</span>
      <span class="sidebar-nav-label">Log out</span>
    </button>
    <div class="sidebar-logout-confirm" id="sidebar-logout-confirm">
      <p class="logout-confirm-text">Sign out of your account?</p>
      <div class="logout-confirm-actions">
        <button class="logout-confirm-btn cancel" id="sidebar-logout-cancel">Cancel</button>
        <button class="logout-confirm-btn confirm" id="sidebar-logout-confirm-btn">Log out</button>
      </div>
    </div>
  ` : `
    <button class="sidebar-nav-item sidebar-login-btn" id="sidebar-login-btn" title="Log in / Sync" onclick="window.dispatchEvent(new CustomEvent('open-login-modal'))">
      <span class="sidebar-nav-icon">${iconSvgs.login}</span>
      <span class="sidebar-nav-label">Log in / Sync</span>
    </button>
  `;

  return `
    <aside class="desktop-sidebar ${isCollapsed ? 'collapsed' : ''}" data-collapsed="${isCollapsed}">
      <div class="sidebar-header">
        <div class="sidebar-brand">
          <div class="brand-name">Vision</div>
        </div>
        <button
          class="sidebar-toggle"
          title="${isCollapsed ? 'Expand' : 'Collapse'} sidebar"
          aria-label="${isCollapsed ? 'Expand' : 'Collapse'} sidebar"
          aria-expanded="${(!isCollapsed).toString()}"
        >
          ${toggleIcon}
        </button>
      </div>
      
      <div class="sidebar-section">
        <div class="sidebar-section-label">MENU</div>
        <nav class="sidebar-nav">
           ${menuHtml}
        </nav>
        <div class="sidebar-divider"></div>
        ${authHtml}
      </div>
    </aside>
  `;
}

export function toggleSidebar() {
  isCollapsed = !isCollapsed;
  const app = document.getElementById('app');
  const sidebar = document.querySelector('.desktop-sidebar');

  if (app) {
    app.classList.toggle('sidebar-collapsed', isCollapsed);
  }

  if (sidebar) {
    sidebar.classList.toggle('collapsed', isCollapsed);
    sidebar.setAttribute('data-collapsed', isCollapsed);

    // Update toggle icon
    const toggleBtn = sidebar.querySelector('.sidebar-toggle');
    if (toggleBtn) {
      const iconSvgs = {
        expand: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><line x1="9" y1="3" x2="9" y2="21"/></svg>`,
        collapse: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><line x1="9" y1="3" x2="9" y2="21"/></svg>`
      };
      toggleBtn.innerHTML = isCollapsed ? iconSvgs.expand : iconSvgs.collapse;
      toggleBtn.title = (isCollapsed ? 'Expand' : 'Collapse') + ' sidebar';
      toggleBtn.setAttribute('aria-label', (isCollapsed ? 'Expand' : 'Collapse') + ' sidebar');
      toggleBtn.setAttribute('aria-expanded', (!isCollapsed).toString());
    }
  }
}

export function isSidebarCollapsed() {
  return isCollapsed;
}

let eventsInitialized = false;

export function initSidebarEvents() {
  if (eventsInitialized) return;
  eventsInitialized = true;

  // Navigation item clicks
  document.querySelectorAll('.sidebar-nav-item[data-route]').forEach(item => {
    item.addEventListener('click', () => {
      const route = item.dataset.route;

      if (route === '/add') {
        resetAddLotState();
      }

      document.querySelectorAll('.sidebar-nav-item[data-route]').forEach(navItem => {
        navItem.classList.toggle('active', navItem.dataset.route === route);
      });
      navigate(route);
    });
  });

  // Keep sidebar active state in sync with hash navigation from other controls
  window.addEventListener('hashchange', () => {
    const currentRoute = window.location.hash.slice(1) || '/';
    document.querySelectorAll('.sidebar-nav-item[data-route]').forEach(item => {
      item.classList.toggle('active', item.dataset.route === currentRoute);
    });
  });

  // Sidebar toggle button
  const toggleBtn = document.querySelector('.sidebar-toggle');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleSidebar();
    });
  }

  bindAuthEvents();

  // Tooltip handling for collapsed mode
  const sidebar = document.querySelector('.desktop-sidebar');
  if (sidebar) {
    sidebar.addEventListener('mouseenter', (e) => {
      if (sidebar.classList.contains('collapsed') && e.target.classList.contains('sidebar-nav-item')) {
        showTooltip(e.target);
      }
    }, true);

    sidebar.addEventListener('mouseleave', (e) => {
      if (e.target.classList.contains('sidebar-nav-item')) {
        hideTooltip(e.target);
      }
    }, true);
  }
}

function bindAuthEvents() {
  const logoutBtn = document.getElementById('sidebar-logout-btn');
  const logoutConfirm = document.getElementById('sidebar-logout-confirm');
  const logoutCancel = document.getElementById('sidebar-logout-cancel');
  const logoutConfirmBtn = document.getElementById('sidebar-logout-confirm-btn');

  if (logoutBtn && logoutConfirm) {
    logoutBtn.addEventListener('click', () => {
      logoutConfirm.classList.add('visible');
    });
  }

  if (logoutCancel && logoutConfirm) {
    logoutCancel.addEventListener('click', () => {
      logoutConfirm.classList.remove('visible');
    });
  }

  if (logoutConfirmBtn && logoutConfirm) {
    logoutConfirmBtn.addEventListener('click', async () => {
      await logout();
      logoutConfirm.classList.remove('visible');
    });
  }
}

function showTooltip(element) {
  const label = element.getAttribute('title');
  if (!label) return;

  let tooltip = element.querySelector('.sidebar-tooltip');
  if (!tooltip) {
    tooltip = document.createElement('div');
    tooltip.className = 'sidebar-tooltip';
    tooltip.textContent = label;
    element.appendChild(tooltip);
  }

  tooltip.classList.add('visible');
}

function hideTooltip(element) {
  const tooltip = element.querySelector('.sidebar-tooltip');
  if (tooltip) {
    tooltip.classList.remove('visible');
  }
}

/**
 * Updates the authentication button region in the Sidebar dynamically.
 */
export function updateSidebarAuthState() {
  const sidebar = document.querySelector('.desktop-sidebar');
  if (!sidebar) return;

  const user = auth.currentUser;
  const divider = sidebar.querySelector('.sidebar-divider');
  if (!divider) return;

  // Remove existing auth elements (like buttons or confirms) that sit after the divider
  let nextSibling = divider.nextElementSibling;
  while (nextSibling) {
    const toRemove = nextSibling;
    nextSibling = nextSibling.nextElementSibling;
    toRemove.remove();
  }

  const iconSvgs = {
    logout: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>`,
    login: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path><polyline points="10 17 15 12 10 7"></polyline><line x1="15" y1="12" x2="3" y2="12"></line></svg>`
  };

  const authHtml = user ? `
    <button class="sidebar-nav-item sidebar-logout-btn" id="sidebar-logout-btn" title="Log out">
      <span class="sidebar-nav-icon">${iconSvgs.logout}</span>
      <span class="sidebar-nav-label">Log out</span>
    </button>
    <div class="sidebar-logout-confirm" id="sidebar-logout-confirm">
      <p class="logout-confirm-text">Sign out of your account?</p>
      <div class="logout-confirm-actions">
        <button class="logout-confirm-btn cancel" id="sidebar-logout-cancel">Cancel</button>
        <button class="logout-confirm-btn confirm" id="sidebar-logout-confirm-btn">Log out</button>
      </div>
    </div>
  ` : `
    <button class="sidebar-nav-item sidebar-login-btn" id="sidebar-login-btn" title="Log in / Sync" onclick="window.dispatchEvent(new CustomEvent('open-login-modal'))">
      <span class="sidebar-nav-icon">${iconSvgs.login}</span>
      <span class="sidebar-nav-label">Log in / Sync</span>
    </button>
  `;

  divider.insertAdjacentHTML('afterend', authHtml);

  // Bind events only to the newly injected auth elements
  bindAuthEvents();
}
