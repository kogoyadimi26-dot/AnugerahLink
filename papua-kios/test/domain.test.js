'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const d = require('../lib/domain');

function baseState() {
  return {
    products: [
      d.createProduct({ id: 'beras', name: 'Beras 5kg', unit: 'karung', price: 65000,
        stock: { Jayapura: 10, Wamena: 4, Timika: 0 } }),
      d.createProduct({ id: 'minyak', name: 'Minyak goreng 1L', unit: 'botol', price: 17000,
        stock: { Jayapura: 50, Wamena: 20, Timika: 30 } }),
    ],
    buyers: [
      d.createBuyer({ id: 'kios1', name: 'Kios Sentani', type: 'kios', hub: 'Jayapura', creditLimit: 200000 }),
      d.createBuyer({ id: 'warung2', name: 'Warung Wamena', type: 'warung', hub: 'Wamena', creditLimit: 0 }),
    ],
    orders: [],
  };
}

test('quote adds delivery fee and platform fee from the buyer hub', () => {
  const q = d.quote(baseState().products, [{ productId: 'minyak', qty: 2 }], 'Wamena');
  assert.equal(q.subtotal, 34000);
  assert.equal(q.deliveryFee, 25000);
  assert.equal(q.platformFee, Math.round(34000 * d.PLATFORM_FEE_BPS / 10000));
  assert.equal(q.total, 59000);
});

test('quote rejects stock shortfalls at the hub', () => {
  assert.throws(
    () => d.quote(baseState().products, [{ productId: 'beras', qty: 1 }], 'Timika'),
    /Stok Beras 5kg di Timika tidak cukup/,
  );
});

test('quote rejects non-integer and zero quantities', () => {
  assert.throws(() => d.quote(baseState().products, [{ productId: 'minyak', qty: 0 }], 'Jayapura'));
  assert.throws(() => d.quote(baseState().products, [{ productId: 'minyak', qty: 1.5 }], 'Jayapura'));
});

test('cash order decrements stock and is marked paid, no balance owed', () => {
  const s = d.placeOrder(baseState(), {
    buyerId: 'kios1', items: [{ productId: 'beras', qty: 3 }], paymentMethod: 'tunai',
    orderId: 'o1', createdAt: '2026-11-19T00:00:00Z',
  });
  assert.equal(s.products.find((p) => p.id === 'beras').stock.Jayapura, 7);
  assert.equal(s.orders[0].paid, true);
  assert.equal(s.buyers.find((b) => b.id === 'kios1').balance, 0);
});

test('credit order raises balance and is marked unpaid', () => {
  const s = d.placeOrder(baseState(), {
    buyerId: 'kios1', items: [{ productId: 'minyak', qty: 4 }], paymentMethod: 'kredit',
    orderId: 'o1', createdAt: 'now',
  });
  assert.equal(s.orders[0].paid, false);
  assert.equal(s.buyers.find((b) => b.id === 'kios1').balance, 68000);
});

test('credit order over the limit is refused', () => {
  assert.throws(
    () => d.placeOrder(baseState(), {
      buyerId: 'warung2', items: [{ productId: 'minyak', qty: 1 }], paymentMethod: 'kredit',
      orderId: 'o1', createdAt: 'now',
    }),
    /Melebihi batas kredit/,
  );
});

test('placeOrder does not mutate the input state', () => {
  const before = baseState();
  const snapshot = JSON.stringify(before);
  d.placeOrder(before, {
    buyerId: 'kios1', items: [{ productId: 'beras', qty: 1 }], paymentMethod: 'kredit',
    orderId: 'o1', createdAt: 'now',
  });
  assert.equal(JSON.stringify(before), snapshot);
});

test('cancelling a waiting order returns stock and reverses credit', () => {
  let s = d.placeOrder(baseState(), {
    buyerId: 'kios1', items: [{ productId: 'beras', qty: 2 }], paymentMethod: 'kredit',
    orderId: 'o1', createdAt: 'now',
  });
  s = d.setStatus(s, 'o1', 'dibatalkan');
  assert.equal(s.products.find((p) => p.id === 'beras').stock.Jayapura, 10);
  assert.equal(s.buyers.find((b) => b.id === 'kios1').balance, 0);
});

test('a dispatched order cannot be cancelled', () => {
  let s = d.placeOrder(baseState(), {
    buyerId: 'kios1', items: [{ productId: 'beras', qty: 1 }], paymentMethod: 'tunai',
    orderId: 'o1', createdAt: 'now',
  });
  s = d.setStatus(s, 'o1', 'dikirim');
  assert.throws(() => d.setStatus(s, 'o1', 'dibatalkan'), /hanya bisa dibatalkan saat masih menunggu/);
});

test('repayment reduces the balance and cannot exceed what is owed', () => {
  let s = d.placeOrder(baseState(), {
    buyerId: 'kios1', items: [{ productId: 'minyak', qty: 4 }], paymentMethod: 'kredit',
    orderId: 'o1', createdAt: 'now',
  });
  s = d.recordPayment(s, 'kios1', 20000);
  assert.equal(s.buyers.find((b) => b.id === 'kios1').balance, 48000);
  assert.throws(() => d.recordPayment(s, 'kios1', 100000), /melebihi utang/);
});

test('summary counts only live orders and sums receivables', () => {
  let s = d.placeOrder(baseState(), {
    buyerId: 'kios1', items: [{ productId: 'minyak', qty: 4 }], paymentMethod: 'kredit',
    orderId: 'o1', createdAt: 'now',
  });
  s = d.placeOrder(s, {
    buyerId: 'kios1', items: [{ productId: 'beras', qty: 1 }], paymentMethod: 'tunai',
    orderId: 'o2', createdAt: 'now',
  });
  s = d.setStatus(s, 'o2', 'dibatalkan');
  const sum = d.summary(s);
  assert.equal(sum.orderCount, 1);
  assert.equal(sum.gmv, s.orders[0].total);
  assert.equal(sum.receivables, 68000);
});

test('createBuyer and createProduct validate inputs', () => {
  assert.throws(() => d.createBuyer({ name: '', type: 'kios', hub: 'Jayapura' }), /Nama pembeli/);
  assert.throws(() => d.createBuyer({ name: 'X', type: 'pabrik', hub: 'Jayapura' }), /Jenis pembeli/);
  assert.throws(() => d.createBuyer({ name: 'X', type: 'kios', hub: 'Nabire' }), /Hub tidak dikenal/);
  assert.throws(() => d.createProduct({ name: 'X', price: 0 }), /Harga/);
});
