// Desktop Sidebar Navigation Component

import { navigate } from '../router.js';
import { resetAddLotState } from '../views/AddLotView.js';

let isCollapsed = false;

export function Sidebar(activeRoute = '/') {
  const menuItems = [
    { route: '/', label: 'Dashboard', icon: 'dashboard' },
    { route: '/inventory', label: 'Inventory', icon: 'inventory' },
    { route: '/sales', label: 'Sales', icon: 'sales' },
    { route: '/analytics', label: 'Analytics', icon: 'analytics' }
  ];

  const settingsItems = [
    { route: '/add', label: 'Add Item', icon: 'add' }
  ];

  const iconSvgs = {
    dashboard: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9" rx="1"></rect><rect x="14" y="3" width="7" height="5" rx="1"></rect><rect x="14" y="12" width="7" height="9" rx="1"></rect><rect x="3" y="16" width="7" height="5" rx="1"></rect></svg>`,
    inventory: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline></svg>`,
    sales: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>`,
    analytics: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>`,
    add: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`,
    collapse: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 17l-5-5 5-5M18 17l-5-5 5-5"/></svg>`,
    expand: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M13 17l5-5-5-5M6 17l5-5-5-5"/></svg>`
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

  const settingsHtml = settingsItems.map(item => `
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

  return `
    <aside class="desktop-sidebar ${isCollapsed ? 'collapsed' : ''}" data-collapsed="${isCollapsed}">
      <div class="sidebar-header">
        <div class="sidebar-brand">
          <div class="brand-name">ResellTracker</div>
          <div class="brand-tagline">Reselling simplified</div>
        </div>
        <button class="sidebar-toggle" title="${isCollapsed ? 'Expand' : 'Collapse'} sidebar">
          ${toggleIcon}
        </button>
      </div>
      
      <div class="sidebar-divider"></div>
      
      <div class="sidebar-section">
        <div class="sidebar-section-label">Menu</div>
        <nav class="sidebar-nav">
          ${menuHtml}
        </nav>
      </div>
      
      <div class="sidebar-divider"></div>
      
      <div class="sidebar-section">
        <div class="sidebar-section-label">Settings</div>
        <nav class="sidebar-nav">
          ${settingsHtml}
        </nav>
      </div>
    </aside>
  `;
}

export function toggleSidebar() {
  isCollapsed = !isCollapsed;
  const sidebar = document.querySelector('.desktop-sidebar');
  if (sidebar) {
    sidebar.classList.toggle('collapsed', isCollapsed);
    sidebar.setAttribute('data-collapsed', isCollapsed);
    
    // Update main content margin
    const pageContent = document.getElementById('page-content');
    if (pageContent) {
      pageContent.style.marginLeft = isCollapsed ? '72px' : '240px';
      pageContent.style.maxWidth = isCollapsed ? 'calc(100% - 72px)' : 'calc(100% - 240px)';
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
      navigate(route);
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
