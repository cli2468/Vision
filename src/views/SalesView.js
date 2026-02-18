// Sales View - All sales with filtering and sorting

import { getAllSales, getLots } from '../services/storage.js';
import { formatCurrency } from '../services/calculations.js';
import { navigate } from '../router.js';

let currentSort = { key: 'date', direction: 'desc' };
let platformFilter = 'all';

export function SalesView() {
  const salesData = getAllSales();
  const allLots = getLots();
  
  // Filter by platform if needed
  let filteredSales = salesData;
  if (platformFilter !== 'all') {
    filteredSales = salesData.filter(({ sale }) => sale?.platform === platformFilter);
  }
  
  // Sort sales
  const sortedSales = sortSales(filteredSales, currentSort.key, currentSort.direction);
  
  // Calculate totals
  const totalRevenue = filteredSales.reduce((sum, { sale }) => sum + (Number(sale?.totalPrice) || 0), 0);
  const totalProfit = filteredSales.reduce((sum, { sale }) => sum + (Number(sale?.profit) || 0), 0);
  
  // Count by platform
  const platformCounts = {};
  salesData.forEach(({ sale }) => {
    if (!sale) return;
    const platform = sale.platform || 'unknown';
    platformCounts[platform] = (platformCounts[platform] || 0) + 1;
  });

  return `
    <div class="page">
      <div class="container">
        <div class="sales-view-header">
          <h1 class="page-title">Sales History</h1>
          <div class="sales-stats">
            <div class="sales-stat">
              <span class="stat-label">Total Sales</span>
              <span class="stat-value">${filteredSales.length}</span>
            </div>
            <div class="sales-stat">
              <span class="stat-label">Revenue</span>
              <span class="stat-value">${formatCurrency(totalRevenue)}</span>
            </div>
            <div class="sales-stat">
              <span class="stat-label">Profit</span>
              <span class="stat-value ${totalProfit >= 0 ? 'positive' : 'negative'}">${formatCurrency(totalProfit, true)}</span>
            </div>
          </div>
        </div>
        
        <div class="sales-filters">
          <div class="filter-group">
            <label>Platform</label>
            <select id="platform-filter" class="filter-select">
              <option value="all" ${platformFilter === 'all' ? 'selected' : ''}>All Platforms</option>
              <option value="facebook" ${platformFilter === 'facebook' ? 'selected' : ''}>Facebook</option>
              <option value="ebay" ${platformFilter === 'ebay' ? 'selected' : ''}>eBay</option>
            </select>
          </div>
        </div>
        
        <div class="sales-table-container">
          <table class="sales-table full-width">
            <thead>
              <tr>
                <th class="sortable ${currentSort.key === 'date' ? currentSort.direction : ''}" data-sort="date">
                  Date ${getSortIndicator('date')}
                </th>
                <th class="sortable ${currentSort.key === 'item' ? currentSort.direction : ''}" data-sort="item">
                  Item ${getSortIndicator('item')}
                </th>
                <th class="sortable ${currentSort.key === 'platform' ? currentSort.direction : ''}" data-sort="platform">
                  Platform ${getSortIndicator('platform')}
                </th>
                <th class="sortable ${currentSort.key === 'units' ? currentSort.direction : ''}" data-sort="units">
                  Units ${getSortIndicator('units')}
                </th>
                <th class="sortable ${currentSort.key === 'revenue' ? currentSort.direction : ''}" data-sort="revenue">
                  Revenue ${getSortIndicator('revenue')}
                </th>
                <th class="sortable ${currentSort.key === 'profit' ? currentSort.direction : ''}" data-sort="profit">
                  Profit ${getSortIndicator('profit')}
                </th>
              </tr>
            </thead>
            <tbody>
              ${renderSalesRows(sortedSales, allLots)}
            </tbody>
          </table>
          
          ${sortedSales.length === 0 ? `
            <div class="sales-empty-state">
              <p>No sales found${platformFilter !== 'all' ? ' for this platform' : ''}.</p>
            </div>
          ` : ''}
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

function renderSalesRows(sales, lots) {
  if (sales.length === 0) {
    return '';
  }
  
  return sales.map(({ lot, sale }) => {
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
            day: 'numeric',
            year: 'numeric'
          });
        }
      } catch (e) {
        dateDisplay = '—';
      }
    }
    
    const platform = sale.platform || 'unknown';
    const units = sale.unitsSold || 0;
    const revenue = Number(sale.totalPrice) || 0;
    const profit = Number(sale.profit) || 0;
    
    return `
      <tr class="sale-row">
        <td>${dateDisplay}</td>
        <td class="item-name">${lotName}</td>
        <td>
          <span class="platform-badge ${platform}">
            ${platform === 'facebook' ? 'Facebook' : platform === 'ebay' ? 'eBay' : 'Unknown'}
          </span>
        </td>
        <td>${units}</td>
        <td>${formatCurrency(revenue)}</td>
        <td class="${profit >= 0 ? 'positive' : 'negative'}">${formatCurrency(profit, true)}</td>
      </tr>
    `;
  }).join('');
}

export function initSalesEvents() {
  // Platform filter change
  const platformSelect = document.getElementById('platform-filter');
  if (platformSelect) {
    platformSelect.addEventListener('change', (e) => {
      platformFilter = e.target.value;
      // Re-render the view
      window.dispatchEvent(new CustomEvent('viewchange'));
    });
  }
  
  // Table sorting
  document.querySelectorAll('.sortable').forEach(th => {
    th.addEventListener('click', () => {
      const sortKey = th.dataset.sort;
      
      // Toggle direction if clicking same column
      if (currentSort.key === sortKey) {
        currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
      } else {
        currentSort.key = sortKey;
        currentSort.direction = 'desc';
      }
      
      // Re-render the view
      window.dispatchEvent(new CustomEvent('viewchange'));
    });
  });
}
