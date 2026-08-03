/**
 * Seed content mirrored from the existing index.html so the homepage keeps
 * showing exactly the same products once Phase 5 renders them from the
 * database. Titles, categories, images, prices and bid counts are copied
 * from the hardcoded markup - nothing here is new product data.
 */

/** Every seeded account uses this password. Demo data only. */
export const DEMO_PASSWORD = 'password123';

export const SELLERS = [
  { key: 'tiffanyco', firstName: 'Tiffany', lastName: 'Co', email: 'tiffanyco@bidderx.test', phone: '+91 90000 00001' },
  { key: 'luxurytime', firstName: 'Luxury', lastName: 'Time', email: 'luxurytime@bidderx.test', phone: '+91 90000 00002' },
  { key: 'premiumjewels', firstName: 'Premium', lastName: 'Jewels', email: 'premiumjewels@bidderx.test', phone: '+91 90000 00003' },
];

export const BUYERS = [
  { key: 'john', firstName: 'John', lastName: 'Doe', email: 'john@example.com', phone: '+91 98000 00001' },
  { key: 'priya', firstName: 'Priya', lastName: 'Sharma', email: 'priya@example.com', phone: '+91 98000 00002' },
  { key: 'arjun', firstName: 'Arjun', lastName: 'Mehta', email: 'arjun@example.com', phone: '+91 98000 00003' },
];

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

export const AUCTIONS = [
  {
    // Hero card in index.html
    sellerKey: 'luxurytime',
    title: 'Breitling Superocean Heritage Chronograph',
    category: 'Luxury Watches',
    description: 'Superocean Heritage Chronograph 44mm. Steel case with bronze-gold bezel, black dial, COSC-certified chronometer. Box and papers included.',
    imageUrl: '/images/breitling-superocean.jpg',
    startingPrice: 900000,
    currentPrice: 1200000,
    bidCount: 23,
    endsInMs: 4 * HOUR + 23 * MINUTE + 45 * 1000,
  },
  {
    sellerKey: 'tiffanyco',
    title: '18K White Gold Diamond Ring (2ct)',
    category: "Women's Jewelry",
    description: 'Brilliant-cut 2 carat centre stone set in 18K white gold. Certified colour grade F, clarity VS1.',
    imageUrl: '/images/diamond-ring.jpg',
    startingPrice: 500000,
    currentPrice: 680000,
    bidCount: 15,
    endsInMs: 2 * HOUR + 15 * MINUTE + 30 * 1000,
  },
  {
    sellerKey: 'luxurytime',
    title: 'Omega Speedmaster Professional',
    category: 'Luxury Watches',
    description: 'Moonwatch Professional Co-Axial Master Chronometer, 42mm. Hesalite crystal, manual-winding calibre 3861.',
    imageUrl: '/images/omega-speedmaster.jpg',
    startingPrice: 300000,
    currentPrice: 540000,
    bidCount: 42,
    endsInMs: 6 * HOUR,
  },
  {
    sellerKey: 'premiumjewels',
    title: 'Cartier Platinum Diamond Necklace',
    category: "Women's Jewelry",
    description: 'Platinum necklace set with graduated round brilliant diamonds totalling 5.4 carats. Original Cartier case.',
    imageUrl: '/images/cartier-necklace.jpg',
    startingPrice: 850000,
    currentPrice: 1000000,
    bidCount: 8,
    endsInMs: 29 * HOUR + 40 * MINUTE,
  },
];
