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
}


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
    Expected JSON:
    {
      "items": [
        {"id": "relampago", "qty": 2},
        {"id": "cookie", "qty": 3}
      ]
    }
    """
    data = request.get_json(silent=True) or {}
    raw_items = data.get("items", [])

    if not isinstance(raw_items, list) or not raw_items:
        return jsonify({"ok": False, "error": "Empty or invalid items"}), 400

    # Normalize + validate
    items = []
    total = 0.0

    for entry in raw_items:
        if not isinstance(entry, dict):
            return jsonify({"ok": False, "error": "Invalid item format"}), 400

        pid = str(entry.get("id", "")).strip()
        qty = int(entry.get("qty", 0))

        if pid not in CATALOG or qty <= 0:
            return jsonify({"ok": False, "error": f"Invalid item: {pid} x {qty}"}), 400

        name = CATALOG[pid]["name"]
        price = float(CATALOG[pid]["price"])
        line_total = price * qty
        total += line_total

        items.append({
            "id": pid, "name": name, "price": price, "qty": qty,
            "subtotal": round(line_total, 2)
        })

    # Persist the sale
    now = datetime.now().isoformat(timespec="seconds")
    # Make it simpler before saving
    contenido_json = json.dumps({item["name"]: item["qty"] for item in items}, ensure_ascii=False)


    conn = get_db()
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO Ventas (FechayHora, Contenido, Total) VALUES (?, ?, ?)",
        (now, contenido_json, round(total, 2))
    )
    conn.commit()
    order_id = cur.lastrowid
    conn.close()

    return jsonify({"ok": True, "order_id": order_id, "total": round(total, 2)}), 201

if __name__ == "__main__":
    init_db()
    app.run(debug=True)
