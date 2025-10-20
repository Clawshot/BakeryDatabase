from flask import Flask, request, jsonify, send_from_directory
import sqlite3, json
from datetime import datetime
from pathlib import Path

APP_ROOT = Path(__file__).parent.resolve()
DB_PATH = APP_ROOT / "db.sqlite3"

app = Flask(
    __name__,
    static_folder=str(APP_ROOT),   # serve index.html, style.css, script.js
    static_url_path=""             # so /style.css works
)

# Simple product catalog (server is the source of truth for price)
CATALOG = {
    # Pastries
    "relampago": {"name": "Relámpago", "price": 3.50},
    "brownie":   {"name": "Brownie",   "price": 2.75},
    "cookie":    {"name": "Cookie",    "price": 1.25},
    "tartaleta": {"name": "Tartaleta", "price": 4.00},

    # Drinks
    "capuchino": {"name": "Capuchino", "price": 2.50},
    "latte":     {"name": "Latte",     "price": 3.00},
    "espresso":  {"name": "Espresso",  "price": 2.00},
    "cake": {"name": "Custom Cake", "price": None},  # price computed from options
}

def price_for_cake(options: dict) -> float:
    """Compute a cake's unit price based on selected options."""
    # Base prices per size (tweak as you like)
    base_prices = {'6"': 20.0, '8"': 30.0, '10"': 45.0}
    size = (options.get("size") or "").strip()
    price = base_prices.get(size, 0.0)

    # Optional surcharges
    message = (options.get("message") or "").strip()
    if message:
        price += 0.0  # e.g., add 2.0 if you want to charge for a custom message

    return round(price, 2)

def cake_label(options: dict) -> str:
    """Human-friendly label for the DB 'Contenido' field."""
    size = options.get("size", "?")
    flavor = options.get("flavor", "?")
    frosting = options.get("frosting", "?")
    message = (options.get("message") or "").strip()
    label = f'Cake ({size}, {flavor}, {frosting}'
    if message:
        label += f', "{message}"'
    label += ')'
    return label




def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS Ventas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            FechayHora TEXT NOT NULL,
            Contenido  TEXT NOT NULL,   -- JSON of items
            Total      REAL NOT NULL
        )
    """)
    conn.commit()
    conn.close()

@app.get("/")
def index():
    # Serve the front-end
    return send_from_directory(app.static_folder, "index.html")

@app.post("/api/buy")
def api_buy():
    """
    Expected JSON from the front end:
    {
      "items": [
        { "id": "relampago", "qty": 2 },
        { "id": "cake", "qty": 1, "options": {
            "size": "8\"",
            "flavor": "Chocolate",
            "frosting": "Vanilla",
            "message": "Feliz cumple!"
        }}
      ]
    }
    """
    data = request.get_json(silent=True) or {}
    raw_items = data.get("items", [])
    if not isinstance(raw_items, list) or not raw_items:
        return jsonify({"ok": False, "error": "Empty or invalid items"}), 400

    items_for_receipt = []   # detailed lines for receipt (name, price, qty, subtotal, options)
    simplified = {}          # compact version for DB 'Contenido' (name/label -> qty)
    total = 0.0

    for entry in raw_items:
        if not isinstance(entry, dict):
            return jsonify({"ok": False, "error": "Invalid item format"}), 400

        pid = str(entry.get("id", "")).strip()
        try:
            qty = int(entry.get("qty", 0))
        except Exception:
            return jsonify({"ok": False, "error": f"Invalid quantity for {pid}"}), 400

        if qty <= 0:
            return jsonify({"ok": False, "error": f"Invalid quantity for {pid}"}), 400

        # ---- Handle cakes (computed price) vs regular catalog items
        if pid == "cake":
            options = entry.get("options") or {}
            unit_price = price_for_cake(options)
            name = CATALOG["cake"]["name"]  # "Custom Cake"
            label = cake_label(options)     # human-friendly label for DB
        else:
            if pid not in CATALOG:
                return jsonify({"ok": False, "error": f"Invalid item id: {pid}"}), 400
            product = CATALOG[pid]
            name = product["name"]
            unit_price = float(product["price"])
            options = None
            label = name  # regular items use their product name as label

        line_total = round(unit_price * qty, 2)
        total += line_total

        # Build detailed line (useful for receipts/exports)
        items_for_receipt.append({
            "id": pid,
            "name": name,
            "price": unit_price,
            "qty": qty,
            "subtotal": line_total,
            "options": options
        })

        # Build simplified mapping for DB: label -> qty (aggregate same labels)
        simplified[label] = simplified.get(label, 0) + qty

    # Persist the sale
    now = datetime.now().isoformat(timespec="seconds")
    contenido_json = json.dumps(simplified, ensure_ascii=False)  # 👈 compact & readable
    total = round(total, 2)

    conn = get_db()
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO Ventas (FechayHora, Contenido, Total) VALUES (?, ?, ?)",
        (now, contenido_json, total)
    )
    conn.commit()
    order_id = cur.lastrowid
    conn.close()

    # Return a minimal receipt; you can also return items_for_receipt if you want
    return jsonify({"ok": True, "order_id": order_id, "total": total}), 201


if __name__ == "__main__":
    init_db()
    app.run(debug=True)
