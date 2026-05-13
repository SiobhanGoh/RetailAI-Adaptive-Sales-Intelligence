import pandas as pd
import streamlit as st

from utils.column_mapper import (
    detect_column_map,
    detect_capabilities,
    detect_dataset_mode,
    standardize_detected_columns,
)


def read_uploaded_file(uploaded_file):
    try:
        file_name = uploaded_file.name.lower()

        if file_name.endswith(".csv"):
            return pd.read_csv(uploaded_file)

        if file_name.endswith((".xlsx", ".xls")):
            return pd.read_excel(uploaded_file)

        st.error("Only CSV/Excel files are supported.")
        return None

    except Exception as e:
        st.error(f"Error reading file: {e}")
        return None


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


def prepare_adaptive_dataset(raw_df):
    df = raw_df.copy()

    column_map = detect_column_map(df)
    capabilities = detect_capabilities(column_map)
    dataset_mode = detect_dataset_mode(capabilities)

    if dataset_mode == "unsupported":
        st.error("Unsupported dataset format.")
        st.warning(
            "This app needs at least a Sales / Revenue / Amount column, "
            "or a Product column for product catalog analysis."
        )
        st.write("Detected columns:")
        st.write(df.columns.tolist())
        st.stop()

    df = standardize_detected_columns(df, column_map)

    if "Sales" in df.columns:
        df["Sales"] = clean_price_like_column(df["Sales"])
        df["Sales"] = pd.to_numeric(df["Sales"], errors="coerce")
        df = df.dropna(subset=["Sales"])
        df = df[df["Sales"] >= 0]
    else:
        df["Sales"] = 0

    if "Order_Date" in df.columns:
        df["Order_Date"] = pd.to_datetime(df["Order_Date"], errors="coerce")
        df = df.dropna(subset=["Order_Date"])

    if df.empty:
        st.error("After cleaning, no usable rows remain.")
        st.stop()

    if "Order_Date" not in df.columns:
        df["Order_Date"] = pd.NaT

    if "Ship_Date" not in df.columns:
        df["Ship_Date"] = df["Order_Date"]

    df["Ship_Date"] = pd.to_datetime(df["Ship_Date"], errors="coerce")
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


@st.cache_data
def load_default_data():
    df = pd.read_csv("data/Superstore Sales Dataset.csv")
    df = normalize_columns(df)

    cleaned_df, metadata = prepare_adaptive_dataset(df)

    metadata["dataset_type"] = "transaction"
    metadata["dataset_mode"] = "full_transaction"

    return {
        "df": cleaned_df,
        "dataset_type": metadata["dataset_type"],
        "dataset_mode": metadata["dataset_mode"],
        "capabilities": metadata["capabilities"],
        "column_map": metadata["column_map"],
    }


def load_data():
    st.sidebar.markdown("### Data Source (CSV/Excel)")

    uploaded_file = st.sidebar.file_uploader(
        "",
        type=["csv", "xlsx", "xls"]
    )

    if uploaded_file is None:
        st.sidebar.info("Using default Superstore dataset.")
        return load_default_data()

    raw_df = read_uploaded_file(uploaded_file)

    if raw_df is None:
        st.stop()

    raw_df = normalize_columns(raw_df)

    cleaned_df, metadata = prepare_adaptive_dataset(raw_df)

    dataset_mode = metadata["dataset_mode"]

    mode_labels = {
        "basic_sales": "Basic Sales Dataset",
        "time_based": "Time-Based Sales Dataset",
        "category_product": "Category/Product Sales Dataset",
        "full_transaction": "Full Transaction Dataset",
        "product_catalog": "Product Catalog Dataset",
    }

    st.sidebar.success(
        f"Detected dataset: {mode_labels.get(dataset_mode, 'Sales Dataset')}"
    )

    return {
        "df": cleaned_df,
        "dataset_type": metadata["dataset_type"],
        "dataset_mode": metadata["dataset_mode"],
        "capabilities": metadata["capabilities"],
        "column_map": metadata["column_map"],
    }