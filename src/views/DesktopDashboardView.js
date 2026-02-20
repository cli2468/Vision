import { getAllSales, getSalesByDateRange, getLots, getLotTotalProfit } from '../services/storage.js';
import { calculateMonthlyStats, formatCurrency } from '../services/calculations.js';
import { aggregateSalesByDay, aggregateSalesForChart } from '../services/chartData.js';
import { renderPlatformBadge } from '../services/uiHelpers.js';
import { navigate } from '../router.js';
import { auth } from '../services/firebase.js';

let selectedRange = null;
let desktopChartInstance = null;
let desktopChartData = null;
let selectedBarIndex = null;

function getCssVar(name, fallback) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

export function DesktopDashboardView() {
  if (!selectedRange) {
    selectedRange = localStorage.getItem('dashboardCurrentRange') || '30d';
  }

  const salesData = getAllSales();
  const allLots = getLots();
  const unsoldUnits = allLots.reduce((sum, lot) => sum + (lot.remaining || 0), 0);
  const unsoldCostBasis = allLots.reduce((sum, lot) => sum + (lot.unitCost || 0) * (lot.remaining || 0), 0);
  const rawName = auth.currentUser?.displayName?.split(' ')[0] || '';
  const userName = rawName ? rawName.charAt(0).toUpperCase() + rawName.slice(1).toLowerCase() : 'there';

  const now = new Date();
  now.setHours(23, 59, 59, 999);


  // Rolling 30D Bounds
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  thirtyDaysAgo.setHours(0, 0, 0, 0);

  const sixtyDaysAgo = new Date(now);
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
  sixtyDaysAgo.setHours(0, 0, 0, 0);

  // KPIs are strictly rolling 30D and real-time, completely ignoring selectedRange
  const currentMonthSales = getSalesByDateRange(thirtyDaysAgo, now);
  const previousMonthSales = getSalesByDateRange(sixtyDaysAgo, thirtyDaysAgo);
  const inventoryValueAtStartOfMonth = calculateInventoryValueAtDate(allLots, thirtyDaysAgo);
  const prevUnsoldUnitsAtStartOfMonth = calculateInventoryQtyAtDate(allLots, thirtyDaysAgo);

  const currentStats = calculateMonthlyStats(currentMonthSales);
  const previousStats = calculateMonthlyStats(previousMonthSales);

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
      trend: calculateTrend(unsoldCostBasis, inventoryValueAtStartOfMonth),
    },
    {
      label: 'Inventory Qty',
      value: unsoldUnits.toString(),
      trend: calculateTrend(unsoldUnits, prevUnsoldUnitsAtStartOfMonth),
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
          ${renderSegmentation(currentMonthSales, previousMonthSales)}
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
  const arrow = trend.direction === 'up' ? '↑' : trend.direction === 'down' ? '↓' : '';
  const cls = trend.direction === 'up' ? 'trend-up' : trend.direction === 'down' ? 'trend-down' : 'trend-neutral';
  // Use a slight gap if arrow exists
  const arrowHtml = arrow ? ` ${arrow}` : '';
  return `<span class="kpi-pill-trend"><span class="${cls}">${trend.value}%${arrowHtml}</span> vs Last 30D</span>`;
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

function renderSegmentation(salesData, prevSalesData) {
  const currentStats = {};
  let totalRevenue = 0;

  salesData.forEach(({ sale }) => {
    if (!sale) return;
    const platform = (sale.platform || 'other').toLowerCase();
    if (!currentStats[platform]) currentStats[platform] = { count: 0, revenue: 0 };
    currentStats[platform].count++;
    const rev = Number(sale.totalPrice) || 0;
    currentStats[platform].revenue += rev;
    totalRevenue += rev;
  });

  const prevStats = {};
  if (prevSalesData) {
    prevSalesData.forEach(({ sale }) => {
      if (!sale) return;
      const platform = (sale.platform || 'other').toLowerCase();
      if (!prevStats[platform]) prevStats[platform] = { count: 0, revenue: 0 };
      prevStats[platform].count++;
      prevStats[platform].revenue += (Number(sale.totalPrice) || 0);
    });
  }

  const colors = {
    amazon: '#FF9900',
    shopify: '#96BF48',
    facebook: 'var(--platform-facebook)',
    ebay: 'var(--platform-ebay)',
    whatnot: '#F5D01E',
    other: 'var(--platform-other)'
  };

  const icons = {
    amazon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 21c-2.4 1.3-6.5 2-10 2-4.5 0-8.2-1.3-11-2.5l1-2.5c2.4 1.1 5.4 2 8.5 2 3.8 0 7.2-.6 9.5-1.5l2 2.5z"/></svg>`,
    shopify: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M16 2 4 4l-1 5 13-1-1-6z"/><path d="M4 9 3 20l9 2 9-5V7Z"/></svg>`,
    facebook: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>`,
    ebay: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
    whatnot: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>`,
    other: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>`
  };

  const getLabel = (p) => p === 'other' || p === 'unknown' ? 'Other' : p.charAt(0).toUpperCase() + p.slice(1);

  let sortedPlatforms = Object.keys(currentStats).sort((a, b) => currentStats[b].revenue - currentStats[a].revenue);

  if (sortedPlatforms.length === 0 || totalRevenue === 0) {
    return `<p class="seg-empty">No sales data yet.</p>`;
  }

  const chartStats = [];
  const top2 = sortedPlatforms.slice(0, 2);
  const remaining = sortedPlatforms.slice(2);

  top2.forEach(p => {
    chartStats.push({ platform: p, ...currentStats[p] });
  });

  if (remaining.length > 0) {
    let otherCount = 0;
    let otherRevenue = 0;
    remaining.forEach(p => {
      otherCount += currentStats[p].count;
      otherRevenue += currentStats[p].revenue;
    });

    // In case a literal 'other' platform made top 3, meld it.
    const existingOther = chartStats.find(s => s.platform === 'other');
    if (existingOther) {
      existingOther.count += otherCount;
      existingOther.revenue += otherRevenue;
    } else {
      chartStats.push({ platform: 'other', count: otherCount, revenue: otherRevenue });
    }
  }

  const totalSales = sortedPlatforms.reduce((sum, p) => sum + currentStats[p].count, 0);
  const pcts = chartStats.map(stats => Math.round((stats.revenue / totalRevenue) * 100));

  const segmentBar = chartStats.map((stats, i) => {
    return `<div class="seg-bubble" style="width: ${pcts[i]}%; background: ${colors[stats.platform] || colors.other};"></div>`;
  }).join('');

  let cumulativeOffset = 0;
  const legendItems = chartStats.map((stats, i) => {
    const left = cumulativeOffset;
    cumulativeOffset += pcts[i];
    return `
      <div class="seg-legend-item" style="left: ${left}%; position: absolute; min-width: max-content; margin-bottom: 24px;">
        <span class="seg-legend-dot" style="background: ${colors[stats.platform] || colors.other};"></span>
        <span class="seg-legend-label" style="text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${getLabel(stats.platform)}</span>
      </div>
    `;
  }).join('');

  const channelRows = sortedPlatforms.map((platform) => {
    const stats = currentStats[platform];
    const prevRev = prevStats[platform] ? prevStats[platform].revenue : 0;

    // Growth vs Last 30D. Using the global calculateTrend function from calculations.js
    const realTrendObj = calculateTrend(stats.revenue, prevRev);

    const arrow = realTrendObj.direction === 'up' ? '↑' : realTrendObj.direction === 'down' ? '↓' : '';
    const trendCls = realTrendObj.direction === 'up' ? 'trend-up' : realTrendObj.direction === 'down' ? 'trend-down' : 'trend-neutral';
    const trendText = realTrendObj.value === '∞' ? '∞%' : `${realTrendObj.value}%`;
    const sign = realTrendObj.direction === 'up' ? '+' : realTrendObj.direction === 'down' ? '-' : '';
    const arrowHtml = arrow ? ` ${arrow}` : '';

    return `
      <div class="seg-channel-row" style="display: flex; flex-wrap: wrap; justify-content: space-between; gap: 8px; align-items: center; min-width: 0;">
        <span class="seg-channel-name" style="flex: 1 1 80px; min-width: 80px; display: flex; align-items: center; gap: 6px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
          <span class="seg-channel-icon" style="color: ${colors[platform] || colors.other}; display: flex;">${icons[platform] || icons.other}</span>
          ${getLabel(platform)}
        </span>
        <span class="seg-channel-number" style="flex: 0 0 40px; text-align: right; min-width: 40px;">${stats.count}</span>
        <span class="seg-channel-total ${trendCls}" style="flex: 0 0 60px; text-align: right; min-width: 60px;">${sign}${trendText}${arrowHtml}</span>
      </div>
    `;
  }).join('');

  return `
    <div class="seg-hero">
      <span class="seg-hero-value">${totalSales.toLocaleString()}</span>
      <span class="seg-hero-label">total sales</span>
    </div>
    <div class="seg-bar" style="display: flex; width: 100%; border-radius: 4px; overflow: hidden; margin-bottom: 24px;">${segmentBar}</div>
    <div class="seg-legend" style="position: relative; width: 100%; height: 32px; overflow: hidden; margin-bottom: 8px;">${legendItems}</div>
    <div class="seg-channels-header" style="display: flex; justify-content: space-between; flex-wrap: wrap; padding-bottom: 8px; border-bottom: 1px solid var(--border-color); margin-bottom: 12px; gap: 8px;">
      <span style="flex: 1 1 80px; min-width: 80px;">Channels</span>
      <span style="flex: 0 0 40px; text-align: right; min-width: 40px;">Number</span>
      <span style="flex: 0 0 60px; text-align: right; min-width: 60px;">Growth</span>
    </div>
    <div class="seg-channels" style="display: flex; flex-direction: column; gap: 12px; overflow-x: hidden;">${channelRows}</div>
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
        ${renderPlatformBadge(platform)}
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
  const now = new Date();
  now.setHours(23, 59, 59, 999);

  if (selectedRange === 'all') {
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - 364); // 365 days including today
    startDate.setHours(0, 0, 0, 0);
    salesData = getSalesByDateRange(startDate, now);
  } else {
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

  if (selectedBarIndex === null || selectedBarIndex >= labels.length) {
    selectedBarIndex = labels.length - 1;
  }

  const barCount = labels.length;
  const radius = barCount <= 5 ? 14 : barCount <= 8 ? 11 : barCount <= 15 ? 9 : 7;
  const unselectedBg = '#292929';
  const unselectedBorder = '#424242';

  desktopChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Revenue',
        data: revenues,
        backgroundColor: (ctx) => {
          return ctx.dataIndex === selectedBarIndex ? gradient : unselectedBg;
        },
        hoverBackgroundColor: (ctx) => {
          return ctx.dataIndex === selectedBarIndex ? hoverGradient : unselectedBg;
        },
        borderColor: (ctx) => {
          return ctx.dataIndex === selectedBarIndex ? 'transparent' : unselectedBorder;
        },
        borderWidth: (ctx) => {
          return ctx.dataIndex === selectedBarIndex ? 0 : 1;
        },
        minBarLength: 10,
        borderRadius: radius,
        borderSkipped: false,
        barPercentage: 0.85,
        categoryPercentage: 0.9,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 200, easing: 'easeOutQuart' },
      interaction: { intersect: true, mode: 'index' },
      onClick: (e, elements) => {
        if (elements.length > 0) {
          selectedBarIndex = elements[0].index;
          if (desktopChartInstance) desktopChartInstance.update();
        }
      },
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
          ticks: {
            color: axisTicks,
            font: { size: 10, weight: '500' },
            maxRotation: 0,
            autoSkip: false,
            maxTicksLimit: 15,
            padding: 10
          },
          border: { display: false }
        },
        y: {
          display: false,
          grid: { display: false },
          border: { display: false }
        }
      }
    }
  });
}

export function initDesktopDashboardEvents(isInitialLoad = false) {
  // If this is the initial login load, wait for the app preloader to fade out (~750-800ms)
  const initialDelay = isInitialLoad ? 800 : 0;

  setTimeout(() => {
    initDesktopRevenueChart();
  }, initialDelay);

  document.querySelectorAll('.filter-btn[data-range]').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedRange = btn.dataset.range;
      localStorage.setItem('dashboardCurrentRange', selectedRange);
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedBarIndex = null; // Reset to latest for new range
      initDesktopRevenueChart();
    });
  });

  const viewAllBtn = document.getElementById('view-all-sales-btn');
  if (viewAllBtn) {
    viewAllBtn.addEventListener('click', () => navigate('/sales'));
  }
}
