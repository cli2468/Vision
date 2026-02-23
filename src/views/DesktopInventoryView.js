// Desktop Inventory View - Split panel layout with data table
// Only renders on desktop (≥1280px), mobile uses existing InventoryView

import { getLots, recordSale, deleteLot, isFullySold, hasSales, getLotTotalProfit, getReturnDeadline, getDaysUntilReturn } from '../services/storage.js';
import { formatCurrency, formatDate, PLATFORM_FEES, calculateSaleProfit } from '../services/calculations.js';
import { celebrateSuccess } from '../utils/animations.js';

// Import shared state from InventoryView
import { setActiveTab, getActiveTab, setSearchQuery, getSearchQuery } from './InventoryView.js';

let desktopSelectedLotId = null;
let desktopSaleMode = false; // 'view' or 'record'
let desktopSalePrice = '';
let desktopSaleQty = 1;
let desktopSalePlatform = 'facebook';
let desktopSaleShipping = '';
let desktopSortBy = 'roi'; // 'roi' | 'daysHeld' | 'profit' | 'sellThrough'
let desktopActiveFilters = new Set(); // 'lowStock' | 'highRoi' | 'stale'

function generateSparklineSVG(lot) {
  const purchaseDate = new Date(lot.purchaseDate);
  purchaseDate.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(23, 59, 59, 999);

  const totalTime = today - purchaseDate;
  const numBuckets = 20; // Fixed number of points for a smooth trend line
  const timePerBucket = totalTime / numBuckets;

  // Initialize buckets
  const trendBuckets = new Array(numBuckets).fill(0);

  // Group sales into proportional buckets
  if (lot.sales) {
    for (const sale of lot.sales) {
      if (!sale.dateSold) continue;
      // Parse local to avoid timezone shifting
      const saleDateStr = sale.dateSold.includes('T') ? sale.dateSold : sale.dateSold + 'T00:00:00';
      const saleDate = new Date(saleDateStr);

      const timeSincePurchase = saleDate - purchaseDate;
      let bucketIndex = Math.floor(timeSincePurchase / timePerBucket);

      // Safety bounds
      if (bucketIndex < 0) bucketIndex = 0;
      if (bucketIndex >= numBuckets) bucketIndex = numBuckets - 1;

      trendBuckets[bucketIndex] += sale.unitsSold;
    }
  }

  // Smooth the data slightly to prevent severe jaggedness using a simple moving average (3-point window)
  const smoothedData = trendBuckets.map((val, i, arr) => {
    if (i === 0) return (val + arr[1]) / 2;
    if (i === arr.length - 1) return (arr[i - 1] + val) / 2;
    return (arr[i - 1] + val + arr[i + 1]) / 3;
  });

  // Generate SVG Path
  // ViewBox: 0 0 200 70
  // Y max: 5 (top, 5px margin), Y min: 68 (bottom)
  const maxSales = Math.max(...smoothedData, 0.1); // Avoid division by zero
  const graphHeight = 63; // 68 - 5

  const pathPoints = smoothedData.map((sales, index) => {
    const x = (index / (numBuckets - 1)) * 200;
    const normalizedY = sales / maxSales;
    const y = 68 - (normalizedY * graphHeight);
    return { x: x.toFixed(1), y: y.toFixed(1) };
  });

  const pathData = pathPoints.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x} ${p.y}`).join(' ');
  const fillPathData = `${pathData} L200 70 L0 70 Z`;

  return `
    <svg width="100%" height="70" viewBox="0 0 200 70" preserveAspectRatio="none">
      <defs>
        <linearGradient id="spark-gradient-${lot.id}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#34D399"/>
          <stop offset="100%" stop-color="transparent"/>
        </linearGradient>
        <clipPath id="spark-clip-${lot.id}">
          <rect x="0" y="0" width="0" height="70">
            <animate attributeName="width" from="0" to="200" dur="1.1s" fill="freeze" calcMode="spline" keySplines="0.4 0 0.2 1" keyTimes="0;1"/>
          </rect>
        </clipPath>
      </defs>
      <g clip-path="url(#spark-clip-${lot.id})">
        <path d="${fillPathData}" fill="url(#spark-gradient-${lot.id})" opacity="0.2"/>
        <path d="${pathData}" fill="none" class="spark-path" stroke="#34D399" stroke-width="2"/>
      </g>
    </svg>
  `;
}

function isDesktop() {
  return window.innerWidth >= 1280;
}

function calculateLotStats(lot) {
  const unitsSold = lot.quantity - lot.remaining;
  const sellThrough = lot.quantity > 0 ? Math.round((unitsSold / lot.quantity) * 100) : 0;
  const totalProfit = getLotTotalProfit(lot);
  const totalRevenue = lot.sales?.reduce((sum, s) => sum + (s.totalPrice || 0), 0) || 0;
  const totalCost = lot.unitCost * lot.quantity;
  const roi = totalCost > 0 ? Math.round((totalProfit / totalCost) * 100) : 0;
  const cashRemaining = lot.remaining * lot.unitCost;
  const daysHeld = Math.floor((Date.now() - new Date(lot.purchaseDate).getTime()) / (1000 * 60 * 60 * 24));

  const capitalRecoveredPercent = totalCost > 0 ? Math.min(Math.round((totalRevenue / totalCost) * 100), 200) : 0;

  // Low stock detection
  const isLowStock = lot.remaining <= 2 || (lot.remaining / lot.quantity) <= 0.2;

  return {
    unitsSold,
    sellThrough,
    totalProfit,
    totalRevenue,
    roi,
    cashRemaining,
    isLowStock,
    capitalRecoveredPercent,
    daysHeld
  };
}

// Status dot removed from grid — it was visual noise without clear meaning

function renderInventoryGrid(lots) {
  if (lots.length === 0) {
    return `
      <div class="desktop-empty-state">
        <p>No items found</p>
      </div>
    `;
  }

  return `
    <div class="inv-grid">
      <div class="inv-table-header">
        <div class="inv-header-cell cell-item">ITEM</div>
        <div class="inv-header-cell cell-perf">NET PROFIT / ROI</div>
        <div class="inv-header-cell cell-risk">CAPITAL</div>
        <div class="inv-header-cell cell-left">UNITS LEFT</div>
        <div class="inv-header-cell cell-days">DAYS HELD</div>
      </div>
      <div class="inv-grid-body">
        ${lots.map(lot => {
    const stats = calculateLotStats(lot);
    const isSelected = lot.id === desktopSelectedLotId;
    const isSoldOut = isFullySold(lot);
    const purchaseDate = new Date(lot.purchaseDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    // ROI badge — color-coded by performance tier
    let roiBadgeClass = 'roi-badge-neutral';
    if (stats.roi >= 60) roiBadgeClass = 'roi-badge-great';
    else if (stats.roi >= 40) roiBadgeClass = 'roi-badge-good';
    else if (stats.roi > 0) roiBadgeClass = 'roi-badge-ok';
    else if (stats.roi < 0) roiBadgeClass = 'roi-badge-bad';
    const roiSign = stats.roi >= 0 ? '+' : '';

    // Semantic Sell-Through progress bar color
    let sellThroughClass = 'progress-red';
    if (stats.sellThrough >= 80) sellThroughClass = 'progress-green';
    else if (stats.sellThrough >= 50) sellThroughClass = 'progress-yellow';

    // Capital at risk = cost of remaining unsold units  
    const capitalAtRisk = lot.remaining * lot.unitCost;

    // Days held semantic color
    let daysClass = '';
    if (stats.daysHeld > 180) daysClass = 'days-danger';
    else if (stats.daysHeld > 90) daysClass = 'days-warn';

    // Inline badges replacing subfilters
    let rowBadges = '';
    if (stats.isLowStock && lot.remaining > 0) rowBadges += '<span class="row-badge badge-low-stock">LOW STOCK</span>';
    if (stats.daysHeld > 180) rowBadges += '<span class="row-badge badge-stale">STALE</span>';

    return `
            <div class="inv-card ${isSelected ? 'selected' : ''} ${isSoldOut ? 'sold-out' : ''}" data-lot-id="${lot.id}">
              <div class="inv-zone inv-zone-identity">
                <div class="inv-item-name">
                  ${lot.name}
                  ${rowBadges}
                </div>
                <div class="inv-item-meta">Purchased ${purchaseDate} · ${lot.quantity} units total</div>
              </div>

              <div class="inv-zone inv-zone-performance">
                <div class="perf-profit-col">
                  <div class="inv-perf-profit ${stats.totalProfit >= 0 ? 'positive' : 'negative'}">
                    ${formatCurrency(stats.totalProfit, true)}
                  </div>
                  <span class="roi-badge ${roiBadgeClass}">${roiSign}${stats.roi}%</span>
                </div>
              </div>

              <div class="inv-zone inv-zone-risk">
                <div class="inv-risk-item">
                  <span class="inv-risk-value">${formatCurrency(capitalAtRisk)}</span>
                  <span class="inv-risk-label">at risk</span>
                </div>
                <div class="inv-risk-item">
                  <span class="inv-risk-value">${lot.remaining}</span>
                  <span class="inv-risk-label">left</span>
                </div>
                <div class="inv-risk-item">
                  <span class="inv-risk-value ${daysClass}">${stats.daysHeld}d</span>
                  <span class="inv-risk-label">held</span>
                </div>
              </div>
            </div>
          `;
  }).join('')}
      </div>
    </div>
  `;
}

function renderIntelligencePanel(lot) {
  if (!lot) {
    return `
      <div class="intelligence-panel empty">
        <div class="empty-message">
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
            <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
            <line x1="12" y1="22.08" x2="12" y2="12"></line>
          </svg>
          <p>Select an item to view details</p>
        </div>
      </div>
    `;
  }

  const stats = calculateLotStats(lot);
  const purchaseDate = new Date(lot.purchaseDate).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  // Days held context
  let daysHeldClass = '';
  if (stats.daysHeld > 180) daysHeldClass = 'negative';
  else if (stats.daysHeld > 90) daysHeldClass = 'days-warn';

  // Capital At Risk
  const totalInvested = lot.quantity * lot.unitCost;
  const capitalAtRisk = lot.remaining * lot.unitCost;
  const capitalAtRiskPercent = totalInvested > 0 ? Math.round((capitalAtRisk / totalInvested) * 100) : 0;
  const riskProgressWidth = Math.min(capitalAtRiskPercent, 100);

  // Avg sale price & margin
  const avgSalePrice = stats.unitsSold > 0 ? stats.totalRevenue / stats.unitsSold : 0;
  const marginPerUnit = avgSalePrice > 0 ? avgSalePrice - lot.unitCost : 0;

  // Break-even price (min price to sell remaining units at to cover total cost)
  const totalCostRemaining = lot.remaining * lot.unitCost;
  const breakEvenPrice = lot.remaining > 0 ? totalCostRemaining / lot.remaining : 0;

  // Projected total profit (if remaining sell at avg sale price)
  const projectedRevFromRemaining = lot.remaining * avgSalePrice;
  const projectedCostRemaining = lot.remaining * lot.unitCost;
  const projectedProfitRemaining = projectedRevFromRemaining - projectedCostRemaining;
  const projectedTotalProfit = stats.totalProfit + projectedProfitRemaining;

  // Avg days to sell (velocity)
  let avgDaysToSell = '—';
  if (lot.sales?.length > 0 && stats.unitsSold > 0) {
    const salesDates = lot.sales.map(s => new Date(s.dateSold).getTime()).sort();
    const purchaseTime = new Date(lot.purchaseDate).getTime();
    const lastSaleTime = salesDates[salesDates.length - 1];
    const sellingPeriod = Math.max(1, Math.floor((lastSaleTime - purchaseTime) / (1000 * 60 * 60 * 24)));
    avgDaysToSell = Math.round(sellingPeriod / stats.unitsSold);
  }

  if (desktopSaleMode) {
    return renderSaleDrawer(lot);
  }

  return `
    <div class="intelligence-panel">
      <div class="panel-header">
        <h3 class="panel-title" title="${lot.name}">${lot.name}</h3>
        <button class="panel-close-btn" id="close-intelligence-panel-header">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
        <div class="panel-meta">
          <span>Purchased ${purchaseDate}</span>
          <span class="meta-sep">·</span>
          <span>${lot.quantity} units total</span>
        </div>
      </div>

      <div class="panel-divider"></div>

      <div class="panel-section-card sparkline-card">
        <div class="section-header">
          <span class="panel-section-title">Sales Velocity</span>
          <span class="accent-green" style="font-size:0.75rem;font-weight:600;">${stats.unitsSold} sales</span>
        </div>
        <div class="sparkline-placeholder">
          ${generateSparklineSVG(lot)}
        </div>
      </div>

      <div class="panel-section-flat">
        <div class="panel-section-title">Inventory Status</div>
        <div class="stats-grid">
          <div class="stat-item">
            <div class="stat-label">Units Left</div>
            <div class="stat-value ${stats.isLowStock ? 'low-stock' : ''}">${lot.remaining} <span style="font-size:0.8em;color:var(--text-muted);font-weight:normal">/ ${lot.quantity}</span></div>
          </div>
          <div class="stat-item">
            <div class="stat-label">Days Held</div>
            <div class="stat-value ${daysHeldClass}">${stats.daysHeld}</div>
          </div>
          <div class="stat-item">
            <div class="stat-label">Sell-Through</div>
            <div class="stat-value">${stats.sellThrough}%</div>
          </div>
          <div class="stat-item">
            <div class="stat-label">Avg Days / Sale</div>
            <div class="stat-value">${avgDaysToSell}${typeof avgDaysToSell === 'number' ? 'd' : ''}</div>
          </div>
          <div class="stat-item">
            <div class="stat-label">Capital at Risk</div>
            <div class="stat-value ${capitalAtRiskPercent > 50 ? 'negative' : ''}">${formatCurrency(capitalAtRisk)}</div>
          </div>
          <div class="stat-item">
            <div class="stat-label">Break-even</div>
            <div class="stat-value">${formatCurrency(breakEvenPrice)}/unit</div>
          </div>
        </div>
      </div>

      <div class="panel-section-flat">
        <div class="panel-section-title">Financial Performance</div>
        <div class="stats-grid">
          <div class="stat-item">
            <div class="stat-label">Revenue</div>
            <div class="stat-value">${formatCurrency(stats.totalRevenue)}</div>
          </div>
          <div class="stat-item">
            <div class="stat-label">Cost Basis</div>
            <div class="stat-value">${formatCurrency(lot.unitCost)}/unit</div>
          </div>
          <div class="stat-item">
            <div class="stat-label">Net Profit</div>
            <div class="stat-value ${stats.totalProfit >= 0 ? 'positive' : 'negative'}">${formatCurrency(stats.totalProfit, true)}</div>
          </div>
          <div class="stat-item">
            <div class="stat-label">ROI</div>
            <div class="stat-value ${stats.roi >= 0 ? 'positive' : 'negative'}">${stats.roi >= 0 ? '+' : ''}${stats.roi}%</div>
          </div>
          <div class="stat-item">
            <div class="stat-label">Margin / Unit</div>
            <div class="stat-value ${marginPerUnit >= 0 ? 'positive' : 'negative'}">${formatCurrency(marginPerUnit, true)}</div>
          </div>
          <div class="stat-item">
            <div class="stat-label">Projected Total</div>
            <div class="stat-value ${projectedTotalProfit >= 0 ? 'positive' : 'negative'}">${stats.unitsSold > 0 ? formatCurrency(projectedTotalProfit, true) : '—'}</div>
          </div>
        </div>
      </div>

      ${lot.sales?.length > 0 ? `
        <div class="recent-sales-section panel-section-flat">
          <div class="section-header">
            <span class="panel-section-title">Recent Sales</span>
            <span class="sale-count">${lot.sales.length} total</span>
          </div>
          <div class="recent-sales-list">
            ${lot.sales.slice(-5).reverse().map(sale => `
              <div class="recent-sale-item stacked">
                <div class="sale-col">
                  <span class="sale-date">${formatDate(sale.dateSold)}</span>
                  <span class="sale-qty">${sale.unitsSold}× units</span>
                </div>
                <div class="sale-col align-right">
                  <span class="sale-revenue val-currency">${formatCurrency(sale.totalPrice)}</span>
                  <span class="sale-profit val-currency ${sale.profit >= 0 ? 'positive' : 'negative'}">${formatCurrency(sale.profit, true)}</span>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}

      ${!isFullySold(lot) ? `
        <button class="btn btn-primary btn-full record-sale-drawer-btn" data-lot-id="${lot.id}">
          Record Sale
        </button>
      ` : ''}
    </div>
  `;
}

function renderSaleDrawer(lot) {
  const price = parseFloat(desktopSalePrice) || 0;
  const qty = Math.min(parseInt(desktopSaleQty) || 1, lot.remaining);
  const priceInCents = Math.round(price * 100);
  const totalRevenue = priceInCents * qty;

  const feeRate = desktopSalePlatform === 'ebay' ? 0.135 : 0;
  const fees = Math.round(totalRevenue * feeRate);

  const shippingPerUnit = desktopSalePlatform === 'ebay' ? (parseFloat(desktopSaleShipping) || 0) : 0;
  const shippingCostCents = Math.round(shippingPerUnit * 100) * qty;

  const costBasis = lot.unitCost * qty;
  const netProfit = totalRevenue - fees - shippingCostCents - costBasis;

  return `
    <div class="intelligence-panel sale-drawer">
      <div class="drawer-header">
        <button class="back-btn" id="back-to-view">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <line x1="19" y1="12" x2="5" y2="12"></line>
            <polyline points="12 19 5 12 12 5"></polyline>
          </svg>
          Back
        </button>
        <h3 class="drawer-title">Record Sale</h3>
      </div>

      <div class="drawer-content">
        <div class="form-group">
          <label class="form-label">Sale Price (per unit)</label>
          <div class="input-prefix">
            <span class="prefix">$</span>
            <input type="number" 
                   class="form-input" 
                   id="desktop-sale-price" 
                   placeholder="0.00" 
                   step="0.01" 
                   min="0" 
                   value="${desktopSalePrice}"
                   inputmode="decimal">
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Quantity</label>
          <div class="quantity-stepper">
            <button type="button" class="stepper-btn" id="desktop-qty-decrease">-</button>
            <input type="number" 
                   class="form-input stepper-input" 
                   id="desktop-sale-qty" 
                   value="${desktopSaleQty}" 
                   min="1" 
                   max="${lot.remaining}"
                   readonly>
            <button type="button" class="stepper-btn" id="desktop-qty-increase">+</button>
          </div>
          <div class="qty-hint">Max: ${lot.remaining} units</div>
        </div>

        <div class="form-group">
          <label class="form-label">Platform</label>
          <div class="platform-toggle">
            <button class="platform-btn ${desktopSalePlatform === 'facebook' ? 'active' : ''}" data-platform="facebook">
              Facebook
            </button>
            <button class="platform-btn ${desktopSalePlatform === 'ebay' ? 'active' : ''}" data-platform="ebay">
              eBay
            </button>
          </div>
        </div>

        ${desktopSalePlatform === 'ebay' ? `
          <div class="form-group">
            <label class="form-label">Shipping Fee (per unit)</label>
            <div class="input-prefix">
              <span class="prefix">$</span>
              <input type="number" 
                     class="form-input" 
                     id="desktop-shipping-cost" 
                     placeholder="0.00" 
                     step="0.01" 
                     min="0" 
                     value="${desktopSaleShipping}"
                     inputmode="decimal">
            </div>
          </div>
        ` : ''}

        <div class="sale-summary">
          <div class="summary-row">
            <span>Revenue</span>
            <span>${formatCurrency(totalRevenue)}</span>
          </div>
          <div class="summary-row">
            <span>Fees (${desktopSalePlatform === 'ebay' ? '13.5%' : '0%'})</span>
            <span class="negative">-${formatCurrency(fees)}</span>
          </div>
          ${desktopSalePlatform === 'ebay' ? `
            <div class="summary-row">
              <span>Shipping</span>
              <span class="negative">-${formatCurrency(shippingCostCents)}</span>
            </div>
          ` : ''}
          <div class="summary-row">
            <span>COGS (${qty} × ${formatCurrency(lot.unitCost)})</span>
            <span class="negative">-${formatCurrency(costBasis)}</span>
          </div>
          <div class="summary-row total">
            <span>Net Profit</span>
            <span class="${netProfit >= 0 ? 'positive' : 'negative'}">${formatCurrency(netProfit, true)}</span>
          </div>
        </div>
      </div>

      <div class="drawer-footer">
        <button class="btn btn-primary btn-full" id="desktop-confirm-sale" ${price <= 0 ? 'disabled' : ''}>
          Confirm Sale
        </button>
      </div>
    </div>
  `;
}

function calculateSummaryMetrics(lots) {
  const skusInStock = lots.filter(l => l.remaining > 0).length;
  const totalCapital = lots.reduce((sum, l) => sum + (l.unitCost * l.remaining), 0);

  // Calculate unrealized profit (projected profit from remaining units)
  const totalUnrealizedProfit = lots.reduce((sum, lot) => {
    if (lot.remaining <= 0 || !lot.sales?.length) return sum;
    const avgProfitPerUnit = lot.sales.reduce((s, sale) => s + (sale.profit / sale.unitsSold), 0) / lot.sales.length;
    return sum + (avgProfitPerUnit * lot.remaining);
  }, 0);

  const lowStockCount = lots.filter(l =>
    l.remaining > 0 && (l.remaining <= 2 || (l.remaining / l.quantity) <= 0.2)
  ).length;

  return { skusInStock, totalCapital, totalUnrealizedProfit, lowStockCount };
}

export function DesktopInventoryView() {
  const currentTab = getActiveTab ? getActiveTab() : 'all';
  const currentSearch = getSearchQuery ? getSearchQuery() : '';

  const lots = getLots();
  let filteredLots = lots.filter(lot => {
    if (currentTab === 'unsold') return lot.remaining > 0;
    if (currentTab === 'sold') return isFullySold(lot);
    return true;
  });

  // Apply search filter
  if (currentSearch.trim()) {
    const q = currentSearch.toLowerCase();
    filteredLots = filteredLots.filter(lot => lot.name.toLowerCase().includes(q));
  }

  // Apply chip filters
  if (desktopActiveFilters.size > 0) {
    filteredLots = filteredLots.filter(lot => {
      const stats = calculateLotStats(lot);
      if (desktopActiveFilters.has('lowStock') && !(stats.isLowStock && lot.remaining > 0)) return false;
      if (desktopActiveFilters.has('highRoi') && stats.roi < 50) return false;
      if (desktopActiveFilters.has('stale') && stats.daysHeld <= 180) return false;
      return true;
    });
  }

  // Apply sorting
  filteredLots = [...filteredLots].sort((a, b) => {
    const sa = calculateLotStats(a);
    const sb = calculateLotStats(b);
    switch (desktopSortBy) {
      case 'roi': return sb.roi - sa.roi;
      case 'daysHeld': return sb.daysHeld - sa.daysHeld;
      case 'profit': return sb.totalProfit - sa.totalProfit;
      case 'sellThrough': return sb.sellThrough - sa.sellThrough;
      default: return 0;
    }
  });

  const selectedLot = desktopSelectedLotId ? lots.find(l => l.id === desktopSelectedLotId) : null;
  const hasSelection = !!selectedLot;
  const summary = calculateSummaryMetrics(lots);

  return `
    <div class="desktop-inventory-container ${hasSelection ? 'has-selection' : ''}">
      <div class="inv-header">
        <div class="inv-header-stats">
          <div class="inv-header-stat">
            <span class="inv-header-stat-label">Active SKUs</span>
            <span class="inv-header-stat-value">${summary.skusInStock}</span>
            <span class="inv-header-sub">across all categories</span>
          </div>
          <div class="inv-header-divider"></div>
          <div class="inv-header-stat">
            <span class="inv-header-stat-label">Total Inventory Value</span>
            <span class="inv-header-stat-value stat-hero">${formatCurrency(summary.totalCapital)}</span>
            <span class="inv-header-sub">capital deployed</span>
          </div>
          <div class="inv-header-divider"></div>
          <div class="inv-header-stat">
            <span class="inv-header-stat-label">Avg Portfolio ROI</span>
            <span class="inv-header-stat-value accent-green">+58%</span>
            <span class="inv-header-sub">across sold units</span>
          </div>
          <div class="inv-header-divider"></div>
          <div class="inv-header-stat">
            <span class="inv-header-stat-label">Low Stock</span>
            <span class="inv-header-stat-value ${summary.lowStockCount > 0 ? 'accent-amber' : ''}">${summary.lowStockCount}</span>
            <span class="inv-header-sub">items need attention</span>
          </div>
        </div>
      </div>
      <div class="inv-toolbar">
        <div class="inv-toolbar-left">
          <div class="inv-toolbar-title">INVENTORY</div>
          <div class="tabs">
            <button class="tab ${currentTab === 'all' ? 'active' : ''}" data-tab="all">All Items</button>
            <button class="tab ${currentTab === 'unsold' ? 'active' : ''}" data-tab="unsold">Available</button>
          </div>
        </div>
        <div class="inv-toolbar-right">
          <div class="inv-sort">
            <label for="desktop-sort-select">SORT</label>
            <select id="desktop-sort-select">
              <option value="roi" ${desktopSortBy === 'roi' ? 'selected' : ''}>ROI</option>
              <option value="daysHeld" ${desktopSortBy === 'daysHeld' ? 'selected' : ''}>Days Held</option>
              <option value="profit" ${desktopSortBy === 'profit' ? 'selected' : ''}>Profit</option>
              <option value="sellThrough" ${desktopSortBy === 'sellThrough' ? 'selected' : ''}>Sell-Through</option>
            </select>
          </div>
          <div class="inventory-search">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input type="text" id="desktop-inventory-search" placeholder="Search items..." value="${currentSearch}">
          </div>
        </div>
      </div>
      <div class="inventory-content">
        <div class="inventory-left-panel">
          <div class="inventory-table-container">
            ${renderInventoryGrid(filteredLots)}
          </div>
        </div>
        <div class="inventory-right-panel">
          ${renderIntelligencePanel(selectedLot)}
        </div>
      </div>
    </div>
  `;
}

export function initDesktopInventoryEvents() {
  // Row selection - dynamic update for smooth panel animation
  document.querySelectorAll('.inv-card').forEach(row => {
    row.addEventListener('click', () => {
      const lotId = row.dataset.lotId;

      if (desktopSelectedLotId !== lotId) {
        desktopSelectedLotId = lotId;
        desktopSaleMode = false;

        const container = document.querySelector('.desktop-inventory-container');
        const rightPanel = document.querySelector('.inventory-right-panel');
        const lots = getLots();
        const selectedLot = lots.find(l => l.id === lotId);

        if (container && rightPanel && selectedLot) {
          document.querySelectorAll('.inv-card').forEach(r => r.classList.remove('selected'));
          row.classList.add('selected');

          rightPanel.innerHTML = renderIntelligencePanel(selectedLot);
          attachPanelEvents();
          container.classList.add('has-selection');
        } else {
          window.dispatchEvent(new CustomEvent('viewchange'));
        }
      }
    });
  });

  // Tab switching
  document.querySelectorAll('.desktop-inventory-container .tab').forEach(tab => {
    tab.addEventListener('click', () => {
      if (setActiveTab) setActiveTab(tab.dataset.tab);
      window.dispatchEvent(new CustomEvent('viewchange'));
    });
  });

  // Search
  const searchInput = document.getElementById('desktop-inventory-search');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      if (setSearchQuery) setSearchQuery(e.target.value);
      // Filter table rows without full re-render
      const query = e.target.value.toLowerCase();
      document.querySelectorAll('.inv-card').forEach(row => {
        const name = row.querySelector('.inv-item-name')?.textContent.toLowerCase() || '';
        row.style.display = name.includes(query) ? '' : 'none';
      });
    });
  }

  // Close panel button logic moved to attachPanelEvents  // Sort dropdown
  const sortSelect = document.getElementById('desktop-sort-select');
  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      desktopSortBy = e.target.value;
      window.dispatchEvent(new CustomEvent('viewchange'));
    });
  }

  // Filter chips
  document.querySelectorAll('.filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const filter = chip.dataset.filter;
      if (desktopActiveFilters.has(filter)) {
        desktopActiveFilters.delete(filter);
      } else {
        desktopActiveFilters.add(filter);
      }
      window.dispatchEvent(new CustomEvent('viewchange'));
    });
  });

  // Auto-select first item if nothing is selected
  if (!desktopSelectedLotId) {
    const firstRow = document.querySelector('.inv-card');
    if (firstRow) {
      firstRow.click();
    }
  }

  attachPanelEvents();
}

function attachPanelEvents() {
  // Record sale button
  const recordBtn = document.querySelector('.record-sale-drawer-btn');
  if (recordBtn) {
    recordBtn.addEventListener('click', () => {
      desktopSaleMode = true;
      desktopSalePrice = '';
      desktopSaleQty = 1;
      desktopSalePlatform = 'facebook';
      desktopSaleShipping = '';

      const lots = getLots();
      const selectedLot = lots.find(l => l.id === desktopSelectedLotId);
      const rightPanel = document.querySelector('.inventory-right-panel');
      if (rightPanel && selectedLot) {
        rightPanel.innerHTML = renderSaleDrawer(selectedLot);
        attachDrawerEvents(selectedLot);
      }
    });
  }

  // Close panel button
  const closeBtn = document.getElementById('close-intelligence-panel-header');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      desktopSelectedLotId = null;
      desktopSaleMode = false;
      const container = document.querySelector('.desktop-inventory-container');
      if (container) {
        container.classList.remove('has-selection');
        document.querySelectorAll('.inv-card').forEach(r => r.classList.remove('selected'));
        // Wait for animation to finish before clearing DOM
        setTimeout(() => {
          const rightPanel = document.querySelector('.inventory-right-panel');
          if (rightPanel && !desktopSelectedLotId) {
            rightPanel.innerHTML = '';
          }
        }, 300);
      } else {
        window.dispatchEvent(new CustomEvent('viewchange'));
      }
    });
  }
}

function attachDrawerEvents(lot) {
  // Back button
  document.getElementById('back-to-view')?.addEventListener('click', () => {
    desktopSaleMode = false;
    const rightPanel = document.querySelector('.inventory-right-panel');
    if (rightPanel) {
      rightPanel.innerHTML = renderIntelligencePanel(lot);
      attachPanelEvents();
    }
  });

  // Price input
  document.getElementById('desktop-sale-price')?.addEventListener('input', (e) => {
    desktopSalePrice = e.target.value;
    updateSaleSummary(lot);
  });

  // Quantity stepper
  document.getElementById('desktop-qty-decrease')?.addEventListener('click', () => {
    if (desktopSaleQty > 1) {
      desktopSaleQty--;
      document.getElementById('desktop-sale-qty').value = desktopSaleQty;
      updateSaleSummary(lot);
    }
  });

  document.getElementById('desktop-qty-increase')?.addEventListener('click', () => {
    if (desktopSaleQty < lot.remaining) {
      desktopSaleQty++;
      document.getElementById('desktop-sale-qty').value = desktopSaleQty;
      updateSaleSummary(lot);
    }
  });

  // Platform toggle
  document.querySelectorAll('.platform-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.platform-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      desktopSalePlatform = btn.dataset.platform;

      // Re-render drawer to show/hide shipping field
      const rightPanel = document.querySelector('.inventory-right-panel');
      if (rightPanel) {
        rightPanel.innerHTML = renderSaleDrawer(lot);
        attachDrawerEvents(lot);
      }
    });
  });

  // Shipping input
  document.getElementById('desktop-shipping-cost')?.addEventListener('input', (e) => {
    desktopSaleShipping = e.target.value;
    updateSaleSummary(lot);
  });

  // Confirm sale
  document.getElementById('desktop-confirm-sale')?.addEventListener('click', () => {
    const price = parseFloat(desktopSalePrice);
    if (!price || price <= 0) return;

    const shipping = desktopSalePlatform === 'ebay' ? (parseFloat(desktopSaleShipping) || 0) : 0;

    recordSale(
      lot.id,
      price,
      desktopSaleQty,
      desktopSalePlatform,
      shipping,
      new Date().toISOString().split('T')[0]
    );

    // Optimistic UI update
    desktopSaleMode = false;

    // Check if sold out
    const updatedLot = getLots().find(l => l.id === lot.id);
    if (updatedLot && updatedLot.remaining === 0) {
      // Animate sold out transition
      const row = document.querySelector(`.inv-card[data-lot-id="${lot.id}"]`);
      if (row) {
        row.classList.add('sold-out-transition');
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('viewchange'));
        }, 300);
      } else {
        window.dispatchEvent(new CustomEvent('viewchange'));
      }
    } else {
      // Update right panel to show view mode
      const rightPanel = document.querySelector('.inventory-right-panel');
      if (rightPanel && updatedLot) {
        rightPanel.innerHTML = renderIntelligencePanel(updatedLot);
        attachPanelEvents();
      }

      // Update row data without full re-render
      updateRowData(updatedLot);
    }
  });
}

function updateSaleSummary(lot) {
  // Re-render just the summary section
  const rightPanel = document.querySelector('.inventory-right-panel');
  if (rightPanel) {
    rightPanel.innerHTML = renderSaleDrawer(lot);
    attachDrawerEvents(lot);
  }
}

function updateRowData(lot) {
  const row = document.querySelector(`.inv-card[data-lot-id="${lot.id}"]`);
  if (!row) return;

  const stats = calculateLotStats(lot);

  // Update performance zone  
  const profitEl = row.querySelector('.inv-perf-profit');
  if (profitEl) {
    profitEl.textContent = formatCurrency(stats.totalProfit, true);
    profitEl.className = `inv-perf-profit ${stats.totalProfit >= 0 ? 'positive' : 'negative'}`;
  }

  // Update ROI badge
  let roiBadgeClass = 'roi-badge-neutral';
  if (stats.roi >= 60) roiBadgeClass = 'roi-badge-great';
  else if (stats.roi >= 40) roiBadgeClass = 'roi-badge-good';
  else if (stats.roi > 0) roiBadgeClass = 'roi-badge-ok';
  else if (stats.roi < 0) roiBadgeClass = 'roi-badge-bad';
  const roiSign = stats.roi >= 0 ? '+' : '';
  const roiBadge = row.querySelector('.roi-badge');
  if (roiBadge) {
    roiBadge.className = `roi-badge ${roiBadgeClass}`;
    roiBadge.textContent = `${roiSign}${stats.roi}%`;
  }

  // Update sell-through bar
  const progressFill = row.querySelector('.mini-progress-fill');
  if (progressFill) progressFill.style.width = `${stats.sellThrough}%`;
  const sellThroughEl = row.querySelector('.val-sellthrough');
  if (sellThroughEl) sellThroughEl.textContent = stats.sellThrough + '%';

  // Update risk zone values
  const riskValues = row.querySelectorAll('.inv-risk-value');
  if (riskValues.length >= 3) {
    const capitalAtRisk = lot.remaining * lot.unitCost;
    riskValues[0].textContent = formatCurrency(capitalAtRisk);
    riskValues[1].textContent = lot.remaining;
    riskValues[2].textContent = stats.daysHeld + 'd';
    riskValues[2].className = `inv-risk-value ${stats.daysHeld > 180 ? 'days-danger' : stats.daysHeld > 90 ? 'days-warn' : ''}`;
  }
}

// Expose to window for access from main.js
window.desktopInventory = {
  reset: () => {
    desktopSelectedLotId = null;
    desktopSaleMode = false;
  }
};
