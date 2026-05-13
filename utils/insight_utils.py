# utils/insight_utils.py

import pandas as pd

from utils.interpretation_utils import get_top_share_interpretation, interpret_health_score


def has_useful_column(df, column):
    if df is None or column not in df.columns:
        return False

    values = df[column].dropna().astype(str).str.strip()
    values = values[
        (values != "")
        & (values.str.lower() != "unknown")
        & (values.str.lower() != "unknown product")
        & (values.str.lower() != "unknown customer")
    ]

    return values.nunique() > 0


def is_catalog_dataset(df):
    return (
        "Customer_ID" in df.columns
        and df["Customer_ID"].nunique() == 1
        and str(df["Customer_ID"].iloc[0]) == "Catalog_User"
    )


def calculate_business_health_score(df):
    if df is None or df.empty:
        return 0

    score = 0

    if "Sales" in df.columns:
        total_sales = pd.to_numeric(df["Sales"], errors="coerce").fillna(0).sum()
        score += min(total_sales / 1_000_000 * 30, 30)

    if has_useful_column(df, "Order_ID"):
        orders = df["Order_ID"].nunique()
        score += min(orders / 3000 * 15, 15)
    else:
        score += min(len(df) / 3000 * 10, 10)

    if has_useful_column(df, "Customer_ID"):
        customers = df["Customer_ID"].nunique()
        score += min(customers / 500 * 20, 20)

    if has_useful_column(df, "Product_ID"):
        products = df["Product_ID"].nunique()
        score += min(products / 1000 * 20, 20)
    elif has_useful_column(df, "Product_Name"):
        products = df["Product_Name"].nunique()
        score += min(products / 1000 * 20, 20)

    if has_useful_column(df, "Category"):
        categories = df["Category"].nunique()
        score += min(categories / 20 * 10, 10)

    if has_useful_column(df, "Order_Date"):
        date_count = pd.to_datetime(df["Order_Date"], errors="coerce").notna().sum()
        score += min(date_count / len(df) * 5, 5)

    return int(min(score, 100))


def generate_executive_insights(df):
    insights = []

    if df is None or df.empty:
        return insights

    health_score = calculate_business_health_score(df)

    if "Sales" not in df.columns:
        insights.append({
            "title": "Sales Data Missing",
            "body": (
                "This dataset does not contain a usable sales/revenue column, so the app can only provide limited structural insights."
            ),
            "icon": "⚠️"
        })

        insights.append({
            "title": "Business Health Check",
            "body": interpret_health_score(health_score),
            "icon": "🩺"
        })

        return insights

    total_sales = pd.to_numeric(df["Sales"], errors="coerce").fillna(0).sum()
    avg_sales = pd.to_numeric(df["Sales"], errors="coerce").fillna(0).mean()

    region = get_top_share_interpretation(df, "Region")
    category = get_top_share_interpretation(df, "Category")
    product = get_top_share_interpretation(df, "Product_Name")
    segment = get_top_share_interpretation(df, "Segment")

    if region:
        insights.append({
            "title": "Best Performing Region",
            "body": (
                f"{region['top_name']} leads with {region['share']:.1f}% of sales. "
                f"{region['text']} This region can be treated as a benchmark for weaker regions."
            ),
            "icon": "📍"
        })

    if category:
        insights.append({
            "title": "Top Revenue Category",
            "body": (
                f"{category['top_name']} contributes {category['share']:.1f}% of sales. "
                f"{category['text']} This category is a good candidate for promotions, stock planning, and bundles."
            ),
            "icon": "📦"
        })

    if product:
        insights.append({
            "title": "Product Opportunity",
            "body": (
                f"{product['top_name']} is the current top product, contributing {product['share']:.1f}% of sales. "
                "If the share is high, this may be a hero product. If the share is lower, the business has a more balanced product mix."
            ),
            "icon": "🔥"
        })

    if segment:
        insights.append({
            "title": "Customer Segment Signal",
            "body": (
                f"{segment['top_name']} is the strongest detected segment with {segment['share']:.1f}% of sales. "
                "This can help guide campaign targeting and customer prioritisation."
            ),
            "icon": "👥"
        })

    if not region and not category and not product and not segment:
        insights.append({
            "title": "Basic Sales Snapshot",
            "body": (
                f"The dataset contains total sales of {total_sales:,.2f}, with an average value of {avg_sales:,.2f} per record. "
                "This is useful for simple sales tracking, but richer columns such as Category, Product, Region, or Customer would unlock deeper analysis."
            ),
            "icon": "📊"
        })

    if has_useful_column(df, "Order_Date"):
        min_date = pd.to_datetime(df["Order_Date"], errors="coerce").min()
        max_date = pd.to_datetime(df["Order_Date"], errors="coerce").max()

        if pd.notna(min_date) and pd.notna(max_date):
            insights.append({
                "title": "Time Coverage",
                "body": (
                    f"The dataset covers sales from {min_date.date()} to {max_date.date()}. "
                    "This means the app can attempt time-based analysis and forecasting if there is enough weekly history."
                ),
                "icon": "📅"
            })

    insights.append({
        "title": "Business Health Check",
        "body": interpret_health_score(health_score),
        "icon": "🩺"
    })

    return insights[:4]
