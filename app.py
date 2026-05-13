import streamlit as st

from utils.data_loader import load_data
from utils.filters import render_global_filters, apply_global_filters
from utils.ui import inject_premium_css
from utils.pdf_report import build_pdf_report
from app_pages import overview, business_analysis, forecasting, recommendations, project_summary

st.set_page_config(
    page_title="E-Commerce Sales Intelligence & Recommendation System",
    page_icon="📊",
    layout="wide"
)

inject_premium_css()

with st.spinner("Preparing dataset..."):
    data = load_data()

df = data["df"]
dataset_type = data.get("dataset_type", "basic_sales")
dataset_mode = data.get("dataset_mode", "basic_sales")
capabilities = data.get("capabilities", {})

with st.spinner("Preparing PDF report..."):
    pdf_bytes = build_pdf_report(
        df=df,
        full_df=df,
        dataset_type=dataset_type,
        filters={}
    )

st.sidebar.title("Navigation")

section = st.sidebar.radio(
    "Go to",
    [
        "📊 Overview",
        "📈 Business Analysis",
        "🔮 Forecasting",
        "🛒 Recommendations",
        "📋 Project Summary"
    ]
)

filters = render_global_filters(df)
filtered_df = apply_global_filters(df, filters)

if filtered_df.empty:
    st.warning("No records match the selected filters. Try changing or clearing your filter selections.")
    st.stop()

with st.sidebar.expander("🧠 Dataset Capability Check", expanded=False):
    st.write(f"Dataset mode: **{dataset_mode.replace('_', ' ').title()}**")

    st.write("Available:")
    st.write(f"Sales data: {'✅' if capabilities.get('has_sales') else '❌'}")
    st.write(f"Date data: {'✅' if capabilities.get('has_date') else '❌'}")
    st.write(f"Product data: {'✅' if capabilities.get('has_product') else '❌'}")
    st.write(f"Customer data: {'✅' if capabilities.get('has_customer') else '❌'}")
    st.write(f"Category data: {'✅' if capabilities.get('has_category') else '❌'}")

with st.spinner("Preparing filtered PDF report..."):
    filtered_pdf_bytes = build_pdf_report(
        df=filtered_df,
        full_df=df,
        dataset_type=dataset_type,
        filters=filters
    )

active_filter_parts = []

for column, selected_values in filters.items():
    if selected_values:
        active_filter_parts.append(f"{column}: {', '.join(selected_values)}")

if active_filter_parts:
    st.info("Current filtered view → " + " | ".join(active_filter_parts))

if section == "📊 Overview":
    overview.render(filtered_df, filtered_pdf_bytes)

elif section == "📈 Business Analysis":
    business_analysis.render(filtered_df, df)

elif section == "🔮 Forecasting":
    if capabilities.get("can_forecast"):
        forecasting.render(filtered_df)
    else:
        st.warning("Forecasting is unavailable for this dataset.")
        st.info(
            """
            Forecasting needs both:

            - A sales column, such as `Sales`, `Revenue`, `Amount`, or `Total Amount`
            - A date column, such as `Date`, `Order Date`, or `Transaction Date`

            Real-life meaning: without dates, the app cannot understand sales movement over time, so it cannot forecast future demand.
            """
        )

elif section == "🛒 Recommendations":
    if capabilities.get("can_recommend"):
        recommendations.render(filtered_df, df, dataset_type)
    else:
        st.warning("Recommendations are unavailable for this dataset.")
        st.info(
            """
            Recommendations need product-level data, such as `Product_Name`, `Product`, `Item`, or `Title`.

            Real-life meaning: the app needs to know what items exist before it can suggest similar products or cross-sell ideas.
            """
        )

elif section == "📋 Project Summary":
    project_summary.render(filtered_df, None)