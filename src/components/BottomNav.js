// Bottom Navigation Component

import { navigate, getCurrentRoute } from '../router.js';
import { resetAddLotState } from '../views/AddLotView.js';

// Define route order for direction calculation
const routeOrder = ['/', '/inventory', '/add'];

/**
 * Calculate navigation direction based on route order
 * @param {string} from - Current path
 * @param {string} to - Target path
 * @returns {string} 'forward' or 'reverse'
 */
function getNavigationDirection(from, to) {
    const fromIndex = routeOrder.indexOf(from);
    const toIndex = routeOrder.indexOf(to);
    
    if (fromIndex === -1 || toIndex === -1) {
        return 'forward';
    }
    
    return toIndex > fromIndex ? 'forward' : 'reverse';
}

export function BottomNav(activeRoute = '/') {
  return `
    <nav class="bottom-nav">
      <button class="nav-item nav-dashboard ${activeRoute === '/' ? 'active' : ''}" data-route="/" data-anim="dashboard">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="3" width="7" height="9" fill="currentColor" fill-opacity="0"></rect>
          <rect x="14" y="3" width="7" height="5" fill="currentColor" fill-opacity="0"></rect>
          <rect x="14" y="12" width="7" height="9" fill="currentColor" fill-opacity="0"></rect>
          <rect x="3" y="16" width="7" height="5" fill="currentColor" fill-opacity="0"></rect>
        </svg>
      </button>

      <button class="nav-item nav-inventory ${activeRoute === '/inventory' ? 'active' : ''}" data-route="/inventory" data-anim="inventory">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
          <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
          <line x1="12" y1="22.08" x2="12" y2="12"></line>
        </svg>
      </button>
      
      <button class="nav-item nav-add ${activeRoute === '/add' ? 'active' : ''}" data-route="/add" data-anim="add">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
      </button>
      
      <button class="nav-item nav-account" id="account-btn" data-anim="account">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
          <circle cx="12" cy="7" r="4"></circle>
        </svg>
      </button>
    </nav>
  `;
}

export function initBottomNavEvents() {
  const currentRoute = getCurrentRoute();
  
  document.querySelectorAll('.nav-item[data-route]').forEach(item => {
    item.addEventListener('click', (e) => {
      const route = item.dataset.route;
      const animType = item.dataset.anim;
      const direction = getNavigationDirection(currentRoute, route);
      
      // Add specific animation class based on the button type
      if (animType) {
        item.classList.add(`${animType}-animating`);
        // Dashboard needs 600ms (300ms per square x 2 with delays), inventory needs 600ms
        const duration = animType === 'dashboard' ? 700 : 650;
        setTimeout(() => item.classList.remove(`${animType}-animating`), duration);
      }
      
      if (route === '/add') {
        resetAddLotState();
      }
      navigate(route, direction);
    });
  });

  // Account button opens login modal
  document.getElementById('account-btn')?.addEventListener('click', (e) => {
    const btn = e.currentTarget;
    
    // Add account animation
    btn.classList.add('account-animating');
    setTimeout(() => btn.classList.remove('account-animating'), 500);
    
    // Open login/account modal
    window.dispatchEvent(new CustomEvent('open-login-modal'));
  });
}
