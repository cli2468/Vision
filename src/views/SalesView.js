// Sales View - All sales with filtering, sorting, and inline expanding

import { getAllSales, getLots } from '../services/storage.js';
import { formatCurrency } from '../services/calculations.js';
import { renderPlatformBadge } from '../services/uiHelpers.js';
import { navigate } from '../router.js';

let currentSort = { key: 'date', direction: 'desc' };
let currentSearch = '';
let currentStartDate = '';
let currentEndDate = '';
let isDatePickerOpen = false;
let expandedSaleId = null;
let currentViewingMonth = new Date().getMonth();
let currentViewingYear = new Date().getFullYear();

export function SalesView() {
  const salesData = getAllSales();
  const allLots = getLots();

  // Search filtering
  let filteredSales = salesData;
  if (currentSearch.trim()) {
    const q = currentSearch.toLowerCase();
    filteredSales = filteredSales.filter(({ lot }) => {
      const name = lot?.name || '';
      const num = lot?.lotNumber || '';
      return name.toLowerCase().includes(q) || num.toLowerCase().includes(q);
    });
  }

  // Date filtering
  if (currentStartDate || currentEndDate) {
    filteredSales = filteredSales.filter(({ sale }) => {
      if (!sale?.dateSold) return false;
      // Normalize dates for safe comparison
      const saleDate = new Date(sale.dateSold).toISOString().split('T')[0];
      if (currentStartDate && saleDate < currentStartDate) return false;
      if (currentEndDate && saleDate > currentEndDate) return false;
      return true;
    });
  }

  // Sort sales
  const sortedSales = sortSales(filteredSales, currentSort.key, currentSort.direction);

  return `
    <div class="desktop-inventory-container sales-log-view">
      <div class="inv-toolbar">
        <div class="inv-toolbar-left">
          <div class="inv-toolbar-title">SALES</div>
          <div class="sales-record-count">${filteredSales.length} records</div>
        </div>
        <div class="inv-toolbar-right">
          <div class="date-range-selector" id="sales-date-trigger" style="position: relative;">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
              <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
            <span id="sales-date-display">
              ${currentStartDate && currentEndDate ? `${formatShortDate(currentStartDate)} – ${formatShortDate(currentEndDate)}` :
      currentStartDate ? `From ${formatShortDate(currentStartDate)}` :
        currentEndDate ? `Until ${formatShortDate(currentEndDate)}` :
          'Filter by Date'}
            </span>
            
            <div class="custom-date-popover ${isDatePickerOpen ? 'active' : ''}" id="sales-date-popover">
              <div class="date-popover-header">Quick Select</div>
              <div class="date-popover-chips">
                <button class="date-chip" data-range="7">Last 7 Days</button>
                <button class="date-chip" data-range="30">Last 30 Days</button>
                <button class="date-chip" data-range="ytd">Year to Date</button>
                <button class="date-chip" data-range="all">All Time</button>
              </div>
              
              <div class="calendar-module">
                <div class="calendar-header">
                  <button class="calendar-nav-btn" id="cal-prev-btn">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m15 18-6-6 6-6"/></svg>
                  </button>
                  <div class="calendar-month-label" id="cal-month-label"></div>
                  <button class="calendar-nav-btn" id="cal-next-btn">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 18 6-6-6-6"/></svg>
                  </button>
                </div>
                <div class="calendar-grid" id="cal-days-header" style="pointer-events: none;">
                  <div class="calendar-day-header">Su</div>
                  <div class="calendar-day-header">Mo</div>
                  <div class="calendar-day-header">Tu</div>
                  <div class="calendar-day-header">We</div>
                  <div class="calendar-day-header">Th</div>
                  <div class="calendar-day-header">Fr</div>
                  <div class="calendar-day-header">Sa</div>
                </div>
                <div class="calendar-grid" id="cal-grid"></div>
              </div>
              
              <div class="date-popover-footer">
                <button class="btn-date-clear" id="popover-clear-btn">Clear</button>
                <button class="btn-date-apply" id="popover-apply-btn">Apply Range</button>
              </div>
            </div>
          </div>
          <div class="inventory-search">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input type="text" id="sales-search" placeholder="Search by item..." value="${currentSearch}">
          </div>
        </div>
      </div>
      
      <div class="sales-log-container">
        <div class="sale-log-header">
          <div class="sale-col-date sortable ${currentSort.key === 'date' ? currentSort.direction : ''}" data-sort="date">
            DATE ${getSortIndicator('date')}
          </div>
          <div class="sale-col-item sortable ${currentSort.key === 'item' ? currentSort.direction : ''}" data-sort="item">
            ITEM ${getSortIndicator('item')}
          </div>
          <div class="sale-col-platform sortable ${currentSort.key === 'platform' ? currentSort.direction : ''}" data-sort="platform">
            PLATFORM ${getSortIndicator('platform')}
          </div>
          <div class="sale-col-price sortable ${currentSort.key === 'revenue' ? currentSort.direction : ''}" data-sort="revenue">
            SALE PRICE ${getSortIndicator('revenue')}
          </div>
          <div class="sale-col-profit sortable ${currentSort.key === 'profit' ? currentSort.direction : ''}" data-sort="profit">
            PROFIT ${getSortIndicator('profit')}
          </div>
          <div class="sale-col-roi">ROI</div>
          <div class="sale-col-qty sortable ${currentSort.key === 'units' ? currentSort.direction : ''}" data-sort="units">
            QTY ${getSortIndicator('units')}
          </div>
          <div class="sale-col-actions"></div>
        </div>
        
        <div class="sale-log-body">
          ${sortedSales.length === 0 ? `
            <div class="desktop-empty-state"><p>No sales records found.</p></div>
          ` : renderSalesRows(sortedSales, allLots)}
        </div>
      </div>
    </div>
  `;
}

function getSortIndicator(key) {
  if (currentSort.key !== key) return '↕';
  return currentSort.direction === 'asc' ? '↑' : '↓';
}

function sortSales(sales, key, direction) {
  const sorted = [...sales];
  sorted.sort((a, b) => {
    let valA, valB;
    switch (key) {
      case 'date':
        valA = a.sale?.dateSold ? new Date(a.sale.dateSold) : new Date(0);
        valB = b.sale?.dateSold ? new Date(b.sale.dateSold) : new Date(0);
        break;
      case 'item':
        valA = a.lot?.name || '';
        valB = b.lot?.name || '';
        break;
      case 'platform':
        valA = a.sale?.platform || '';
        valB = b.sale?.platform || '';
        break;
      case 'units':
        valA = a.sale?.unitsSold || 0;
        valB = b.sale?.unitsSold || 0;
        break;
      case 'revenue':
        valA = Number(a.sale?.totalPrice) || 0;
        valB = Number(b.sale?.totalPrice) || 0;
        break;
      case 'profit':
        valA = Number(a.sale?.profit) || 0;
        valB = Number(b.sale?.profit) || 0;
        break;
      default:
        return 0;
    }
    if (valA < valB) return direction === 'asc' ? -1 : 1;
    if (valA > valB) return direction === 'asc' ? 1 : -1;
    return 0;
  });
  return sorted;
}

function getPlatformColor(platform) {
  switch (platform?.toLowerCase()) {
    case 'ebay': return '#34D399'; // Teal
    case 'amazon': return '#FBBF24'; // Yellow
    case 'shopify': return '#A78BFA'; // Purple
    case 'facebook': return '#60A5FA'; // Blue
    case 'poshmark': return '#F87171'; // Red
    default: return '#9CA3AF'; // Gray
  }
}

function renderSalesRows(sales, lots) {
  return sales.map(({ lot, sale, saleIndex }) => {
    if (!sale) return '';
    const lotName = lot?.name || 'Unknown';
    const lotNum = lot?.lotNumber || `Lot #${lot?.id?.substring(0, 4) || '—'}`;
    const dateStr = sale.dateSold;
    let dateDisplay = '—';

    if (dateStr && dateStr !== 'Invalid Date') {
      try {
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
          dateDisplay = date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
          });
        }
      } catch (e) {
        dateDisplay = '—';
      }
    }

    const platform = sale.platform || 'unknown';
    const platformLabel = platform.charAt(0).toUpperCase() + platform.slice(1);
    const platformColor = getPlatformColor(platform);

    const units = sale.unitsSold || 0;
    const revenue = Number(sale.totalPrice) || 0;
    const profit = Number(sale.profit) || 0;

    const unitCost = lot?.unitCost || 0;
    const totalCost = unitCost * units;
    const roi = totalCost > 0 ? Math.round((profit / totalCost) * 100) : 0;
    const salePerUnit = units > 0 ? revenue / units : 0;
    const marginPerUnit = units > 0 ? profit / units : 0;

    let daysToSell = '—';
    if (lot?.purchaseDate && dateStr) {
      const pDate = new Date(lot.purchaseDate);
      const sDate = new Date(dateStr);
      const msDiff = Math.max(0, sDate.getTime() - pDate.getTime());
      daysToSell = Math.floor(msDiff / (1000 * 60 * 60 * 24)) + 'd';
    }

    const uniqueId = `${lot?.id}-${saleIndex}`;
    const isExpanded = expandedSaleId === uniqueId;

    let expandedHtml = '';
    if (isExpanded) {
      expandedHtml = `
        <div class="sale-log-expanded-details">
          <div class="sale-log-details-grid">
            <div class="sale-detail-item">
              <span class="sale-detail-label">Cost / Unit</span>
              <span class="sale-detail-value">${formatCurrency(unitCost)}</span>
            </div>
            <div class="sale-detail-item">
              <span class="sale-detail-label">Sale / Unit</span>
              <span class="sale-detail-value">${formatCurrency(salePerUnit)}</span>
            </div>
            <div class="sale-detail-item">
              <span class="sale-detail-label">Margin / Unit</span>
              <span class="sale-detail-value accent-teal">${formatCurrency(marginPerUnit, true)}</span>
            </div>
            <div class="sale-detail-item">
              <span class="sale-detail-label">Total Cost</span>
              <span class="sale-detail-value">${formatCurrency(totalCost)}</span>
            </div>
            <div class="sale-detail-item">
              <span class="sale-detail-label">Total Revenue</span>
              <span class="sale-detail-value">${formatCurrency(revenue)}</span>
            </div>
            <div class="sale-detail-item">
              <span class="sale-detail-label">Days to Sell</span>
              <span class="sale-detail-value">${daysToSell}</span>
            </div>
          </div>
          <div class="sale-log-details-actions">
            <button class="sale-inline-action-btn edit sale-edit-text-btn" data-lot-id="${lot.id}" data-sale-idx="${saleIndex}">Edit Sale</button>
            <button class="sale-inline-action-btn delete sale-delete-text-btn" data-lot-id="${lot.id}" data-sale-idx="${saleIndex}">Delete</button>
          </div>
        </div>
      `;
    }

    return `
      <div class="sale-log-wrapper">
        <div class="sale-log-row ${isExpanded ? 'active' : ''}" data-unique-id="${uniqueId}">
          <div class="sale-col-date">${dateDisplay}</div>
          <div class="sale-col-item">
            <div class="sale-item-name">${lotName}</div>
            <div class="sale-item-meta">${lotNum}</div>
          </div>
          <div class="sale-col-platform">
            <span class="platform-dot" style="background-color: ${platformColor}"></span>
            ${platformLabel}
          </div>
          <div class="sale-col-price">${formatCurrency(revenue)}</div>
          <div class="sale-col-profit accent-teal">${formatCurrency(profit, true)}</div>
          <div class="sale-col-roi accent-teal">+${roi}%</div>
          <div class="sale-col-qty">${units}</div>
          <div class="sale-col-actions hover-actions">
            <button class="icon-btn edit-sale-btn" data-lot-id="${lot.id}" data-sale-idx="${saleIndex}" title="Edit Sale">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
            </button>
            <button class="icon-btn delete-sale-btn" data-lot-id="${lot.id}" data-sale-idx="${saleIndex}" title="Delete Sale">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                <line x1="10" y1="11" x2="10" y2="17"></line>
                <line x1="14" y1="11" x2="14" y2="17"></line>
              </svg>
            </button>
          </div>
        </div>
        ${expandedHtml}
      </div>
    `;
  }).join('');
}

// Helper for nice date formats in trigger
function formatShortDate(isoString) {
  if (!isoString) return '';
  const [y, m, d] = isoString.split('-');
  return `${m}/${d}/${y.slice(2)}`;
}

export function initSalesEvents() {
  const isDesktop = window.innerWidth >= 1024;
  if (!isDesktop) return;
  // Row Expand Toggle
  document.querySelectorAll('.sale-log-row').forEach(row => {
    row.addEventListener('click', (e) => {
      const uid = row.dataset.uniqueId;
      if (expandedSaleId === uid) {
        expandedSaleId = null; // collapse if already open
      } else {
        expandedSaleId = uid;
      }
      window.dispatchEvent(new CustomEvent('viewchange'));
    });
  });

  // Action buttons - stop propagation
  document.querySelectorAll('.edit-sale-btn, .delete-sale-btn, .sale-edit-text-btn, .sale-delete-text-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const lotId = btn.dataset.lotId;
      const saleIdx = btn.dataset.saleIdx;
      // In a real app we'd open an edit modal or confirm delete here
      console.log('Action clicked:', btn.className, 'for', lotId, 'idx', saleIdx);
    });
  });

  // Search - inline filtering to prevent focus loss
  const searchInput = document.getElementById('sales-search');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      currentSearch = e.target.value;
      const query = currentSearch.toLowerCase();

      document.querySelectorAll('.sale-log-wrapper').forEach(wrapper => {
        const row = wrapper.querySelector('.sale-log-row');
        if (!row) return;

        const name = row.querySelector('.sale-item-name')?.textContent.toLowerCase() || '';
        const meta = row.querySelector('.sale-item-meta')?.textContent.toLowerCase() || '';

        if (name.includes(query) || meta.includes(query)) {
          wrapper.style.display = '';
        } else {
          wrapper.style.display = 'none';
        }
      });
    });
  }

  // Custom Date Popover Logic
  const trigger = document.getElementById('sales-date-trigger');
  const popover = document.getElementById('sales-date-popover');

  if (trigger && popover) {
    // Open/Close toggle
    trigger.addEventListener('click', (e) => {
      // Don't toggle if clicking inside the popover itself
      if (e.target.closest('.custom-date-popover')) return;

      isDatePickerOpen = !isDatePickerOpen;
      window.dispatchEvent(new CustomEvent('viewchange'));
    });

    // Stop propagation so clicking inside doesn't close it
    popover.addEventListener('click', (e) => {
      e.stopPropagation();
    });

    // Global click-outside to close attached safely across view cycles
    if (!window._salesOutsideClickHandler) {
      window._salesOutsideClickHandler = (e) => {
        const activeTrigger = document.getElementById('sales-date-trigger');
        if (isDatePickerOpen && activeTrigger && !activeTrigger.contains(e.target)) {
          isDatePickerOpen = false;
          window.dispatchEvent(new CustomEvent('viewchange'));
          document.removeEventListener('click', window._salesOutsideClickHandler);
        }
      };
    }

    document.removeEventListener('click', window._salesOutsideClickHandler);

    if (isDatePickerOpen) {
      // Delay attachment so the opening click doesn't immediately close it
      setTimeout(() => document.addEventListener('click', window._salesOutsideClickHandler), 0);
    }

    // Local popover state before hitting Apply
    let tempStart = currentStartDate;
    let tempEnd = currentEndDate;

    // Calendar Engine
    function buildCalendar() {
      const grid = document.getElementById('cal-grid');
      const label = document.getElementById('cal-month-label');
      if (!grid || !label) return;

      const date = new Date(currentViewingYear, currentViewingMonth, 1);
      const monthName = date.toLocaleString('default', { month: 'long' });
      label.textContent = `${monthName} ${currentViewingYear}`;

      grid.innerHTML = '';

      const firstDayIndex = date.getDay();
      const daysInMonth = new Date(currentViewingYear, currentViewingMonth + 1, 0).getDate();
      const todayStr = new Date().toISOString().split('T')[0];

      // Empty cells
      for (let i = 0; i < firstDayIndex; i++) {
        const cell = document.createElement('div');
        cell.className = 'calendar-cell empty';
        grid.appendChild(cell);
      }

      // Day cells
      for (let i = 1; i <= daysInMonth; i++) {
        const cell = document.createElement('div');
        cell.className = 'calendar-cell';
        cell.textContent = i;

        // Format YYYY-MM-DD safely for local time edge cases
        const y = currentViewingYear;
        const m = String(currentViewingMonth + 1).padStart(2, '0');
        const d = String(i).padStart(2, '0');
        const cellDateStr = `${y}-${m}-${d}`;

        if (cellDateStr === todayStr) cell.classList.add('is-today');

        // Selection Visuals
        const tStart = tempStart || null;
        const tEnd = tempEnd || null;

        if (tStart && tEnd && cellDateStr >= tStart && cellDateStr <= tEnd) {
          cell.classList.add('in-range');
        }

        if (tStart === cellDateStr) {
          cell.classList.add('active-start');
          if (tEnd) cell.classList.add('has-end');
          cell.classList.remove('in-range'); // Boundary replaces in-range color
        }
        if (tEnd && tEnd === cellDateStr) {
          cell.classList.add('active-end');
          if (tStart) cell.classList.add('has-start');
          cell.classList.remove('in-range');
        }

        cell.addEventListener('click', (e) => {
          e.stopPropagation();
          if (tempStart && tempEnd) {
            tempStart = cellDateStr;
            tempEnd = '';
          } else if (tempStart && !tempEnd) {
            if (cellDateStr < tempStart) {
              tempEnd = tempStart;
              tempStart = cellDateStr;
            } else {
              tempEnd = cellDateStr;
            }
          } else {
            tempStart = cellDateStr;
          }
          buildCalendar();
        });

        grid.appendChild(cell);
      }
    }

    // Call initial build if open
    if (isDatePickerOpen) buildCalendar();

    // Nav Listeners
    document.getElementById('cal-prev-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      currentViewingMonth--;
      if (currentViewingMonth < 0) { currentViewingMonth = 11; currentViewingYear--; }
      buildCalendar();
    });

    document.getElementById('cal-next-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      currentViewingMonth++;
      if (currentViewingMonth > 11) { currentViewingMonth = 0; currentViewingYear++; }
      buildCalendar();
    });

    // Quick Chips
    document.querySelectorAll('.date-chip').forEach(chip => {
      chip.addEventListener('click', (e) => {
        e.stopPropagation();
        const range = e.target.dataset.range;
        const today = new Date();
        const endStr = today.toISOString().split('T')[0];
        let startStr = '';

        if (range === '7') {
          const start = new Date(today);
          start.setDate(today.getDate() - 7);
          startStr = start.toISOString().split('T')[0];
        } else if (range === '30') {
          const start = new Date(today);
          start.setDate(today.getDate() - 30);
          startStr = start.toISOString().split('T')[0];
        } else if (range === 'ytd') {
          startStr = `${today.getFullYear()}-01-01`;
        } else if (range === 'all') {
          startStr = '';
        }

        tempStart = startStr;
        tempEnd = range === 'all' ? '' : endStr;

        // Hop calendar view to the latest date boundary
        if (tempEnd) {
          const [y, m] = tempEnd.split('-');
          currentViewingYear = parseInt(y, 10);
          currentViewingMonth = parseInt(m, 10) - 1;
        }
        buildCalendar();
      });
    });

    // Apply & Clear
    document.getElementById('popover-apply-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      currentStartDate = tempStart;
      currentEndDate = tempEnd;
      isDatePickerOpen = false;
      document.removeEventListener('click', window._salesOutsideClickHandler);
      window.dispatchEvent(new CustomEvent('viewchange'));
    });

    document.getElementById('popover-clear-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      currentStartDate = '';
      currentEndDate = '';
      tempStart = '';
      tempEnd = '';
      isDatePickerOpen = false;
      document.removeEventListener('click', window._salesOutsideClickHandler);
      window.dispatchEvent(new CustomEvent('viewchange'));
    });
  }

  // Table sorting
  document.querySelectorAll('.sortable').forEach(th => {
    th.addEventListener('click', () => {
      const sortKey = th.dataset.sort;
      if (currentSort.key === sortKey) {
        currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
      } else {
        currentSort.key = sortKey;
        currentSort.direction = 'desc';
      }
      window.dispatchEvent(new CustomEvent('viewchange'));
    });
  });
}
