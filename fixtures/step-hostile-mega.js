/**
 * STEP | mega.js — data + behavior for the portal-style homepage.
 * Loaded after script.js on index.html only. Reuses Store.utils / Store.cart /
 * Store.toast and the shared shoe SVG. Everything here is mock data.
 */
'use strict';

const Mega = {};

/* ==========================================================================
   1. DATA
   ========================================================================== */

Mega.PALETTE = ['#b5432b', '#233150', '#5b3a22', '#3c5a44', '#8a8577', '#b8912f', '#5f8fae', '#8f331f'];
Mega.color = i => Mega.PALETTE[i % Mega.PALETTE.length];

Mega.MENU = [
  {
    label: 'Men', cols: [
      { title: 'By Category', links: ['Sneakers', 'Running Shoes', 'Trail & Hiking', 'Boots', 'Dress Shoes', 'Sandals & Slides', 'Slippers'] },
      { title: 'By Activity', links: ['Road Running', 'Gym & Training', 'Basketball', 'Football', 'Tennis', 'Walking', 'Recovery'] },
      { title: 'Shop by Feature', links: ['Waterproof', 'Wide Fit', 'Extra Cushioning', 'Vegan Materials', 'Lightweight', 'High Arch Support', 'Slip Resistant'] }
    ],
    promo: { tag: 'New Season', title: 'Fall/Winter 2026', desc: 'Forty new styles for men, now in every branch and online.' }
  },
  {
    label: 'Women', cols: [
      { title: 'By Category', links: ['Sneakers', 'Running Shoes', 'Ankle Boots', 'Tall Boots', 'Flats', 'Heels', 'Sandals'] },
      { title: 'By Activity', links: ['Road Running', 'Studio & Yoga', 'Cross Training', 'Dance', 'Walking', 'Hiking', 'Everyday'] },
      { title: 'Shop by Feature', links: ['Narrow Fit', 'Arch Support', 'Machine Washable', 'Water Repellent', 'Memory Foam', 'Recycled Materials', 'Orthotic Friendly'] }
    ],
    promo: { tag: 'Bestseller', title: 'The Cloudline Series', desc: 'Our most-reviewed women\'s runner — 4.8 stars from 2,140 reviews.' }
  },
  {
    label: 'Kids', cols: [
      { title: 'By Age', links: ['Baby (0–1)', 'Toddler (1–3)', 'Little Kids (4–7)', 'Big Kids (8–12)', 'Teens (13+)'] },
      { title: 'By Category', links: ['School Shoes', 'Sneakers', 'Sport', 'Rain Boots', 'Sandals', 'Slippers'] },
      { title: 'Parent Picks', links: ['Easy Velcro', 'Non-Marking Soles', 'Grow-With-Me Fit', 'Reflective Details', 'Machine Washable'] }
    ],
    promo: { tag: 'Back to School', title: 'Buy 2, Get 30% Off', desc: 'On all school shoes through the end of the month. Free size checks in store.' }
  },
  {
    label: 'Sport', cols: [
      { title: 'Running', links: ['Daily Trainers', 'Tempo & Race', 'Carbon Plate', 'Trail', 'Track Spikes', 'Marathon Kits'] },
      { title: 'Team Sports', links: ['Basketball', 'Football Boots', 'Indoor Soccer', 'Volleyball', 'Handball', 'Netball'] },
      { title: 'Studio & Gym', links: ['Cross Training', 'Weightlifting', 'Yoga & Barre', 'Cycling Shoes', 'Boxing Boots'] },
      { title: 'Outdoor', links: ['Hiking Boots', 'Approach Shoes', 'Mountaineering', 'Water Shoes', 'Snow Boots'] }
    ],
    promo: { tag: 'Pro Service', title: 'Free Gait Analysis', desc: 'Book a 20-minute treadmill session with a STEP fit specialist.' }
  },
  {
    label: 'Brands', cols: [
      { title: 'Top Brands', links: ['Volta', 'Northline', 'Kinetic Lab', 'Aster', 'Ridgeway', 'Modena', 'Trailhead'] },
      { title: 'Performance', links: ['Kinetic Lab Pro', 'Volta Race', 'Northline Trail', 'Aster Studio'] },
      { title: 'Lifestyle', links: ['Modena Heritage', 'Aster Everyday', 'Ridgeway Classics', 'Volta Retro'] }
    ],
    promo: { tag: 'Exclusive', title: 'Only at STEP', desc: 'Twelve colorways you will not find anywhere else in the country.' }
  },
  {
    label: 'Sale', hot: true, cols: [
      { title: 'By Discount', links: ['Up to 30% Off', 'Up to 50% Off', 'Up to 70% Off', 'Final Clearance', 'Last Pairs'] },
      { title: 'By Department', links: ['Men\'s Sale', 'Women\'s Sale', 'Kids\' Sale', 'Sport Sale', 'Accessories Sale'] },
      { title: 'Deals', links: ['Deal of the Day', 'Buy 2 Get 1', 'Outlet Corner', 'Bundle & Save', 'Student Offers'] }
    ],
    promo: { tag: 'Ends Sunday', title: 'Mid-Season Sale', desc: 'Up to 70% off more than 900 styles across every department.' }
  },
  {
    label: 'Club & Services', cols: [
      { title: 'STEP Club', links: ['Join the Club', 'My Points', 'Tier Benefits', 'Points Calculator', 'Redeem Points', 'Club Partners'] },
      { title: 'Services', links: ['Free Gait Analysis', 'Custom Insoles', 'Shoe Repair', 'Cleaning Service', 'Personal Shopper', 'Corporate Orders'] },
      { title: 'Support', links: ['Track My Order', 'Returns & Exchanges', 'Size Guide', 'Care Instructions', 'Warranty', 'Contact Us'] }
    ],
    promo: { tag: 'Members Only', title: 'Double Points Week', desc: 'Every purchase earns twice the points until the end of the month.' }
  }
];

Mega.TICKER = [
  'Free shipping on every order over $300 — no code needed.',
  'Mid-season sale is live: up to 70% off more than 900 styles.',
  'New: same-day pickup available in 14 branches nationwide.',
  'STEP Club members earn double points through August 31.',
  'Extended returns: 60 days on all full-price footwear.',
  'Book a free gait analysis and get a $25 credit toward insoles.'
];

Mega.SLIDES = [
  { eyebrow: 'Fall/Winter 2026', title: 'Every Step<br>Starts Here', desc: 'Forty new silhouettes built for cold mornings, wet commutes, and long weekends. Designed in-house, tested on real roads.', meta: ['Free shipping over $300', '60-day returns', '14 branches'], primary: 'Shop New Arrivals', secondary: 'Browse the Lookbook' },
  { eyebrow: 'Mid-Season Sale', title: 'Up to 70% Off<br>Over 900 Styles', desc: 'Our biggest markdown event of the season. Extra 10% off for STEP Club members at checkout, automatically applied.', meta: ['Ends Sunday 23:59', 'Members get extra 10%', 'Final pairs going fast'], primary: 'Shop the Sale', secondary: 'See Club Benefits' },
  { eyebrow: 'Running', title: 'Meet the<br>Cloudline Pro', desc: 'A carbon-plated racer at 198 grams. Two years of development, six months of testing with our national marathon squad.', meta: ['198 g in size 42', 'Carbon fiber plate', 'Race-day tuned'], primary: 'Discover Cloudline', secondary: 'Book a Gait Analysis' },
  { eyebrow: 'Kids', title: 'Back to School,<br>Sorted', desc: 'Buy two pairs of school shoes and take 30% off the second. Free in-store size checks every day of the week.', meta: ['Buy 2, save 30%', 'Free size checks', 'Scuff-resistant'], primary: 'Shop Kids', secondary: 'Find a Branch' },
  { eyebrow: 'STEP Club', title: 'Join Free.<br>Earn Every Step.', desc: 'Points on every purchase, birthday rewards, early access to drops, and free returns for life across four membership tiers.', meta: ['Free to join', '4 tiers', 'Birthday reward'], primary: 'Join the Club', secondary: 'Compare Tiers' }
];

Mega.QUICK = [
  { icon: '📦', label: 'Track My Order' }, { icon: '↩️', label: 'Start a Return' },
  { icon: '📏', label: 'Size Guide' }, { icon: '🏬', label: 'Find a Branch' },
  { icon: '🎁', label: 'Gift Cards' }, { icon: '⭐', label: 'STEP Club' },
  { icon: '🧾', label: 'My Invoices' }, { icon: '🛠️', label: 'Repair Service' },
  { icon: '👟', label: 'Custom Insoles' }, { icon: '💬', label: 'Live Chat' },
  { icon: '♿', label: 'Accessibility' }, { icon: '📞', label: 'Contact Us' }
];

Mega.DEAL_TABS = [
  { id: 'week', label: 'Deals of the Week' },
  { id: 'running', label: 'Running' },
  { id: 'sneakers', label: 'Sneakers' },
  { id: 'boots', label: 'Boots & Outdoor' },
  { id: 'kids', label: 'Kids' },
  { id: 'clearance', label: 'Final Clearance' }
];

Mega.DEALS = {
  week: [
    ['Volta', 'Air Classic Low', 'Two colorways left in most sizes', 449, 599, 'Save 25%'],
    ['Northline', 'Trail Master GTX', 'Waterproof membrane, Vibram sole', 469, 629, 'Save 25%'],
    ['Kinetic Lab', 'Cloudline Daily', 'Our most-returned-to daily trainer', 389, 459, 'Bestseller'],
    ['Aster', 'Studio Flex', 'Barefoot feel for studio work', 299, 379, 'Save 21%'],
    ['Modena', 'Heritage Derby', 'Full-grain leather, Goodyear welt', 549, 699, 'Last pairs'],
    ['Ridgeway', 'Desert Boot', 'Crepe sole, unlined suede', 389, 479, 'Save 19%'],
    ['Volta', 'Retro 90 Court', 'Reissued from the 1994 archive', 439, 519, 'Limited'],
    ['Trailhead', 'Alpine Boot Pro', 'Reinforced ankle, insulated', 599, 749, 'Save 20%']
  ],
  running: [
    ['Kinetic Lab', 'Cloudline Pro Race', 'Carbon plate, 198 g', 749, 899, 'New'],
    ['Kinetic Lab', 'Cloudline Daily', 'Daily miles, high stack', 389, 459, 'Save 15%'],
    ['Volta', 'Urban Run 4', 'City pavement specialist', 359, 429, 'Save 16%'],
    ['Northline', 'Trail Runner Lite', 'Loose gravel and forest paths', 419, 499, 'Save 16%'],
    ['Aster', 'Tempo Split', 'Interval and threshold work', 469, 549, 'Popular'],
    ['Volta', 'Track Spike S', '5 mm pins included', 329, 399, 'Save 17%'],
    ['Kinetic Lab', 'Recovery Slide', 'Post-run foam recovery', 149, 199, 'Save 25%'],
    ['Northline', 'Storm Runner', 'Water repellent upper', 399, 469, 'Save 15%']
  ],
  sneakers: [
    ['Volta', 'Air Classic Low', 'The one everyone owns', 449, 599, 'Save 25%'],
    ['Volta', 'Air Classic High', 'Same shoe, taller collar', 479, 619, 'Save 22%'],
    ['Modena', 'Court Leather', 'Minimalist Italian leather', 519, 629, 'Save 17%'],
    ['Aster', 'Everyday Canvas', 'Washable cotton canvas', 249, 319, 'Save 21%'],
    ['Volta', 'Retro 90 Court', 'Archive reissue', 439, 519, 'Limited'],
    ['Ridgeway', 'Classic Slip-On', 'No laces, all day', 279, 349, 'Save 20%'],
    ['Kinetic Lab', 'Minigame', 'Bold two-tone colorway', 459, 519, 'Save 12%'],
    ['Aster', 'Studio Flex', 'Barefoot feel', 299, 379, 'Save 21%']
  ],
  boots: [
    ['Trailhead', 'Alpine Boot Pro', 'Technical mountain boot', 599, 749, 'Save 20%'],
    ['Northline', 'Volt High', 'Wool-lined winter boot', 549, 649, 'Save 15%'],
    ['Ridgeway', 'Desert Boot', 'Crepe sole classic', 389, 479, 'Save 19%'],
    ['Modena', 'Chelsea Leather', 'Elastic gore, pull tab', 529, 639, 'Save 17%'],
    ['Trailhead', 'Approach Mid', 'Sticky rubber toe cap', 489, 589, 'Save 17%'],
    ['Northline', 'Snow Guard', 'Rated to −25 °C', 619, 739, 'Save 16%'],
    ['Ridgeway', 'Rain Boot Tall', 'Natural rubber, lined', 259, 329, 'Save 21%'],
    ['Trailhead', 'Trek Light Mid', 'Weekend hiking, low weight', 439, 529, 'Save 17%']
  ],
  kids: [
    ['Aster', 'School Shoe Velcro', 'Scuff resistant toe', 189, 249, 'Save 24%'],
    ['Volta', 'Mini Air', 'The classic, shrunk down', 219, 279, 'Save 21%'],
    ['Northline', 'Rain Splash', 'Fully waterproof', 169, 219, 'Save 23%'],
    ['Kinetic Lab', 'Playground Run', 'Non-marking sole', 199, 259, 'Save 23%'],
    ['Aster', 'First Steps', 'Soft sole for babies', 139, 179, 'Save 22%'],
    ['Ridgeway', 'Sandal Trek', 'Adjustable triple strap', 149, 199, 'Save 25%'],
    ['Volta', 'Court Junior', 'Indoor court grip', 229, 289, 'Save 21%'],
    ['Northline', 'Snow Kid', 'Insulated winter boot', 249, 319, 'Save 22%']
  ],
  clearance: [
    ['Modena', 'Heritage Oxford', 'Discontinued color', 349, 699, 'Save 50%'],
    ['Volta', 'Air Classic 2024', 'Previous generation', 249, 549, 'Save 55%'],
    ['Aster', 'Studio Flex v1', 'Superseded model', 179, 379, 'Save 53%'],
    ['Northline', 'Trail Master v2', 'Last season pattern', 289, 599, 'Save 52%'],
    ['Ridgeway', 'Summer Sandal', 'End of season', 99, 249, 'Save 60%'],
    ['Kinetic Lab', 'Tempo v3', 'Final sizes only', 219, 519, 'Save 58%'],
    ['Trailhead', 'Trek Light v1', 'Two sizes remaining', 199, 499, 'Save 60%'],
    ['Volta', 'Retro 88', 'Archive clearance', 189, 459, 'Save 59%']
  ]
};

Mega.BRANDS = [
  ['Volta', 'Since 1978'], ['Northline', 'Outdoor'], ['Kinetic Lab', 'Performance'],
  ['Aster', 'Studio'], ['Ridgeway', 'Heritage'], ['Modena', 'Italy'],
  ['Trailhead', 'Mountain'], ['Corso', 'Leather'], ['Pace & Co.', 'Running'],
  ['Halden', 'Nordic'], ['Junction', 'Street'], ['Marlow', 'Comfort']
];

Mega.MOSAIC = [
  { name: 'Sneakers', count: '284 styles', size: 'xl' },
  { name: 'Running', count: '176 styles', size: '' },
  { name: 'Boots', count: '132 styles', size: '' },
  { name: 'Trail & Hiking', count: '94 styles', size: 'wide' },
  { name: 'Casual', count: '211 styles', size: '' },
  { name: 'Sport & Training', count: '158 styles', size: '' },
  { name: 'Kids', count: '143 styles', size: 'wide' }
];

Mega.TIERS = [
  { name: 'Step', points: '0–999 points', featured: false, perks: ['1 point per $10 spent', 'Birthday reward', 'Free standard returns', 'Members-only newsletter'] },
  { name: 'Stride', points: '1,000–2,999 points', featured: false, perks: ['1.5 points per $10', 'Free shipping, no minimum', 'Early access to sales', 'Free size exchange'] },
  { name: 'Sprint', points: '3,000–7,499 points', featured: true, perks: ['2 points per $10', 'Free express shipping', '48h early drop access', 'Free custom insoles once a year', 'Dedicated support line'] },
  { name: 'Summit', points: '7,500+ points', featured: false, perks: ['3 points per $10', 'Free shipping and returns for life', 'Personal shopper', 'Invitations to launch events', 'Annual $150 credit'] }
];

Mega.SIZE_ROWS = [
  [35, 3.5, 2.5, 22.0, 'Extra small'], [36, 4.5, 3.5, 22.5, 'Extra small'],
  [37, 5.5, 4.5, 23.5, 'Small'], [38, 6.5, 5.5, 24.0, 'Small'],
  [39, 7.0, 6.0, 24.5, 'Small'], [40, 8.0, 7.0, 25.5, 'Medium'],
  [41, 8.5, 7.5, 26.0, 'Medium'], [42, 9.5, 8.5, 27.0, 'Medium'],
  [43, 10.5, 9.5, 27.5, 'Large'], [44, 11.0, 10.0, 28.5, 'Large'],
  [45, 12.0, 11.0, 29.0, 'Large'], [46, 13.0, 12.0, 30.0, 'Extra large'],
  [47, 13.5, 12.5, 30.5, 'Extra large'], [48, 14.5, 13.5, 31.5, 'Extra large']
];

Mega.COMPARE_ROWS = [
  ['Weight (size 42)', '198 g', '245 g', '310 g', '480 g'],
  ['Drop', '4 mm', '8 mm', '10 mm', '12 mm'],
  ['Stack height', '39 mm', '34 mm', '28 mm', '24 mm'],
  ['Carbon plate', true, false, false, false],
  ['Waterproof', false, false, false, true],
  ['Wide fit available', true, true, true, false],
  ['Recycled content', '62%', '48%', '31%', '18%'],
  ['Machine washable', false, true, true, false],
  ['Best for', 'Race day', 'Daily miles', 'Everyday wear', 'Winter and trail'],
  ['Warranty', '24 months', '24 months', '12 months', '36 months'],
  ['Price', '$749', '$389', '$449', '$599']
];

Mega.ARTICLES = [
  ['Guides', 'How to Pick Your First Running Shoe', 'Cushioning, drop, and fit explained without the marketing language — a plain checklist you can take into any store.', 'Aug 1, 2026', '7 min read'],
  ['Care', 'Cleaning Suede Without Ruining It', 'Four household mistakes that permanently mark suede, and the two tools that actually work.', 'Jul 28, 2026', '5 min read'],
  ['Fit', 'Why Your Left Foot Is Bigger', 'Asymmetry is normal. Here is how to size for it instead of fighting it every morning.', 'Jul 24, 2026', '6 min read'],
  ['Training', 'Rotating Two Pairs Makes Both Last Longer', 'The foam recovery argument, and whether the research actually supports it.', 'Jul 19, 2026', '9 min read'],
  ['Materials', 'What Gore-Tex Really Does', 'Waterproof, water resistant, and water repellent are three different promises.', 'Jul 15, 2026', '8 min read'],
  ['Style', 'Five Ways to Wear White Sneakers in Winter', 'Salt, slush, and grey light — a wardrobe problem with straightforward answers.', 'Jul 9, 2026', '4 min read'],
  ['Kids', 'How Often Children Actually Outgrow Shoes', 'Growth rates by age, and the two-week check that prevents most fit problems.', 'Jul 2, 2026', '6 min read'],
  ['Sustainability', 'Where Our Recycled Uppers Come From', 'A supply chain walkthrough, from collection bin to finished mesh.', 'Jun 26, 2026', '11 min read'],
  ['Health', 'Arch Support: Who Needs It and Who Does Not', 'A physiotherapist separates the marketing claims from the clinical evidence.', 'Jun 20, 2026', '10 min read']
];

Mega.REVIEWS = [
  ['Dana R.', 5, 'Jul 30, 2026', 'Third pair of the same model. They fit exactly the same every time, which is more than I can say for anything else I have bought online.', 'Cloudline Daily'],
  ['Michael B.', 5, 'Jul 27, 2026', 'The in-store gait analysis changed which shoe I bought entirely. Free, twenty minutes, no pressure to buy the expensive option.', 'Urban Run 4'],
  ['Yael K.', 4, 'Jul 25, 2026', 'Beautiful boot and genuinely waterproof. Half a size small, so order up — the size guide on the product page says as much.', 'Volt High'],
  ['Tom A.', 5, 'Jul 22, 2026', 'Ordered at 2 pm, picked up in the branch by 6. The pickup counter had it ready with my name on it.', 'Air Classic Low'],
  ['Noa S.', 4, 'Jul 18, 2026', 'Comfortable straight out of the box with no break-in. The laces are too long, but that is a two-dollar problem.', 'Studio Flex'],
  ['Eitan M.', 5, 'Jul 14, 2026', 'Returned a pair that did not fit and the refund landed in three days. That is the whole reason I keep coming back.', 'Trail Master GTX'],
  ['Rina L.', 5, 'Jul 11, 2026', 'The club points added up faster than I expected and covered most of my second pair.', 'Retro 90 Court'],
  ['Guy P.', 4, 'Jul 7, 2026', 'Solid winter boot. Heavier than my old pair, but it is warm in a way the old pair never was.', 'Alpine Boot Pro'],
  ['Shira D.', 5, 'Jul 3, 2026', 'Bought school shoes for two kids in one visit. Staff measured both properly instead of guessing.', 'School Shoe Velcro'],
  ['Amir F.', 5, 'Jun 29, 2026', 'The custom insole service is worth every shekel. My knee pain after long runs is simply gone.', 'Cloudline Pro Race']
];

Mega.STORES = [
  ['Tel Aviv — Dizengoff Center', '50 Dizengoff St, Tel Aviv', '09:30–21:30', ['Gait analysis', 'Same-day pickup', 'Repairs', 'Wheelchair access'], true],
  ['Tel Aviv — Sarona Market', '3 Aluf Kalman Magen St, Tel Aviv', '10:00–22:00', ['Same-day pickup', 'Personal shopper', 'Wheelchair access'], true],
  ['Ramat Gan — Ayalon Mall', '2 Aba Hillel Silver Rd, Ramat Gan', '09:30–21:30', ['Gait analysis', 'Kids fitting', 'Wheelchair access'], true],
  ['Jerusalem — Malha Mall', '1 Agudat Sport Beitar, Jerusalem', '09:30–22:00', ['Same-day pickup', 'Repairs', 'Kids fitting'], true],
  ['Jerusalem — Mamilla', '8 Alrov Mamilla Ave, Jerusalem', '10:00–21:00', ['Personal shopper', 'Wheelchair access'], false],
  ['Haifa — Grand Kanyon', '54 Simha Golan Rd, Haifa', '09:30–21:30', ['Gait analysis', 'Custom insoles', 'Wheelchair access'], true],
  ['Haifa — Lev HaMifratz', '1 HaHistadrut Ave, Haifa', '09:00–21:00', ['Same-day pickup', 'Kids fitting'], true],
  ['Beersheba — Grand Kanyon', '1 Shderot David Tuviyahu, Beersheba', '09:30–21:30', ['Repairs', 'Wheelchair access'], true],
  ['Netanya — Ir Yamim', '1 Ha-Tikhon St, Netanya', '09:30–21:30', ['Same-day pickup', 'Kids fitting', 'Wheelchair access'], true],
  ['Rishon LeZion — Cinema City', '1 Moshe Dayan Rd, Rishon LeZion', '10:00–22:00', ['Gait analysis', 'Personal shopper'], false],
  ['Petah Tikva — Avnat', '2 HaSivim St, Petah Tikva', '09:00–21:00', ['Custom insoles', 'Repairs'], true],
  ['Ashdod — Sea Mall', '1 Ha-Menofim St, Ashdod', '09:30–21:30', ['Same-day pickup', 'Wheelchair access'], true],
  ['Eilat — Ice Mall', '8 Kamen St, Eilat', '10:00–22:00', ['Same-day pickup', 'Kids fitting'], true],
  ['Modiin — Azrieli', '1 Lev Ha-Ir St, Modiin', '09:30–21:30', ['Gait analysis', 'Repairs', 'Wheelchair access'], false]
];

Mega.FAQ_TABS = [
  { id: 'orders', label: 'Orders & Shipping' },
  { id: 'returns', label: 'Returns & Exchanges' },
  { id: 'sizing', label: 'Sizing & Fit' },
  { id: 'cbw', label: 'STEP Club' },
  { id: 'care', label: 'Care & Warranty' }
];

Mega.FAQ = {
  orders: [
    ['How long does delivery take?', 'Standard delivery arrives in 3–5 business days nationwide. Express delivery ordered before 2 pm arrives the next business day. Same-day pickup is available in 14 branches, usually ready within four hours of ordering.'],
    ['Is shipping really free?', 'Standard shipping is free on every order over $300. Below that it is $29. STEP Club members at Stride tier and above get free standard shipping with no minimum, and Sprint tier and above get free express shipping.'],
    ['Can I change my delivery address after ordering?', 'Yes, until the order enters packing — normally about two hours after you place it. Open the order in your account and choose "Edit delivery details". After packing starts, contact support and we will reroute the parcel with the courier where possible.'],
    ['Do you ship internationally?', 'We ship to 34 countries. International delivery takes 7–14 business days and duties are calculated and shown at checkout, so nothing is collected on arrival.'],
    ['How do I track my order?', 'Every shipment gets an SMS and email with a tracking link the moment it leaves the warehouse. You can also open "Track My Order" from the top of any page using your order number and phone number.'],
    ['Can I order by phone?', 'Yes. Our order line is open Sunday to Thursday, 08:00–20:00, and Friday 08:00–13:00. Phone orders qualify for the same offers and club points as online orders.']
  ],
  returns: [
    ['What is the return window?', 'Sixty days on all full-price footwear and thirty days on sale items, counted from the delivery date. Shoes must be unworn outdoors and returned with the original box.'],
    ['Do returns cost anything?', 'Standard returns are free for all customers. You can drop the parcel at any of our 14 branches or book a free courier pickup from your account.'],
    ['How long does a refund take?', 'We inspect returns within two business days of arrival. Refunds are issued to the original payment method and typically appear within 3–5 business days after that.'],
    ['Can I exchange for a different size instead?', 'Yes, and it is the fastest option. Choose "Exchange" instead of "Return" in your account and we ship the new size as soon as the courier scans your parcel, rather than waiting for it to arrive.'],
    ['What if the shoes arrived damaged?', 'Contact support with photos within seven days. We send a replacement immediately at no cost and arrange collection of the damaged pair — you are never asked to pay first and claim later.']
  ],
  sizing: [
    ['How do I measure my foot at home?', 'Stand on a sheet of paper against a wall in the evening, when feet are largest. Mark the longest toe, measure heel to mark in centimeters, and match that number to the CM column in our size chart above.'],
    ['Do your shoes run true to size?', 'Most do. Where a model runs small or large, the product page says so directly in the size selector, based on aggregated exchange data rather than guesswork.'],
    ['What is the difference between wide and regular fit?', 'Wide fit adds roughly 6 mm across the forefoot and uses a deeper toe box, without changing the length. If you normally size up for width alone, wide fit in your usual size will fit better.'],
    ['Can I get shoes fitted in store?', 'Every branch offers free measurement. Six branches also offer treadmill gait analysis, which takes about twenty minutes and requires a booking.'],
    ['Do children need extra room to grow?', 'About 10–12 mm of space beyond the longest toe. More than that and the shoe slides, causing blisters. We check growth room free of charge in any branch.']
  ],
  club: [
    ['Does joining cost anything?', 'No. Membership is free and permanent, and you start earning points on your first purchase, including purchases made before you joined if made with the same phone number in the last 30 days.'],
    ['How are points calculated?', 'One point per $10 at Step tier, rising to three points per $10 at Summit. Points post 14 days after delivery, once the return window on that order narrows.'],
    ['Do points expire?', 'Points expire 24 months after they are earned. Any purchase resets the clock on your whole balance, so an active member never loses points.'],
    ['How do I redeem points?', '100 points equals $10 off. Redeem at checkout in any increment, in store or online. Points can be combined with sale prices and with promotional codes.'],
    ['Can I share my account with family?', 'Yes. Family accounts link up to five members under a shared point balance. Everyone keeps their own login, sizes, and order history.']
  ],
  care: [
    ['How should I clean mesh running shoes?', 'Remove the laces and insoles, brush off dry dirt, then hand wash with lukewarm water and a drop of mild soap. Air dry away from direct heat — a radiator will warp the midsole permanently.'],
    ['Are your shoes machine washable?', 'Some canvas and knit models are, and the product page states it explicitly. Never machine wash leather, suede, or anything with a waterproof membrane.'],
    ['What does the warranty cover?', 'Manufacturing defects for 12 to 36 months depending on the model, listed on each product page. Normal outsole wear, creasing, and damage from misuse are not covered.'],
    ['How long should a running shoe last?', 'Between 600 and 900 kilometers for most foam midsoles. Rotating two pairs extends the life of both, since foam recovers between runs.'],
    ['Do you repair shoes?', 'Yes, in eight branches. Resoling, stitching, heel replacement, and eyelet repair are all available, typically within 5–7 business days.']
  ]
};

Mega.FOOTER = [
  { title: 'Shop', links: ['All Products', 'New Arrivals', 'Bestsellers', 'Sale', 'Men', 'Women', 'Kids', 'Sport', 'Outlet'] },
  { title: 'Categories', links: ['Sneakers', 'Running', 'Boots', 'Trail & Hiking', 'Casual', 'Sandals', 'Slippers', 'Accessories'] },
  { title: 'Brands', links: ['Volta', 'Northline', 'Kinetic Lab', 'Aster', 'Ridgeway', 'Modena', 'Trailhead', 'All Brands'] },
  { title: 'Customer Service', links: ['Contact Us', 'Track My Order', 'Shipping Info', 'Returns & Exchanges', 'Size Guide', 'Care Instructions', 'Warranty', 'FAQ'] },
  { title: 'STEP Club', links: ['Join the Club', 'Tier Benefits', 'My Points', 'Redeem Points', 'Club Partners', 'Terms of the Club'] },
  { title: 'Services', links: ['Gait Analysis', 'Custom Insoles', 'Shoe Repair', 'Cleaning Service', 'Personal Shopper', 'Corporate Orders', 'Gift Cards'] },
  { title: 'About STEP', links: ['Our Story', 'Sustainability', 'Careers', 'Press Room', 'Investor Relations', 'Store Openings', 'Affiliates'] },
  { title: 'Legal', links: ['Terms of Use', 'Privacy Policy', 'Cookie Policy', 'Accessibility Statement', 'Return Policy', 'Warranty Terms', 'Sitemap'] }
];

Mega.SEO_LINKS = [
  'running shoes', 'men\'s sneakers', 'women\'s sneakers', 'kids school shoes', 'waterproof boots',
  'hiking shoes', 'wide fit shoes', 'carbon plate racers', 'leather dress shoes', 'canvas slip-ons',
  'trail running shoes', 'gym trainers', 'basketball shoes', 'football boots', 'recovery slides',
  'winter boots', 'chelsea boots', 'desert boots', 'vegan shoes', 'recycled sneakers',
  'orthotic friendly shoes', 'machine washable shoes', 'narrow fit shoes', 'toddler first walkers',
  'shoes under $300', 'shoes on sale', 'last pairs clearance', 'gift cards for shoes'
];

/* ==========================================================================
   2. RENDERERS
   ========================================================================== */

const el = id => document.getElementById(id);
const esc = s => Store.utils.escapeHtml(s);
const price = n => Store.utils.formatPrice(n);

Mega.render = {
  menu() {
    const host = el('e29');
    if (!host) return;
    host.innerHTML = Mega.MENU.map((item, i) => `
      <div class="c6w">
        <div class="c42 ${item.hot ? 'cn' : ''}"
                data-s0="false" data-s5="megaPanel${i}" data-x1="${i}">
          ${esc(item.label)} <span class="c68" data-s3="true">▾</span>
        </div>
        <div class="ca4" id="megaPanel${i}" data-xb="${i}" hidden>
          ${item.cols.map(col => `
            <div>
              <div class="cz">${esc(col.title)}</div>
              <div class="c43">
                ${col.links.map(l => `<div><a href="shop.html">${esc(l)}</a></div>`).join('')}
              </div>
            </div>`).join('')}
          <div class="c44">
            <span class="c10">${esc(item.promo.tag)}</span>
            ${Store.shoeIconSVG(Mega.color(i))}
            <div class="ch">${esc(item.promo.title)}</div>
            <p class="co">${esc(item.promo.desc)}</p>
            <a class="cc0 c83" href="shop.html">Explore</a>
          </div>
        </div>
      </div>`).join('');
  },

  ticker() {
    const host = el('e8');
    if (!host) return;
    host.innerHTML = Mega.TICKER.map((msg, i) => `
      <p class="c8q ${i === 0 ? 'c1n' : ''}" data-x6="${i}">
        <span data-s3="true">✦</span> ${esc(msg)} <a href="shop.html">Details</a>
      </p>`).join('');
  },

  hero() {
    const track = el('e1m');
    const dots = el('e1y');
    if (!track) return;
    track.innerHTML = Mega.SLIDES.map((s, i) => `
      <div class="ca2 ${i === 0 ? 'c32' : ''}" data-xr="${i}"
           data-s9="slide" data-s7="Slide ${i + 1} of ${Mega.SLIDES.length}">
        <div class="c3y">
          <div>
            <span class="c23">${esc(s.eyebrow)}</span>
            <div class="c3z">${s.title}</div>
            <p class="c53">${esc(s.desc)}</p>
            <div class="c54">${s.meta.map(m => `<span>✓ ${esc(m)}</span>`).join('')}</div>
            <div class="c22">
              <a class="cc0 c8v" href="shop.html">${esc(s.primary)}</a>
              <a class="cc0 c83" style="border-color:#f6f2ea;color:#f6f2ea" href="shop.html">${esc(s.secondary)}</a>
            </div>
          </div>
          <div class="c64">
            <div class="cm">${Store.shoeIconSVG(Mega.color(i + 2))}</div>
          </div>
        </div>
      </div>`).join('');
    dots.innerHTML = Mega.SLIDES.map((s, i) => `
      <div class="c31 ${i === 0 ? 'c4' : ''}"
              data-xg="${i}" data-s7="Go to slide ${i + 1}: ${esc(s.eyebrow)}"></div>`).join('');
  },

  quick() {
    const host = el('e19');
    if (!host) return;
    host.innerHTML = Mega.QUICK.map(q => `
      <a class="c4b" href="shop.html">
        <span class="c4a" data-s3="true">${q.icon}</span>
        <span>${esc(q.label)}</span>
      </a>`).join('');
  },

  dealTabs() {
    const host = el('e1t');
    if (!host) return;
    host.innerHTML = Mega.DEAL_TABS.map((t, i) => `
      <div class="c8p" id="dealTab-${t.id}"
              data-s5="dealPanel" data-s1="${i === 0}" data-xj="${t.id}">${esc(t.label)}</div>`).join('');
  },

  deals(tabId) {
    const host = el('e1s');
    if (!host) return;
    host.innerHTML = (Mega.DEALS[tabId] || []).map((d, i) => {
      const [brand, name, note, now, was, ribbon] = d;
      return `
        <div class="cam">
          <div class="c4y" style="background:${Mega.color(i)}">
            <span class="c3v">${esc(ribbon)}</span>
            ${Store.shoeIconSVG('#fff')}
          </div>
          <div class="c5y">
            <span class="c50">${esc(brand)}</span>
            <div class="c61"><a href="shop.html">${esc(name)}</a></div>
            <p class="c62">${esc(note)}</p>
            <div class="c5z">
              <span class="c60">was ${price(was)}<br>from</span>
              <span class="c4z">${price(now)}</span>
            </div>
          </div>
        </div>`;
    }).join('');
  },

  productRail(hostId, products) {
    const host = el(hostId);
    if (!host) return;
    host.innerHTML = products.map(p => Store.homePage.productCardTemplate(p)).join('');
  },

  brands() {
    const host = el('ew');
    if (!host) return;
    host.innerHTML = Mega.BRANDS.map(([name, sub]) => `
      <a class="c3o" href="shop.html">
        ${esc(name)}<span class="c4r">${esc(sub)}</span>
      </a>`).join('');
  },

  mosaic() {
    const host = el('e2k');
    if (!host) return;
    host.innerHTML = Mega.MOSAIC.map((t, i) => `
      <a class="c8h ${t.size ? 'mosaic__tile--' + t.size : ''}" href="shop.html" style="background:${Mega.color(i)}">
        ${Store.shoeIconSVG('#fff')}
        <span class="c8g">${esc(t.name)}</span>
        <span class="c7u">${esc(t.count)}</span>
      </a>`).join('');
  },

  tiers() {
    const host = el('e25');
    if (!host) return;
    host.innerHTML = Mega.TIERS.map(t => `
      <div class="cb1 ${t.featured ? 'c2o' : ''}">
        ${t.featured ? '<span class="c5n">Most popular</span>' : ''}
        <div class="c6i">${esc(t.name)}</div>
        <span class="c4n">${esc(t.points)}</span>
        <div class="c5o">${t.perks.map(p => `<div>${esc(p)}</div>`).join('')}</div>
        <a class="cc0 c83" href="shop.html">Learn more</a>
      </div>`).join('');
  },

  sizeTable() {
    const host = el('ee');
    if (!host) return;
    host.innerHTML = Mega.SIZE_ROWS.map(r => `
      <div data-t="t4">
        <div data-t="t5" scope="row">${r[0]}</div><div data-t="t6">${r[1]}</div><div data-t="t6">${r[2]}</div><div data-t="t6">${r[3]}</div><div data-t="t6">${esc(r[4])}</div>
        <div data-t="t6"><a href="shop.html">Shop size ${r[0]}</a></div>
      </div>`).join('');
  },

  compareTable() {
    const host = el('e2');
    if (!host) return;
    const cell = v => v === true ? '<span class="c5x">Yes</span>'
      : v === false ? '<span class="c6p">No</span>' : esc(v);
    host.innerHTML = Mega.COMPARE_ROWS.map(r => `
      <div data-t="t4"><div data-t="t5" scope="row">${esc(r[0])}</div>${r.slice(1).map(v => `<div data-t="t6">${cell(v)}</div>`).join('')}</div>`).join('');
  },

  articles() {
    const host = el('ep');
    if (!host) return;
    host.innerHTML = Mega.ARTICLES.map(([tag, title, excerpt, date, read], i) => `
      <div class="c82">
        <div class="c1p" style="background:${Mega.color(i + 1)}">${Store.shoeIconSVG('#fff')}</div>
        <div class="c2r">
          <span class="c3n">${esc(tag)}</span>
          <div class="c1q"><a href="#">${esc(title)}</a></div>
          <p class="cw">${esc(excerpt)}</p>
          <div class="c2s"><span>${esc(date)}</span><span>${esc(read)}</span></div>
        </div>
      </div>`).join('');
  },

  instagram() {
    const host = el('e2j');
    if (!host) return;
    const caps = ['#StepEveryDay', '#CloudlinePro', '#TrailSeason', '#StepClub', '#NewArrivals', '#BackToSchool',
      '#RunClub', '#WinterBoots', '#StepStyle', '#OnMyFeet', '#RaceDay', '#StepKids'];
    host.innerHTML = caps.map((c, i) => `
      <a class="cbg" href="#" style="background:${Mega.color(i + 3)}">
        ${Store.shoeIconSVG('#fff')}
        <span class="c55"><span>${esc(c)}</span><span>♥ ${(i + 3) * 137}</span></span>
      </a>`).join('');
  },

  reviews() {
    const host = el('e1a');
    if (!host) return;
    host.innerHTML = Mega.REVIEWS.map(([name, stars, date, text, product], i) => `
      <div class="c9g">
        <div class="c4f">
          <span class="c2f" style="background:${Mega.color(i)}">${esc(name[0])}</span>
          <span>
            <span class="c4g">${esc(name)}</span><br>
            <span class="c4e">${esc(date)} · Verified purchase</span>
          </span>
        </div>
        <span class="c3i" data-s7="${stars} out of 5 stars">${Store.utils.stars(stars)}</span>
        <p class="c4h">${esc(text)}</p>
        <span class="c1k">Reviewed: ${esc(product)}</span>
      </div>`).join('');
  },

  stores() {
    const host = el('er');
    if (!host) return;
    host.innerHTML = Mega.STORES.map(([name, addr, hours, tags, open], i) => `
      <div class="c7p" data-xs="${i}" data-s2="${i === 0}">
        <span class="c7r">${esc(name)}</span>
        <span class="c7o">${esc(addr)}</span>
        <span class="${open ? 'c7s' : 'c66'}">${open ? 'Open now' : 'Closed now'} · ${esc(hours)}</span>
        <span class="c7t">${tags.map(t => `<span class="c8f">${esc(t)}</span>`).join('')}</span>
      </div>`).join('');
  },

  storeDetail(i) {
    const host = el('ea');
    if (!host) return;
    const [name, addr, hours, tags, open] = Mega.STORES[i];
    host.innerHTML = `
      <div class="c8e" data-s3="true">Map preview — ${esc(name)}</div>
      <div style="font-size:22px">${esc(name)}</div>
      <p style="margin-top:6px;color:var(--color-ink-soft);font-size:14px">${esc(addr)}</p>
      <p style="margin-top:6px" class="${open ? 'c7s' : 'c66'}">${open ? 'Open now' : 'Closed now'}</p>
      <div class="c7t" style="margin-top:12px">${tags.map(t => `<span class="c8f">${esc(t)}</span>`).join('')}</div>
      <div class="cae" style="margin-top:16px">
        <div data-t="t0" class="c9x" style="min-width:0">
          <div data-t="t7">Opening hours</div>
          <div data-t="t2">
            ${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'].map(d => `<div data-t="t4"><div data-t="t5" scope="row">${d}</div><div data-t="t6">${esc(hours)}</div></div>`).join('')}
            <div data-t="t4"><div data-t="t5" scope="row">Friday</div><div data-t="t6">09:00–14:00</div></div>
            <div data-t="t4"><div data-t="t5" scope="row">Saturday</div><div data-t="t6">Closed</div></div>
          </div>
        </div>
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:16px">
        <a class="cc0 c8v" href="#">Get directions</a>
        <a class="cc0 c83" href="#">Call branch</a>
        <a class="cc0 c83" href="#">Book a fitting</a>
      </div>`;
  },

  faqTabs() {
    const host = el('e26');
    if (!host) return;
    host.innerHTML = Mega.FAQ_TABS.map((t, i) => `
      <div class="c8p" id="faqTab-${t.id}" data-s1="${i === 0}"
              data-s5="faqPanel" data-xk="${t.id}">${esc(t.label)}</div>`).join('');
  },

  faq(tabId) {
    const host = el('e1u');
    if (!host) return;
    host.innerHTML = (Mega.FAQ[tabId] || []).map(([q, a], i) => `
      <div class="c5t">
        <div>
          <div class="c2q" data-s0="false"
                  data-s5="faqBody-${tabId}-${i}" data-xd>
            <span>${esc(q)}</span><span class="c5s" data-s3="true">+</span>
          </div>
        </div>
        <div class="c4q" id="faqBody-${tabId}-${i}" hidden>${esc(a)}</div>
      </div>`).join('');
  },

  footer() {
    const host = el('e13');
    if (!host) return;
    host.innerHTML = Mega.FOOTER.map(col => `
      <div>
        <div class="c36">${esc(col.title)}</div>
        <div class="c35">${col.links.map(l => `<div><a href="#">${esc(l)}</a></div>`).join('')}</div>
      </div>`).join('');
    const seo = el('e1l');
    if (seo) seo.innerHTML = Mega.SEO_LINKS.map(l => `<a href="shop.html">${esc(l)}</a>`).join(' ');
  },

  searchSuggestions(query) {
    const host = el('ed');
    if (!host) return;
    const q = query.trim().toLowerCase();
    const matches = (q ? Store.PRODUCTS.filter(p =>
      p.name.toLowerCase().includes(q) || p.category.includes(q)) : Store.PRODUCTS).slice(0, 8);
    host.innerHTML = matches.length ? matches.map(p => `
      <a class="c7x" href="product.html?id=${p.id}">
        <span class="c1m" style="background:${p.colors[0].hex}">${Store.shoeIconSVG('#fff')}</span>
        <span>
          <span class="c2k">${esc(p.name)}</span><br>
          <span class="c2j">${esc(Store.getCategoryLabel(p.category))} · ${Store.utils.stars(p.rating)} (${p.reviews})</span>
        </span>
        <span class="c1l">${price(p.price)}</span>
      </a>`).join('')
      : `<p style="padding:16px;color:var(--color-ink-soft)">No products match “${esc(query)}”. Try a category such as running or boots.</p>`;
  }
};

/* ==========================================================================
   3. WIDGETS
   ========================================================================== */

Mega.widgets = {
  ticker() {
    const items = Store.utils.qsa('[data-x6]');
    if (!items.length) return;
    let idx = 0;
    const go = n => {
      items[idx].classList.remove('c1n');
      idx = (n + items.length) % items.length;
      items[idx].classList.add('c1n');
    };
    let timer = setInterval(() => go(idx + 1), 5000);
    const reset = () => { clearInterval(timer); timer = setInterval(() => go(idx + 1), 5000); };
    el('e1d').addEventListener('click', () => { go(idx - 1); reset(); });
    el('e1c').addEventListener('click', () => { go(idx + 1); reset(); });
  },

  megaMenu() {
    const nav = el('e29');
    if (!nav) return;
    const closeAll = except => {
      Store.utils.qsa('[data-xb]', nav).forEach(panel => {
        if (panel.dataset.xb === except) return;
        panel.hidden = true;
        nav.querySelector(`[data-x1="${panel.dataset.xb}"]`).setAttribute('data-s0', 'false');
      });
    };
    nav.addEventListener('click', e => {
      const trigger = e.target.closest('[data-x1]');
      if (!trigger) return;
      const id = trigger.dataset.x1;
      const panel = nav.querySelector(`[data-xb="${id}"]`);
      const open = panel.hidden;
      closeAll(open ? id : null);
      panel.hidden = !open;
      trigger.setAttribute('data-s0', String(open));
    });
    nav.addEventListener('mouseover', e => {
      const item = e.target.closest('.c6w');
      if (!item || !nav.querySelector('[data-xb]:not([hidden])')) return;
      const trigger = item.querySelector('[data-x1]');
      const panel = item.querySelector('[data-xb]');
      closeAll(trigger.dataset.x1);
      panel.hidden = false;
      trigger.setAttribute('data-s0', 'true');
    });
    document.addEventListener('click', e => { if (!nav.contains(e.target)) closeAll(null); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeAll(null); });
  },

  search() {
    const overlay = el('ec');
    const input = el('et');
    if (!overlay) return;
    const open = () => { overlay.hidden = false; input.focus(); Mega.render.searchSuggestions(''); };
    const close = () => { overlay.hidden = true; };
    el('e1b').addEventListener('click', open);
    el('es').addEventListener('click', close);
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
    input.addEventListener('input', Store.utils.debounce(e => Mega.render.searchSuggestions(e.target.value), 180));
    Store.utils.qsa('[data-x5]').forEach(chip => chip.addEventListener('click', () => {
      input.value = chip.textContent.trim();
      Mega.render.searchSuggestions(input.value);
    }));
  },

  heroCarousel() {
    const slides = Store.utils.qsa('[data-xr]');
    const dots = Store.utils.qsa('[data-xg]');
    const bar = el('el');
    if (!slides.length) return;
    let idx = 0, elapsed = 0, timer = null;
    const DURATION = 6500, TICK = 100;
    const go = n => {
      slides[idx].classList.remove('c32');
      dots[idx].classList.remove('c4');
      idx = (n + slides.length) % slides.length;
      slides[idx].classList.add('c32');
      dots[idx].classList.add('c4');
      elapsed = 0;
    };
    const start = () => {
      stop();
      timer = setInterval(() => {
        elapsed += TICK;
        bar.style.width = (elapsed / DURATION * 100) + '%';
        if (elapsed >= DURATION) go(idx + 1);
      }, TICK);
    };
    const stop = () => { if (timer) clearInterval(timer); timer = null; };
    el('e20').addEventListener('click', () => { go(idx - 1); start(); });
    el('e1z').addEventListener('click', () => { go(idx + 1); start(); });
    dots.forEach(d => d.addEventListener('click', () => { go(Number(d.dataset.xg)); start(); }));
    const track = el('e1m');
    track.addEventListener('mouseenter', stop);
    track.addEventListener('mouseleave', start);
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) start();
  },

  finder() {
    const tabs = Store.utils.qsa('[data-xa]');
    tabs.forEach(tab => tab.addEventListener('click', () => {
      tabs.forEach(t => {
        const selected = t === tab;
        t.setAttribute('data-s1', String(selected));
        el(t.dataset.xa).hidden = !selected;
      });
    }));
    Store.utils.qsa('[data-x2]').forEach(form => form.addEventListener('submit', e => {
      e.preventDefault();
      Store.toast.show('Searching the catalog for your selection…', 'info');
      setTimeout(() => { window.location.href = 'shop.html'; }, 900);
    }));
  },

  countdown() {
    const host = el('e12');
    if (!host) return;
    const target = new Date();
    target.setDate(target.getDate() + 3);
    target.setHours(23, 59, 59, 0);
    const pad = n => String(n).padStart(2, '0');
    const tick = () => {
      const diff = Math.max(0, target - new Date());
      const d = Math.floor(diff / 86400000);
      const h = Math.floor(diff / 3600000) % 24;
      const m = Math.floor(diff / 60000) % 60;
      const s = Math.floor(diff / 1000) % 60;
      [['days', d], ['hours', h], ['minutes', m], ['seconds', s]].forEach(([k, v]) => {
        const node = host.querySelector(`[data-xo="${k}"]`);
        if (node) node.textContent = pad(v);
      });
    };
    tick();
    setInterval(tick, 1000);
  },

  dealTabs() {
    const host = el('e1t');
    if (!host) return;
    host.addEventListener('click', e => {
      const btn = e.target.closest('[data-xj]');
      if (!btn) return;
      Store.utils.qsa('[data-xj]', host).forEach(b => b.setAttribute('data-s1', String(b === btn)));
      el('e1s').setAttribute('data-s6', btn.id);
      Mega.render.deals(btn.dataset.xj);
    });
  },

  rails() {
    Store.utils.qsa('.cbz').forEach(rail => {
      const viewport = rail.querySelector('.c70');
      const prev = rail.querySelector('.c6e');
      const next = rail.querySelector('.c6d');
      const step = () => Math.round(viewport.clientWidth * 0.8);
      if (prev) prev.addEventListener('click', () => viewport.scrollBy({ left: -step(), behavior: 'smooth' }));
      if (next) next.addEventListener('click', () => viewport.scrollBy({ left: step(), behavior: 'smooth' }));
    });
  },

  counters() {
    const nodes = Store.utils.qsa('[data-xi]');
    if (!nodes.length) return;
    const animate = node => {
      const to = Number(node.dataset.xi);
      const suffix = node.dataset.x0 || '';
      const started = performance.now();
      const step = now => {
        const p = Math.min(1, (now - started) / 1400);
        const eased = 1 - Math.pow(1 - p, 3);
        node.textContent = Math.round(to * eased).toLocaleString('en-US') + suffix;
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };
    const io = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        animate(entry.target);
        io.unobserve(entry.target);
      });
    }, { threshold: 0.4 });
    nodes.forEach(n => io.observe(n));
  },

  locator() {
    const list = el('er');
    if (!list) return;
    Mega.render.storeDetail(0);
    list.addEventListener('click', e => {
      const btn = e.target.closest('[data-xs]');
      if (!btn) return;
      Store.utils.qsa('[data-xs]', list).forEach(b => b.setAttribute('data-s2', String(b === btn)));
      Mega.render.storeDetail(Number(btn.dataset.xs));
    });
    const filter = el('eb');
    filter.addEventListener('input', Store.utils.debounce(() => {
      const q = filter.value.trim().toLowerCase();
      Store.utils.qsa('[data-xs]', list).forEach(btn => {
        const match = btn.textContent.toLowerCase().includes(q);
        btn.style.display = match ? '' : 'none';
      });
    }, 160));
  },

  faq() {
    const tabs = el('e26');
    const panel = el('e1u');
    if (!tabs) return;
    tabs.addEventListener('click', e => {
      const btn = e.target.closest('[data-xk]');
      if (!btn) return;
      Store.utils.qsa('[data-xk]', tabs).forEach(b => b.setAttribute('data-s1', String(b === btn)));
      panel.setAttribute('data-s6', btn.id);
      Mega.render.faq(btn.dataset.xk);
    });
    panel.addEventListener('click', e => {
      const trigger = e.target.closest('[data-xd]');
      if (!trigger) return;
      const open = trigger.getAttribute('data-s0') === 'true';
      trigger.setAttribute('data-s0', String(!open));
      document.getElementById(trigger.getAttribute('data-s5')).hidden = open;
    });
  },

  cookieBar() {
    const bar = el('e1h');
    if (!bar) return;
    if (localStorage.getItem('step_cookie_choice')) return;
    setTimeout(() => { bar.hidden = false; }, 1200);
    bar.addEventListener('click', e => {
      const btn = e.target.closest('[data-xm]');
      if (!btn) return;
      localStorage.setItem('step_cookie_choice', btn.dataset.xm);
      bar.hidden = true;
      Store.toast.show('Cookie preferences saved.', 'success');
    });
  },

  chat() {
    const win = el('e10');
    if (!win) return;
    const body = el('e1q');
    const REPLIES = [
      'Happy to help with that. Which branch are you closest to?',
      'That model runs true to size — I would stay with your usual number.',
      'Your order should arrive within 3–5 business days. Want me to look it up?',
      'Returns are free for 60 days. I can start one for you right now.',
      'Club points post 14 days after delivery. Yours are on the way.'
    ];
    let i = 0;
    el('ez').addEventListener('click', () => { win.hidden = !win.hidden; if (!win.hidden) el('e1g').focus(); });
    el('e1f').addEventListener('click', () => { win.hidden = true; });
    el('e1r').addEventListener('submit', e => {
      e.preventDefault();
      const input = el('e1g');
      if (!input.value.trim()) return;
      body.insertAdjacentHTML('beforeend', `<p class="cb3 c86">${esc(input.value)}</p>`);
      input.value = '';
      body.scrollTop = body.scrollHeight;
      setTimeout(() => {
        body.insertAdjacentHTML('beforeend', `<p class="cb3 c7e">${esc(REPLIES[i++ % REPLIES.length])}</p>`);
        body.scrollTop = body.scrollHeight;
      }, 700);
    });
  },

  backToTop() {
    const btn = el('e1e');
    if (!btn) return;
    btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  },

  modals() {
    Store.utils.qsa('[data-xc]').forEach(btn => btn.addEventListener('click', () => {
      el(btn.dataset.xc).hidden = false;
    }));
    Store.utils.qsa('[data-x3]').forEach(btn => btn.addEventListener('click', () => {
      btn.closest('.cbu').hidden = true;
    }));
    Store.utils.qsa('.cbu').forEach(modal => modal.addEventListener('click', e => {
      if (e.target === modal) modal.hidden = true;
    }));
    document.addEventListener('keydown', e => {
      if (e.key !== 'Escape') return;
      Store.utils.qsa('.cbu').forEach(m => { m.hidden = true; });
    });
  },

  subscribe() {
    const form = el('eg');
    if (!form) return;
    form.addEventListener('submit', e => {
      e.preventDefault();
      Store.toast.show('You are on the list. Check your inbox to confirm.', 'success');
      form.reset();
    });
  }
};

/* ==========================================================================
   4. BOOTSTRAP
   ========================================================================== */
document.addEventListener('DOMContentLoaded', () => {
  if (!document.getElementById('e29')) return;

  Mega.render.menu();
  Mega.render.ticker();
  Mega.render.hero();
  Mega.render.quick();
  Mega.render.dealTabs();
  Mega.render.deals('week');
  Mega.render.brands();
  Mega.render.mosaic();
  Mega.render.tiers();
  Mega.render.sizeTable();
  Mega.render.compareTable();
  Mega.render.articles();
  Mega.render.instagram();
  Mega.render.reviews();
  Mega.render.stores();
  Mega.render.faqTabs();
  Mega.render.faq('orders');
  Mega.render.footer();

  const byBadge = badge => Store.PRODUCTS.filter(p => p.badge === badge);
  Mega.render.productRail('bestsellerRail', [...Store.PRODUCTS].sort((a, b) => b.reviews - a.reviews).slice(0, 12));
  Mega.render.productRail('newRail', byBadge('new').concat(Store.PRODUCTS.slice(0, 12)).slice(0, 12));
  Mega.render.productRail('saleRail', byBadge('sale').concat(Store.PRODUCTS.filter(p => p.oldPrice)).slice(0, 12));
  Mega.render.productRail('topRatedRail', [...Store.PRODUCTS].sort((a, b) => b.rating - a.rating).slice(0, 12));

  Object.values(Mega.widgets).forEach(fn => {
    try { fn(); } catch (err) { console.error('[mega] widget failed', err); }
  });
});
