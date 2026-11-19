'use strict';

// Core rules for a B2B ordering and credit app for kios, warung, schools,
// churches and offices in Papua. Pure functions over plain objects so they
// can be tested without HTTP or disk.

const HUBS = ['Jayapura', 'Wamena', 'Timika'];
const PAYMENT_METHODS = ['tunai', 'qris', 'kredit'];
const STATUSES = ['menunggu', 'dikonfirmasi', 'dikirim', 'diterima', 'dibatalkan'];
const BUYER_TYPES = ['kios', 'warung', 'sekolah', 'gereja', 'instansi'];

// Platform fee in basis points (500 = 5%). Charged on the goods subtotal.
const PLATFORM_FEE_BPS = 500;

// Flat delivery fee per hub, in IDR. Replace with real freight quotes.
const DELIVERY_FEE = { Jayapura: 0, Wamena: 25000, Timika: 15000 };

function isPositiveInt(n) {
  return Number.isInteger(n) && n > 0;
}

function bpsOf(amount, bps) {
  return Math.round((amount * bps) / 10000);
}

function createBuyer(input) {
  const name = String(input.name || '').trim();
  if (!name) throw new Error('Nama pembeli wajib diisi');
  if (!BUYER_TYPES.includes(input.type)) throw new Error('Jenis pembeli tidak dikenal');
  if (!HUBS.includes(input.hub)) throw new Error('Hub tidak dikenal');
  const creditLimit = input.creditLimit === undefined ? 0 : input.creditLimit;
  if (!Number.isInteger(creditLimit) || creditLimit < 0) {
    throw new Error('Batas kredit harus bilangan bulat, nol atau lebih');
  }
  return {
    id: input.id,
    name,
    type: input.type,
    hub: input.hub,
    phone: String(input.phone || '').trim(),
    creditLimit,
    // Outstanding credit owed by the buyer, in IDR.
    balance: 0,
  };
}

function createProduct(input) {
  const name = String(input.name || '').trim();
  if (!name) throw new Error('Nama produk wajib diisi');
  if (!isPositiveInt(input.price)) throw new Error('Harga harus bilangan bulat di atas nol');
  const stock = {};
  for (const hub of HUBS) {
    const qty = (input.stock && input.stock[hub]) || 0;
    if (!Number.isInteger(qty) || qty < 0) throw new Error('Stok harus bilangan bulat, nol atau lebih');
    stock[hub] = qty;
  }
  return { id: input.id, name, unit: input.unit || 'pcs', price: input.price, stock };
}

function quote(products, items, hub) {
  if (!HUBS.includes(hub)) throw new Error('Hub tidak dikenal');
  if (!Array.isArray(items) || items.length === 0) throw new Error('Pesanan kosong');
  const lines = items.map((item) => {
    const product = products.find((p) => p.id === item.productId);
    if (!product) throw new Error(`Produk tidak ditemukan: ${item.productId}`);
    if (!isPositiveInt(item.qty)) throw new Error('Jumlah harus bilangan bulat di atas nol');
    if (product.stock[hub] < item.qty) {
      throw new Error(`Stok ${product.name} di ${hub} tidak cukup (tersisa ${product.stock[hub]})`);
    }
    return { productId: product.id, name: product.name, unit: product.unit, qty: item.qty,
      unitPrice: product.price, lineTotal: product.price * item.qty };
  });
  const subtotal = lines.reduce((sum, l) => sum + l.lineTotal, 0);
  const deliveryFee = DELIVERY_FEE[hub];
  const platformFee = bpsOf(subtotal, PLATFORM_FEE_BPS);
  return { lines, subtotal, deliveryFee, platformFee, total: subtotal + deliveryFee };
}

// Returns the new state. Does not mutate the inputs.
function placeOrder(state, { buyerId, items, paymentMethod, orderId, createdAt }) {
  const buyer = state.buyers.find((b) => b.id === buyerId);
  if (!buyer) throw new Error('Pembeli tidak ditemukan');
  if (!PAYMENT_METHODS.includes(paymentMethod)) throw new Error('Metode pembayaran tidak dikenal');

  const q = quote(state.products, items, buyer.hub);

  if (paymentMethod === 'kredit') {
    const available = buyer.creditLimit - buyer.balance;
    if (q.total > available) {
      throw new Error(`Melebihi batas kredit. Tersedia Rp${available}, pesanan Rp${q.total}`);
    }
  }

  const products = state.products.map((p) => {
    const line = q.lines.find((l) => l.productId === p.id);
    if (!line) return p;
    return { ...p, stock: { ...p.stock, [buyer.hub]: p.stock[buyer.hub] - line.qty } };
  });
  const buyers = state.buyers.map((b) => (
    b.id === buyer.id && paymentMethod === 'kredit'
      ? { ...b, balance: b.balance + q.total }
      : b
  ));
  const order = {
    id: orderId,
    buyerId: buyer.id,
    hub: buyer.hub,
    lines: q.lines,
    subtotal: q.subtotal,
    deliveryFee: q.deliveryFee,
    platformFee: q.platformFee,
    total: q.total,
    paymentMethod,
    // Credit orders are owed; cash and QRIS are assumed settled at checkout.
    paid: paymentMethod !== 'kredit',
    status: 'menunggu',
    createdAt,
  };
  return { ...state, products, buyers, orders: [...state.orders, order] };
}

function setStatus(state, orderId, status) {
  if (!STATUSES.includes(status)) throw new Error('Status tidak dikenal');
  const order = state.orders.find((o) => o.id === orderId);
  if (!order) throw new Error('Pesanan tidak ditemukan');
  if (status === 'dibatalkan' && order.status !== 'menunggu') {
    throw new Error('Pesanan hanya bisa dibatalkan saat masih menunggu');
  }
  const orders = state.orders.map((o) => (o.id === orderId ? { ...o, status } : o));
  let { products, buyers } = state;
  if (status === 'dibatalkan') {
    // Return stock and reverse any credit owed by this order.
    products = products.map((p) => {
      const line = order.lines.find((l) => l.productId === p.id);
      if (!line) return p;
      return { ...p, stock: { ...p.stock, [order.hub]: p.stock[order.hub] + line.qty } };
    });
    if (order.paymentMethod === 'kredit' && !order.paid) {
      buyers = buyers.map((b) => (b.id === order.buyerId
        ? { ...b, balance: b.balance - order.total } : b));
    }
  }
  return { ...state, orders, products, buyers };
}

// Records a credit repayment. Cannot exceed what the buyer owes.
function recordPayment(state, buyerId, amount) {
  if (!isPositiveInt(amount)) throw new Error('Jumlah bayar harus bilangan bulat di atas nol');
  const buyer = state.buyers.find((b) => b.id === buyerId);
  if (!buyer) throw new Error('Pembeli tidak ditemukan');
  if (amount > buyer.balance) throw new Error(`Pembayaran melebihi utang (Rp${buyer.balance})`);
  const buyers = state.buyers.map((b) => (b.id === buyerId ? { ...b, balance: b.balance - amount } : b));
  return { ...state, buyers };
}

// Totals for the back office. Platform fees are counted only on orders not
// cancelled, and receivables are the sum of unpaid credit balances.
function summary(state) {
  const live = state.orders.filter((o) => o.status !== 'dibatalkan');
  return {
    orderCount: live.length,
    gmv: live.reduce((s, o) => s + o.total, 0),
    platformFees: live.reduce((s, o) => s + o.platformFee, 0),
    receivables: state.buyers.reduce((s, b) => s + b.balance, 0),
  };
}

module.exports = {
  HUBS, PAYMENT_METHODS, STATUSES, BUYER_TYPES, PLATFORM_FEE_BPS, DELIVERY_FEE,
  createBuyer, createProduct, quote, placeOrder, setStatus, recordPayment, summary,
};
