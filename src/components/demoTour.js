// src/components/demoTour.js

const tourSteps = [
    {
        targetSelector: '.desktop-dashboard-kpis .kpi-card:nth-child(1), .kpis-grid .kpi-card:nth-child(1)',
        title: 'Revenue Tracking',
        text: 'Monitor your top-line revenue, profit margins, and ROI at a glance with real-time margin calculations.',
        placement: 'bottom'
    },
    {
        targetSelector: '.chart-container, .chart-wrapper',
        title: 'Performance Trends',
        text: 'Analyze historical sales data seamlessly. Hover or tap over the interactive graph to see daily breakdowns.',
        placement: 'top'
    },
    {
        targetSelector: '.sidebar-nav-item[data-route="/add"], .bottom-nav-item[data-route="/add"]',
        title: 'Seamless Inventory',
        text: 'Add new items directly from mobile or desktop. We automatically track unit costs and predict break-even.',
        placement: 'right' // will auto-adjust to bottom/top on mobile
    },
    {
        targetSelector: '.channel-breakdown-card, .desktop-secondary-metrics .rs-card:last-child',
        title: 'Channel Analytics',
        text: 'See exactly which platforms drive your profit, allowing you to optimize your sales strategy.',
        placement: 'left'
    }
];

let observer = null;
let activeTooltip = null;

export function initDemoTour() {
    if (localStorage.getItem('demoMode') !== 'true') return;
    if (parseInt(localStorage.getItem('demoTourStep') || '1') > tourSteps.length) return;

    // Wait for the app DOM to settle
    setTimeout(renderCurrentStep, 800);
}

function renderCurrentStep() {
    const stepIndex = parseInt(localStorage.getItem('demoTourStep') || '1') - 1;
    if (stepIndex >= tourSteps.length) {
        cleanupTour();
        return;
    }

    const step = tourSteps[stepIndex];
    let targetNode = document.querySelector(step.targetSelector);

    // If the target isn't in DOM yet, we set a MutationObserver to wait for it
    if (!targetNode) {
        if (!observer) {
            observer = new MutationObserver(() => {
                if (document.querySelector(step.targetSelector)) {
                    observer.disconnect();
                    observer = null;
                    setTimeout(renderCurrentStep, 300); // slight delay for layout
                }
            });
            observer.observe(document.body, { childList: true, subtree: true });
        }
        return;
    }

    // Target exists. Render tooltip.
    cleanupActiveTooltip();

    const tooltip = document.createElement('div');
    tooltip.className = 'demo-tour-tooltip';
    tooltip.innerHTML = `
    <div class="demo-tour-header">
      <span class="demo-tour-step">Step ${stepIndex + 1} of ${tourSteps.length}</span>
      <button class="demo-tour-skip" onclick="window.skipDemoTour()">Skip Tour</button>
    </div>
    <div class="demo-tour-body">
      <h3>${step.title}</h3>
      <p>${step.text}</p>
    </div>
    <div class="demo-tour-footer">
      <button class="demo-tour-btn primary" onclick="window.nextDemoTourStep()">
        ${stepIndex === tourSteps.length - 1 ? 'Finish' : 'Next'}
      </button>
    </div>
  `;

    document.body.appendChild(tooltip);
    activeTooltip = tooltip;

    positionTooltip(targetNode, tooltip, step.placement);

    // Re-position on resize smoothly
    window.addEventListener('resize', positionTooltipOnResize);
}

function positionTooltip(target, tooltip, placement) {
    const rect = target.getBoundingClientRect();
    const tipRect = tooltip.getBoundingClientRect();

    // Safe defaults
    let top = 0;
    let left = 0;

    const gap = 16;
    const isMobile = window.innerWidth < 1024;

    if (isMobile) {
        // Override placement on mobile to strictly top/bottom to prevent overflow
        if (rect.top > window.innerHeight / 2) {
            placement = 'top';
        } else {
            placement = 'bottom';
        }
    }

    switch (placement) {
        case 'bottom':
            top = rect.bottom + gap;
            left = rect.left + (rect.width / 2) - (tipRect.width / 2);
            break;
        case 'top':
            top = rect.top - tipRect.height - gap;
            left = rect.left + (rect.width / 2) - (tipRect.width / 2);
            break;
        case 'left':
            top = rect.top + (rect.height / 2) - (tipRect.height / 2);
            left = rect.left - tipRect.width - gap;
            break;
        case 'right':
            top = rect.top + (rect.height / 2) - (tipRect.height / 2);
            left = rect.right + gap;
            break;
    }

    // Bounds checking to prevent edge overflow
    if (left < 16) left = 16;
    if (left + tipRect.width > window.innerWidth - 16) {
        left = window.innerWidth - tipRect.width - 16;
    }
    if (top < 16) top = 16;
    if (top + tipRect.height > window.innerHeight - 16) {
        top = window.innerHeight - tipRect.height - 16;
    }

    tooltip.style.transform = `translate3d(${left}px, ${top}px, 0)`;
    tooltip.classList.add('visible');
}

function positionTooltipOnResize() {
    if (!activeTooltip) return;
    const stepIndex = parseInt(localStorage.getItem('demoTourStep') || '1') - 1;
    if (stepIndex >= tourSteps.length) return;
    const target = document.querySelector(tourSteps[stepIndex].targetSelector);
    if (target) {
        positionTooltip(target, activeTooltip, tourSteps[stepIndex].placement);
    }
}

function cleanupActiveTooltip() {
    if (activeTooltip) {
        activeTooltip.remove();
        activeTooltip = null;
    }
    window.removeEventListener('resize', positionTooltipOnResize);
}

window.nextDemoTourStep = () => {
    const current = parseInt(localStorage.getItem('demoTourStep') || '1');
    localStorage.setItem('demoTourStep', (current + 1).toString());

    if (activeTooltip) {
        activeTooltip.classList.remove('visible');
        setTimeout(renderCurrentStep, 300); // Wait for exit animation
    } else {
        renderCurrentStep();
    }
};

window.skipDemoTour = () => {
    localStorage.setItem('demoTourStep', '99'); // End tour
    cleanupTour();
};

function cleanupTour() {
    cleanupActiveTooltip();
    if (observer) {
        observer.disconnect();
        observer = null;
    }
}
