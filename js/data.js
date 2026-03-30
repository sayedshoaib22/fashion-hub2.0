// data.js — Fashion Hub product & navigation data

const ICONS = {
  search: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>`,
  cart: `<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"/></svg>`,
  menu: `<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/></svg>`,
  chevronDown: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>`,
  close: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>`,
  emptyCart: `<svg class="w-24 h-24 mb-4 text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"/></svg>`,
  logoMoon: `<svg class="w-full h-full text-[#FF6B35]" fill="currentColor" viewBox="0 0 20 20"><path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z"/></svg>`,
  filter: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"/></svg>`,
  check: `<svg class="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>`,
};

const BRANCHES = ["Mumbai HQ", "Andheri", "Mira Road", "Thane", "Navi Mumbai", "Pune", "Delhi"];

const NAV_ITEMS = [
  {
    label: "Men", category: "Men", image: "https://images.unsplash.com/photo-1490114538077-0a7f8cb49891?auto=format&fit=crop&q=80&w=600",
    subItems: [{ label: "Topwear", items: ["T-Shirts", "Casual Shirts", "Formal Shirts", "Hoodies", "Jackets"] }, { label: "Bottomwear", items: ["Jeans", "Trousers", "Shorts", "Track Pants"] }, { label: "Accessories", items: ["Watches", "Belts", "Wallets", "Caps"] }]
  },
  {
    label: "Women", category: "Women", image: "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&q=80&w=600",
    subItems: [{ label: "Western Wear", items: ["Dresses", "Tops", "T-Shirts", "Jeans", "Skirts"] }, { label: "Ethnic Wear", items: ["Kurtas", "Kurtis", "Sarees", "Lehengas"] }, { label: "Accessories", items: ["Handbags", "Jewelry", "Watches", "Scarves"] }]
  },
  {
    label: "Kids", category: "Kids", image: "https://images.unsplash.com/photo-1503944583220-79d8926ad5e2?auto=format&fit=crop&q=80&w=600",
    subItems: [{ label: "Boys", items: ["T-Shirts", "Shirts", "Jeans", "Shorts"] }, { label: "Girls", items: ["Dresses", "Tops", "Jeans", "Skirts"] }, { label: "Infants", items: ["Bodysuits", "Rompers", "Sets"] }]
  },
  {
    label: "Footwear", category: "Footwear", image: "https://images.unsplash.com/photo-1460353581641-37baddab0fa2?auto=format&fit=crop&q=80&w=600",
    subItems: [{ label: "Men's", items: ["Casual Shoes", "Formal Shoes", "Sports Shoes", "Sandals"] }, { label: "Women's", items: ["Heels", "Flats", "Sandals", "Sneakers"] }, { label: "Kids", items: ["School Shoes", "Sports Shoes", "Sandals"] }]
  },
  {
    label: "Accessories", category: "Accessories", image: "https://images.unsplash.com/photo-1492707892479-7bc8d5a4ee93?auto=format&fit=crop&q=80&w=600",
    subItems: [{ label: "Fashion", items: ["Watches", "Sunglasses", "Jewelry", "Belts", "Bags"] }, { label: "Winter", items: ["Scarves", "Gloves", "Caps"] }, { label: "Tech", items: ["Phone Cases", "Smart Watches"] }]
  },
];

const SLIDES = [
  { image: "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&q=80&w=1600", title: "Fashion That Defines You", subtitle: "Discover the latest trends", cta: "Shop Now", offer: "Up to 50% OFF", category: "Women" },
  { image: "https://images.unsplash.com/photo-1490114538077-0a7f8cb49891?auto=format&fit=crop&q=80&w=1600", title: "Men's Collection", subtitle: "Elevate your style with premium menswear", cta: "Explore Men", offer: "Free Delivery", category: "Men" },
  { image: "https://images.unsplash.com/photo-1503944583220-79d8926ad5e2?auto=format&fit=crop&q=80&w=1600", title: "Kids Fashion", subtitle: "Comfortable and stylish for your little ones", cta: "Shop Kids", offer: "Buy 2 Get 1 Free", category: "Kids" },
];

const CATEGORY_MODAL_DATA = {
  'Men': {
    title: "Men's Fashion", items: [
      { name: 'T-Shirts', image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&q=80&w=400', category: 'Men' },
      { name: 'Shirts', image: 'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?auto=format&fit=crop&q=80&w=400', category: 'Men' },
      { name: 'Jeans', image: 'https://images.unsplash.com/photo-1542272604-787c3835535d?auto=format&fit=crop&q=80&w=400', category: 'Men' },
      { name: 'Hoodies', image: 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?auto=format&fit=crop&q=80&w=400', category: 'Men' },
      { name: 'Jackets', image: 'https://images.unsplash.com/photo-1551028719-00167b16eac5?auto=format&fit=crop&q=80&w=400', category: 'Men' },
      { name: 'Footwear', image: 'https://images.unsplash.com/photo-1460353581641-37baddab0fa2?auto=format&fit=crop&q=80&w=400', category: 'Men' },
    ]
  },
  'Women': {
    title: "Women's Fashion", items: [
      { name: 'Dresses', image: 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?auto=format&fit=crop&q=80&w=400', category: 'Women' },
      { name: 'Tops', image: 'https://images.unsplash.com/photo-1564859228273-274232fdb516?auto=format&fit=crop&q=80&w=400', category: 'Women' },
      { name: 'Jeans', image: 'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?auto=format&fit=crop&q=80&w=400', category: 'Women' },
      { name: 'Kurtas', image: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&q=80&w=400', category: 'Women' },
      { name: 'Handbags', image: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&q=80&w=400', category: 'Women' },
      { name: 'Footwear', image: 'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?auto=format&fit=crop&q=80&w=400', category: 'Women' },
    ]
  },
  'Kids': {
    title: "Kids Fashion", items: [
      { name: 'Boys T-Shirts', image: 'https://images.unsplash.com/photo-1519238263530-99bdd11df2ea?auto=format&fit=crop&q=80&w=400', category: 'Kids' },
      { name: 'Girls Dresses', image: 'https://images.unsplash.com/photo-1518831959646-742c3a14ebf7?auto=format&fit=crop&q=80&w=400', category: 'Kids' },
      { name: 'Boys Jeans', image: 'https://images.unsplash.com/photo-1503944583220-79d8926ad5e2?auto=format&fit=crop&q=80&w=400', category: 'Kids' },
      { name: 'Ethnic Wear', image: 'https://images.unsplash.com/photo-1514090458221-65bb69cf63e6?auto=format&fit=crop&q=80&w=400', category: 'Kids' },
    ]
  },
  'Footwear': {
    title: "Footwear", items: [
      { name: 'Sports Shoes', image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&q=80&w=400', category: 'Footwear' },
      { name: 'Casual Shoes', image: 'https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&q=80&w=400', category: 'Footwear' },
      { name: 'Formal Shoes', image: 'https://images.unsplash.com/photo-1533867617858-e7b97e060509?auto=format&fit=crop&q=80&w=400', category: 'Footwear' },
      { name: 'Sneakers', image: 'https://images.unsplash.com/photo-1460353581641-37baddab0fa2?auto=format&fit=crop&q=80&w=400', category: 'Footwear' },
      { name: 'Sandals', image: 'https://images.unsplash.com/photo-1603487742131-4160ec999306?auto=format&fit=crop&q=80&w=400', category: 'Footwear' },
      { name: 'Heels', image: 'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?auto=format&fit=crop&q=80&w=400', category: 'Footwear' },
    ]
  },
  'Accessories': {
    title: "Accessories", items: [
      { name: 'Watches', image: 'https://images.unsplash.com/photo-1523170335258-f5ed11844a49?auto=format&fit=crop&q=80&w=400', category: 'Accessories' },
      { name: 'Sunglasses', image: 'https://images.unsplash.com/photo-1511499767150-a48a237f0083?auto=format&fit=crop&q=80&w=400', category: 'Accessories' },
      { name: 'Handbags', image: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&q=80&w=400', category: 'Accessories' },
      { name: 'Jewelry', image: 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&q=80&w=400', category: 'Accessories' },
      { name: 'Belts', image: 'https://images.unsplash.com/photo-1624222247344-550fb60583bb?auto=format&fit=crop&q=80&w=400', category: 'Accessories' },
    ]
  },
};

const DEFAULT_PRODUCTS = [
  { id: 1, name: "Classic Cotton T-Shirt", category: "Men", subCategory: "T-Shirts", price: 1, displayPrice: "₹1", originalPrice: "₹799", image: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&q=80&w=800", images: ["https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&q=80&w=800", "https://images.unsplash.com/photo-1617127365659-c47fa864d8bc?auto=format&fit=crop&q=80&w=800"], description: "Premium quality cotton t-shirt with comfortable fit.", badge: "Bestseller", features: ["100% Cotton", "Breathable", "Machine Washable", "Comfortable Fit"], colors: ["Black", "White", "Navy", "Gray"], sizes: { S: { price: 1, stock: 25 }, M: { price: 1, stock: 30 }, L: { price: 1, stock: 20 }, XL: { price: 1, stock: 15 }, XXL: { price: 1, stock: 10 } } },
  { id: 2, name: "Slim Fit Denim Jeans", category: "Men", subCategory: "Jeans", price: 1, displayPrice: "₹1", originalPrice: "₹1,999", image: "https://images.unsplash.com/photo-1542272604-787c3835535d?auto=format&fit=crop&q=80&w=800", images: ["https://images.unsplash.com/photo-1542272604-787c3835535d?auto=format&fit=crop&q=80&w=800"], description: "Stylish slim fit jeans with stretch fabric.", badge: "New", features: ["Stretch Denim", "Slim Fit", "5 Pockets", "Durable"], colors: ["Blue", "Black", "Gray"], sizes: { "28": { price: 1, stock: 12 }, "30": { price: 1, stock: 18 }, "32": { price: 1, stock: 22 }, "34": { price: 1, stock: 20 }, "36": { price: 1, stock: 15 }, "38": { price: 1, stock: 10 } } },
  { id: 3, name: "Casual Hoodie", category: "Men", subCategory: "Hoodies", price: 1, displayPrice: "₹1", originalPrice: "₹1,499", image: "https://images.unsplash.com/photo-1556821840-3a63f95609a7?auto=format&fit=crop&q=80&w=800", images: ["https://images.unsplash.com/photo-1556821840-3a63f95609a7?auto=format&fit=crop&q=80&w=800"], description: "Comfortable hoodie with soft fleece lining.", badge: "Sale", features: ["Fleece Lining", "Kangaroo Pocket", "Adjustable Hood", "Warm"], colors: ["Black", "Gray", "Navy", "Red"], sizes: { S: { price: 1, stock: 10 }, M: { price: 1, stock: 15 }, L: { price: 1, stock: 12 }, XL: { price: 1, stock: 8 }, XXL: { price: 1, stock: 5 } } },
  { id: 4, name: "Floral Print Dress", category: "Women", subCategory: "Dresses", price: 1, displayPrice: "₹1", originalPrice: "₹2,499", image: "https://images.unsplash.com/photo-1595777457583-95e059d581b8?auto=format&fit=crop&q=80&w=800", images: ["https://images.unsplash.com/photo-1595777457583-95e059d581b8?auto=format&fit=crop&q=80&w=800"], description: "Beautiful floral print dress for summer.", badge: "Popular", features: ["Floral Print", "Breathable", "Comfortable", "Summer Wear"], colors: ["Pink", "White", "Beige"], sizes: { S: { price: 1, stock: 20 }, M: { price: 1, stock: 25 }, L: { price: 1, stock: 15 }, XL: { price: 1, stock: 10 }, XXL: { price: 1, stock: 5 } } },
  { id: 5, name: "Designer Kurti", category: "Women", subCategory: "Kurtis", price: 1, displayPrice: "₹1", originalPrice: "₹1,299", image: "https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&q=80&w=800", images: ["https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&q=80&w=800"], description: "Elegant designer kurti with embroidery work.", badge: null, features: ["Embroidery Work", "Cotton", "Comfortable", "Ethnic Wear"], colors: ["White", "Pink", "Beige", "Blue"], sizes: { S: { price: 1, stock: 18 }, M: { price: 1, stock: 22 }, L: { price: 1, stock: 16 }, XL: { price: 1, stock: 12 }, XXL: { price: 1, stock: 8 } } },
  { id: 6, name: "Women's Skinny Jeans", category: "Women", subCategory: "Jeans", price: 1, displayPrice: "₹1", originalPrice: "₹1,899", image: "https://images.unsplash.com/photo-1541099649105-f69ad21f3246?auto=format&fit=crop&q=80&w=800", images: ["https://images.unsplash.com/photo-1541099649105-f69ad21f3246?auto=format&fit=crop&q=80&w=800"], description: "Trendy skinny jeans with perfect stretch fit.", badge: null, features: ["Skinny Fit", "Stretch", "High Waist", "Stylish"], colors: ["Blue", "Black", "Gray"], sizes: { "28": { price: 1, stock: 10 }, "30": { price: 1, stock: 16 }, "32": { price: 1, stock: 20 }, "34": { price: 1, stock: 18 }, "36": { price: 1, stock: 12 }, "38": { price: 1, stock: 8 } } },
  { id: 7, name: "Kids Graphic T-Shirt", category: "Kids", subCategory: "T-Shirts", price: 1, displayPrice: "₹1", originalPrice: "₹699", image: "https://images.unsplash.com/photo-1519238263530-99bdd11df2ea?auto=format&fit=crop&q=80&w=800", images: ["https://images.unsplash.com/photo-1519238263530-99bdd11df2ea?auto=format&fit=crop&q=80&w=800"], description: "Fun graphic t-shirt for kids.", badge: "Trending", features: ["Soft Cotton", "Vibrant Print", "Durable"], colors: ["Red", "Blue", "Green", "White"], sizes: { S: { price: 1, stock: 30 }, M: { price: 1, stock: 35 }, L: { price: 1, stock: 25 }, XL: { price: 1, stock: 20 }, XXL: { price: 1, stock: 15 } } },
  { id: 8, name: "Kids Denim Shorts", category: "Kids", subCategory: "Shorts", price: 1, displayPrice: "₹1", originalPrice: "₹999", image: "https://images.unsplash.com/photo-1503944583220-79d8926ad5e2?auto=format&fit=crop&q=80&w=800", images: ["https://images.unsplash.com/photo-1503944583220-79d8926ad5e2?auto=format&fit=crop&q=80&w=800"], description: "Comfortable denim shorts for active kids.", badge: null, features: ["Denim", "Adjustable Waist", "Pockets", "Durable"], colors: ["Blue", "Black"], sizes: { S: { price: 1, stock: 20 }, M: { price: 1, stock: 25 }, L: { price: 1, stock: 18 }, XL: { price: 1, stock: 12 }, XXL: { price: 1, stock: 8 } } },
  { id: 9, name: "Running Shoes", category: "Footwear", subCategory: "Sports Shoes", price: 1, displayPrice: "₹1", originalPrice: "₹3,499", image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&q=80&w=800", images: ["https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&q=80&w=800"], description: "Lightweight running shoes with excellent cushioning.", badge: "Comfort", features: ["Lightweight", "Cushioned", "Breathable", "Anti-Slip"], colors: ["Black", "White", "Blue", "Red"], sizes: { S: { price: 1, stock: 12 }, M: { price: 1, stock: 15 }, L: { price: 1, stock: 10 }, XL: { price: 1, stock: 8 }, XXL: { price: 1, stock: 5 } } },
  { id: 10, name: "Casual Sneakers", category: "Footwear", subCategory: "Sneakers", price: 1, displayPrice: "₹1", originalPrice: "₹2,799", image: "https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&q=80&w=800", images: ["https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&q=80&w=800"], description: "Stylish casual sneakers for everyday wear.", badge: null, features: ["Casual Style", "Comfortable", "Durable", "Trendy"], colors: ["White", "Black", "Navy"], sizes: { S: { price: 1, stock: 10 }, M: { price: 1, stock: 14 }, L: { price: 1, stock: 12 }, XL: { price: 1, stock: 8 }, XXL: { price: 1, stock: 4 } } },
  { id: 11, name: "Leather Watch", category: "Accessories", subCategory: "Watches", price: 1, displayPrice: "₹1", originalPrice: "₹4,999", image: "https://images.unsplash.com/photo-1523170335258-f5ed11844a49?auto=format&fit=crop&q=80&w=800", images: ["https://images.unsplash.com/photo-1523170335258-f5ed11844a49?auto=format&fit=crop&q=80&w=800"], description: "Premium leather strap watch with elegant design.", badge: "Premium", features: ["Leather Strap", "Water Resistant", "Elegant", "1 Year Warranty"], colors: ["Brown", "Black"], sizes: { S: { price: 1, stock: 8 }, M: { price: 1, stock: 10 }, L: { price: 1, stock: 6 }, XL: { price: 1, stock: 4 }, XXL: { price: 1, stock: 2 } } },
  { id: 12, name: "Designer Handbag", category: "Accessories", subCategory: "Handbags", price: 1, displayPrice: "₹1", originalPrice: "₹3,499", image: "https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&q=80&w=800", images: ["https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&q=80&w=800"], description: "Stylish designer handbag with multiple compartments.", badge: null, features: ["Multiple Compartments", "Durable", "Stylish", "Spacious"], colors: ["Black", "Brown", "Beige"], sizes: { S: { price: 1, stock: 6 }, M: { price: 1, stock: 8 }, L: { price: 1, stock: 5 }, XL: { price: 1, stock: 3 }, XXL: { price: 1, stock: 2 } } },
];

const PRODUCTS = [...DEFAULT_PRODUCTS];
window.PRODUCTS = PRODUCTS;
