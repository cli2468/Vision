// Chart Data Service - Aggregate sales data for charting

/**
 * Aggregate sales data by day for charting
 * @param {Array} salesData - Array of { lot, sale } objects
 * @param {string} range - '7d' | '30d' | '90d' | 'all'
 * @returns {Object} { labels[], revenues[], profits[], returns[], salesByDay: Map }
 */
export function aggregateSalesByDay(salesData, range) {
    const now = new Date();
    now.setHours(23, 59, 59, 999);

    // Determine number of days based on range
    let numDays;
    switch (range) {
        case '7d': numDays = 7; break;
        case '30d': numDays = 30; break;
        case '90d': numDays = 90; break;
        case 'all':
            // For "all", find the earliest sale date or default to 30 days
            if (salesData.length === 0) {
                numDays = 30;
            } else {
                const earliest = salesData.reduce((min, { sale }) => {
                    const d = new Date(sale.dateSold);
                    return d < min ? d : min;
                }, new Date());
                numDays = Math.ceil((now - earliest) / (1000 * 60 * 60 * 24)) + 1;
                numDays = Math.max(numDays, 7); // At least 7 days
                numDays = Math.min(numDays, 365); // Cap at 1 year
            }
            break;
        default: numDays = 30;
    }

    // Create a map of date string -> { revenue, profit, returns, sales[] }
    const salesByDay = new Map();

    // Initialize all days in range with zeros
    for (let i = numDays - 1; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        const dateKey = formatDateKey(date);
        salesByDay.set(dateKey, { revenue: 0, profit: 0, returns: 0, sales: [] });
    }

    // Aggregate sales into days
    for (const { lot, sale } of salesData) {
        // Parse date as local time by appending T00:00:00 to avoid UTC shift
        const saleDateStr = sale.dateSold.includes('T') ? sale.dateSold : sale.dateSold + 'T00:00:00';
        const saleDate = new Date(saleDateStr);
        const dateKey = formatDateKey(saleDate);

        if (salesByDay.has(dateKey)) {
            const dayData = salesByDay.get(dateKey);
            dayData.sales.push({ lot, sale });
            
            if (sale.returned) {
                // Track returns separately (negative impact)
                dayData.returns += sale.profit;
            } else {
                // Normal sale
                dayData.revenue += sale.totalPrice;
                dayData.profit += sale.profit;
            }
        }
    }

    // Convert to arrays for Chart.js
    const labels = [];
    const revenues = [];
    const profits = [];
    const returns = [];
    const cumulativeProfits = [];
    let runningProfit = 0;

    for (const [dateKey, data] of salesByDay) {
        labels.push(formatDateLabel(dateKey, range));
        revenues.push(data.revenue / 100); // Convert cents to dollars
        profits.push(data.profit / 100);
        returns.push(data.returns / 100);
        runningProfit += (data.profit + data.returns) / 100; // Include returns in cumulative
        cumulativeProfits.push(runningProfit);
    }

    return { labels, revenues, profits, returns, cumulativeProfits, salesByDay };
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
 * @param {number} index - Index of the day in the chart
 * @returns {Array} Array of { lot, sale } for that day
 */
export function getSalesForDay(salesByDay, index) {
    const keys = Array.from(salesByDay.keys());
    if (index >= 0 && index < keys.length) {
        return salesByDay.get(keys[index])?.sales || [];
    }
    return [];
}
