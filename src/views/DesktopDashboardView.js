import { getAllSales, getSalesByDateRange, getLots, getLotTotalProfit } from '../services/storage.js';
import { calculateMonthlyStats, formatCurrency } from '../services/calculations.js';
import { aggregateSalesByDay, aggregateSalesForChart } from '../services/chartData.js';
import { navigate } from '../router.js';
import { auth } from '../services/firebase.js';

let selectedRange = '30d';
let desktopChartInstance = null;
let desktopChartData = null;

function getCssVar(name, fallback) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

export function DesktopDashboardView() {
  const salesData = getAllSales();
  const allLots = getLots();
  const unsoldUnits = allLots.reduce((sum, lot) => sum + (lot.remaining || 0), 0);
  const unsoldCostBasis = allLots.reduce((sum, lot) => sum + (lot.unitCost || 0) * (lot.remaining || 0), 0);
  const rawName = auth.currentUser?.displayName?.split(' ')[0] || '';
  const userName = rawName ? rawName.charAt(0).toUpperCase() + rawName.slice(1).toLowerCase() : 'there';

  const now = new Date();
  now.setHours(23, 59, 59, 999);
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  thirtyDaysAgo.setHours(0, 0, 0, 0);
  const sixtyDaysAgo = new Date(now);
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
  sixtyDaysAgo.setHours(0, 0, 0, 0);

  const currentPeriodSales = getSalesByDateRange(thirtyDaysAgo, now);
  const previousPeriodSales = getSalesByDateRange(sixtyDaysAgo, thirtyDaysAgo);

  const currentStats = calculateMonthlyStats(currentPeriodSales);
  const previousStats = calculateMonthlyStats(previousPeriodSales);
  const inventoryValueThirtyDaysAgo = calculateInventoryValueAtDate(allLots, thirtyDaysAgo);
  const prevUnsoldUnits = calculateInventoryQtyAtDate(allLots, thirtyDaysAgo);

  const profitMargin = currentStats.totalRevenue > 0
    ? Math.round((currentStats.totalProfit / currentStats.totalRevenue) * 100)
    : 0;
  const prevProfitMargin = previousStats.totalRevenue > 0
    ? Math.round((previousStats.totalProfit / previousStats.totalRevenue) * 100)
    : 0;

  const kpiMetrics = [
    {
      label: 'Total Revenue',
      value: formatCurrency(currentStats.totalRevenue),
      trend: calculateTrend(currentStats.totalRevenue, previousStats.totalRevenue),
    },
    {
      label: 'Profit Margin',
      value: `${profitMargin}%`,
      trend: calculateTrend(profitMargin, prevProfitMargin),
    },
    {
      label: 'Inventory Value',
      value: formatCurrency(unsoldCostBasis),
      trend: calculateTrend(unsoldCostBasis, inventoryValueThirtyDaysAgo),
    },
    {
      label: 'Inventory Qty',
      value: unsoldUnits.toString(),
      trend: calculateTrend(unsoldUnits, prevUnsoldUnits),
    },
    {
      label: 'Items Sold',
      value: currentStats.unitsSold.toString(),
      trend: calculateTrend(currentStats.unitsSold, previousStats.unitsSold),
    },
  ];

  const recentSales = [...salesData]
    .sort((a, b) => {
      const dateA = a.sale?.dateSold ? new Date(a.sale.dateSold) : new Date(0);
      const dateB = b.sale?.dateSold ? new Date(b.sale.dateSold) : new Date(0);
      return dateB - dateA;
    })
    .slice(0, 7);

  return `
    <div class="desktop-dashboard vision-desktop-dashboard">
      <div class="dashboard-intro">
        <h2 class="dashboard-greeting">Welcome back${userName ? `, ${userName}` : ''}</h2>
        <p class="dashboard-greeting-subtext">Here's what's happening today.</p>
      </div>

      <div class="kpi-pill">
        ${kpiMetrics.map((m, i) => `
          ${i > 0 ? '<div class="kpi-pill-divider"></div>' : ''}
          <div class="kpi-pill-cell">
            <span class="kpi-pill-label">${m.label}</span>
            <span class="kpi-pill-value">${m.value}</span>
            ${renderPillTrend(m.trend)}
          </div>
        `).join('')}
      </div>

      <div class="dashboard-mid-row">
        <div class="chart-section-large revenue-panel">
          <div class="section-header">
            <h3 class="section-title">Revenue</h3>
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

        <div class="chart-section-small segmentation-panel">
          <div class="section-header">
            <h3 class="section-title">Segmentation</h3>
          </div>
          ${renderSegmentation(salesData)}
        </div>
      </div>

      <div class="dashboard-bottom-row">
        <div class="bottom-card">
          ${renderTopPerformersPanel(allLots)}
        </div>
        <div class="bottom-card">
          ${renderRecentSalesCard(recentSales, allLots)}
        </div>
      </div>
    </div>
  `;
}

function renderPillTrend(trend) {
  if (!trend) return '';
  const arrow = trend.direction === 'up' ? '↑' : trend.direction === 'down' ? '↓' : '→';
  const cls = trend.direction === 'up' ? 'trend-up' : trend.direction === 'down' ? 'trend-down' : 'trend-neutral';
  return `<span class="kpi-pill-trend"><span class="${cls}">${trend.value}% ${arrow}</span> vs Last Month</span>`;
}

function calculateInventoryValueAtDate(lots, atDate) {
  const targetTime = atDate.getTime();
  return lots.reduce((sum, lot) => {
    const purchaseDate = new Date(lot.purchaseDate).getTime();
    if (Number.isNaN(purchaseDate) || purchaseDate > targetTime) return sum;
    const quantity = Number(lot.quantity) || 0;
    const unitCost = Number(lot.unitCost) || 0;
    const currentRemaining = Number(lot.remaining) || 0;
    const unitsSoldAfterDate = (lot.sales || []).reduce((salesSum, sale) => {
      const soldAt = new Date(sale.dateSold).getTime();
      if (!Number.isNaN(soldAt) && soldAt > targetTime) {
        return salesSum + (Number(sale.unitsSold) || 0);
      }
      return salesSum;
    }, 0);
    const remainingAtDate = Math.min(quantity, Math.max(0, currentRemaining + unitsSoldAfterDate));
    return sum + (remainingAtDate * unitCost);
  }, 0);
}

function calculateInventoryQtyAtDate(lots, atDate) {
  const targetTime = atDate.getTime();
  return lots.reduce((sum, lot) => {
    const purchaseDate = new Date(lot.purchaseDate).getTime();
    if (Number.isNaN(purchaseDate) || purchaseDate > targetTime) return sum;
    const quantity = Number(lot.quantity) || 0;
    const currentRemaining = Number(lot.remaining) || 0;
    const unitsSoldAfterDate = (lot.sales || []).reduce((salesSum, sale) => {
      const soldAt = new Date(sale.dateSold).getTime();
      if (!Number.isNaN(soldAt) && soldAt > targetTime) {
        return salesSum + (Number(sale.unitsSold) || 0);
      }
      return salesSum;
    }, 0);
    return sum + Math.min(quantity, Math.max(0, currentRemaining + unitsSoldAfterDate));
  }, 0);
}

function renderSegmentation(salesData) {
  const platformStats = {};
  let totalRevenue = 0;
  salesData.forEach(({ lot, sale }) => {
    if (!sale) return;
    const platform = sale.platform || 'unknown';
    if (!platformStats[platform]) platformStats[platform] = { count: 0, revenue: 0 };
    platformStats[platform].count++;
    const rev = Number(sale.totalPrice) || 0;
    platformStats[platform].revenue += rev;
    totalRevenue += rev;
  });

  const colors = {
    facebook: 'var(--platform-facebook)',
    ebay: 'var(--platform-ebay)',
    unknown: 'var(--platform-other)',
  };
  const labels = { facebook: 'Facebook', ebay: 'eBay', unknown: 'Other' };
  const icons = {
    facebook: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>`,
    ebay: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
    unknown: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>`,
  };

  const entries = Object.entries(platformStats);
  if (entries.length === 0 || totalRevenue === 0) {
    return `<p class="seg-empty">No sales data yet.</p>`;
  }

  const totalSales = entries.reduce((s, [, v]) => s + v.count, 0);

  const pcts = entries.map(([, stats]) => Math.round((stats.revenue / totalRevenue) * 100));

  const segmentBar = entries.map(([platform], i) => {
    return `<div class="seg-bubble" style="width: ${pcts[i]}%; background: ${colors[platform] || '#999'}"></div>`;
  }).join('');

  let cumulativeOffset = 0;
  const legendItems = entries.map(([platform], i) => {
    const left = cumulativeOffset;
    cumulativeOffset += pcts[i];
    return `
      <div class="seg-legend-item" style="left: ${left}%">
        <span class="seg-legend-dot" style="background: ${colors[platform] || '#999'}"></span>
        <span class="seg-legend-label">${labels[platform] || platform}</span>
      </div>
    `;
  }).join('');

  const channelRows = entries.map(([platform, stats], i) => {
    return `
      <div class="seg-channel-row">
        <span class="seg-channel-name"><span class="seg-channel-icon" style="color: ${colors[platform] || '#999'}">${icons[platform] || icons.unknown}</span>${labels[platform] || platform}</span>
        <span class="seg-channel-number">${stats.count}</span>
        <span class="seg-channel-total">+${pcts[i]}% ↑</span>
      </div>
    `;
  }).join('');

  return `
    <div class="seg-hero">
      <span class="seg-hero-value">${totalSales.toLocaleString()}</span>
      <span class="seg-hero-label">total sales</span>
    </div>
    <div class="seg-bar">${segmentBar}</div>
    <div class="seg-legend">${legendItems}</div>
    <div class="seg-channels-header">
      <span>Channels</span>
      <span>Number</span>
      <span>Total</span>
    </div>
    <div class="seg-channels">${channelRows}</div>
  `;
}

function renderTopPerformersPanel(lots) {
  const topItems = lots
    .filter(lot => lot?.sales?.length > 0)
    .map(lot => ({
      name: lot.name,
      profit: getLotTotalProfit(lot),
      unitsSold: lot.sales.reduce((sum, sale) => sum + (Number(sale.unitsSold) || 0), 0),
    }))
    .sort((a, b) => b.profit - a.profit)
    .slice(0, 6);

  const header = `
    <div class="section-header">
      <h3 class="section-title">Top Performers</h3>
    </div>`;

  if (topItems.length === 0) {
    return `${header}<p class="bottom-card-empty">No sold items yet.</p>`;
  }

  const podiumOrder = [topItems[1], topItems[0], topItems[2]].filter(Boolean);
  const rest = topItems.slice(3);

  const podiumHtml = podiumOrder.map(item => {
    const rank = topItems.indexOf(item) + 1;
    return `
      <div class="tp-pedestal tp-rank-${rank}">
        <div class="tp-pedestal-badge">${rank}</div>
        <div class="tp-pedestal-bar"></div>
        <span class="tp-pedestal-name">${item.name}</span>
        <span class="tp-pedestal-profit">${formatCurrency(item.profit, true)}</span>
        <span class="tp-pedestal-units">${item.unitsSold} sold</span>
      </div>
    `;
  }).join('');

  const restHtml = rest.map((item, idx) => `
    <div class="tp-compact-row">
      <span class="tp-compact-rank">${idx + 4}</span>
      <span class="tp-compact-name">${item.name}</span>
      <span class="tp-compact-units">${item.unitsSold} sold</span>
      <span class="tp-compact-profit positive">${formatCurrency(item.profit, true)}</span>
    </div>
  `).join('');

  return `
    ${header}
    <div class="tp-list">
      <div class="tp-podium">${podiumHtml}</div>
      ${rest.length > 0 ? `<div class="tp-compact-list">${restHtml}</div>` : ''}
    </div>
  `;
}

function renderRecentSalesCard(sales, lots) {
  const header = `
    <div class="section-header">
      <h3 class="section-title">Recent Sales</h3>
      <button class="view-all-btn" id="view-all-sales-btn">View All</button>
    </div>`;

  if (sales.length === 0) {
    return `${header}<p class="bottom-card-empty">No sales yet.</p>`;
  }

  const rows = sales.map(({ lot, sale }) => {
    if (!sale) return '';
    const lotName = lot?.name || 'Unknown';
    let dateDisplay = '—';
    if (sale.dateSold && sale.dateSold !== 'Invalid Date') {
      try {
        const date = new Date(sale.dateSold);
        if (!isNaN(date.getTime())) {
          dateDisplay = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        }
      } catch (e) { dateDisplay = '—'; }
    }
    const platform = sale.platform || 'unknown';
    const totalPrice = Number(sale.totalPrice) || 0;
    const profit = Number(sale.profit) || 0;
    return `
      <div class="rs-row">
        <span class="rs-date">${dateDisplay}</span>
        <span class="rs-name">${lotName}</span>
        <span class="platform-badge ${platform}">${platform === 'facebook' ? 'Facebook' : platform === 'ebay' ? 'eBay' : 'Other'}</span>
        <span class="rs-revenue">${formatCurrency(totalPrice)}</span>
        <span class="rs-profit ${profit >= 0 ? 'positive' : 'negative'}">${formatCurrency(profit, true)}</span>
      </div>
    `;
  }).join('');

  return `${header}<div class="rs-list">${rows}</div>`;
}

function calculateTrend(current, previous) {
  if (previous === 0) {
    return current > 0 ? { direction: 'up', value: '∞' } : { direction: 'neutral', value: '0' };
  }
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct > 0) return { direction: 'up', value: Math.abs(pct) };
  if (pct < 0) return { direction: 'down', value: Math.abs(pct) };
  return { direction: 'neutral', value: '0' };
}

function initDesktopRevenueChart() {
  const canvas = document.getElementById('desktop-revenue-chart');
  if (!canvas || typeof Chart === 'undefined') return;

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

  desktopChartData = aggregateSalesByDay(salesData, selectedRange);
  const chartBuckets = aggregateSalesForChart(salesData, selectedRange);
  const { labels, revenues } = chartBuckets;
  if (!labels?.length || !revenues?.length) return;

  const maxRevenue = Math.max(...revenues);
  const yMax = maxRevenue > 0 ? Math.ceil(maxRevenue * 1.15) : 100;

  if (desktopChartInstance) desktopChartInstance.destroy();

  const ctx = canvas.getContext('2d');
  const axisTicks = getCssVar('--chart-axis-text', 'rgba(234, 230, 224, 0.55)');
  const axisGrid = getCssVar('--chart-grid-line', 'rgba(234, 230, 224, 0.08)');

  const gradient = ctx.createLinearGradient(0, canvas.height || 300, 0, 0);
  gradient.addColorStop(0, '#35b8e6');
  gradient.addColorStop(1, '#41CDFF');

  const hoverGradient = ctx.createLinearGradient(0, canvas.height || 300, 0, 0);
  hoverGradient.addColorStop(0, '#4dd4ff');
  hoverGradient.addColorStop(1, '#6ee0ff');

  const barColors = revenues.map(v => v > 0 ? gradient : 'rgba(255,255,255,0.04)');
  const barHoverColors = revenues.map(v => v > 0 ? hoverGradient : 'rgba(255,255,255,0.06)');

  const barCount = labels.length;
  const radius = barCount <= 5 ? 14 : barCount <= 8 ? 11 : barCount <= 15 ? 9 : 7;

  desktopChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Revenue',
        data: revenues,
        backgroundColor: barColors,
        hoverBackgroundColor: barHoverColors,
        borderRadius: radius,
        borderSkipped: false,
        barPercentage: 0.85,
        categoryPercentage: 0.9,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 250, easing: 'easeOutQuart' },
      interaction: { intersect: false, mode: 'index' },
      plugins: {
        legend: { display: false },
        tooltip: {
          enabled: true,
          backgroundColor: '#1B1B1B',
          titleColor: '#ABABAB',
          bodyColor: '#fff',
          borderColor: 'rgba(255,255,255,0.08)',
          borderWidth: 1,
          padding: 10,
          cornerRadius: 8,
          displayColors: false,
          callbacks: {
            title: ctx => ctx[0].label,
            label: ctx => {
              const v = ctx.raw;
              return v > 0 ? '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : 'No sales';
            },
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: axisTicks, font: { size: 10 }, maxRotation: 0, autoSkip: false, maxTicksLimit: 15 },
          border: { display: false }
        },
        y: {
          max: yMax,
          ticks: {
            maxTicksLimit: 5, color: axisTicks, font: { size: 10 }, padding: 8,
            callback: v => v >= 1000 ? '$' + (v / 1000).toFixed(1) + 'k' : '$' + Math.round(v),
          },
          grid: { color: axisGrid, drawBorder: false, tickLength: 0 },
          border: { display: false }
        }
      }
    }
  });
}

export function initDesktopDashboardEvents() {
  initDesktopRevenueChart();

  document.querySelectorAll('.filter-btn[data-range]').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedRange = btn.dataset.range;
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      initDesktopRevenueChart();
    });
  });

  const viewAllBtn = document.getElementById('view-all-sales-btn');
  if (viewAllBtn) {
    viewAllBtn.addEventListener('click', () => navigate('/sales'));
  }
}
