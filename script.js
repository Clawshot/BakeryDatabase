// --- Helpers & State ---
const currency = (n) => `$${n.toFixed(2)}`;

/** cart structure:
 * { [id]: { id, name, price, qty } }
 */
const cart = Object.create(null);

const els = {
  productButtons: document.querySelectorAll('.product-btn'),
  cartBody: document.getElementById('cartBody'),
  emptyRow: document.getElementById('emptyRow'),
  totalLabel: document.getElementById('totalLabel'),
  buyBtn: document.getElementById('buyBtn'),
  clearBtn: document.getElementById('clearBtn'),
};

// --- Cart ops ---
function addItem({ id, name, price }) {
  if (!cart[id]) cart[id] = { id, name, price, qty: 0 };
  cart[id].qty += 1;
  renderCart();
}

function updateQty(id, delta) {
  if (!cart[id]) return;
  cart[id].qty += delta;
  if (cart[id].qty <= 0) delete cart[id];
  renderCart();
}

function removeItem(id) {
  delete cart[id];
  renderCart();
}

function clearCart() {
  for (const k of Object.keys(cart)) delete cart[k];
  renderCart();
}

function cartItems() { return Object.values(cart); }

function calcTotal() {
  return cartItems().reduce((sum, it) => sum + it.price * it.qty, 0);
}

// --- Render ---
function renderCart() {
  const items = cartItems();
  els.cartBody.innerHTML = '';

  if (items.length === 0) {
    els.cartBody.appendChild(els.emptyRow);
    els.buyBtn.disabled = true;
  } else {
    els.buyBtn.disabled = false;

    for (const it of items) {
      const tr = document.createElement('tr');

      const tdName = document.createElement('td');
      tdName.textContent = it.name;

      const tdPrice = document.createElement('td');
      tdPrice.textContent = currency(it.price);

      const tdQty = document.createElement('td');
      const qtyWrap = document.createElement('div');
      qtyWrap.className = 'qty-controls';
      const minus = document.createElement('button');
      minus.className = 'icon-btn';
      minus.type = 'button';
      minus.setAttribute('aria-label', `Decrease ${it.name} quantity`);
      minus.textContent = '–';
      minus.addEventListener('click', () => updateQty(it.id, -1));
      const qty = document.createElement('span');
      qty.textContent = it.qty;
      const plus = document.createElement('button');
      plus.className = 'icon-btn';
      plus.type = 'button';
      plus.setAttribute('aria-label', `Increase ${it.name} quantity`);
      plus.textContent = '+';
      plus.addEventListener('click', () => updateQty(it.id, +1));
      qtyWrap.append(minus, qty, plus);
      tdQty.appendChild(qtyWrap);

      const tdSubtotal = document.createElement('td');
      tdSubtotal.textContent = currency(it.price * it.qty);

      const tdAction = document.createElement('td');
      const remove = document.createElement('button');
      remove.className = 'remove-btn';
      remove.type = 'button';
      remove.textContent = 'Remove';
      remove.setAttribute('aria-label', `Remove ${it.name} from cart`);
      remove.addEventListener('click', () => removeItem(it.id));
      tdAction.appendChild(remove);

      tr.append(tdName, tdPrice, tdQty, tdSubtotal, tdAction);
      els.cartBody.appendChild(tr);
    }
  }

  els.totalLabel.textContent = `Total: ${currency(calcTotal())}`;
}

// --- Wiring ---
els.productButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    const id = btn.dataset.id;
    const name = btn.dataset.name;
    const price = parseFloat(btn.dataset.price);
    addItem({ id, name, price });
  });
});

els.clearBtn.addEventListener('click', clearCart);

els.buyBtn.addEventListener('click', async () => {
  const items = cartItems();
  if (items.length === 0) return;

  // Only send what's needed. The server will validate price by ID.
  const payload = {
    items: items.map(it => ({ id: it.id, qty: it.qty }))
  };

  els.buyBtn.disabled = true;
  els.buyBtn.textContent = 'Processing...';

  try {
    const res = await fetch('/api/buy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(errText || `Request failed with ${res.status}`);
    }

    const data = await res.json();
    alert(
      `Order placed ✅\nOrder #${data.order_id}\nTotal: $${data.total.toFixed(2)}`
    );
    clearCart();
  } catch (err) {
    console.error(err);
    alert(`Could not place order: ${err.message}`);
  } finally {
    els.buyBtn.textContent = 'Buy';
    renderCart(); // this will re-enable if cart has items
  }
});


// Initial render
renderCart();
