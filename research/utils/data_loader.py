"""Archived Python data preparation used by the research scripts (the app now runs in the browser)."""
import warnings

import pandas as pd
from utils.date_utils import parse_dates

from utils.column_mapper import (
    detect_column_map,
    detect_capabilities,
    detect_dataset_mode,
    standardize_detected_columns,
)


def normalize_columns(df):
    df = df.copy()

    df.columns = (
        df.columns
        .str.strip()
        .str.lower()
        .str.replace(" ", "_")
        .str.replace("-", "_")
        .str.replace("/", "_")
        .str.replace(".", "_")
    )

    return df


def clean_price_like_column(series):
    return (
        series
        .astype(str)
        .str.replace("RM", "", regex=False)
        .str.replace("rm", "", regex=False)
        .str.replace("₹", "", regex=False)
        .str.replace("$", "", regex=False)
        .str.replace(",", "", regex=False)
        .str.strip()
    )


def prepare_adaptive_dataset(raw_df, *, dayfirst=True, date_format=None):
    df = normalize_columns(raw_df)

    column_map = detect_column_map(df)
    capabilities = detect_capabilities(column_map)
    dataset_mode = detect_dataset_mode(capabilities)

    if dataset_mode == "unsupported":
        raise ValueError(f"Unsupported dataset: need a sales or product column. Columns: {df.columns.tolist()}")

    df = standardize_detected_columns(df, column_map)

    if "Sales" in df.columns:
        df["Sales"] = clean_price_like_column(df["Sales"])
        df["Sales"] = pd.to_numeric(df["Sales"], errors="coerce")
        df = df.dropna(subset=["Sales"])
        df = df[df["Sales"] >= 0]
    else:
        df["Sales"] = 0

    if "Order_Date" in df.columns:
        df["Order_Date"] = parse_dates(df["Order_Date"], dayfirst=dayfirst, date_format=date_format)
        invalid_dates = int(df["Order_Date"].isna().sum())
        if invalid_dates:
            warnings.warn(f"Excluded {invalid_dates:,} rows with missing or invalid order dates.")
        df = df.dropna(subset=["Order_Date"])

    if df.empty:
        raise ValueError("After cleaning, no usable rows remain.")

    if "Order_Date" not in df.columns:
        df["Order_Date"] = pd.NaT

    if "Ship_Date" not in df.columns:
        df["Ship_Date"] = df["Order_Date"]

    df["Ship_Date"] = parse_dates(df["Ship_Date"], dayfirst=dayfirst, date_format=date_format)
    df["Ship_Date"] = df["Ship_Date"].fillna(df["Order_Date"])

    if "Product_Name" not in df.columns:
        if "Category" in df.columns:
            df["Product_Name"] = df["Category"].astype(str)
        else:
            df["Product_Name"] = "Unknown Product"

    if "Product_ID" not in df.columns:
        df["Product_ID"] = df["Product_Name"].astype(str)

    if "Customer_ID" not in df.columns:
        df["Customer_ID"] = "Unknown Customer"

    if "Customer_Name" not in df.columns:
        df["Customer_Name"] = "Unknown Customer"

    if "Order_ID" not in df.columns:
        df["Order_ID"] = df.index.astype(str)

    optional_text_cols = {
        "Region": "Unknown",
        "Category": "Unknown",
        "Segment": "Unknown",
        "State": "Unknown",
        "Sub_Category": "Unknown",
    }

    for col, default_value in optional_text_cols.items():
        if col not in df.columns:
            df[col] = default_value

    df["Shipping_Days"] = (df["Ship_Date"] - df["Order_Date"]).dt.days
    df["Shipping_Days"] = df["Shipping_Days"].fillna(0)

    df["Year"] = df["Order_Date"].dt.year
    df["Month"] = df["Order_Date"].dt.month
    df["Quarter"] = df["Order_Date"].dt.quarter
    df["Weekday"] = df["Order_Date"].dt.day_name()
    df["Day_Of_Week_Num"] = df["Order_Date"].dt.dayofweek
    df["Is_Weekend"] = df["Day_Of_Week_Num"].isin([5, 6])

    avg_sales = df["Sales"].mean()

    df["Average_Order_Value_Flag"] = df["Sales"].apply(
        lambda x: "Above Average" if x >= avg_sales else "Below Average"
    )

    metadata = {
        "column_map": column_map,
        "capabilities": capabilities,
        "dataset_mode": dataset_mode,
        "dataset_type": (
            "transaction"
            if capabilities["has_sales"] and capabilities["has_date"]
            else "product_catalog"
            if capabilities["has_product"] and not capabilities["has_date"]
            else "basic_sales"
        )
    }

    return df.drop_duplicates(), metadata
