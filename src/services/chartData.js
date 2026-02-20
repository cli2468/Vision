// Chart Data Service - Aggregate sales data for charting

/**
 * Aggregate sales data by day for charting
 * @param {Array} salesData - Array of { lot, sale } objects
 * @param {string} range - '7d' | '30d' | '90d' | 'all'
 * @returns {Object} { labels[], revenues[], profits[], returns[], salesByDay: Map }
 */
export function aggregateSalesByDay(salesData, range) {
  // Get today's date at midnight (no time component)
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Create end date string from today (for comparing sale dates)
  const todayKey = formatDateKey(today);

  // Determine number of days based on range
  let numDays;
  switch (range) {
    case '7d': numDays = 7; break;
    case '30d': numDays = 30; break;
    case '90d': numDays = 90; break;
    case 'all':
      numDays = 365;
      break;
    default: numDays = 30;
  }

  // Create a map of date string -> { revenue, profit, returns, sales[] }
  const salesByDay = new Map();

  // Initialize all days in range with zeros, starting from today and going backwards
  for (let i = 0; i < numDays; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateKey = formatDateKey(date);
    salesByDay.set(dateKey, { revenue: 0, profit: 0, returns: 0, sales: [] });
  }

  // Aggregate sales into days
  for (const { lot, sale } of salesData) {
    // Defensive: skip invalid sales
    if (!sale || !sale.dateSold) continue;

    // Parse date as local time by appending T00:00:00 to avoid UTC shift
    const saleDateStr = sale.dateSold.includes('T') ? sale.dateSold : sale.dateSold + 'T00:00:00';
    const saleDate = new Date(saleDateStr);

    // Skip invalid dates
    if (isNaN(saleDate.getTime())) continue;

    const dateKey = formatDateKey(saleDate);

    if (salesByDay.has(dateKey)) {
      const dayData = salesByDay.get(dateKey);
      dayData.sales.push({ lot, sale });

      // Ensure numeric values
      const totalPrice = Number(sale.totalPrice) || 0;
      const profit = Number(sale.profit) || 0;

      if (sale.returned) {
        // Track returns separately (negative impact)
        dayData.returns += profit;
      } else {
        // Normal sale
        dayData.revenue += totalPrice;
        dayData.profit += profit;
      }
    }
  }

  // Convert to arrays for Chart.js - reverse to get chronological order (oldest first)
  const labels = [];
  const revenues = [];
  const profits = [];
  const returns = [];
  const cumulativeRevenues = [];
  const cumulativeProfits = [];
  let runningRevenue = 0;
  let runningProfit = 0;

  // Convert Map to array and reverse to get chronological order
  const entries = Array.from(salesByDay.entries()).reverse();

  for (const [dateKey, data] of entries) {
    labels.push(formatDateLabel(dateKey, range));
    revenues.push(data.revenue / 100); // Convert cents to dollars
    profits.push(data.profit / 100);
    returns.push(data.returns / 100);
    runningRevenue += (data.revenue) / 100;
    runningProfit += (data.profit + data.returns) / 100; // Include returns in cumulative
    cumulativeRevenues.push(runningRevenue);
    cumulativeProfits.push(runningProfit);
  }

  return { labels, revenues, profits, returns, cumulativeRevenues, cumulativeProfits, salesByDay };
}

/**
 * Re-bucket daily chart data into weekly or monthly groups for a fuller bar chart.
 * 7D  -> daily  (7 bars)
 * 30D -> weekly (4-5 bars)
 * 90D -> weekly (12-13 bars)
 * ALL -> monthly (variable)
 */
export function aggregateSalesForChart(salesData, range) {
  const daily = aggregateSalesByDay(salesData, range);

  if (range === '7d') {
    return { labels: daily.labels, revenues: daily.revenues };
  }

  const entries = Array.from(daily.salesByDay.entries()).sort();

  if (range === '30d' || range === '90d') {
    return bucketByWeek(entries);
  }

  return bucketByMonth(entries);
}

function bucketByWeek(dayEntries) {
  const buckets = [];
  let currentBucket = null;

  for (const [dateKey, data] of dayEntries) {
    const date = new Date(dateKey + 'T12:00:00');
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - date.getDay());
    const weekKey = formatDateKey(weekStart);

    if (!currentBucket || currentBucket.key !== weekKey) {
      currentBucket = { key: weekKey, startDate: new Date(weekStart), revenue: 0 };
      buckets.push(currentBucket);
    }
    currentBucket.revenue += data.revenue;
    currentBucket.endDate = new Date(date);
  }

  const labels = buckets.map(b => {
    const m = b.startDate.getMonth() + 1;
    const d = b.startDate.getDate();
    return `${m}/${d}`;
  });
  const revenues = buckets.map(b => b.revenue / 100);

  return { labels, revenues };
}

function bucketByMonth(dayEntries) {
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const buckets = new Map();

  // Initialize precisely 12 monthly buckets ending with today's month
  const today = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const monthKey = `${d.getFullYear()}-${d.getMonth()}`;
    buckets.set(monthKey, { month: d.getMonth(), year: d.getFullYear(), revenue: 0 });
  }

  for (const [dateKey, data] of dayEntries) {
    const date = new Date(dateKey + 'T12:00:00');
    const monthKey = `${date.getFullYear()}-${date.getMonth()}`;

    if (buckets.has(monthKey)) {
      buckets.get(monthKey).revenue += data.revenue;
    }
  }

  const sorted = Array.from(buckets.values());
  const labels = sorted.map(b => monthNames[b.month]);
  const revenues = sorted.map(b => b.revenue / 100);

  return { labels, revenues };
}

/**
 * Format date as YYYY-MM-DD key
 */
function formatDateKey(date) {
  return date.toISOString().split('T')[0];
}

/**
 * Format date for chart label based on range
 */
function formatDateLabel(dateKey, range) {
  const date = new Date(dateKey + 'T12:00:00');
  if (range === '7d') {
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  } else {
    // Use M/D format (e.g., "1/12")
    return `${date.getMonth() + 1}/${date.getDate()}`;
  }
}

/**
 * Get sales for a specific date
 * @param {Map} salesByDay - Map from aggregateSalesByDay
 * @param {number} index - Index of the day in the chart (0 = oldest)
 * @returns {Array} Array of { lot, sale } for that day
 */
export function getSalesForDay(salesByDay, index) {
  // Sort keys chronologically to match chart order
  const keys = Array.from(salesByDay.keys()).sort();
  if (index >= 0 && index < keys.length) {
    return salesByDay.get(keys[index])?.sales || [];
  }
  return [];
}
