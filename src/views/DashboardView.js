// Dashboard View - Revenue/Profit chart with time-range filtering and Return Alerts

import { getAllSales, getSalesByDateRange, getLots, getLotsNearingReturnDeadline, getReturnDeadline, markReturned, dismissReturnAlert } from '../services/storage.js';
import { calculateMonthlyStats, formatCurrency } from '../services/calculations.js';
import { aggregateSalesByDay, getSalesForDay } from '../services/chartData.js';

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
        <h1 class="page-title">Dashboard</h1>
        
        ${returnAlertsHtml}
        
        <div class="chart-card">
      <div class="chart-header">
        <div class="chart-title-section">
          <div class="chart-main-title">Total revenue</div>
          <div class="chart-subtitle ${stats.totalProfit >= 0 ? 'text-success' : 'text-danger'}">
            ${stats.totalProfit >= 0 ? 'Gained' : 'Lost'} ${formatCurrency(Math.abs(stats.totalProfit))} this ${selectedRange === '7d' ? 'week' : selectedRange === '30d' ? 'month' : selectedRange === '90d' ? 'quarter' : 'period'}
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
        
        <div class="card" style="margin-bottom: var(--spacing-lg);">
          <h3 class="section-title">Summary</h3>
          <div class="summary-box">
            <div class="summary-row">
              <span class="text-secondary">Revenue</span>
              <span class="summary-value">${formatCurrency(stats.totalRevenue)}</span>
            </div>
            <div class="summary-row">
              <span class="text-secondary">Cost of Goods</span>
              <span class="summary-value">-${formatCurrency(stats.totalCosts)}</span>
            </div>
            <div class="summary-row">
              <span class="text-secondary">Platform Fees</span>
              <span class="summary-value">-${formatCurrency(stats.totalFees)}</span>
            </div>
            <div class="summary-row ${stats.totalProfit >= 0 ? 'profit' : 'loss'}">
              <span>Net Profit</span>
              <span class="summary-value">${formatCurrency(stats.totalProfit)}</span>
            </div>
          </div>
        </div>
        
        <div class="card">
          <h3 class="section-title">Inventory Status</h3>
          <div class="stats-grid" style="margin-bottom: 0;">
            <div class="stat-card">
              <div class="stat-value">${unsoldUnits}</div>
              <div class="stat-label">Unsold Units</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">${formatCurrency(unsoldCostBasis)}</div>
              <div class="stat-label">Cost Basis</div>
            </div>
          </div>
        </div>
        
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
          <div class="chart-main-title">Total revenue</div>
          <div class="chart-subtitle ${profitClass}">
            ${stats.totalProfit >= 0 ? 'Gained' : 'Lost'} ${formatCurrency(Math.abs(stats.totalProfit))} this ${selectedRange === '7d' ? 'week' : selectedRange === '30d' ? 'month' : selectedRange === '90d' ? 'quarter' : 'period'}
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
 * Initialize and render the chart
 */
function initChart() {
  const canvas = document.getElementById('dashboard-chart');
  if (!canvas || typeof Chart === 'undefined') return;

  const salesData = getSalesForSelectedRange();
  currentChartData = aggregateSalesByDay(salesData, selectedRange);

  const { labels, cumulativeProfits } = currentChartData;

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
        label: 'Profit',
        data: cumulativeProfits,
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
        duration: 600,
        easing: 'easeOutQuart'
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
              return '$' + value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
            autoSkip: true,
            maxTicksLimit: 6
          },
          border: {
            display: false
          }
        },
        y: {
          min: 0,
          maxTicksLimit: 5,
          grid: {
            color: 'rgba(180, 177, 171, 0.15)',
            drawBorder: false,
            tickLength: 0
          },
          ticks: {
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

  // Update range button active states
  document.querySelectorAll('.pill-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.range === selectedRange);
  });

  // Re-render chart
  initChart();

  // Update totals
  const profitClass = stats.totalProfit >= 0 ? 'text-success' : 'text-danger';
  const totalsHtml = `
    <div class="chart-total-item">
      <span class="chart-total-value">${formatCurrency(stats.totalRevenue)}</span>
      <span class="chart-total-label">Revenue</span>
    </div>
    <div class="chart-total-item">
      <span class="chart-total-value ${profitClass}">${formatCurrency(stats.totalProfit)}</span>
      <span class="chart-total-label">Profit</span>
    </div>
  `;
  const totalsEl = document.querySelector('.chart-totals');
  if (totalsEl) totalsEl.innerHTML = totalsHtml;
}

export function initDashboardEvents() {
  // Initialize chart on first load
  initChart();

  // Time range pill buttons
  document.querySelectorAll('.pill-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedRange = btn.dataset.range;
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
