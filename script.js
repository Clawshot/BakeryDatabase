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

// Pricing for cakes (you can tweak)
const CAKE_PRICES = {
  "Vainilla":   { 'Pequeno': 300, 'Mediano': 430, 'Cuadrado': 590, 'Grande': 770 },
  "Chocolate": { 'Pequeno': 370, 'Mediano': 510, 'Cuadrado': 690, 'Grande': 900 },
  "Fruta":{ 'Pequeno': 390, 'Mediano': 570, 'Cuadrado': 750, 'Grande': 900 },
  "Mantequilla":{ 'Pequeno': 18.00, 'Mediano': 530, 'Cuadrado': 720, 'Grande': 55.00 },
  "Tres Leches":{ 'Pequeno': 0, 'Mediano': 200, 'Cuadrado': 0, 'Grande': 480 },
};


// Grab modal elements
const cakeEls = {
  modal: document.getElementById('cakeModal'),
  form: document.getElementById('cakeForm'),
  size: document.getElementById('cakeSize'),
  flavor: document.getElementById('cakeFlavor'),
  frosting: document.getElementById('cakeFrosting'),
  message: document.getElementById('cakeMessage'),
  qty: document.getElementById('cakeQty'),
  cancel: document.getElementById('cakeCancel'),
  pricePreview: document.getElementById('cakePricePreview'),
};

function cakeUnitPrice(opts) {
  const flavorTable = CAKE_PRICES[opts.flavor];
  if (!flavorTable) return 0;

  let base = flavorTable[opts.size] ?? 0;

  if (opts.message) base += MESSAGE_SURCHARGE;
  // if (FROSTING_SURCHARGE?.[opts.frosting]) base += FROSTING_SURCHARGE[opts.frosting];

  return base;
}



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

function openCakeModal(prefill = {}) {
  // reset first
  cakeEls.form.reset();

  // lock in the flavor coming from the clicked button
  if (prefill.flavor) {
    cakeEls.flavor.value = prefill.flavor;
  }

  // If you want to make flavor truly immutable, disable it (even though it's hidden)
  cakeEls.flavor.disabled = true;

  updateCakePreview();
  if (typeof cakeEls.modal.showModal === 'function') {
    cakeEls.modal.showModal();
  } else {
    cakeEls.modal.setAttribute('open', 'open');
  }
}

function closeCakeModal() {
  if (typeof cakeEls.modal.close === 'function') {
    cakeEls.modal.close();
  } else {
    cakeEls.modal.removeAttribute('open');
  }
}


function updateCakePreview() {
  const opts = {
    size: cakeEls.size.value,
    flavor: cakeEls.flavor.value,   // preselected when opening modal
    frosting: cakeEls.frosting?.value || '',
    message: cakeEls.message?.value || '',
  };
  const unit = cakeUnitPrice(opts);
  const qty = Math.max(1, parseInt(cakeEls.qty.value || '1', 10));
  cakeEls.pricePreview.textContent = `${currency(unit)} each — ${currency(unit * qty)} total`;
}




function updateCakePreview() {
  const opts = {
    size: cakeEls.size.value,
    flavor: cakeEls.flavor.value,
    frosting: cakeEls.frosting.value,
    message: cakeEls.message.value || '',
  };
  const unit = cakeUnitPrice(opts);
  const qty = Math.max(1, parseInt(cakeEls.qty.value || '1', 10));
  cakeEls.pricePreview.textContent = `${currency(unit * qty)} total`;
}

// Keep preview updated as inputs change
['change', 'input'].forEach(ev => {
  cakeEls.size.addEventListener(ev, updateCakePreview);
  cakeEls.flavor.addEventListener(ev, updateCakePreview);
  cakeEls.frosting.addEventListener(ev, updateCakePreview);
  cakeEls.message.addEventListener(ev, updateCakePreview);
  cakeEls.qty.addEventListener(ev, updateCakePreview);
});

// Cancel
cakeEls.cancel.addEventListener('click', (e) => {
  e.preventDefault();
  closeCakeModal();
});

// Submit ("Add to Cart")
cakeEls.form.addEventListener('submit', (e) => {
  e.preventDefault();

  const opts = {
    size: cakeEls.size.value,
    flavor: cakeEls.flavor.value,         // locked from the button
    frosting: cakeEls.frosting?.value || '',
    message: (cakeEls.message?.value || '').trim(),
  };
  const qty = Math.max(1, parseInt(cakeEls.qty.value || '1', 10));
  const unit = cakeUnitPrice(opts);

  const pretty = `Cake (${opts.size}, ${opts.flavor}${
    opts.frosting ? `, ${opts.frosting}` : ''
  }${opts.message ? `, “${opts.message}”` : ''})`;

  const uniqueId = `cake-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;

  cart[uniqueId] = {
    id: uniqueId,
    baseId: 'cake',
    name: pretty,
    price: unit,
    qty,
    options: opts,
  };

  renderCart();
  closeCakeModal();
});



els.productButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    const id = btn.dataset.id;

    // If it's a cake flavor button, open modal with that flavor pre-selected
    if (id === 'cake' && btn.dataset.flavor) {
      const flavor = btn.dataset.flavor; // e.g., "Vanilla"
      openCakeModal({ flavor });
      return;
    }

    // Regular products (non-cake)
    const name = btn.dataset.name;
    const price = parseFloat(btn.dataset.price);
    addItem({ id, name, price });
  });
});



els.clearBtn.addEventListener('click', clearCart);

els.buyBtn.addEventListener('click', async () => {
  const items = cartItems();
  if (items.length === 0) return;

  const payload = {
    items: items.map(it => {
      const baseId = it.baseId || it.id; // 'cake' for custom cakes, or the normal id
      const line = { id: baseId, qty: it.qty };
      if (it.options) line.options = it.options; // include customizations
      return line;
    })
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
      `Order placed \nOrder #${data.order_id}\nTotal: $${data.total.toFixed(2)}`
    );
    clearCart();
  } catch (err) {
    console.error(err);
    alert(`Could not place order: ${err.message}`);
  } finally {
    els.buyBtn.textContent = 'Buy';
    renderCart();
  }
});



// Initial render
renderCart();
