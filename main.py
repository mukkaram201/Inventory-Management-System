
from decimal import Decimal, InvalidOperation
import sqlite3

from inventory import InventoryManager


def show_products(products):
    if not products:
        print("\nNo products found.")
        return

    print("\nID | SKU | Name | Price (Rs) | Qty | Status")
    print("-" * 70)

    for product in products:
        status = (
            "LOW STOCK"
            if product.quantity <= product.low_stock_threshold
            else "OK"
        )

        print(
            f"{product.id} | {product.sku} | {product.name} | "
            f"{product.price:.2f} | {product.quantity} | {status}"
        )


def read_integer(prompt, minimum=0, default=None):
    raw_value = input(prompt).strip()
    if not raw_value and default is not None:
        return default

    try:
        value = int(raw_value)
    except ValueError:
        raise ValueError("Enter a whole number.") from None

    if value < minimum:
        raise ValueError(f"Enter a number >= {minimum}.")
    return value


def read_price(prompt):
    value = Decimal(input(prompt).strip())
    if not value.is_finite() or value < 0:
        raise ValueError("Price must be finite and non-negative.")
    if value.as_tuple().exponent < -2:
        raise ValueError("Use no more than 2 decimal places.")
    return value


def main():
    inventory = InventoryManager()

    try:
        while True:
            print("""
===== INVENTORY MANAGEMENT SYSTEM =====
1. Add product
2. View all products
3. Search products
4. Update product
5. Delete product
6. Show low-stock products
0. Exit
""")

            choice = input("Choose an option: ").strip()

            try:
                if choice == "1":
                    sku = input("SKU: ")
                    name = input("Product name: ")
                    price = read_price("Price (Rs): ")
                    quantity = read_integer("Quantity: ")
                    threshold = read_integer(
                        "Low-stock threshold (default 5): ", default=5
                    ) if input("Set custom threshold? (y/n): ").lower() == "y" else 5

                    product_id = inventory.add_product(
                        sku, name, price, quantity, threshold
                    )
                    print(f"Product added. ID: {product_id}")

                elif choice == "2":
                    show_products(inventory.get_all_products())

                elif choice == "3":
                    term = input("Search name or SKU: ")
                    show_products(inventory.search_products(term))

                elif choice == "4":
                    product_id = read_integer("Product ID: ", minimum=1)
                    product = inventory.get_product(product_id)

                    if product is None:
                        print("Product not found.")
                        continue

                    name = input(f"Name [{product.name}]: ").strip()
                    price_text = input(
                        f"Price [{product.price:.2f}]: "
                    ).strip()
                    quantity_text = input(
                        f"Quantity [{product.quantity}]: "
                    ).strip()
                    threshold_text = input(
                        f"Threshold [{product.low_stock_threshold}]: "
                    ).strip()

                    inventory.update_product(
                        product_id,
                        name or product.name,
                        Decimal(price_text) if price_text else product.price,
                        int(quantity_text) if quantity_text else product.quantity,
                        int(threshold_text) if threshold_text else product.low_stock_threshold,
                    )
                    print("Product updated.")

                elif choice == "5":
                    product_id = read_integer("Product ID: ", minimum=1)
                    confirm = input("Delete this product? (y/n): ").lower()

                    if confirm == "y":
                        inventory.delete_product(product_id)
                        print("Product deleted.")

                elif choice == "6":
                    show_products(inventory.get_low_stock_products())

                elif choice == "0":
                    print("Goodbye!")
                    break

                else:
                    print("Invalid menu option.")

            except (
                ValueError,
                InvalidOperation,
                sqlite3.IntegrityError,
                sqlite3.OperationalError,
            ) as error:
                print(f"Error: {error}")

    finally:
        inventory.close()


if __name__ == "__main__":
    main()
