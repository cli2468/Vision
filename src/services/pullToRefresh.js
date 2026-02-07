// Pull-to-Refresh Service
// Detects pull gesture and triggers service worker update check

let startY = 0;
let currentY = 0;
let isPulling = false;
let pullDistance = 0;
const PULL_THRESHOLD = 80; // pixels to pull before triggering refresh
const MAX_PULL = 120;

let indicator = null;

// Create and inject the pull indicator element
function createIndicator() {
    if (indicator) return;

    indicator = document.createElement('div');
    indicator.id = 'pull-refresh-indicator';
    indicator.innerHTML = `
    <div class="pull-refresh-content">
      <div class="pull-refresh-spinner"></div>
      <span class="pull-refresh-text">Pull to refresh</span>
    </div>
  `;
    document.body.insertBefore(indicator, document.body.firstChild);
}

// Check if we're at the top of the page
function isAtTop() {
    return window.scrollY <= 0;
}

// Update indicator based on pull distance
function updateIndicator() {
    if (!indicator) return;

    const progress = Math.min(pullDistance / PULL_THRESHOLD, 1);
    indicator.style.transform = `translateY(${Math.min(pullDistance, MAX_PULL) - 60}px)`;
    indicator.style.opacity = progress;

    const text = indicator.querySelector('.pull-refresh-text');
    const spinner = indicator.querySelector('.pull-refresh-spinner');

    if (pullDistance >= PULL_THRESHOLD) {
        text.textContent = 'Release to refresh';
        spinner.classList.add('ready');
    } else {
        text.textContent = 'Pull to refresh';
        spinner.classList.remove('ready');
    }
}

// Hide indicator
function hideIndicator() {
    if (!indicator) return;
    indicator.style.transform = 'translateY(-60px)';
    indicator.style.opacity = '0';

    const spinner = indicator.querySelector('.pull-refresh-spinner');
    spinner.classList.remove('ready', 'loading');
}

// Show loading state
function showLoading() {
    if (!indicator) return;

    const text = indicator.querySelector('.pull-refresh-text');
    const spinner = indicator.querySelector('.pull-refresh-spinner');

    text.textContent = 'Checking for updates...';
    spinner.classList.remove('ready');
    spinner.classList.add('loading');
}

// Check for service worker updates
async function checkForUpdates() {
    showLoading();

    try {
        if ('serviceWorker' in navigator) {
            const registration = await navigator.serviceWorker.getRegistration();

            if (registration) {
                // Force check for updates
                await registration.update();

                // Check if there's a waiting worker (new version)
                if (registration.waiting) {
                    showUpdateAvailable(registration.waiting);
                    return;
                }

                // Check if installing
                if (registration.installing) {
                    trackInstallation(registration.installing);
                    return;
                }
            }
        }

        // No update available, just refresh data
        refreshData();
    } catch (error) {
        console.error('Update check failed:', error);
        refreshData();
    }
}

// Track installation progress
function trackInstallation(worker) {
    worker.addEventListener('statechange', () => {
        if (worker.state === 'installed') {
            showUpdateAvailable(worker);
        }
    });
}

// Show update available UI
function showUpdateAvailable(worker) {
    if (!indicator) return;

    const text = indicator.querySelector('.pull-refresh-text');
    const spinner = indicator.querySelector('.pull-refresh-spinner');

    spinner.classList.remove('loading');
    text.innerHTML = '<button id="apply-update-btn" class="update-btn">Update Available - Tap to Install</button>';

    document.getElementById('apply-update-btn')?.addEventListener('click', () => {
        worker.postMessage({ type: 'SKIP_WAITING' });
    });

    // Listen for controller change (new SW taking over)
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        window.location.reload();
    });
}

// Refresh data without full page reload
function refreshData() {
    if (!indicator) return;

    const text = indicator.querySelector('.pull-refresh-text');
    const spinner = indicator.querySelector('.pull-refresh-spinner');

    text.textContent = 'Up to date!';
    spinner.classList.remove('loading');
    spinner.classList.add('done');

    // Trigger data refresh
    window.dispatchEvent(new CustomEvent('viewchange'));

    // Hide after delay
    setTimeout(() => {
        hideIndicator();
        spinner.classList.remove('done');
    }, 1000);
}

// Touch event handlers
function handleTouchStart(e) {
    if (!isAtTop()) return;

    startY = e.touches[0].clientY;
    isPulling = true;
}

function handleTouchMove(e) {
    if (!isPulling || !isAtTop()) {
        isPulling = false;
        return;
    }

    currentY = e.touches[0].clientY;
    pullDistance = Math.max(0, currentY - startY);

    if (pullDistance > 0) {
        // Prevent default scroll when pulling
        e.preventDefault();
        updateIndicator();
    }
}

function handleTouchEnd() {
    if (!isPulling) return;

    if (pullDistance >= PULL_THRESHOLD) {
        // Keep indicator visible and check for updates
        indicator.style.transform = 'translateY(0)';
        checkForUpdates();
    } else {
        hideIndicator();
    }

    isPulling = false;
    pullDistance = 0;
    startY = 0;
    currentY = 0;
}

// Initialize pull-to-refresh
export function initPullToRefresh() {
    createIndicator();

    // Use passive: false to allow preventDefault on touchmove
    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });

    console.log('🔄 Pull-to-refresh initialized');
}
