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

function isDesktop() {
  return window.innerWidth >= 1280;
}

function calculateLotStats(lot) {
  const unitsSold = lot.quantity - lot.remaining;
  const sellThrough = lot.quantity > 0 ? Math.round((unitsSold / lot.quantity) * 100) : 0;
  const totalProfit = getLotTotalProfit(lot);
  const totalRevenue = lot.sales?.reduce((sum, s) => sum + (s.totalPrice || 0), 0) || 0;
  const totalCost = lot.unitCost * unitsSold;
  const roi = totalCost > 0 ? Math.round((totalProfit / totalCost) * 100) : 0;
  const cashRemaining = lot.remaining * lot.unitCost;

  // Low stock detection
  const isLowStock = lot.remaining <= 2 || (lot.remaining / lot.quantity) <= 0.2;

  return {
    unitsSold,
    sellThrough,
    totalProfit,
    totalRevenue,
    roi,
    cashRemaining,
    isLowStock
  };
}

function getStatusDot(lot, stats) {
  if (isFullySold(lot)) {
    return `<span class="status-dot sold" title="Sold Out"></span>`;
  } else if (stats.isLowStock) {
    return `<span class="status-dot low-stock" title="Low Stock"></span>`;
  }
  return `<span class="status-dot active" title="Active"></span>`;
}

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
      <div class="inv-grid-header">
        <span>Item</span>
        <span class="text-right">Left</span>
        <span class="text-right">Sold</span>
        <span>Sell-Through</span>
        <span class="text-right">ROI</span>
        <span class="text-right">Profit</span>
        <span class="text-right">Cash</span>
        <span></span>
      </div>
      <div class="inv-grid-body">
        ${lots.map(lot => {
    const stats = calculateLotStats(lot);
    const isSelected = lot.id === desktopSelectedLotId;
    const isSoldOut = isFullySold(lot);
    const purchaseDate = new Date(lot.purchaseDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    const roiCls = stats.roi >= 0 ? 'trend-up' : 'trend-down';
    const roiArrow = stats.roi >= 0 ? '↑' : '↓';

    return `
            <div class="inv-card ${isSelected ? 'selected' : ''} ${isSoldOut ? 'sold-out' : ''}" data-lot-id="${lot.id}">
              <div class="inv-col-item">
                <div class="inv-item-name">${lot.name}</div>
                <div class="inv-item-date">${purchaseDate}</div>
              </div>
              
              <div class="inv-col-units ${stats.isLowStock ? 'low-stock' : ''}">
                <span class="val-left">${lot.remaining}</span>
                ${stats.isLowStock ? '<span class="low-stock-indicator"></span>' : ''}
              </div>
              
              <div class="inv-col-units">
                <span class="val-sold">${stats.unitsSold}</span>
              </div>
              
              <div class="inv-col-progress">
                <div class="mini-progress-bar">
                  <div class="mini-progress-fill" style="width: ${stats.sellThrough}%"></div>
                </div>
                <span class="val-sellthrough">${stats.sellThrough}%</span>
              </div>
              
              <div class="inv-col-roi">
                <span class="kpi-pill-trend inline"><span class="${roiCls}">${Math.abs(stats.roi)}% ${roiArrow}</span></span>
              </div>
              
              <div class="inv-col-currency val-profit ${stats.totalProfit >= 0 ? 'positive' : 'negative'}">
                ${formatCurrency(stats.totalProfit, true)}
              </div>
              
              <div class="inv-col-currency val-cash">
                ${formatCurrency(stats.cashRemaining)}
              </div>
              
              <div class="inv-col-status">
                ${getStatusDot(lot, stats)}
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

  // Days held
  const daysHeld = Math.floor((Date.now() - new Date(lot.purchaseDate).getTime()) / (1000 * 60 * 60 * 24));

  // Avg sale price
  const avgSalePrice = stats.unitsSold > 0 ? stats.totalRevenue / stats.unitsSold : 0;

  if (desktopSaleMode) {
    return renderSaleDrawer(lot);
  }

  return `
    <div class="intelligence-panel">
      <div class="panel-header">
        <h3 class="panel-title">${lot.name}</h3>
        <div class="panel-meta">
          <span>Purchased ${purchaseDate}</span>
          <span class="meta-sep">•</span>
          <span>${lot.quantity} units @ ${formatCurrency(lot.unitCost)}/unit</span>
        </div>
      </div>

      <div class="capital-recovered-section">
        <div class="section-label">Capital Recovered</div>
        <div class="progress-bar-container">
          <div class="progress-labels">
            <span class="val-sellthrough">${stats.sellThrough}%</span>
            <span><span class="inv-col-currency">${formatCurrency(stats.totalRevenue)}</span> <span class="text-muted">/ ${formatCurrency(lot.totalCost)}</span></span>
          </div>
          <div class="mini-progress-bar" style="margin-top: 8px; height: 6px;">
            <div class="mini-progress-fill" style="width: ${stats.sellThrough}%"></div>
          </div>
        </div>
      </div>

      <div class="stats-grid">
        <div class="stat-item">
          <div class="stat-label">Total Invested</div>
          <div class="stat-value">${formatCurrency(lot.totalCost)}</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">Total Revenue</div>
          <div class="stat-value">${formatCurrency(stats.totalRevenue)}</div>
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
          <div class="stat-label">Units Remaining</div>
          <div class="stat-value ${stats.isLowStock ? 'low-stock' : ''}">${lot.remaining}</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">Days Held</div>
          <div class="stat-value">${daysHeld}</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">Avg Sale Price</div>
          <div class="stat-value">${formatCurrency(avgSalePrice)}</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">Cost Basis</div>
          <div class="stat-value">${formatCurrency(lot.unitCost)}/unit</div>
        </div>
      </div>

      ${lot.sales?.length > 0 ? `
        <div class="recent-sales-section">
          <div class="section-header">
            <span class="section-label" style="margin-bottom:0;">Recent Sales</span>
            <span class="sale-count">${lot.sales.length} total</span>
          </div>
          <div class="recent-sales-list">
            ${lot.sales.slice(-5).reverse().map(sale => `
              <div class="recent-sale-item">
                <span class="sale-date">${formatDate(sale.dateSold)}</span>
                <span class="sale-qty">${sale.unitsSold}×</span>
                <span class="sale-revenue val-currency">${formatCurrency(sale.totalPrice)}</span>
                <span class="sale-profit val-currency ${sale.profit >= 0 ? 'positive' : 'negative'}">${formatCurrency(sale.profit, true)}</span>
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

  const selectedLot = desktopSelectedLotId ? lots.find(l => l.id === desktopSelectedLotId) : null;
  const hasSelection = !!selectedLot;
  const summary = calculateSummaryMetrics(lots);

  return `
    <div class="desktop-inventory-container ${hasSelection ? 'has-selection' : ''}">
      <div class="inventory-summary-strip">
        <div class="summary-item">
          <span class="summary-value">${summary.skusInStock}</span>
          <span class="summary-label">SKUs in Stock</span>
        </div>
        <div class="summary-divider"></div>
        <div class="summary-item">
          <span class="summary-value">${formatCurrency(summary.totalCapital)}</span>
          <span class="summary-label">Capital Deployed</span>
        </div>
        <div class="summary-divider"></div>
        <div class="summary-item">
          <span class="summary-value ${summary.totalUnrealizedProfit >= 0 ? 'positive' : 'negative'}">${formatCurrency(summary.totalUnrealizedProfit, true)}</span>
          <span class="summary-label">Unrealized Profit</span>
        </div>
        <div class="summary-divider"></div>
        <div class="summary-item ${summary.lowStockCount > 0 ? 'has-alert' : ''}">
          <span class="summary-value">${summary.lowStockCount}</span>
          <span class="summary-label">Low Stock</span>
          ${summary.lowStockCount > 0 ? '<span class="alert-dot"></span>' : ''}
        </div>
      </div>
      <div class="inventory-content">
        <div class="inventory-left-panel">
          <div class="panel-header">
            <div class="tabs">
              <button class="tab ${currentTab === 'all' ? 'active' : ''}" data-tab="all">All</button>
              <button class="tab ${currentTab === 'unsold' ? 'active' : ''}" data-tab="unsold">Available</button>
              <button class="tab ${currentTab === 'sold' ? 'active' : ''}" data-tab="sold">Sold Out</button>
            </div>
            <div class="inventory-search">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
              <input type="text" id="desktop-inventory-search" placeholder="Search items..." value="${currentSearch}">
            </div>
          </div>
          <div class="inventory-table-container">
            ${renderInventoryGrid(filteredLots)}
          </div>
        </div>
        ${hasSelection ? `
          <div class="inventory-right-panel">
            <button class="panel-close-btn" id="close-intelligence-panel">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
            ${renderIntelligencePanel(selectedLot)}
          </div>
        ` : ''}
      </div>
    </div>
  `;
}

export function initDesktopInventoryEvents() {
  // Row selection - trigger viewchange for smooth panel animation
  document.querySelectorAll('.inv-card').forEach(row => {
    row.addEventListener('click', () => {
      const lotId = row.dataset.lotId;

      // Only trigger re-render if selecting a different item
      if (desktopSelectedLotId !== lotId) {
        desktopSelectedLotId = lotId;
        desktopSaleMode = false;
        window.dispatchEvent(new CustomEvent('viewchange'));
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

  // Close panel button
  document.getElementById('close-intelligence-panel')?.addEventListener('click', () => {
    desktopSelectedLotId = null;
    desktopSaleMode = false;
    window.dispatchEvent(new CustomEvent('viewchange'));
  });

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

  row.querySelector('.val-left').textContent = lot.remaining;
  row.querySelector('.val-sold').textContent = stats.unitsSold;

  const progressFill = row.querySelector('.mini-progress-fill');
  if (progressFill) progressFill.style.width = `${stats.sellThrough}%`;
  row.querySelector('.val-sellthrough').textContent = stats.sellThrough + '%';

  const roiCls = stats.roi >= 0 ? 'trend-up' : 'trend-down';
  const roiArrow = stats.roi >= 0 ? '↑' : '↓';
  row.querySelector('.inv-col-roi').innerHTML = `<span class="kpi-pill-trend inline"><span class="${roiCls}">${Math.abs(stats.roi)}% ${roiArrow}</span></span>`;

  row.querySelector('.val-profit').textContent = formatCurrency(stats.totalProfit, true);
  row.querySelector('.val-profit').className = `inv-col-currency val-profit ${stats.totalProfit >= 0 ? 'positive' : 'negative'}`;

  row.querySelector('.val-cash').textContent = formatCurrency(stats.cashRemaining);
  row.querySelector('.inv-col-status').innerHTML = getStatusDot(lot, stats);
}

// Expose to window for access from main.js
window.desktopInventory = {
  reset: () => {
    desktopSelectedLotId = null;
    desktopSaleMode = false;
  }
};
