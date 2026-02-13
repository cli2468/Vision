// Inventory View - List all lots with sale recording

import { getLots, recordSale, deleteLot, isFullySold, hasSales, getLotTotalProfit, deleteSale, updateSale, getReturnDeadline, getDaysUntilReturn, markSaleReturned } from '../services/storage.js';
import { formatCurrency, formatDate, PLATFORM_FEES, calculateSaleProfit } from '../services/calculations.js';
import { importLotsFromCSV, generateCSVTemplate } from '../services/csvImport.js';
import { celebrateSuccess } from '../utils/animations.js';

let activeTab = 'unsold';
let searchQuery = '';
let sortOrder = 'newest';
let selectedLotId = null;
let salePrice = '';
let unitsSold = '1';
let selectedPlatform = 'facebook';
let expandedLots = new Set();
let shippingCost = '';
let saleDate = new Date().toISOString().split('T')[0]; // Default to today
let showImportModal = false;

// Edit sale state
let editSaleData = null; // { lotId, saleId, sale }
let editSalePrice = '';
let editShippingCost = '';
let editSaleDate = '';

export function setActiveTab(tab) {
  activeTab = tab;
}

function getFilteredAndSortedLots() {
  const allLots = getLots();
  let filteredLots = allLots;
  if (activeTab === 'unsold') {
    filteredLots = allLots.filter(lot => lot.remaining > 0);
  } else if (activeTab === 'sold') {
    filteredLots = allLots.filter(lot => isFullySold(lot));
  }

  // Search filter
  if (searchQuery.trim()) {
    const q = searchQuery.trim().toLowerCase();
    filteredLots = filteredLots.filter(lot => lot.name.toLowerCase().includes(q));
  }

  // Sort
  filteredLots = [...filteredLots];
  switch (sortOrder) {
    case 'newest':
      filteredLots.sort((a, b) => new Date(b.purchaseDate || b.dateAdded || 0) - new Date(a.purchaseDate || a.dateAdded || 0));
      break;
    case 'oldest':
      filteredLots.sort((a, b) => new Date(a.purchaseDate || a.dateAdded || 0) - new Date(b.purchaseDate || b.dateAdded || 0));
      break;
    case 'highest':
      filteredLots.sort((a, b) => b.totalCost - a.totalCost);
      break;
    case 'lowest':
      filteredLots.sort((a, b) => a.totalCost - b.totalCost);
      break;
  }
  return filteredLots;
}

export function InventoryView() {
  const filteredLots = getFilteredAndSortedLots();

  const modalHtml = selectedLotId ? renderSaleModal() : '';
  const importModalHtml = showImportModal ? renderImportModal() : '';
  const editSaleModalHtml = editSaleData ? renderEditSaleModal() : '';

  return `
    <div class="page">
      <div class="container">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--spacing-md);">
          <h1 class="page-title" style="margin-bottom: 0;">Inventory</h1>
          <button class="btn btn-secondary btn-sm" id="import-csv-btn" style="padding: 8px 12px;">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px;">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="17 8 12 3 7 8"></polyline>
              <line x1="12" y1="3" x2="12" y2="15"></line>
            </svg>
            Import
          </button>
        </div>
        
        <div class="tabs">
          <button class="tab ${activeTab === 'all' ? 'active' : ''}" data-tab="all">All</button>
          <button class="tab ${activeTab === 'unsold' ? 'active' : ''}" data-tab="unsold">Available</button>
          <button class="tab ${activeTab === 'sold' ? 'active' : ''}" data-tab="sold">Sold Out</button>
        </div>

        <div class="inventory-controls">
          <div class="search-bar">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input type="text" class="search-input" id="inventory-search" placeholder="Search items..." value="${searchQuery}" />
          </div>
          <select class="sort-dropdown" id="inventory-sort">
            <option value="newest" ${sortOrder === 'newest' ? 'selected' : ''}>Newest</option>
            <option value="oldest" ${sortOrder === 'oldest' ? 'selected' : ''}>Oldest</option>
            <option value="highest" ${sortOrder === 'highest' ? 'selected' : ''}>Highest $</option>
            <option value="lowest" ${sortOrder === 'lowest' ? 'selected' : ''}>Lowest $</option>
          </select>
        </div>
        
        ${filteredLots.length === 0 ? renderEmptyState() : ''}
        
        <div class="lot-list">
          ${filteredLots.map((lot, index) => renderLotCard(lot, index)).join('')}
        </div>
      </div>
    </div>
    ${modalHtml}
    ${importModalHtml}
    ${editSaleModalHtml}
  `;
}


function renderLotCard(lot, index = 0) {
  const fullySold = isFullySold(lot);
  const hasAnySales = hasSales(lot);
  const totalProfit = getLotTotalProfit(lot);
  const unitsSold = lot.quantity - lot.remaining;
  const soldPercent = Math.round((unitsSold / lot.quantity) * 100);
  const isExpanded = expandedLots.has(lot.id);

  // Return deadline calculation
  const returnDeadline = getReturnDeadline(lot);
  const daysUntilReturn = getDaysUntilReturn(lot);
  const returnDateStr = returnDeadline.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const showReturnWarning = !fullySold && daysUntilReturn <= 3 && daysUntilReturn >= 0;

  const profitHtml = hasAnySales
    ? `<div class="lot-profit ${totalProfit >= 0 ? 'text-success' : 'text-danger'}">${formatCurrency(totalProfit, true)}</div>`
    : '';

  const progressBar = lot.quantity > 1 ? `
    <div class="lot-progress">
      <div class="lot-progress-bar" style="width: ${soldPercent}%"></div>
    </div>
    <div class="lot-progress-text">${unitsSold} of ${lot.quantity} sold</div>
  ` : '';

  const returnDeadlineHtml = (!fullySold && lot.remaining > 0) ? `
    <div class="lot-return-deadline ${showReturnWarning ? 'urgent' : ''}">
      Return by ${returnDateStr}
    </div>
  ` : '';

  const salesListHtml = hasAnySales ? `
    <div class="sales-list-accordion ${isExpanded ? 'expanded' : ''}" id="sales-list-${lot.id}">
      ${renderSalesList(lot)}
    </div>
  ` : '';
  const viewSalesBtn = hasAnySales ? `
    <button class="btn btn-secondary btn-sm toggle-sales" data-lot-id="${lot.id}" style="margin-top: var(--spacing-sm); padding: 4px 8px; font-size: 0.75rem; min-height: 28px;">
      ${isExpanded ? 'Hide Sales' : 'View Sales'}
    </button>
  ` : '';

return `
    <div class="lot-card-swipe-wrapper" data-lot-id="${lot.id}" style="animation: cardFadeIn 0.3s ease-out forwards; animation-delay: ${index * 20}ms; opacity: 0;">
      <!-- Background Actions - shown when card is swiped -->
      <div class="swipe-actions-bg">
        <!-- Edit action on left (swipe right) -->
        <div class="swipe-bg-action edit-bg" data-lot-id="${lot.id}">
          <div class="swipe-bg-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
          </div>
          <span>Edit</span>
        </div>
        
        <!-- Delete action on right (swipe left) -->
        <div class="swipe-bg-action delete-bg" data-lot-id="${lot.id}">
          <div class="swipe-bg-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </div>
          <span>Delete</span>
        </div>
      </div>
      
      <!-- Main Card Content -->
      <div class="lot-card ${fullySold ? 'sold' : ''}" data-lot-id="${lot.id}">
        <div class="lot-info">
          <div class="lot-name">${lot.name}</div>
          <div class="lot-meta">${formatCurrency(lot.unitCost)}/unit • ${lot.remaining} available</div>
          ${returnDeadlineHtml}
          ${progressBar}
          ${viewSalesBtn}
          ${salesListHtml}
        </div>
        
        <div class="lot-actions">
          <div class="lot-cost-info">
            <div class="lot-total-cost">${formatCurrency(lot.totalCost)}</div>
            ${profitHtml}
          </div>
          ${!fullySold ? `
            <button class="btn btn-primary add-sale-btn" data-lot-id="${lot.id}">
              Record Sale
            </button>
          ` : ''}
        </div>
      </div>
    </div>
  `;
}

function renderSalesList(lot) {
  return `
    <div class="sales-list" style="margin-top: var(--spacing-md); border-top: 1px solid rgba(255, 255, 255, 0.05); padding-top: var(--spacing-sm);">
      ${lot.sales.map(sale => {
    const saleDateFormatted = formatDate(sale.dateSold);
    const shippingDisplay = sale.shippingCost ? ` (+ ${formatCurrency(sale.shippingCost)} ship)` : '';
    const returnedBadge = sale.returned ? `<span style="color: var(--accent-danger); font-size: 0.75rem; margin-left: 8px;">(RETURNED)</span>` : '';
    const profitDisplay = sale.returned
      ? `<span style="color: var(--accent-danger); text-decoration: line-through;">${formatCurrency(sale.profit, true)}</span>`
      : `<span class="${sale.profit >= 0 ? 'text-success' : 'text-danger'}" style="font-weight: 600;">${formatCurrency(sale.profit, true)}</span>`;
    return `
        <div class="sale-item ${sale.returned ? 'returned' : ''}" style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; font-size: 0.875rem; border-bottom: 1px solid rgba(255, 255, 255, 0.03);">
          <div>
            <div style="font-weight: 500;">Sold ${sale.unitsSold} on ${sale.platform === 'ebay' ? 'eBay' : 'Facebook'}${returnedBadge}</div>
            <div class="text-muted" style="font-size: 0.75rem;">
              ${saleDateFormatted} • @ ${formatCurrency(sale.pricePerUnit)}${shippingDisplay}
            </div>
          </div>
          <div style="text-align: right; display: flex; align-items: center; gap: 8px;">
            ${profitDisplay}
            ${!sale.returned ? `
            <button class="return-sale-btn" data-lot-id="${lot.id}" data-sale-id="${sale.id}" style="background: none; border: none; color: var(--accent-warning); cursor: pointer; padding: 4px;" title="Mark as Returned">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 10h18"></path>
                <path d="M3 14h18"></path>
                <path d="M10 3v18"></path>
                <path d="M14 3v18"></path>
              </svg>
            </button>
            ` : ''}
            <button class="edit-sale-btn" data-lot-id="${lot.id}" data-sale-id="${sale.id}" style="background: none; border: none; color: var(--text-muted); cursor: pointer; padding: 4px;" title="Edit Sale">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
            </button>
            <button class="delete-sale-btn" data-lot-id="${lot.id}" data-sale-id="${sale.id}" style="background: none; border: none; color: var(--text-muted); cursor: pointer; padding: 4px;" title="Delete Sale">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                <line x1="10" y1="11" x2="10" y2="17"></line>
                <line x1="14" y1="11" x2="14" y2="17"></line>
              </svg>
            </button>
          </div>
        </div>
      `;
  }).join('')}
    </div>
  `;
}

function renderEmptyState() {
  return `
    <div class="empty-state">
      <div class="empty-icon">📦</div>
      <div class="empty-title">No items yet</div>
      <div class="empty-text">Add your first inventory lot by taking a screenshot of your Amazon order</div>
    </div>
  `;
}

function renderEditSaleModal() {
  if (!editSaleData) return '';

  const { sale, lotId } = editSaleData;
  const priceValue = editSalePrice || (sale.pricePerUnit / 100).toFixed(2);
  // Shipping is stored as total cents, convert to per-unit dollars for display
  const shippingPerUnitCents = (sale.shippingCost != null && sale.unitsSold > 0 && !isNaN(sale.shippingCost)) ? sale.shippingCost / sale.unitsSold : 0;
  // shippingPerUnitCents is in cents, divide by 100 once to get dollars
  const shippingDollars = isNaN(shippingPerUnitCents) ? 0 : shippingPerUnitCents / 100;
  const shippingValue = editShippingCost !== '' ? editShippingCost : shippingDollars.toFixed(2);
  const dateValue = editSaleDate || new Date(sale.dateSold).toISOString().split('T')[0];

  return `
    <div class="modal-overlay" id="edit-sale-modal">
      <div class="modal-content">
        <div class="modal-header">
          <h2 class="modal-title">Edit Sale</h2>
          <button class="modal-close" id="close-edit-sale-modal">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        
        <p class="text-secondary" style="margin-bottom: var(--spacing-lg);">
          Sold ${sale.unitsSold} unit${sale.unitsSold > 1 ? 's' : ''} on ${sale.platform === 'ebay' ? 'eBay' : 'Facebook'}
        </p>
        
        <div class="form-group">
          <label class="form-label">Price Per Unit ($)</label>
          <input type="number" class="form-input" id="edit-sale-price" placeholder="0.00" step="0.01" min="0" value="${priceValue}" inputmode="decimal" />
        </div>
        
        ${sale.platform === 'ebay' ? `
          <div class="form-group">
            <label class="form-label">Shipping Cost Per Unit ($)</label>
            <input type="number" class="form-input" id="edit-shipping-cost" placeholder="0.00" step="0.01" min="0" value="${shippingValue}" inputmode="decimal" />
          </div>
        ` : ''}
        
        <div class="form-group">
          <label class="form-label">Sale Date</label>
          <input type="date" class="form-input" id="edit-sale-date" value="${dateValue}" />
        </div>
        
        <button class="btn btn-success btn-full" id="save-edit-sale">
          Save Changes
        </button>
      </div>
    </div>
  `;
}

function renderImportModal() {
  return `
    <div class="modal-overlay" id="import-modal">
      <div class="modal-content">
        <div class="modal-header">
          <h2 class="modal-title">Import from CSV</h2>
          <button class="modal-close" id="close-import-modal">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        
        <div class="import-drop-zone" id="import-drop-zone">
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="color: var(--text-muted); margin-bottom: var(--spacing-md);">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="17 8 12 3 7 8"></polyline>
            <line x1="12" y1="3" x2="12" y2="15"></line>
          </svg>
          <p style="margin: 0; color: var(--text-secondary);">Drop CSV file here or click to browse</p>
          <p style="margin: var(--spacing-sm) 0 0 0; font-size: var(--font-size-sm); color: var(--text-muted);">Columns: name, cost, quantity, purchase_date</p>
          <input type="file" id="csv-file-input" accept=".csv" style="display: none;">
        </div>
        
        <div id="import-result" style="display: none; margin-top: var(--spacing-lg);"></div>
        
        <div style="margin-top: var(--spacing-lg); text-align: center;">
          <button class="btn btn-secondary btn-sm" id="download-template">Download Template</button>
        </div>
      </div>
    </div>
  `;
}

function renderSaleModal() {
  const lot = getLots().find(l => l.id === selectedLotId);
  if (!lot) return '';

  const price = parseFloat(salePrice) || 0;
  const units = Math.min(parseInt(unitsSold) || 1, lot.remaining);
  const priceInCents = Math.round(price * 100);
  const shippingPerUnit = parseFloat(shippingCost) || 0;
  const shippingPerUnitCents = Math.round(shippingPerUnit * 100);
  const totalShippingCents = shippingPerUnitCents * units;

  const { costBasis, totalSalePrice, fees, shippingCost: shippingCalc, profit } = calculateSaleProfit(
    lot.unitCost,
    units,
    priceInCents,
    selectedPlatform,
    selectedPlatform === 'ebay' ? totalShippingCents : 0
  );

  const isEbay = selectedPlatform === 'ebay';
  
  // Platform icons as SVG
  const platformIcons = {
    facebook: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path></svg>`,
    ebay: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line><path d="M6 7h12M6 11h12"></path></svg>`
  };

  const shippingFieldHtml = isEbay ? `
    <div class="form-group">
      <label class="form-label">Shipping Cost ($)</label>
      <input type="number" class="form-input" id="shipping-cost" placeholder="0.00" step="0.01" min="0" value="${shippingCost}" inputmode="decimal" />
    </div>
  ` : '';

  // Validation
  const isValid = price > 0 && units > 0 && (!isEbay || shippingPerUnit >= 0);

  return `
    <div class="modal-overlay" id="sale-modal">
      <div class="modal-content">
        <div class="modal-header">
          <h2 class="modal-title">Record Sale</h2>
          <button class="modal-close" id="close-modal">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        
        <p class="text-secondary" style="margin-bottom: var(--spacing-sm);">${lot.name}</p>
        <p class="text-muted" style="margin-bottom: var(--spacing-lg);">
          ${lot.remaining} of ${lot.quantity} available • ${formatCurrency(lot.unitCost)}/unit cost
        </p>
        
        <!-- Inputs in a row - equal width -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--spacing-md); margin-bottom: var(--spacing-md);">
          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label">Qty</label>
            <div class="quantity-stepper">
              <button type="button" class="stepper-btn" id="decrease-qty">-</button>
              <input type="number" class="form-input stepper-input" id="units-sold" placeholder="1" min="1" max="${lot.remaining}" value="${unitsSold}" inputmode="numeric" readonly />
              <button type="button" class="stepper-btn" id="increase-qty">+</button>
            </div>
          </div>
          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label">Selling Price ($)</label>
            <input type="number" class="form-input" id="sale-price" placeholder="0.00" step="0.01" min="0" value="${salePrice}" inputmode="decimal" />
          </div>
        </div>
        
        ${shippingFieldHtml}
        
        <div class="form-group">
          <label class="form-label">Platform</label>
          <div class="platform-grid compact">
            ${Object.entries(PLATFORM_FEES).map(([key, platform]) => `
              <div class="platform-option compact ${selectedPlatform === key ? 'selected' : ''}" data-platform="${key}">
                <div class="platform-icon">${platformIcons[key]}</div>
                <div class="platform-name">${platform.name}</div>
              </div>
            `).join('')}
          </div>
        </div>
        
        <div class="form-group date-group">
          <label class="form-label">Sale Date</label>
          <input type="date" class="form-input" id="sale-date" value="${saleDate}" />
        </div>
        
        <!-- View Breakdown Toggle -->
        <div class="breakdown-toggle" id="breakdown-toggle">
          <span>View Breakdown</span>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" id="breakdown-arrow">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </div>
        
        <!-- Breakdown Content with accordion -->
        <div class="breakdown-wrapper" id="breakdown-wrapper">
          <div class="breakdown-content" id="breakdown-content">
            <div class="breakdown-row">
              <span class="text-secondary">Revenue</span>
              <span>${formatCurrency(totalSalePrice)}</span>
            </div>
            <div class="breakdown-row">
              <span class="text-secondary">Platform Fees</span>
              <span>-${formatCurrency(fees)}</span>
            </div>
            ${isEbay ? `
              <div class="breakdown-row">
                <span class="text-secondary">Shipping</span>
                <span>-${formatCurrency(shippingCalc)}</span>
              </div>
            ` : ''}
            <div class="breakdown-row">
              <span class="text-secondary">Cost Basis</span>
              <span>-${formatCurrency(costBasis)}</span>
            </div>
          </div>
        </div>
        
        <!-- Profit Display -->
        <div class="profit-display ${profit >= 0 ? 'profit' : 'loss'}" style="text-align: center; padding: var(--spacing-md); background: var(--bg-glass); border-radius: var(--radius-md); margin: var(--spacing-md) 0;">
          <div style="font-size: var(--font-size-sm); color: var(--text-secondary); margin-bottom: 4px;">Net Profit</div>
          <div style="font-size: var(--font-size-2xl); font-weight: 700;" id="profit-display">${formatCurrency(profit)}</div>
        </div>
        
        <button class="btn btn-success btn-full" id="confirm-sale" ${!isValid ? 'disabled' : ''}>
          Confirm Sale
        </button>
      </div>
    </div>
  `;
}

// Update just the lot list content without re-rendering the entire page
function updateLotList() {
  const filteredLots = getFilteredAndSortedLots();

  // Update tab active states
  document.querySelectorAll('.tab').forEach(tab => {
    if (tab.dataset.tab === activeTab) {
      tab.classList.add('active');
    } else {
      tab.classList.remove('active');
    }
  });

  // Update lot list content
  const lotList = document.querySelector('.lot-list');
  const container = document.querySelector('.container');
  if (lotList) {
    lotList.innerHTML = filteredLots.map(lot => renderLotCard(lot)).join('');
  }

  // Handle empty state
  const existingEmptyState = document.querySelector('.empty-state');
  if (filteredLots.length === 0) {
    if (!existingEmptyState && container) {
      const emptyDiv = document.createElement('div');
      emptyDiv.innerHTML = renderEmptyState();
      const lotListEl = document.querySelector('.lot-list');
      if (lotListEl) {
        lotListEl.before(emptyDiv.firstElementChild);
      }
    }
  } else if (existingEmptyState) {
    existingEmptyState.remove();
  }

  // Re-attach event listeners for the new lot cards
  initLotCardEvents();
}

// Update platform selection without full re-render
function updatePlatformSelection(newPlatform) {
  const oldPlatform = selectedPlatform;
  selectedPlatform = newPlatform;

  // Update platform option visual states
  document.querySelectorAll('.platform-option').forEach(opt => {
    if (opt.dataset.platform === newPlatform) {
      opt.classList.add('selected');
    } else {
      opt.classList.remove('selected');
    }
  });

  // Handle shipping field visibility
  const modalContent = document.querySelector('.modal-content');
  const existingShippingField = document.querySelector('.shipping-field');
  const summaryBox = document.querySelector('.modal-content .summary-box');

  if (newPlatform === 'ebay' && !existingShippingField) {
    // Add shipping field after the sale price input (before platform selection)
    const platformGroup = document.querySelector('.platform-grid')?.closest('.form-group');
    if (platformGroup) {
      const shippingDiv = document.createElement('div');
      shippingDiv.className = 'form-group shipping-field';
      shippingDiv.innerHTML = `
        <label class="form-label">Shipping Cost Per Unit ($)</label>
        <input type="number" class="form-input" id="shipping-cost" placeholder="0.00" step="0.01" min="0" value="${shippingCost}" inputmode="decimal" />
      `;
      platformGroup.before(shippingDiv);

      // Attach event listener to new shipping input
      document.getElementById('shipping-cost')?.addEventListener('input', (e) => {
        shippingCost = e.target.value;
        updateSummaryBox();
      });
    }
  } else if (newPlatform !== 'ebay' && existingShippingField) {
    // Remove shipping field
    existingShippingField.remove();
    shippingCost = '';
  }

  // Update summary calculations
  updateSummaryBox();
}

// Update just the summary box without re-rendering the entire page
function updateSummaryBox() {
  const lot = getLots().find(l => l.id === selectedLotId);
  if (!lot) return;

  const price = parseFloat(salePrice) || 0;
  const units = Math.min(parseInt(unitsSold) || 1, lot.remaining);
  const priceInCents = Math.round(price * 100);
  const shipping = parseFloat(shippingCost) || 0;
  const shippingPerUnitCents = Math.round(shipping * 100);
  const totalShippingCents = shippingPerUnitCents * units;
  const isEbay = selectedPlatform === 'ebay';

  const { costBasis, totalSalePrice, fees, shippingCost: shippingCalc, profit } = calculateSaleProfit(
    lot.unitCost,
    units,
    priceInCents,
    selectedPlatform,
    isEbay ? totalShippingCents : 0
  );

  const isValid = price > 0 && units > 0 && (!isEbay || shipping >= 0);

  // Update summary box
  const summaryBox = document.querySelector('.modal-content .summary-box');
  if (summaryBox) {
    summaryBox.innerHTML = `
      <div class="summary-row">
        <span class="text-secondary">Revenue (${units} × ${formatCurrency(priceInCents)})</span>
        <span>${formatCurrency(totalSalePrice)}</span>
      </div>
      <div class="summary-row">
        <span class="text-secondary">Platform Fees</span>
        <span>-${formatCurrency(fees)}</span>
      </div>
      ${isEbay ? `
        <div class="summary-row">
          <span class="text-secondary">Shipping (${units} × ${formatCurrency(shippingPerUnitCents)})</span>
          <span>-${formatCurrency(shippingCalc)}</span>
        </div>
      ` : ''}
      <div class="summary-row">
        <span class="text-secondary">Cost Basis</span>
        <span>-${formatCurrency(costBasis)}</span>
      </div>
      <div class="summary-row ${profit >= 0 ? 'profit' : 'loss'}">
        <span>Net Profit</span>
        <span class="summary-value">${formatCurrency(profit)}</span>
      </div>
    `;
  }

  // Update profit display (for new modal style)
  const profitDisplay = document.getElementById('profit-display');
  if (profitDisplay) {
    profitDisplay.textContent = formatCurrency(profit);
    profitDisplay.parentElement.className = `profit-display ${profit >= 0 ? 'profit' : 'loss'}`;
    profitDisplay.parentElement.style.textAlign = 'center';
    profitDisplay.parentElement.style.padding = 'var(--spacing-md)';
    profitDisplay.parentElement.style.background = 'var(--bg-glass)';
    profitDisplay.parentElement.style.borderRadius = 'var(--radius-md)';
    profitDisplay.parentElement.style.margin = 'var(--spacing-md) 0';
  }

  // Update breakdown content
  const breakdownContent = document.getElementById('breakdown-content');
  if (breakdownContent) {
    breakdownContent.innerHTML = `
      <div class="summary-row" style="display: flex; justify-content: space-between; padding: var(--spacing-xs) 0; border-bottom: 1px solid rgba(255,255,255,0.05);">
        <span class="text-secondary" style="font-size: var(--font-size-sm);">Revenue</span>
        <span>${formatCurrency(totalSalePrice)}</span>
      </div>
      <div class="summary-row" style="display: flex; justify-content: space-between; padding: var(--spacing-xs) 0; border-bottom: 1px solid rgba(255,255,255,0.05);">
        <span class="text-secondary" style="font-size: var(--font-size-sm);">Platform Fees</span>
        <span>-${formatCurrency(fees)}</span>
      </div>
      ${isEbay ? `
        <div class="summary-row" style="display: flex; justify-content: space-between; padding: var(--spacing-xs) 0; border-bottom: 1px solid rgba(255,255,255,0.05);">
          <span class="text-secondary" style="font-size: var(--font-size-sm);">Shipping</span>
          <span>-${formatCurrency(shippingCalc)}</span>
        </div>
      ` : ''}
      <div class="summary-row" style="display: flex; justify-content: space-between; padding: var(--spacing-xs) 0;">
        <span class="text-secondary" style="font-size: var(--font-size-sm);">Cost Basis</span>
        <span>-${formatCurrency(costBasis)}</span>
      </div>
    `;
  }

  // Update confirm button state
  const confirmBtn = document.getElementById('confirm-sale');
  if (confirmBtn) {
    confirmBtn.disabled = !isValid;
  }
}

export function openSaleModal(lotId) {
  selectedLotId = lotId;
  salePrice = '';
  unitsSold = '1';
  selectedPlatform = 'facebook';
  shippingCost = '';
  saleDate = new Date().toISOString().split('T')[0];
  window.dispatchEvent(new CustomEvent('viewchange'));
}

export function closeSaleModal() {
  const modal = document.getElementById('sale-modal');
  if (modal) {
    modal.classList.add('closing');
    setTimeout(() => {
      selectedLotId = null;
      salePrice = '';
      unitsSold = '1';
      shippingCost = '';
      saleDate = new Date().toISOString().split('T')[0];
      window.dispatchEvent(new CustomEvent('viewchange'));
    }, 200);
  } else {
    selectedLotId = null;
    salePrice = '';
    unitsSold = '1';
    shippingCost = '';
    saleDate = new Date().toISOString().split('T')[0];
    window.dispatchEvent(new CustomEvent('viewchange'));
  }
}

function closeEditSaleModal() {
  const modal = document.getElementById('edit-sale-modal');
  if (modal) {
    modal.classList.add('closing');
    setTimeout(() => {
      editSaleData = null;
      editSalePrice = '';
      editShippingCost = '';
      editSaleDate = '';
      window.dispatchEvent(new CustomEvent('viewchange'));
    }, 200);
  } else {
    editSaleData = null;
    editSalePrice = '';
    editShippingCost = '';
    editSaleDate = '';
    window.dispatchEvent(new CustomEvent('viewchange'));
  }
}


// Event handlers specific to lot cards (called after lot list updates)
function initLotCardEvents() {
  // Toggle sales list - accordion animation without page refresh
  document.querySelectorAll('.toggle-sales').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const lotId = btn.dataset.lotId;
      const accordion = document.getElementById(`sales-list-${lotId}`);
      const isCurrentlyExpanded = accordion?.classList.contains('expanded');

      // Toggle button text
      btn.textContent = isCurrentlyExpanded ? 'View Sales' : 'Hide Sales';

      // Toggle accordion with animation
      if (accordion) {
        if (isCurrentlyExpanded) {
          accordion.classList.remove('expanded');
          expandedLots.delete(lotId);
        } else {
          accordion.classList.add('expanded');
          expandedLots.add(lotId);
        }
      }
    });
  });

  // Open sale modal via plus button
  document.querySelectorAll('.add-sale-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openSaleModal(btn.dataset.lotId);
    });
  });

  // Delete individual sale
  document.querySelectorAll('.delete-sale-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const { lotId, saleId } = btn.dataset;
      if (confirm('Delete this sale record and restore units to inventory?')) {
        deleteSale(lotId, saleId);
        window.dispatchEvent(new CustomEvent('viewchange'));
      }
    });
  });

  // Delete lot shortcut
  document.querySelectorAll('.delete-lot-card-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const lotId = btn.dataset.lotId;
      if (confirm('Delete this lot and all its sales history?')) {
        deleteLot(lotId);
        window.dispatchEvent(new CustomEvent('viewchange'));
      }
    });
  });

  // Edit sale button - opens edit modal without full page refresh
  document.querySelectorAll('.edit-sale-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const { lotId, saleId } = btn.dataset;
      const lot = getLots().find(l => l.id === lotId);
      const sale = lot?.sales.find(s => s.id === saleId);
      if (sale) {
        editSaleData = { lotId, saleId, sale };
        editSalePrice = '';
        editShippingCost = '';
        editSaleDate = '';
        // Inject modal directly without full page re-render
        const modalHtml = renderEditSaleModal();
        if (modalHtml) {
          document.body.insertAdjacentHTML('beforeend', modalHtml);
          attachEditSaleModalEvents();
        }
      }
    });
  });

  // Return sale button - marks sale as returned with confirmation
  document.querySelectorAll('.return-sale-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const { lotId, saleId } = btn.dataset;
      const lot = getLots().find(l => l.id === lotId);
      const sale = lot?.sales.find(s => s.id === saleId);

      if (!sale) return;

      const profit = formatCurrency(sale.profit);
      const message = sale.profit >= 0
        ? `This sale had a profit of ${profit}. Marking it as returned will:\n\n1. Remove this profit from your totals\n2. Restore ${sale.unitsSold} unit(s) to inventory\n\nAre you sure you want to mark this as returned?`
        : `This sale had a loss of ${profit}. Marking it as returned will:\n\n1. Remove this loss from your totals (you'll lose the money you made from this sale)\n2. Restore ${sale.unitsSold} unit(s) to inventory\n\nAre you sure you want to mark this as returned?`;

      if (confirm(message)) {
        markSaleReturned(lotId, saleId);
        window.dispatchEvent(new CustomEvent('viewchange'));
      }
  });
});

// Initialize swipe functionality for lot cards
initSwipeHandlers();

}

// Swipe handling functions
function initSwipeHandlers() {
  const swipeWrappers = document.querySelectorAll('.lot-card-swipe-wrapper');
  
  swipeWrappers.forEach(wrapper => {
    const card = wrapper.querySelector('.lot-card');
    const lotId = wrapper.dataset.lotId;
    
    if (!card) return;
    
    let startX = 0;
    let currentX = 0;
    let isDragging = false;
    let startY = 0;
    let isHorizontal = false;
    
    // Touch start
    card.addEventListener('touchstart', (e) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      isDragging = true;
      isHorizontal = false;
      card.classList.add('swiping');
    }, { passive: true });
    
    // Touch move
    card.addEventListener('touchmove', (e) => {
      if (!isDragging) return;
      
      const touchX = e.touches[0].clientX;
      const touchY = e.touches[0].clientY;
      const deltaX = touchX - startX;
      const deltaY = touchY - startY;
      
      // Determine if horizontal swipe on first significant movement
      if (!isHorizontal && (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10)) {
        isHorizontal = Math.abs(deltaX) > Math.abs(deltaY);
        if (isHorizontal) {
          wrapper.classList.add('swiping');
        }
      }
      
      if (isHorizontal) {
        e.preventDefault();
        currentX = deltaX;
        
        // Limit the swipe distance
        const maxSwipe = 120;
        const clampedX = Math.max(-maxSwipe, Math.min(maxSwipe, currentX));
        card.style.transform = `translateX(${clampedX}px)`;
        
        // Show action indicators
        if (currentX < -40) {
          wrapper.classList.add('swiping-left');
          wrapper.classList.remove('swiping-right');
        } else if (currentX > 40) {
          wrapper.classList.add('swiping-right');
          wrapper.classList.remove('swiping-left');
        } else {
          wrapper.classList.remove('swiping-left', 'swiping-right');
        }
      }
    }, { passive: false });
    
    // Touch end
    card.addEventListener('touchend', () => {
      if (!isDragging) return;
      isDragging = false;
      card.classList.remove('swiping');
      wrapper.classList.remove('swiping');
      
      const threshold = 80;
      
      if (currentX > threshold) {
        // Full right swipe - EDIT (now appears on left side)
        card.style.transform = 'translateX(80px)';
        card.classList.add('swiped-right');
        setTimeout(() => {
          openEditLotModal(lotId);
          resetCardPosition(card);
        }, 300);
      } else if (currentX < -threshold) {
        // Full left swipe - DELETE (now appears on right side)
        card.style.transform = 'translateX(-80px)';
        card.classList.add('swiped-left');
        setTimeout(() => {
          if (confirm('Delete this lot and all its sales history?')) {
            deleteLot(lotId);
            window.dispatchEvent(new CustomEvent('viewchange'));
          } else {
            resetCardPosition(card);
          }
        }, 300);
      } else if (currentX > 40) {
        // Partial right swipe - show EDIT button (on left)
        card.style.transform = 'translateX(80px)';
        card.classList.add('swiped-right');
        const clickHandler = () => {
          openEditLotModal(lotId);
          resetCardPosition(card);
          card.removeEventListener('click', clickHandler);
        };
        card.addEventListener('click', clickHandler);
        setTimeout(() => {
          if (card.classList.contains('swiped-right')) {
            resetCardPosition(card);
            card.removeEventListener('click', clickHandler);
          }
        }, 3000);
      } else if (currentX < -40) {
        // Partial left swipe - show DELETE button (on right)
        card.style.transform = 'translateX(-80px)';
        card.classList.add('swiped-left');
        const clickHandler = () => {
          if (confirm('Delete this lot and all its sales history?')) {
            deleteLot(lotId);
            window.dispatchEvent(new CustomEvent('viewchange'));
          } else {
            resetCardPosition(card);
          }
          card.removeEventListener('click', clickHandler);
        };
        card.addEventListener('click', clickHandler);
        setTimeout(() => {
          if (card.classList.contains('swiped-left')) {
            resetCardPosition(card);
            card.removeEventListener('click', clickHandler);
          }
        }, 3000);
      } else {
        resetCardPosition(card);
      }
      
      wrapper.classList.remove('swiping-left', 'swiping-right');
    });
    
    // Mouse events for desktop
    card.addEventListener('mousedown', (e) => {
      startX = e.clientX;
      startY = e.clientY;
      isDragging = true;
      isHorizontal = false;
      card.classList.add('swiping');
    });
    
    card.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      
      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;
      
      if (!isHorizontal && (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10)) {
        isHorizontal = Math.abs(deltaX) > Math.abs(deltaY);
        if (isHorizontal) {
          wrapper.classList.add('swiping');
        }
      }
      
      if (isHorizontal) {
        e.preventDefault();
        currentX = deltaX;
        
        const maxSwipe = 120;
        const clampedX = Math.max(-maxSwipe, Math.min(maxSwipe, currentX));
        card.style.transform = `translateX(${clampedX}px)`;
        
        if (currentX < -40) {
          wrapper.classList.add('swiping-left');
          wrapper.classList.remove('swiping-right');
        } else if (currentX > 40) {
          wrapper.classList.add('swiping-right');
          wrapper.classList.remove('swiping-left');
        } else {
          wrapper.classList.remove('swiping-left', 'swiping-right');
        }
      }
    });
    
    card.addEventListener('mouseup', () => {
      if (!isDragging) return;
      isDragging = false;
      card.classList.remove('swiping');
      wrapper.classList.remove('swiping');
      
      const threshold = 80;
      
      if (currentX > threshold) {
        // Full right swipe - EDIT
        card.style.transform = 'translateX(80px)';
        card.classList.add('swiped-right');
        setTimeout(() => {
          openEditLotModal(lotId);
          resetCardPosition(card);
        }, 300);
      } else if (currentX < -threshold) {
        // Full left swipe - DELETE
        card.style.transform = 'translateX(-80px)';
        card.classList.add('swiped-left');
        setTimeout(() => {
          if (confirm('Delete this lot and all its sales history?')) {
            deleteLot(lotId);
            window.dispatchEvent(new CustomEvent('viewchange'));
          } else {
            resetCardPosition(card);
          }
        }, 300);
      } else if (currentX > 40 || currentX < -40) {
        resetCardPosition(card);
      } else {
        resetCardPosition(card);
      }
      
      wrapper.classList.remove('swiping-left', 'swiping-right');
    });
    
    card.addEventListener('mouseleave', () => {
      if (isDragging) {
        isDragging = false;
        resetCardPosition(card);
        wrapper.classList.remove('swiping', 'swiping-left', 'swiping-right');
      }
    });
  });
}

function resetCardPosition(card) {
  card.classList.remove('swiped-left', 'swiped-right');
  card.classList.add('restore');
  card.style.transform = '';
  setTimeout(() => {
    card.classList.remove('restore');
  }, 300);
}

// Placeholder for edit lot modal (you can implement this later)
function openEditLotModal(lotId) {
  // For now, just alert that edit is coming
  alert('Edit functionality coming soon for lot: ' + lotId);
}

// Attach events for dynamically injected edit sale modal
function attachEditSaleModalEvents() {
  // Close edit sale modal
  document.getElementById('close-edit-sale-modal')?.addEventListener('click', closeEditSaleModal);
  document.getElementById('edit-sale-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'edit-sale-modal') closeEditSaleModal();
  });

  // Edit sale input handlers
  document.getElementById('edit-sale-price')?.addEventListener('input', (e) => {
    editSalePrice = e.target.value;
  });
  document.getElementById('edit-shipping-cost')?.addEventListener('input', (e) => {
    editShippingCost = e.target.value;
  });
  document.getElementById('edit-sale-date')?.addEventListener('input', (e) => {
    editSaleDate = e.target.value;
  });

  // Save edit sale
  document.getElementById('save-edit-sale')?.addEventListener('click', handleSaveEditSale);
}

// Save edit sale handler
function handleSaveEditSale() {
  if (!editSaleData) return;

  const { lotId, saleId, sale } = editSaleData;
  const lot = getLots().find(l => l.id === lotId);
  if (!lot) return;

  // Parse new values with NaN protection
  const priceInput = editSalePrice !== '' ? parseFloat(editSalePrice) : NaN;
  const newPrice = Math.round((!isNaN(priceInput) ? priceInput : sale.pricePerUnit / 100) * 100);
  // Shipping: shippingPerUnitOld is already in cents (stored as total / units)
  const shippingPerUnitCentsOld = (sale.shippingCost != null && !isNaN(sale.shippingCost) && sale.unitsSold > 0) ? sale.shippingCost / sale.unitsSold : 0;
  // editShippingCost is in dollars, convert to cents. If empty, use old value (already in cents)
  const editShippingParsed = parseFloat(editShippingCost);
  const shippingPerUnitCents = sale.platform === 'ebay'
    ? (editShippingCost !== '' && !isNaN(editShippingParsed) ? Math.round(editShippingParsed * 100) : shippingPerUnitCentsOld)
    : 0;
  const newShipping = Math.round(shippingPerUnitCents * sale.unitsSold);

  // Safety check: if any values are NaN, show error and don't save
  if (isNaN(newPrice) || isNaN(newShipping)) {
    console.error('NaN detected in edit sale calculation:', { newPrice, newShipping, shippingPerUnitCents, sale });
    alert('Error: Invalid number calculated. Please check your inputs and try again.');
    return;
  }

  // Validate lot.unitCost is valid
  if (isNaN(lot.unitCost)) {
    console.error('NaN detected in lot.unitCost:', lot);
    alert('Error: Invalid unit cost in lot data. Please contact support.');
    return;
  }

  const newDate = editSaleDate || new Date(sale.dateSold).toISOString().split('T')[0];

  // Recalculate profit with new values
  const profitResult = calculateSaleProfit(
    lot.unitCost,
    sale.unitsSold,
    newPrice,
    sale.platform,
    newShipping
  );

  // Validate profit calculation result
  if (isNaN(profitResult.profit)) {
    console.error('NaN detected in profit calculation:', profitResult, { lot, sale, newPrice, newShipping });
    alert('Error: Profit calculation failed. Please check your inputs and try again.');
    return;
  }

  // Update the sale
  const updates = {
    pricePerUnit: Math.round(newPrice),
    totalPrice: Math.round(newPrice * sale.unitsSold),
    shippingCost: Math.round(newShipping),
    dateSold: new Date(newDate + 'T12:00:00').toISOString(),
    profit: profitResult.profit,
    costBasis: profitResult.costBasis,
    fees: profitResult.fees
  };

  updateSale(lotId, saleId, updates);
  closeEditSaleModal();
  // Refresh lot list to show updated profit
  updateLotList();
}

export function initInventoryEvents() {
  // Tab switching - targeted update only
  document.querySelectorAll('.tabs .tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
      activeTab = e.target.dataset.tab;
      updateLotList();
    });
  });

  // Search input
  document.getElementById('inventory-search')?.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    updateLotList();
  });

  // Sort dropdown
  document.getElementById('inventory-sort')?.addEventListener('change', (e) => {
    sortOrder = e.target.value;
    updateLotList();
  });

  // Initialize lot card specific events
  initLotCardEvents();

  // Modal events
  document.getElementById('close-modal')?.addEventListener('click', closeSaleModal);
  document.getElementById('sale-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'sale-modal') closeSaleModal();
  });

  // Units sold input - targeted update only
  document.getElementById('units-sold')?.addEventListener('input', (e) => {
    unitsSold = e.target.value;
    updateSummaryBox();
  });

  // Sale price input - targeted update only
  document.getElementById('sale-price')?.addEventListener('input', (e) => {
    salePrice = e.target.value;
    updateSummaryBox();
  });

  // Shipping cost input - targeted update only
  document.getElementById('shipping-cost')?.addEventListener('input', (e) => {
    shippingCost = e.target.value;
    updateSummaryBox();
  });

  // Sale date input
  document.getElementById('sale-date')?.addEventListener('change', (e) => {
    saleDate = e.target.value;
  });

  // Platform selection - targeted update only
  document.querySelectorAll('.platform-option').forEach(option => {
    option.addEventListener('click', () => {
      updatePlatformSelection(option.dataset.platform);
    });
  });

  // Quantity stepper buttons - works on both desktop and mobile
  const decreaseBtn = document.getElementById('decrease-qty');
  const increaseBtn = document.getElementById('increase-qty');
  
  function handleDecrease(e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const lot = getLots().find(l => l.id === selectedLotId);
    if (lot) {
      const currentQty = parseInt(unitsSold) || 1;
      if (currentQty > 1) {
        unitsSold = String(currentQty - 1);
        const input = document.getElementById('units-sold');
        if (input) input.value = unitsSold;
        updateSummaryBox();
      }
    }
  }
  
  function handleIncrease(e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const lot = getLots().find(l => l.id === selectedLotId);
    if (lot) {
      const currentQty = parseInt(unitsSold) || 1;
      if (currentQty < lot.remaining) {
        unitsSold = String(currentQty + 1);
        const input = document.getElementById('units-sold');
        if (input) input.value = unitsSold;
        updateSummaryBox();
      }
    }
  }
  
  if (decreaseBtn) {
    decreaseBtn.addEventListener('click', handleDecrease);
    decreaseBtn.addEventListener('touchstart', handleDecrease, { passive: false });
  }
  
  if (increaseBtn) {
    increaseBtn.addEventListener('click', handleIncrease);
    increaseBtn.addEventListener('touchstart', handleIncrease, { passive: false });
  }

  // Breakdown toggle with accordion animation
  document.getElementById('breakdown-toggle')?.addEventListener('click', () => {
    const wrapper = document.getElementById('breakdown-wrapper');
    const arrow = document.getElementById('breakdown-arrow');
    const toggle = document.getElementById('breakdown-toggle');
    if (wrapper && arrow && toggle) {
      const isOpen = wrapper.classList.contains('open');
      if (isOpen) {
        wrapper.classList.remove('open');
        toggle.classList.remove('open');
        arrow.style.transform = 'rotate(0deg)';
      } else {
        wrapper.classList.add('open');
        toggle.classList.add('open');
        arrow.style.transform = 'rotate(180deg)';
      }
    }
  });

  // Confirm sale with animation
  document.getElementById('confirm-sale')?.addEventListener('click', () => {
    const price = parseFloat(salePrice);
    const units = parseInt(unitsSold) || 1;
    const shippingPerUnit = selectedPlatform === 'ebay' ? (parseFloat(shippingCost) || 0) : 0;
    const totalShipping = shippingPerUnit * units;
    if (price > 0 && units > 0 && selectedLotId) {
      // Add animation class to button
      const btn = document.getElementById('confirm-sale');
      if (btn) {
        btn.classList.add('animating');
        btn.textContent = 'Sale Recorded!';
        btn.disabled = true;
      }

      // Trigger confetti celebration
      celebrateSuccess(btn);

      // Delay the actual sale recording and refresh until animation completes
      setTimeout(() => {
        recordSale(selectedLotId, price, units, selectedPlatform, totalShipping, saleDate);
        closeSaleModal();
      }, 1200);
    }
  });

  // Delete lot
  document.getElementById('delete-lot')?.addEventListener('click', () => {
    if (selectedLotId && confirm('Are you sure you want to delete this ENTIRE lot and all its sales?')) {
      deleteLot(selectedLotId);
      closeSaleModal();
    }
  });

  // === CSV Import Events ===

  // Open import modal
  document.getElementById('import-csv-btn')?.addEventListener('click', () => {
    showImportModal = true;
    window.dispatchEvent(new CustomEvent('viewchange'));
  });

  // Close import modal
  document.getElementById('close-import-modal')?.addEventListener('click', closeImportModal);
  document.getElementById('import-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'import-modal') closeImportModal();
  });

  // Drop zone click to browse
  document.getElementById('import-drop-zone')?.addEventListener('click', () => {
    document.getElementById('csv-file-input')?.click();
  });

  // File input change
  document.getElementById('csv-file-input')?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (file) await processCSVFile(file);
  });

  // Drag and drop
  const dropZone = document.getElementById('import-drop-zone');
  if (dropZone) {
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('drag-over');
    });
    dropZone.addEventListener('dragleave', () => {
      dropZone.classList.remove('drag-over');
    });
    dropZone.addEventListener('drop', async (e) => {
      e.preventDefault();
      dropZone.classList.remove('drag-over');
      const file = e.dataTransfer.files?.[0];
      if (file && file.name.endsWith('.csv')) {
        await processCSVFile(file);
      }
    });
  }

  // Download template
  document.getElementById('download-template')?.addEventListener('click', () => {
    const template = generateCSVTemplate();
    const blob = new Blob([template], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'inventory_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  });
}

function closeImportModal() {
  const modal = document.getElementById('import-modal');
  if (modal) {
    modal.classList.add('closing');
    setTimeout(() => {
      showImportModal = false;
      window.dispatchEvent(new CustomEvent('viewchange'));
    }, 200);
  } else {
    showImportModal = false;
    window.dispatchEvent(new CustomEvent('viewchange'));
  }
}

async function processCSVFile(file) {
  const resultEl = document.getElementById('import-result');
  if (!resultEl) return;

  resultEl.style.display = 'block';
  resultEl.innerHTML = '<p class="text-muted">Importing...</p>';

  try {
    const { success, salesImported, errors } = await importLotsFromCSV(file);

    let html = `<div class="import-success">✅ Imported ${success} lot${success !== 1 ? 's' : ''}`;
    if (salesImported > 0) {
      html += ` with ${salesImported} sale${salesImported !== 1 ? 's' : ''}`;
    }
    html += `</div>`;

    if (errors.length > 0) {
      html += `<div class="import-errors" style="margin-top: var(--spacing-md); color: var(--accent-warning);">
        <strong>⚠️ ${errors.length} error${errors.length !== 1 ? 's' : ''}:</strong>
        <ul style="margin: var(--spacing-sm) 0 0 var(--spacing-lg); padding: 0; font-size: var(--font-size-sm);">
          ${errors.slice(0, 5).map(e => `<li>${e}</li>`).join('')}
          ${errors.length > 5 ? `<li>...and ${errors.length - 5} more</li>` : ''}
        </ul>
      </div>`;
    }

    if (success > 0) {
      html += `<button class="btn btn-success btn-full" style="margin-top: var(--spacing-lg);" onclick="window.dispatchEvent(new CustomEvent('viewchange'))">Done</button>`;
    }

    resultEl.innerHTML = html;

    if (success > 0) {
      setTimeout(() => {
        closeImportModal();
      }, 1500);
    }
  } catch (err) {
    resultEl.innerHTML = `<div class="import-error text-danger">❌ Import failed: ${err.message}</div>`;
  }
}
