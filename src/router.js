// Simple hash-based router with directional transitions

const routes = {};
let currentView = null;
let onRouteChange = null;
let currentPath = '/';

// Define route order for direction calculation
const routeOrder = ['/', '/inventory', '/add', '/account'];

/**
 * Register a route
 * @param {string} path - Route path (e.g., '/', '/inventory')
 * @param {Function} handler - View render function
 */
export function route(path, handler) {
    routes[path] = handler;
}

/**
 * Navigate to a path with directional transition
 * @param {string} path - Path to navigate to
 */
export function navigate(path, direction = null) {
    // Calculate direction if not provided
    if (direction === null) {
        direction = getNavigationDirection(currentPath, path);
    }
    
    // Store direction for transition handler
    window._navigationDirection = direction;
    
    window.location.hash = path;
}

/**
 * Get current path from hash
 */
function getPath() {
    const hash = window.location.hash.slice(1);
    return hash || '/';
}

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

/**
 * Handle route changes with transitions
 */
function handleRoute() {
    const path = getPath();
    const handler = routes[path] || routes['/'];
    const direction = window._navigationDirection || 'forward';
    
    if (handler) {
        currentView = handler;
        const app = document.getElementById('app');
        if (app) {
            // Get the new content
            const newContent = handler();
            
            // Apply transition
            applyPageTransition(app, newContent, direction);
            
            // Update current path
            currentPath = path;
            
            // Call the route change callback to init events
            if (onRouteChange) {
                setTimeout(() => onRouteChange(), 400); // Wait for transition
            }
        }
    }
}

/**
 * Apply page transition animation
 * @param {HTMLElement} app - App container
 * @param {string} newContent - New HTML content
 * @param {string} direction - 'forward' or 'reverse'
 */
function applyPageTransition(app, newContent, direction) {
    // Create wrapper for transition
    const wrapper = document.createElement('div');
    wrapper.className = 'page-container';
    wrapper.innerHTML = `
        <div class="page-content slide-exit${direction === 'reverse' ? '-reverse' : ''}">
            ${app.innerHTML}
        </div>
        <div class="page-content slide-enter${direction === 'reverse' ? '-reverse' : ''}">
            ${newContent}
        </div>
    `;
    
    // Replace app content with wrapper
    app.innerHTML = '';
    app.appendChild(wrapper);
    
    // Clean up after animation
    setTimeout(() => {
        app.innerHTML = newContent;
        app.classList.add('ready');
    }, 400);
}

/**
 * Initialize the router
 * @param {Function} callback - Called after each route render
 */
export function initRouter(callback) {
    onRouteChange = callback;
    currentPath = getPath();

    window.addEventListener('hashchange', handleRoute);

    // Initial route on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            if (!window.location.hash) {
                window.location.hash = '/';
            } else {
                handleRoute();
            }
        });
    } else {
        if (!window.location.hash) {
            window.location.hash = '/';
        } else {
            handleRoute();
        }
    }
}

/**
 * Re-render current view
 */
export function refresh() {
    if (currentView) {
        const app = document.getElementById('app');
        if (app) {
            app.innerHTML = currentView();
            if (onRouteChange) {
                onRouteChange();
            }
        }
    }
}

/**
 * Get current route
 */
export function getCurrentRoute() {
    return currentPath;
}
