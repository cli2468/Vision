// Desktop Dashboard Layout Component - 12-column grid layout for desktop

import { getAllSales, getSalesByDateRange, getLots, getLotTotalProfit, getLotsNearingReturnDeadline } from '../services/storage.js';
import { calculateMonthlyStats, formatCurrency } from '../services/calculations.js';
import { aggregateSalesByDay } from '../services/chartData.js';
import { navigate } from '../router.js';

// Current selected time range for dashboard
let selectedRange = '30d'; // '7d' | '30d' | '90d' | 'all'
let desktopChartInstance = null;
let desktopChartData = null;
let desktopPieChartInstance = null;

export function DesktopDashboardView() {
  const salesData = getAllSales();
  const allLots = getLots();
  const unsoldUnits = allLots.reduce((sum, lot) => sum + (lot.remaining || 0), 0);
  const unsoldCostBasis = allLots.reduce((sum, lot) => sum + (lot.unitCost || 0) * (lot.remaining || 0), 0);
  const stats = calculateMonthlyStats(salesData);
  const lotsNearingDeadline = getLotsNearingReturnDeadline(3);
  
  // Calculate trends (current 30 days vs previous 30 days)
  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const sixtyDaysAgo = new Date(now);
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
  
  const currentPeriodSales = getSalesByDateRange(thirtyDaysAgo, now);
  const previousPeriodSales = getSalesByDateRange(sixtyDaysAgo, thirtyDaysAgo);
  
  const currentStats = calculateMonthlyStats(currentPeriodSales);
  const previousStats = calculateMonthlyStats(previousPeriodSales);
  
  // Get recent sales for table - salesData contains { lot, sale } objects
  const recentSales = salesData
    .sort((a, b) => {
      const dateA = a.sale?.dateSold ? new Date(a.sale.dateSold) : new Date(0);
      const dateB = b.sale?.dateSold ? new Date(b.sale.dateSold) : new Date(0);
      return dateB - dateA;
    })
    .slice(0, 10);

  return `
    <div class="desktop-dashboard">
      <!-- Row 1: KPI Cards -->
      <div class="dashboard-grid-row kpi-row">
        ${renderKpiCard({
          label: 'Total Revenue',
          value: formatCurrency(stats.totalRevenue),
          trend: calculateTrend(currentStats.totalRevenue, previousStats.totalRevenue),
          sparkline: generateSparkline(currentPeriodSales, 'revenue'),
          type: 'revenue'
        })}
        
        ${renderKpiCard({
          label: 'Net Profit',
          value: formatCurrency(stats.totalProfit),
          trend: calculateTrend(currentStats.totalProfit, previousStats.totalProfit),
          sparkline: generateSparkline(currentPeriodSales, 'profit'),
          type: 'profit'
        })}
        
        ${renderKpiCard({
          label: 'Inventory Value',
          value: formatCurrency(unsoldCostBasis),
          subtext: `${unsoldUnits} units`,
          sparkline: generateInventorySparkline(allLots),
          type: 'inventory'
        })}
        
        ${renderKpiCard({
          label: 'Return Alerts',
          value: lotsNearingDeadline.length.toString(),
          subtext: lotsNearingDeadline.length > 0 ? 'Need attention' : 'All clear',
          alert: lotsNearingDeadline.length > 0,
          type: 'alert'
        })}
      </div>
      
      <!-- Row 2: Chart + Distribution -->
      <div class="dashboard-grid-row">
        <div class="chart-section-large">
          <div class="section-header">
            <h3 class="section-title">Revenue Trend</h3>
            <div class="date-range-filter">
              <button class="filter-btn ${selectedRange === '7d' ? 'active' : ''}" data-range="7d">7D</button>
              <button class="filter-btn ${selectedRange === '30d' ? 'active' : ''}" data-range="30d">30D</button>
              <button class="filter-btn ${selectedRange === '90d' ? 'active' : ''}" data-range="90d">90D</button>
              <button class="filter-btn ${selectedRange === 'all' ? 'active' : ''}" data-range="all">All</button>
            </div>
          </div>
          <div class="chart-container">
            <canvas id="desktop-revenue-chart"></canvas>
          </div>
        </div>
        
        <div class="chart-section-small">
          <div class="section-header">
            <h3 class="section-title">Platform Split</h3>
          </div>
          <div class="chart-container pie-chart-container">
            <canvas id="desktop-platform-chart"></canvas>
          </div>
          <div class="platform-legend">
            ${renderPlatformLegend(salesData)}
          </div>
        </div>
      </div>
      
      <!-- Row 3: Sales Table + Inventory Alerts -->
      <div class="dashboard-grid-row">
        <div class="table-section">
          <div class="section-header">
            <h3 class="section-title">Recent Sales</h3>
            <button class="view-all-btn" id="view-all-sales-btn">View All</button>
          </div>
          <div class="sales-table-container">
            <table class="sales-table">
              <thead>
                <tr>
                  <th class="sortable" data-sort="date">Date</th>
                  <th class="sortable" data-sort="item">Item</th>
                  <th class="sortable" data-sort="platform">Platform</th>
                  <th class="sortable" data-sort="revenue">Revenue</th>
                  <th class="sortable" data-sort="profit">Profit</th>
                </tr>
              </thead>
              <tbody>
                ${renderSalesTableRows(recentSales, allLots)}
              </tbody>
            </table>
          </div>
        </div>
        
        <div class="alerts-section">
          <div class="section-header">
            <h3 class="section-title">Inventory Alerts</h3>
          </div>
          <div class="alerts-list">
            ${renderAlertsList(lotsNearingDeadline)}
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderPlatformLegend(salesData) {
  const platformStats = {};
  salesData.forEach(({ lot, sale }) => {
    // Defensive check
    if (!sale) return;
    
    const platform = sale.platform || 'unknown';
    if (!platformStats[platform]) {
      platformStats[platform] = { count: 0, revenue: 0 };
    }
    platformStats[platform].count++;
    platformStats[platform].revenue += Number(sale.totalPrice) || 0;
  });
  
  const colors = {
    facebook: '#1877F2',
    ebay: '#E53238'
  };
  
  return Object.entries(platformStats).map(([platform, stats]) => `
    <div class="platform-legend-item">
      <span class="legend-dot" style="background: ${colors[platform] || '#999'}"></span>
      <span class="legend-label">${platform === 'facebook' ? 'Facebook' : 'eBay'}</span>
      <span class="legend-value">${formatCurrency(stats.revenue)}</span>
    </div>
  `).join('');
}

function renderSalesTableRows(sales, lots) {
  if (sales.length === 0) {
    return `<tr><td colspan="5" class="empty-state">No sales yet</td></tr>`;
  }
  
  return sales.map(({ lot, sale }) => {
    // Defensive checks
    if (!sale) return '';
    
    const lotName = lot?.name || 'Unknown';
    const dateStr = sale.dateSold;
    let dateDisplay = '—';
    
    if (dateStr && dateStr !== 'Invalid Date') {
      try {
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
          dateDisplay = date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric'
          });
        }
      } catch (e) {
        dateDisplay = '—';
      }
    }
    
    const platform = sale.platform || 'unknown';
    const totalPrice = Number(sale.totalPrice) || 0;
    const profit = Number(sale.profit) || 0;
    
    return `
      <tr>
        <td>${dateDisplay}</td>
        <td>${lotName}</td>
        <td>
          <span class="platform-badge ${platform}">
            ${platform === 'facebook' ? 'Facebook' : platform === 'ebay' ? 'eBay' : 'Unknown'}
          </span>
        </td>
        <td>${formatCurrency(totalPrice)}</td>
        <td class="${profit >= 0 ? 'positive' : 'negative'}">
          ${formatCurrency(profit, true)}
        </td>
      </tr>
    `;
  }).join('');
}

function renderAlertsList(lots) {
  if (lots.length === 0) {
    return `
      <div class="alert-empty">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
          <polyline points="22 4 12 14.01 9 11.01"></polyline>
        </svg>
        <p>No alerts</p>
        <span>All items are within return windows</span>
      </div>
    `;
  }
  
  return lots.map(lot => {
    const deadline = new Date(lot.purchaseDate);
    deadline.setDate(deadline.getDate() + (lot.returnDays || 30));
    const daysLeft = Math.ceil((deadline - new Date()) / (1000 * 60 * 60 * 24));
    
    return `
      <div class="alert-card ${daysLeft <= 1 ? 'urgent' : 'warning'}">
        <div class="alert-icon">⚠️</div>
        <div class="alert-content">
          <div class="alert-title">${lot.name}</div>
          <div class="alert-meta">${lot.remaining} units • ${daysLeft} days left</div>
        </div>
        <button class="alert-action" data-lot-id="${lot.id}">View</button>
      </div>
    `;
  }).join('');
}

/**
 * Render a KPI card with trend and sparkline
 */
function renderKpiCard({ label, value, trend, subtext, sparkline, type, alert }) {
  const trendHtml = trend ? `
    <div class="kpi-trend ${trend.direction}">
      <span class="trend-arrow">${trend.direction === 'up' ? '↑' : trend.direction === 'down' ? '↓' : '→'}</span>
      <span class="trend-value">${trend.value}%</span>
      <span class="trend-label">vs last 30d</span>
    </div>
  ` : subtext ? `
    <div class="kpi-subtext">${subtext}</div>
  ` : '';
  
  const sparklineHtml = sparkline ? `
    <div class="kpi-sparkline">${sparkline}</div>
  ` : '';
  
  const cardClass = `kpi-card kpi-${type}${alert ? ' kpi-alert' : ''}`;
  
  return `
    <div class="${cardClass}">
      <div class="kpi-content">
        <div class="kpi-header">
          <div class="kpi-label">${label}</div>
        </div>
        <div class="kpi-body">
          <div class="kpi-value">${value}</div>
          ${trendHtml}
        </div>
      </div>
      ${sparklineHtml}
    </div>
  `;
}

/**
 * Calculate trend percentage between current and previous values
 */
function calculateTrend(current, previous) {
  if (previous === 0) {
    return current > 0 ? { direction: 'up', value: '∞' } : { direction: 'neutral', value: '0' };
  }
  
  const percentChange = Math.round(((current - previous) / previous) * 100);
  
  if (percentChange > 0) {
    return { direction: 'up', value: Math.abs(percentChange) };
  } else if (percentChange < 0) {
    return { direction: 'down', value: Math.abs(percentChange) };
  }
  
  return { direction: 'neutral', value: '0' };
}

/**
 * Generate sparkline SVG for sales data
 */
function generateSparkline(salesData, metric) {
  if (salesData.length === 0) {
    return `<svg viewBox="0 0 80 24" class="sparkline"><line x1="0" y1="12" x2="80" y2="12" stroke="rgba(255,255,255,0.1)" stroke-width="1"/></svg>`;
  }
  
  // Group sales by day
  const dailyData = {};
  const now = new Date();
  
  // Initialize last 14 days
  for (let i = 13; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const key = date.toISOString().split('T')[0];
    dailyData[key] = 0;
  }
  
  // Aggregate sales
  salesData.forEach(({ sale }) => {
    if (!sale) return;
    const date = new Date(sale.dateSold);
    const key = date.toISOString().split('T')[0];
    if (dailyData.hasOwnProperty(key)) {
      const value = metric === 'revenue' ? (Number(sale.totalPrice) || 0) : (Number(sale.profit) || 0);
      dailyData[key] += value / 100; // Convert to dollars
    }
  });
  
  const values = Object.values(dailyData);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  
  // Generate SVG path
  const width = 80;
  const height = 24;
  const stepX = width / (values.length - 1);
  
  const points = values.map((val, i) => {
    const x = i * stepX;
    const y = height - ((val - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  });
  
  const pathData = `M${points.join(' L')}`;
  const strokeColor = metric === 'profit' ? '#10B981' : 'rgba(255,255,255,0.4)';
  
  return `
    <svg viewBox="0 0 80 24" class="sparkline" preserveAspectRatio="none">
      <path d="${pathData}" fill="none" stroke="${strokeColor}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `;
}

/**
 * Generate sparkline for inventory trend (placeholder - shows flat line)
 */
function generateInventorySparkline(lots) {
  // For inventory, we show a simple indicator rather than a trend
  return `<svg viewBox="0 0 80 24" class="sparkline sparkline-inventory">
    <rect x="60" y="6" width="16" height="12" rx="2" fill="rgba(255,255,255,0.1)"/>
    <rect x="40" y="8" width="16" height="8" rx="2" fill="rgba(255,255,255,0.15)"/>
    <rect x="20" y="10" width="16" height="4" rx="2" fill="rgba(255,255,255,0.2)"/>
  </svg>`;
}

/**
 * Initialize and render the desktop revenue chart with logging
 */
function initDesktopRevenueChart() {
  console.log('[DEBUG] Starting desktop chart initialization...');
  
  const canvas = document.getElementById('desktop-revenue-chart');
  if (!canvas) {
    console.error('[DEBUG] Canvas element #desktop-revenue-chart not found');
    return;
  }
  
  console.log('[DEBUG] Canvas element found:', canvas);
  
  if (typeof Chart === 'undefined') {
    console.error('[DEBUG] Chart.js library not loaded');
    return;
  }
  
  console.log('[DEBUG] Chart.js is available');
  
  // Get sales data based on selected range
  let salesData;
  if (selectedRange === 'all') {
    salesData = getAllSales();
  } else {
    const now = new Date();
    now.setHours(23, 59, 59, 999);
    const startDate = new Date(now);
    const days = selectedRange === '7d' ? 6 : selectedRange === '90d' ? 89 : 29;
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);
    salesData = getSalesByDateRange(startDate, now);
  }
  
  console.log('[DEBUG] Raw sales data count:', salesData.length);
  console.log('[DEBUG] Raw sales data sample:', salesData.slice(0, 3));
  
  // Aggregate sales by day
  desktopChartData = aggregateSalesByDay(salesData, selectedRange);
  
  console.log('[DEBUG] Processed chart data:', {
    labelsCount: desktopChartData.labels.length,
    labels: desktopChartData.labels,
    cumulativeRevenues: desktopChartData.cumulativeRevenues,
    revenues: desktopChartData.revenues,
    dataIsEmpty: desktopChartData.cumulativeRevenues.every(v => v === 0)
  });
  
  const { labels, cumulativeRevenues } = desktopChartData;
  
  // Validate data
  if (!labels || labels.length === 0) {
    console.error('[DEBUG] No labels generated for chart');
    return;
  }
  
  if (!cumulativeRevenues || cumulativeRevenues.length === 0) {
    console.error('[DEBUG] No revenue data generated for chart');
    return;
  }
  
  console.log('[DEBUG] Data validation passed - labels:', labels.length, 'revenues:', cumulativeRevenues.length);
  
  // Calculate Y-axis step size
  const maxRevenue = Math.max(...cumulativeRevenues, 0);
  const niceSteps = [100, 500, 1000, 2000];
  let stepSize = 2000;
  for (const step of niceSteps) {
    const intervals = maxRevenue / step;
    if (intervals >= 4 && intervals <= 5) {
      stepSize = step;
      break;
    } else if (intervals < 4) {
      stepSize = step;
      break;
    }
    stepSize = step;
  }
  
  let targetIntervals = Math.ceil(maxRevenue / stepSize);
  targetIntervals = Math.max(4, Math.min(5, targetIntervals));
  const yMax = targetIntervals * stepSize;
  
  console.log('[DEBUG] Y-axis config - maxRevenue:', maxRevenue, 'stepSize:', stepSize, 'yMax:', yMax);
  
  // Destroy existing chart
  if (desktopChartInstance) {
    console.log('[DEBUG] Destroying existing chart instance');
    desktopChartInstance.destroy();
  }
  
  const ctx = canvas.getContext('2d');
  
  // Create gradient - muted, cohesive color
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height || 200);
  gradient.addColorStop(0, 'rgba(107, 139, 174, 0.2)');
  gradient.addColorStop(0.5, 'rgba(107, 139, 174, 0.08)');
  gradient.addColorStop(1, 'rgba(107, 139, 174, 0)');
  
  console.log('[DEBUG] Creating Chart.js instance...');
  
  try {
    desktopChartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Revenue',
          data: cumulativeRevenues,
          backgroundColor: gradient,
          borderColor: '#8BA3C4',
          borderWidth: 1.5,
          tension: 0.4,
          fill: true,
          pointBackgroundColor: '#8BA3C4',
          pointBorderColor: '#1C180D',
          pointBorderWidth: 1.5,
          pointRadius: 0,
          pointHoverRadius: 4,
          pointHoverBackgroundColor: '#8BA3C4',
          pointHoverBorderColor: '#1C180D',
          pointHoverBorderWidth: 2,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: 800,
          easing: 'easeOutQuart'
        },
        interaction: {
          intersect: false,
          mode: 'index'
        },
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            enabled: true,
            backgroundColor: 'rgba(28, 24, 13, 0.95)',
            titleColor: 'rgba(255, 255, 255, 0.8)',
            bodyColor: 'rgba(255, 255, 255, 0.9)',
            borderColor: 'rgba(255, 255, 255, 0.1)',
            borderWidth: 1,
            padding: 10,
            cornerRadius: 6,
            displayColors: false,
            callbacks: {
              title: function(context) {
                return context[0].label;
              },
              label: function(context) {
                const value = context.raw;
                return 'Revenue: $' + value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
              }
            }
          }
        },
        scales: {
          x: {
            grid: {
              display: false
            },
            ticks: {
              color: 'rgba(255, 255, 255, 0.4)',
              font: { size: 10 },
              maxRotation: 0,
              autoSkip: selectedRange !== '7d',
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
              color: 'rgba(255, 255, 255, 0.4)',
              font: { size: 10 },
              padding: 6,
              callback: function(value) {
                if (value >= 1000) {
                  return '$' + (value / 1000).toFixed(1) + 'k';
                }
                return '$' + value;
              }
            },
            grid: {
              color: 'rgba(255, 255, 255, 0.06)',
              drawBorder: false,
              tickLength: 0
            },
            border: {
              display: false
            }
          }
        }
      }
    });
    
    console.log('[DEBUG] Chart successfully created!');
    console.log('[DEBUG] Chart instance:', desktopChartInstance);
    console.log('[DEBUG] Chart data:', desktopChartInstance.data);
  } catch (error) {
    console.error('[DEBUG] Error creating chart:', error);
  }
}

/**
 * Aggregate sales data by platform for pie chart
 * @param {Array} salesData - Array of { lot, sale } objects
 * @returns {Object} { labels: [], data: [], colors: [], revenues: {} }
 */
function aggregateSalesByPlatform(salesData) {
  console.log('[DEBUG] Aggregating sales by platform...');
  
  const platformStats = {};
  let totalRevenue = 0;
  
  salesData.forEach(({ lot, sale }) => {
    if (!sale) return;
    
    const platform = sale.platform || 'unknown';
    const revenue = Number(sale.totalPrice) || 0;
    
    if (!platformStats[platform]) {
      platformStats[platform] = { count: 0, revenue: 0 };
    }
    platformStats[platform].count++;
    platformStats[platform].revenue += revenue;
    totalRevenue += revenue;
  });
  
  console.log('[DEBUG] Platform stats:', platformStats, 'Total revenue:', totalRevenue);
  
  // Muted, cohesive color palette
  const platformColors = {
    facebook: '#6B8BAE',
    ebay: '#9B7B6B',
    unknown: '#6B6B6B'
  };
  
  const platformLabels = {
    facebook: 'Facebook',
    ebay: 'eBay',
    unknown: 'Other'
  };
  
  const labels = [];
  const data = [];
  const colors = [];
  const revenues = {};
  
  Object.entries(platformStats).forEach(([platform, stats]) => {
    labels.push(platformLabels[platform] || platform);
    data.push(stats.revenue / 100); // Convert cents to dollars
    colors.push(platformColors[platform] || '#999999');
    revenues[platform] = stats.revenue;
  });
  
  return { labels, data, colors, revenues, totalRevenue, platformStats };
}

/**
 * Initialize and render the desktop platform pie chart
 */
function initDesktopPlatformChart() {
  console.log('[DEBUG] Starting desktop platform pie chart initialization...');
  
  const canvas = document.getElementById('desktop-platform-chart');
  if (!canvas) {
    console.error('[DEBUG] Canvas element #desktop-platform-chart not found');
    return;
  }
  
  console.log('[DEBUG] Pie chart canvas found:', canvas);
  
  if (typeof Chart === 'undefined') {
    console.error('[DEBUG] Chart.js library not loaded');
    return;
  }
  
  // Get sales data based on selected range
  let salesData;
  if (selectedRange === 'all') {
    salesData = getAllSales();
  } else {
    const now = new Date();
    now.setHours(23, 59, 59, 999);
    const startDate = new Date(now);
    const days = selectedRange === '7d' ? 6 : selectedRange === '90d' ? 89 : 29;
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);
    salesData = getSalesByDateRange(startDate, now);
  }
  
  console.log('[DEBUG] Pie chart - sales data count:', salesData.length);
  
  // Handle empty dataset
  if (salesData.length === 0) {
    console.log('[DEBUG] No sales data for pie chart, showing empty state');
    // Clear any existing chart
    if (desktopPieChartInstance) {
      desktopPieChartInstance.destroy();
      desktopPieChartInstance = null;
    }
    // Show "No data" message in canvas
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#666';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('No sales data', canvas.width / 2, canvas.height / 2);
    return;
  }
  
  // Aggregate by platform
  const { labels, data, colors, revenues, totalRevenue } = aggregateSalesByPlatform(salesData);
  
  console.log('[DEBUG] Pie chart data:', { labels, data, colors });
  
  // Validate data
  if (data.length === 0 || data.every(v => v === 0)) {
    console.error('[DEBUG] No platform data to display');
    return;
  }
  
  console.log('[DEBUG] Pie chart data validation passed');
  
  // Destroy existing chart
  if (desktopPieChartInstance) {
    console.log('[DEBUG] Destroying existing pie chart instance');
    desktopPieChartInstance.destroy();
  }
  
  const ctx = canvas.getContext('2d');
  
  console.log('[DEBUG] Creating pie chart...');
  
  try {
    desktopPieChartInstance = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: data,
          backgroundColor: colors,
          borderColor: 'rgba(28, 24, 13, 0.8)',
          borderWidth: 1.5,
          hoverOffset: 3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '55%',
        animation: {
          duration: 600,
          easing: 'easeOutQuart'
        },
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            enabled: true,
            backgroundColor: 'rgba(28, 24, 13, 0.95)',
            titleColor: 'rgba(255, 255, 255, 0.8)',
            bodyColor: 'rgba(255, 255, 255, 0.9)',
            borderColor: 'rgba(255, 255, 255, 0.1)',
            borderWidth: 1,
            padding: 10,
            cornerRadius: 6,
            displayColors: true,
            callbacks: {
              label: function(context) {
                const value = context.raw;
                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
                return `${context.label}: $${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${percentage}%)`;
              }
            }
          }
        }
      }
    });
    
    console.log('[DEBUG] Pie chart successfully created!');
    
    // Update the legend with percentages
    updatePlatformLegend(labels, data, colors, revenues, totalRevenue);
    
  } catch (error) {
    console.error('[DEBUG] Error creating pie chart:', error);
  }
}

/**
 * Update the platform legend with data from the pie chart
 */
function updatePlatformLegend(labels, data, colors, revenues, totalRevenue) {
  const legendContainer = document.querySelector('.platform-legend');
  if (!legendContainer) return;
  
  const total = data.reduce((a, b) => a + b, 0);
  
  const legendHtml = labels.map((label, index) => {
    const value = data[index];
    const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
    const color = colors[index];
    const revenue = revenues[label.toLowerCase()] || 0;
    
    return `
      <div class="platform-legend-item">
        <span class="legend-dot" style="background: ${color}"></span>
        <span class="legend-label">${label}</span>
        <span class="legend-percentage">${percentage}%</span>
        <span class="legend-value">${formatCurrency(revenue)}</span>
      </div>
    `;
  }).join('');
  
  legendContainer.innerHTML = legendHtml;
}

export function initDesktopDashboardEvents() {
  console.log('[DEBUG] Initializing desktop dashboard events...');
  
  // Initialize charts immediately
  initDesktopRevenueChart();
  initDesktopPlatformChart();
  
  // Date range filter
  document.querySelectorAll('.filter-btn[data-range]').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedRange = btn.dataset.range;
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      // Reinitialize charts with new range
      console.log('[DEBUG] Range changed to:', selectedRange);
      initDesktopRevenueChart();
      initDesktopPlatformChart();
    });
  });
  
  // Table sorting
  document.querySelectorAll('.sortable').forEach(th => {
    th.addEventListener('click', () => {
      const sortKey = th.dataset.sort;
      // Toggle sort direction
      th.classList.toggle('asc');
      th.classList.toggle('desc');
      // Would implement actual sorting here
    });
  });
  
  // Alert actions
  document.querySelectorAll('.alert-action').forEach(btn => {
    btn.addEventListener('click', () => {
      const lotId = btn.dataset.lotId;
      // Navigate to inventory with lot highlighted
      window.dispatchEvent(new CustomEvent('viewchange'));
    });
  });
  
  // View All button - navigate to Sales page
  const viewAllBtn = document.getElementById('view-all-sales-btn');
  if (viewAllBtn) {
    viewAllBtn.addEventListener('click', () => {
      console.log('[DEBUG] View All clicked, navigating to /sales');
      navigate('/sales');
    });
  }

  // Keyboard shortcut for Record Sale
  document.addEventListener('keydown', (e) => {
    if (e.key === 'r' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      // Could trigger quick sale modal
    }
  });
}
