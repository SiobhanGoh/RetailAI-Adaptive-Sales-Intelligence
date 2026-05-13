import pandas as pd


COLUMN_PATTERNS = {
    "sales": [
        "sales", "sale", "revenue", "amount", "total", "total_amount",
        "order_value", "price", "selling_price", "net_sales"
    ],
    "date": [
        "order_date", "date", "transaction_date", "invoice_date",
        "purchase_date", "sales_date"
    ],
    "product": [
        "product_name", "product", "item", "item_name", "title", "product_title"
    ],
    "product_id": [
        "product_id", "sku", "asin", "item_id"
    ],
    "customer": [
        "customer_id", "buyer_id", "user_id", "client_id"
    ],
    "order": [
        "order_id", "invoice_id", "transaction_id", "receipt_id"
    ],
    "category": [
        "category", "main_category", "department", "product_category"
    ],
    "subcategory": [
        "sub_category", "subcategory", "sub_category_name"
    ],
    "region": [
        "region", "area", "zone"
    ],
    "segment": [
        "segment", "customer_segment"
    ],
    "state": [
        "state", "province"
    ],
    "ship_date": [
        "ship_date", "shipping_date", "delivery_date"
    ],
}


def find_column(df, column_type):
    cols = list(df.columns)
    patterns = COLUMN_PATTERNS.get(column_type, [])

    for pattern in patterns:
        if pattern in cols:
            return pattern

    for col in cols:
        for pattern in patterns:
            if pattern in col:
                return col

    return None


def detect_column_map(df):
    return {
        "sales_col": find_column(df, "sales"),
        "date_col": find_column(df, "date"),
        "product_col": find_column(df, "product"),
        "product_id_col": find_column(df, "product_id"),
        "customer_col": find_column(df, "customer"),
        "order_col": find_column(df, "order"),
        "category_col": find_column(df, "category"),
        "subcategory_col": find_column(df, "subcategory"),
        "region_col": find_column(df, "region"),
        "segment_col": find_column(df, "segment"),
        "state_col": find_column(df, "state"),
        "ship_date_col": find_column(df, "ship_date"),
    }


def detect_capabilities(column_map):
    has_sales = column_map["sales_col"] is not None
    has_date = column_map["date_col"] is not None
    has_product = column_map["product_col"] is not None
    has_customer = column_map["customer_col"] is not None
    has_category = column_map["category_col"] is not None

    return {
        "has_sales": has_sales,
        "has_date": has_date,
        "has_product": has_product,
        "has_customer": has_customer,
        "has_category": has_category,
        "can_overview": has_sales,
        "can_business_analysis": has_sales,
        "can_forecast": has_sales and has_date,
        "can_recommend": has_product,
        "can_advanced_recommend": has_product and has_customer,
    }


def detect_dataset_mode(capabilities):
    if (
        capabilities["has_sales"]
        and capabilities["has_date"]
        and capabilities["has_product"]
        and capabilities["has_customer"]
    ):
        return "full_transaction"

    if capabilities["has_sales"] and capabilities["has_date"]:
        return "time_based"

    if capabilities["has_sales"] and (
        capabilities["has_product"] or capabilities["has_category"]
    ):
        return "category_product"

    if capabilities["has_sales"]:
        return "basic_sales"

    if capabilities["has_product"]:
        return "product_catalog"

    return "unsupported"


def standardize_detected_columns(df, column_map):
    df = df.copy()

    rename_map = {}

    if column_map["sales_col"]:
        rename_map[column_map["sales_col"]] = "Sales"

    if column_map["date_col"]:
        rename_map[column_map["date_col"]] = "Order_Date"

    if column_map["ship_date_col"]:
        rename_map[column_map["ship_date_col"]] = "Ship_Date"

    if column_map["product_col"]:
        rename_map[column_map["product_col"]] = "Product_Name"

    if column_map["product_id_col"]:
        rename_map[column_map["product_id_col"]] = "Product_ID"

    if column_map["customer_col"]:
        rename_map[column_map["customer_col"]] = "Customer_ID"

    if column_map["order_col"]:
        rename_map[column_map["order_col"]] = "Order_ID"

    if column_map["category_col"]:
        rename_map[column_map["category_col"]] = "Category"

    if column_map["subcategory_col"]:
        rename_map[column_map["subcategory_col"]] = "Sub_Category"

    if column_map["region_col"]:
        rename_map[column_map["region_col"]] = "Region"

    if column_map["segment_col"]:
        rename_map[column_map["segment_col"]] = "Segment"

    if column_map["state_col"]:
        rename_map[column_map["state_col"]] = "State"

    df.rename(columns=rename_map, inplace=True)

    return df