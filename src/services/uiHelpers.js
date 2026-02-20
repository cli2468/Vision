/**
 * Centralized logic for rendering platform badges consistently across the application.
 */
export function renderPlatformBadge(platform) {
    const p = (platform || 'unknown').toLowerCase();

    const labels = {
        facebook: 'Facebook',
        ebay: 'eBay',
        amazon: 'Amazon',
        shopify: 'Shopify',
        poshmark: 'Poshmark',
        whatnot: 'Whatnot',
        unknown: 'Other',
        other: 'Other'
    };

    const label = labels[p] || labels.unknown;
    const className = labels[p] ? p : 'unknown';

    return `<span class="platform-badge ${className}">${label}</span>`;
}
