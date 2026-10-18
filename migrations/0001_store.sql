CREATE TABLE IF NOT EXISTS items (
 id TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK(kind IN ('product','plan')), name TEXT NOT NULL,
 description TEXT NOT NULL, category TEXT NOT NULL, price_paise INTEGER NOT NULL CHECK(price_paise>0),
 stock INTEGER NOT NULL DEFAULT 0 CHECK(stock>=0), duration_days INTEGER NOT NULL DEFAULT 30,
 image_url TEXT NOT NULL DEFAULT '', external_url TEXT NOT NULL DEFAULT '', active INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS settings (id INTEGER PRIMARY KEY CHECK(id=1), value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS orders (
 id TEXT PRIMARY KEY, token TEXT NOT NULL, item_id TEXT NOT NULL REFERENCES items(id), item_name TEXT NOT NULL,
 kind TEXT NOT NULL, amount_paise INTEGER NOT NULL, duration_days INTEGER NOT NULL,
 customer_name TEXT NOT NULL, email TEXT NOT NULL, phone TEXT NOT NULL, address TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending', payment_id TEXT UNIQUE, checkout_url TEXT,
 utr TEXT UNIQUE, paid_at TEXT, membership_until TEXT, fulfillment TEXT NOT NULL DEFAULT 'unfulfilled',
 tracking_url TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS rate_limits (id TEXT PRIMARY KEY,count INTEGER NOT NULL,expires INTEGER NOT NULL);
