
import sqlite3
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation


@dataclass
class Product:
    id: int
    sku: str
    name: str
    price: Decimal
    quantity: int
    low_stock_threshold: int


class InventoryManager:
    def __init__(self, database="inventory.db"):
        self.connection = sqlite3.connect(database)
        self.connection.row_factory = sqlite3.Row
        self.create_table()

    def create_table(self):
        with self.connection:
            self.connection.execute("""
                CREATE TABLE IF NOT EXISTS products (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    sku TEXT NOT NULL UNIQUE,
                    name TEXT NOT NULL,
                    price_cents INTEGER NOT NULL CHECK(price_cents >= 0),
                    quantity INTEGER NOT NULL CHECK(quantity >= 0),
                    low_stock_threshold INTEGER NOT NULL
                        CHECK(low_stock_threshold >= 0)
                )
            """)

    @staticmethod
    def row_to_product(row):
        return Product(
            id=row["id"],
            sku=row["sku"],
            name=row["name"],
            price=Decimal(row["price_cents"]) / Decimal(100),
            quantity=row["quantity"],
            low_stock_threshold=row["low_stock_threshold"],
        )
        
    def add_product(self, sku, name, price, quantity, threshold=5):
        sku = sku.strip().upper()
        name = name.strip()

        if not sku or not name:
            raise ValueError("SKU and name are required.")

        try:
            price = Decimal(str(price))
        except (InvalidOperation, ValueError):
            raise ValueError("Enter a valid price.") from None

        if not price.is_finite() or price < 0:
            raise ValueError("Price must be finite and non-negative.")

        if price.as_tuple().exponent < -2:
            raise ValueError("Price can have at most 2 decimal places.")

        if isinstance(quantity, bool) or not isinstance(quantity, int):
            raise ValueError("Quantity must be a whole number.")

        if isinstance(threshold, bool) or not isinstance(threshold, int):
            raise ValueError("Threshold must be a whole number.")

        if quantity < 0 or threshold < 0:
            raise ValueError("Quantity and threshold cannot be negative.")

        price_cents = int(price * 100)

        with self.connection:
            cursor = self.connection.execute("""
                INSERT INTO products
                    (sku, name, price_cents, quantity, low_stock_threshold)
                VALUES (?, ?, ?, ?, ?)
            """, (sku, name, price_cents, quantity, threshold))

        return cursor.lastrowid

    def get_all_products(self):
        rows = self.connection.execute(
            "SELECT * FROM products ORDER BY name"
        ).fetchall()
        return [self.row_to_product(row) for row in rows]

    def get_product(self, product_id):
        row = self.connection.execute(
            "SELECT * FROM products WHERE id = ?", (product_id,)
        ).fetchone()

        return self.row_to_product(row) if row else None

    def search_products(self, search_term):
        term = f"%{search_term.strip()}%"
        rows = self.connection.execute("""
            SELECT * FROM products
            WHERE name LIKE ? OR sku LIKE ?
            ORDER BY name
        """, (term, term)).fetchall()

        return [self.row_to_product(row) for row in rows]

    def update_product(
        self, product_id, name, price, quantity, threshold
    ):
        if self.get_product(product_id) is None:
            raise ValueError("Product not found.")

        # Reuse validation rules for updated values.
        name = name.strip()
        if not name:
            raise ValueError("Name is required.")

        try:
            price = Decimal(str(price))
        except (InvalidOperation, ValueError):
            raise ValueError("Enter a valid price.") from None

        if (
            not price.is_finite()
            or price < 0
            or price.as_tuple().exponent < -2
        ):
            raise ValueError("Enter a non-negative price with at most 2 decimals.")

        if (
            isinstance(quantity, bool)
            or not isinstance(quantity, int)
            or quantity < 0
            or isinstance(threshold, bool)
            or not isinstance(threshold, int)
            or threshold < 0
        ):
            raise ValueError("Stock and threshold must be non-negative integers.")

        with self.connection:
            self.connection.execute("""
                UPDATE products
                SET name = ?, price_cents = ?, quantity = ?,
                    low_stock_threshold = ?
                WHERE id = ?
            """, (name, int(price * 100), quantity, threshold, product_id))

    def delete_product(self, product_id):
        with self.connection:
            cursor = self.connection.execute(
                "DELETE FROM products WHERE id = ?", (product_id,)
            )

        if cursor.rowcount == 0:
            raise ValueError("Product not found.")

    def get_low_stock_products(self):
        rows = self.connection.execute("""
            SELECT * FROM products
            WHERE quantity <= low_stock_threshold
            ORDER BY quantity, name
        """).fetchall()

        return [self.row_to_product(row) for row in rows]
    def close(self):
        self.connection.close()
