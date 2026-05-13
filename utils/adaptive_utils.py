# utils/adaptive_utils.py

import html
import pandas as pd
import streamlit as st


UNKNOWN_VALUES = {
    "",
    "unknown",
    "unknown product",
    "unknown customer",
    "none",
    "nan",
    "null",
    "n/a",
}


def safe_text(value):
    return html.escape(str(value))


def get_template():
    theme = st.get_option("theme.base")
    return "plotly_dark" if theme == "dark" else "plotly_white"


def clean_string_series(series):
    return series.dropna().astype(str).str.strip()


def has_useful_column(df, column):
    if df is None or column not in df.columns:
        return False

    if column in ["Order_Date", "Ship_Date"]:
        dates = pd.to_datetime(df[column], errors="coerce")
        return dates.notna().sum() > 0

    values = clean_string_series(df[column])
    values = values[~values.str.lower().isin(UNKNOWN_VALUES)]

    return values.nunique() > 0


def get_unique_count(df, column):
    if not has_useful_column(df, column):
        return 0

    values = clean_string_series(df[column])
    values = values[~values.str.lower().isin(UNKNOWN_VALUES)]

    return values.nunique()


def get_valid_date_range(df, date_col="Order_Date"):
    if df is None or date_col not in df.columns:
        return "N/A"

    dates = pd.to_datetime(df[date_col], errors="coerce").dropna()

    if dates.empty:
        return "N/A"

    return f"{dates.min().date()} → {dates.max().date()}"


def get_dataset_capability_flags(df):
    has_sales = df is not None and "Sales" in df.columns
    has_date = has_useful_column(df, "Order_Date")
    has_product = has_useful_column(df, "Product_Name")
    has_customer = has_useful_column(df, "Customer_ID")
    has_category = has_useful_column(df, "Category")
    has_region = has_useful_column(df, "Region")
    has_segment = has_useful_column(df, "Segment")
    has_state = has_useful_column(df, "State")

    return {
        "has_sales": has_sales,
        "has_date": has_date,
        "has_product": has_product,
        "has_customer": has_customer,
        "has_category": has_category,
        "has_region": has_region,
        "has_segment": has_segment,
        "has_state": has_state,
        "can_forecast": has_sales and has_date,
        "can_recommend": has_product,
        "can_hybrid_recommend": has_product and has_customer,
    }


def get_dataset_mode_label(df):
    flags = get_dataset_capability_flags(df)

    if flags["has_sales"] and flags["has_date"] and flags["has_product"] and flags["has_customer"]:
        return "Full Transaction Dataset", "🚀", "Full Transaction Mode"

    if flags["has_sales"] and flags["has_date"]:
        return "Time-Based Sales Dataset", "📅", "Time-Based Sales Mode"

    if flags["has_sales"] and (flags["has_product"] or flags["has_category"]):
        return "Category/Product Sales Dataset", "🛍", "Category/Product Sales Mode"

    if flags["has_sales"]:
        return "Basic Sales Dataset", "📊", "Basic Sales Mode"

    if flags["has_product"]:
        return "Product Catalog Dataset", "📦", "Product Catalog Mode"

    return "Limited Dataset", "🧩", "Limited Dataset Mode"


def get_top_value(df, group_col, value_col="Sales"):
    if df is None or not has_useful_column(df, group_col) or value_col not in df.columns:
        return "N/A"

    grouped = (
        df.groupby(group_col)[value_col]
        .sum()
        .sort_values(ascending=False)
    )

    grouped = grouped[~grouped.index.astype(str).str.lower().isin(UNKNOWN_VALUES)]

    if grouped.empty:
        return "N/A"

    return str(grouped.index[0])


def safe_number(value, fallback=0):
    try:
        if pd.isna(value):
            return fallback
        return value
    except Exception:
        return fallback


def format_number(value, decimals=2):
    try:
        return f"{float(value):,.{decimals}f}"
    except Exception:
        return "N/A"


def calculate_dataset_readiness_score(df):
    if df is None or df.empty:
        return 0, "No Data", "No usable dataset is currently available."

    flags = get_dataset_capability_flags(df)

    score = 0

    if flags["has_sales"]:
        score += 25

    if flags["has_date"]:
        score += 20

    if flags["has_product"]:
        score += 20

    if flags["has_customer"]:
        score += 15

    if flags["has_category"]:
        score += 10

    if flags["has_region"] or flags["has_state"]:
        score += 10

    score = min(score, 100)

    if score >= 85:
        label = "Excellent Readiness"
        desc = "This dataset supports sales analysis, forecasting, and recommendation intelligence."
    elif score >= 65:
        label = "Strong Readiness"
        desc = "This dataset supports meaningful analysis, though some advanced features may be limited."
    elif score >= 40:
        label = "Moderate Readiness"
        desc = "This dataset supports basic analysis, but richer fields would unlock stronger intelligence."
    else:
        label = "Limited Readiness"
        desc = "This dataset has limited useful fields, so only simple analysis may be available."

    return score, label, desc


def get_capability_rows(df):
    flags = get_dataset_capability_flags(df)

    return [
        {
            "label": "Sales Analytics",
            "status": "Enabled" if flags["has_sales"] else "Unavailable",
            "detail": "Requires sales, revenue, amount, or value fields.",
            "icon": "📊",
            "active": flags["has_sales"],
        },
        {
            "label": "Forecasting",
            "status": "Enabled" if flags["can_forecast"] else "Unavailable",
            "detail": "Requires sales and date history.",
            "icon": "🔮",
            "active": flags["can_forecast"],
        },
        {
            "label": "Recommendations",
            "status": "Hybrid Enabled" if flags["can_hybrid_recommend"] else "Content-Based Enabled" if flags["can_recommend"] else "Unavailable",
            "detail": "Uses product data, plus customer behaviour when available.",
            "icon": "🛒",
            "active": flags["can_recommend"],
        },
        {
            "label": "Segmentation",
            "status": "Enabled" if flags["has_category"] or flags["has_region"] or flags["has_segment"] else "Limited",
            "detail": "Uses category, region, segment, or state fields.",
            "icon": "🧩",
            "active": flags["has_category"] or flags["has_region"] or flags["has_segment"],
        },
    ]
