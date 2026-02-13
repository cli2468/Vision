// Dashboard View - Revenue/Profit chart with time-range filtering and Return Alerts

import { getAllSales, getSalesByDateRange, getLots, getLotsNearingReturnDeadline, getReturnDeadline, markReturned, dismissReturnAlert } from '../services/storage.js';
import { calculateMonthlyStats, formatCurrency } from '../services/calculations.js';
import { aggregateSalesByDay, getSalesForDay } from '../services/chartData.js';
import { animateCountUp } from '../utils/animations.js';

// Current selected time range for dashboard
let selectedRange = '30d'; // '7d' | '30d' | '90d' | 'all'
let chartMode = 'revenue'; // 'revenue' | 'profit'
let chartInstance = null;
let currentChartData = null;

export function setTimeRange(range) {
  selectedRange = range;
}

export function getSelectedRange() {
  return selectedRange;
}

/**
 * Get the start date for the selected range
 */
function getStartDateForRange(range) {
  const now = new Date();
  now.setHours(23, 59, 59, 999);

  switch (range) {
    case '7d':
      const start7d = new Date(now);
      start7d.setDate(start7d.getDate() - 6);
      start7d.setHours(0, 0, 0, 0);
      return start7d;
    case '30d':
      const start30d = new Date(now);
      start30d.setDate(start30d.getDate() - 29);
      start30d.setHours(0, 0, 0, 0);
      return start30d;
    case '90d':
      const start90d = new Date(now);
      start90d.setDate(start90d.getDate() - 89);
      start90d.setHours(0, 0, 0, 0);
      return start90d;
    case 'all':
    default:
      return null;
  }
}

/**
 * Get sales for the currently selected range
 */
function getSalesForSelectedRange() {
  if (selectedRange === 'all') {
    return getAllSales();
  }
  const startDate = getStartDateForRange(selectedRange);
  return getSalesByDateRange(startDate, new Date());
}

function renderReturnAlerts() {
  const lotsNearingDeadline = getLotsNearingReturnDeadline(3);

  if (lotsNearingDeadline.length === 0) return '';

  const alertCards = lotsNearingDeadline.map(lot => {
    const deadline = getReturnDeadline(lot);
    const dateStr = deadline.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    return `
      <div class="return-alert-card" data-lot-id="${lot.id}">
        <div class="return-alert-content">
          <div class="return-alert-icon">⚠️</div>
          <div class="return-alert-text">
            <div class="return-alert-title">${lot.name}</div>
            <div class="return-alert-meta">${lot.remaining} unit${lot.remaining > 1 ? 's' : ''} • Return by ${dateStr}</div>
          </div>
        </div>
        <div class="return-alert-actions">
          <button class="btn btn-danger btn-sm mark-returned-btn" data-lot-id="${lot.id}">Returned</button>
          <button class="btn btn-secondary btn-sm keeping-it-btn" data-lot-id="${lot.id}">Keeping</button>
        </div>
      </div>
    `;
  }).join('');

  return `
    <div class="return-alerts-section">
      <h3 class="section-title" style="color: var(--accent-warning);">⏰ Return Window Alerts</h3>
      ${alertCards}
    </div>
  `;
}

export function DashboardView() {
  const salesData = getSalesForSelectedRange();
  const allLots = getLots();
  const unsoldUnits = allLots.reduce((sum, lot) => sum + (lot.remaining || 0), 0);
  const unsoldCostBasis = allLots.reduce((sum, lot) => sum + (lot.unitCost || 0) * (lot.remaining || 0), 0);
  const stats = calculateMonthlyStats(salesData);
  const returnAlertsHtml = renderReturnAlerts();

  return `
    <div class="page">
      <div class="container">
        ${returnAlertsHtml}
        
        <div class="chart-card">
          <div class="chart-header">
            <div class="chart-title-section">
              <div class="chart-main-title">Total Revenue</div>
              <div class="chart-revenue-value">${formatCurrency(stats.totalRevenue)}</div>
              <div class="chart-profit-subtitle ${stats.totalProfit >= 0 ? 'text-success' : 'text-danger'}">
                ${formatCurrency(Math.abs(stats.totalProfit))} profit this ${selectedRange === '7d' ? 'week' : selectedRange === '30d' ? 'month' : selectedRange === '90d' ? 'quarter' : 'lifetime'}
              </div>
            </div>
            <div class="time-selector-accordion" id="time-selector">
              <button class="time-selector-trigger">
                <span class="time-selector-current">${selectedRange === '7d' ? '7D' : selectedRange === '30d' ? '30D' : selectedRange === '90d' ? '90D' : 'All Time'}</span>
                <svg class="time-selector-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </button>
              <div class="time-selector-dropdown">
                <button class="time-option ${selectedRange === '7d' ? 'active' : ''}" data-range="7d">Last 7 Days</button>
                <button class="time-option ${selectedRange === '30d' ? 'active' : ''}" data-range="30d">Last 30 Days</button>
                <button class="time-option ${selectedRange === '90d' ? 'active' : ''}" data-range="90d">Last 90 Days</button>
                <button class="time-option ${selectedRange === 'all' ? 'active' : ''}" data-range="all">All Time</button>
              </div>
            </div>
          </div>
          <div class="chart-wrapper">
            <canvas id="dashboard-chart"></canvas>
          </div>
        </div>
        
        ${renderInventoryCard(allLots, unsoldCostBasis)}
        
        <!-- Day breakdown modal -->
        <div class="modal-overlay day-breakdown-modal" id="day-breakdown-modal" style="display: none;">
          <div class="modal-content">
            <div class="modal-header">
              <h2 class="modal-title" id="day-breakdown-title">Sales</h2>
              <button class="modal-close" id="close-day-modal">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            <div id="day-breakdown-content"></div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderChartSection(stats) {
  const profitClass = stats.totalProfit >= 0 ? 'text-success' : 'text-danger';

  return `
    <div class="chart-card">
      <div class="chart-header">
        <div class="chart-title-section">
          <div class="chart-main-title">Total Revenue</div>
          <div class="chart-revenue-value">${formatCurrency(stats.totalRevenue)}</div>
          <div class="chart-profit-subtitle ${profitClass}">
            ${formatCurrency(Math.abs(stats.totalProfit))} profit this ${selectedRange === '7d' ? 'week' : selectedRange === '30d' ? 'month' : selectedRange === '90d' ? 'quarter' : 'lifetime'}
          </div>
        </div>
        <div class="chart-pill-selector">
          <button class="pill-btn ${selectedRange === '7d' ? 'active' : ''}" data-range="7d">7D</button>
          <button class="pill-btn ${selectedRange === '30d' ? 'active' : ''}" data-range="30d">30D</button>
          <button class="pill-btn ${selectedRange === '90d' ? 'active' : ''}" data-range="90d">90D</button>
          <button class="pill-btn ${selectedRange === 'all' ? 'active' : ''}" data-range="all">All</button>
        </div>
      </div>
      <div class="chart-wrapper">
        <canvas id="dashboard-chart"></canvas>
      </div>
    </div>
  `;
}

/**
 * Render inventory card with circular design
 */
function renderInventoryCard(allLots, unsoldCostBasis) {
  const topInventoryLots = allLots
    .filter(lot => lot.remaining > 0)
    .map(lot => ({
      ...lot,
      inventoryValue: (lot.remaining || 0) * (lot.unitCost || 0)
    }))
    .sort((a, b) => b.inventoryValue - a.inventoryValue)
    .slice(0, 3);

  const totalInventoryValue = topInventoryLots.reduce((sum, lot) => sum + lot.inventoryValue, 0);
  const colors = ['var(--accent)', '#4A90A4', '#8B7B6B'];

  // Build stacked bar segments
  const barSegmentsHtml = topInventoryLots.map((lot, i) => {
    const pct = totalInventoryValue > 0 ? (lot.inventoryValue / totalInventoryValue) * 100 : 0;
    return `<div style="width: ${pct}%; height: 100%; background: ${colors[i]}; transition: width 0.3s ease;"></div>`;
  }).join('');

  // Build side items
  const sideItemsHtml = topInventoryLots.map((lot, i) => `
    <div class="inventory-side-item">
      <div class="inventory-item-color" style="background: ${colors[i]}"></div>
      <div class="inventory-item-info">
        <div class="inventory-item-name">${lot.name}</div>
        <div class="inventory-item-value">${formatCurrency(lot.inventoryValue)}</div>
      </div>
    </div>
  `).join('');

  return `
    <div class="inventory-card">
      <div class="inventory-card-header">Inventory Remaining</div>
      <div class="inventory-value-row">
        <div class="inventory-total">${formatCurrency(unsoldCostBasis)}</div>
        <div class="inventory-total-label">${topInventoryLots.length} item${topInventoryLots.length !== 1 ? 's' : ''} unsold</div>
      </div>
      <div class="inventory-bar">
        ${barSegmentsHtml || '<div style="width: 100%; height: 100%; background: rgba(180, 177, 171, 0.2);"></div>'}
      </div>
      <div class="inventory-side-list" style="margin-top: var(--spacing-md);">
        ${sideItemsHtml || '<div class="inventory-side-item"><div class="inventory-item-info"><div class="inventory-item-name">No inventory</div></div></div>'}
      </div>
    </div>
  `;
}

/**
 * Initialize and render the chart
 */
function initChart() {
  const canvas = document.getElementById('dashboard-chart');
  if (!canvas || typeof Chart === 'undefined') return;

  const salesData = getSalesForSelectedRange();
  currentChartData = aggregateSalesByDay(salesData, selectedRange);

  const { labels, cumulativeRevenues } = currentChartData;

  // Calculate Y-axis step size using nice increments (100, 500, 1000, 2000)
  // Ensure 5-6 total Y-axis points (4-5 intervals) including zero
  const maxRevenue = Math.max(...cumulativeRevenues, 0);
  const niceSteps = [100, 500, 1000, 2000];
  
  // Find step that gives us 4-5 intervals (5-6 total points including zero)
  let stepSize = 2000; // Default to largest
  for (const step of niceSteps) {
    const intervals = maxRevenue / step;
    if (intervals >= 4 && intervals <= 5) {
      // Perfect: 4-5 intervals means 5-6 points (including zero)
      stepSize = step;
      break;
    } else if (intervals < 4) {
      // Too few intervals, use larger step (fewer intervals)
      stepSize = step;
      break;
    }
    stepSize = step;
  }
  
  // Calculate yMax to ensure exactly 5-6 points
  // Round to nearest multiple of stepSize that gives 4-5 intervals
  let targetIntervals = Math.ceil(maxRevenue / stepSize);
  targetIntervals = Math.max(4, Math.min(5, targetIntervals)); // Clamp to 4-5 intervals
  const yMax = targetIntervals * stepSize;

  // Destroy existing chart
  if (chartInstance) {
    chartInstance.destroy();
  }

  const ctx = canvas.getContext('2d');

  // Create fade gradient that goes from neon to transparent
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height || 200);
  gradient.addColorStop(0, 'rgba(204, 255, 0, 0.25)');
  gradient.addColorStop(0.5, 'rgba(204, 255, 0, 0.08)');
  gradient.addColorStop(1, 'rgba(204, 255, 0, 0)');

  // Custom plugin for vertical dotted hover line
  const verticalLinePlugin = {
    id: 'verticalLine',
    beforeDatasetsDraw: (chart) => {
      const { ctx, chartArea: { top, bottom }, tooltip } = chart;
      if (tooltip?._active?.length) {
        const x = tooltip._active[0].element.x;
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(x, top);
        ctx.lineTo(x, bottom);
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = 'rgba(204, 255, 0, 0.6)';
        ctx.stroke();
        ctx.restore();
      }
    }
  };

  chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Revenue',
        data: cumulativeRevenues,
        backgroundColor: gradient,
        borderColor: '#CCFF00',
        borderWidth: 2,
        tension: 0.4,
        fill: true,
        pointBackgroundColor: '#CCFF00',
        pointBorderColor: '#1C180D',
        pointBorderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 6,
        pointHoverBackgroundColor: '#CCFF00',
        pointHoverBorderColor: '#1C180D',
        pointHoverBorderWidth: 3,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: 1500,
        easing: 'easeOutQuart',
        x: {
          type: 'number',
          easing: 'linear',
          duration: 1500,
          from: NaN,
          delay(ctx) {
            if (ctx.type !== 'data' || ctx.xStarted) {
              return 0;
            }
            ctx.xStarted = true;
            return ctx.index * (1500 / cumulativeRevenues.length);
          }
        },
        y: {
          type: 'number',
          easing: 'linear',
          duration: 1500,
          from: (ctx) => {
            return ctx.index === 0 ? ctx.chart.scales.y.getPixelForValue(0) : ctx.chart.getDatasetMeta(0).data[ctx.index - 1].y;
          },
          delay(ctx) {
            if (ctx.type !== 'data' || ctx.yStarted) {
              return 0;
            }
            ctx.yStarted = true;
            return ctx.index * (1500 / cumulativeRevenues.length);
          }
        }
      },
      interaction: {
        intersect: false,
        mode: 'index'
      },
      onClick: (event, elements) => {
        if (elements.length > 0) {
          const index = elements[0].index;
          showDayBreakdown(index);
        }
      },
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          enabled: true,
          backgroundColor: 'rgba(28, 24, 13, 0.95)',
          titleColor: '#D4D0C9',
          bodyColor: '#CCFF00',
          borderColor: 'rgba(204, 255, 0, 0.4)',
          borderWidth: 1,
          padding: 12,
          cornerRadius: 8,
          displayColors: false,
            callbacks: {
              title: function (context) {
                return context[0].label;
              },
              label: function (context) {
                const value = context.raw;
                return 'Revenue: $' + value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
              }
            }
        },
        verticalLine: verticalLinePlugin
      },
      scales: {
        x: {
          grid: {
            display: false
          },
          ticks: {
            color: '#B4B1AB',
            font: { size: 11 },
            maxRotation: 0,
            autoSkip: selectedRange !== '7d', // Show all labels for 7D
            maxTicksLimit: selectedRange === '7d' ? 7 : 6
          },
          border: {
            display: false
          }
        },
        y: {
          min: 0,
          max: yMax,
          ticks: {
            stepSize: stepSize,
            color: '#B4B1AB',
            font: { size: 11 },
            padding: 8,
            callback: function (value) {
              if (value >= 1000) {
                return '$' + (value / 1000).toFixed(1) + 'k';
              }
              return '$' + value;
            }
          },
          grid: {
            color: 'rgba(180, 177, 171, 0.15)',
            drawBorder: false,
            tickLength: 0
          },
          border: {
            display: false
          }
        }
      }
    },
    plugins: [verticalLinePlugin]
  });
}

/**
 * Show breakdown of sales for a specific day
 */
function showDayBreakdown(dayIndex) {
  if (!currentChartData) return;

  const sales = getSalesForDay(currentChartData.salesByDay, dayIndex);
  const dateKeys = Array.from(currentChartData.salesByDay.keys());
  const dateKey = dateKeys[dayIndex];
  const date = new Date(dateKey + 'T12:00:00');
  const dateStr = date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

  const modal = document.getElementById('day-breakdown-modal');
  const title = document.getElementById('day-breakdown-title');
  const content = document.getElementById('day-breakdown-content');

  if (!modal || !title || !content) return;

  title.textContent = dateStr;

  if (sales.length === 0) {
    content.innerHTML = `<p class="text-muted" style="text-align: center; padding: var(--spacing-lg);">No sales on this day</p>`;
  } else {
    content.innerHTML = sales.map(({ lot, sale }) => `
      <div class="day-sale-item">
        <div class="day-sale-info">
          <div class="day-sale-name">${lot.name}</div>
          <div class="day-sale-meta">${sale.unitsSold} unit${sale.unitsSold > 1 ? 's' : ''} on ${sale.platform === 'ebay' ? 'eBay' : 'Facebook'}</div>
        </div>
        <div class="day-sale-values">
          <div class="day-sale-revenue">${formatCurrency(sale.totalPrice)}</div>
          <div class="day-sale-profit ${sale.profit >= 0 ? 'text-success' : 'text-danger'}">${formatCurrency(sale.profit, true)}</div>
        </div>
      </div>
    `).join('');
  }

  modal.style.display = 'flex';
}

/**
 * Close the day breakdown modal
 */
function closeDayModal() {
  const modal = document.getElementById('day-breakdown-modal');
  if (modal) {
    modal.style.display = 'none';
  }
}

/**
 * Update chart without full page re-render
 */
function updateDashboard() {
  const salesData = getSalesForSelectedRange();
  const allLots = getLots();
  const unsoldUnits = allLots.reduce((sum, lot) => sum + (lot.remaining || 0), 0);
  const unsoldCostBasis = allLots.reduce((sum, lot) => sum + (lot.unitCost || 0) * (lot.remaining || 0), 0);
  const stats = calculateMonthlyStats(salesData);

  // Update time selector active state and current label
  document.querySelectorAll('.time-option').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.range === selectedRange);
  });

  const currentLabelEl = document.querySelector('.time-selector-current');
  if (currentLabelEl) {
    const labelMap = { '7d': '7D', '30d': '30D', '90d': '90D', 'all': 'All Time' };
    currentLabelEl.textContent = labelMap[selectedRange];
  }

  // Re-render chart
  initChart();

  // Update totals in header
  const profitClass = stats.totalProfit >= 0 ? 'text-success' : 'text-danger';
  const timeLabel = selectedRange === '7d' ? 'week' : selectedRange === '30d' ? 'month' : selectedRange === '90d' ? 'quarter' : 'lifetime';

  const revenueEl = document.querySelector('.chart-revenue-value');
  if (revenueEl) revenueEl.textContent = formatCurrency(stats.totalRevenue);

  const profitSubtitleEl = document.querySelector('.chart-profit-subtitle');
  if (profitSubtitleEl) {
    profitSubtitleEl.className = `chart-profit-subtitle ${profitClass}`;
    profitSubtitleEl.textContent = `${formatCurrency(Math.abs(stats.totalProfit))} profit this ${timeLabel}`;
  }
}

export function initDashboardEvents() {
  // Initialize chart on first load
  initChart();

  // Animate count-up for revenue and profit on page load
  setTimeout(() => {
    const revenueEl = document.querySelector('.chart-revenue-value');
    const profitEl = document.querySelector('.chart-profit-subtitle');
    
    if (revenueEl) {
      const revenueText = revenueEl.textContent;
      const revenueValue = parseFloat(revenueText.replace(/[$,]/g, '')) || 0;
      animateCountUp(revenueEl, 0, revenueValue, 800, (val) => formatCurrency(val));
    }
    
    if (profitEl) {
      const profitText = profitEl.textContent;
      const profitMatch = profitText.match(/[\d,]+\.?\d*/);
      if (profitMatch) {
        const profitValue = parseFloat(profitMatch[0].replace(/,/g, '')) || 0;
        const prefix = profitText.includes('-') ? '-' : '';
        const suffix = profitText.split(profitMatch[0])[1] || '';
        animateCountUp(profitEl, 0, profitValue, 800, (val) => {
          return (prefix ? '-$' : '$') + Math.abs(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + suffix;
        });
      }
    }
  }, 100);

  // Time selector accordion toggle
  const timeSelector = document.getElementById('time-selector');
  const trigger = timeSelector?.querySelector('.time-selector-trigger');

  trigger?.addEventListener('click', () => {
    timeSelector?.classList.toggle('open');
  });

  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (timeSelector && !timeSelector.contains(e.target)) {
      timeSelector.classList.remove('open');
    }
  });

  // Time option selection
  document.querySelectorAll('.time-option').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedRange = btn.dataset.range;
      timeSelector?.classList.remove('open');
      updateDashboard();
    });
  });

  // Day breakdown modal close
  document.getElementById('close-day-modal')?.addEventListener('click', closeDayModal);
  document.getElementById('day-breakdown-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'day-breakdown-modal') closeDayModal();
  });

  // Mark Returned buttons
  document.querySelectorAll('.mark-returned-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const lotId = btn.dataset.lotId;
      if (confirm('Mark this item as returned? It will be removed from inventory.')) {
        markReturned(lotId);
        window.dispatchEvent(new CustomEvent('viewchange'));
      }
    });
  });

  // Keeping It buttons
  document.querySelectorAll('.keeping-it-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const lotId = btn.dataset.lotId;
      dismissReturnAlert(lotId);
      window.dispatchEvent(new CustomEvent('viewchange'));
    });
  });
}
