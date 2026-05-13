# app_pages/overview.py

import pandas as pd
import streamlit as st
import plotly.express as px
import plotly.graph_objects as go

from utils.ui import (
    render_kpi_card,
    render_hero_section,
    render_score_card,
    render_insight_card,
    render_empty_state_card,
    apply_retailai_chart_style,
    CHART_COLOR_SEQUENCE,
)

from utils.insight_utils import (
    calculate_business_health_score,
    generate_executive_insights,
)

from utils.adaptive_utils import (
    get_template,
    get_unique_count,
    get_valid_date_range,
    get_dataset_mode_label,
    get_top_value,
    get_dataset_capability_flags,
    calculate_dataset_readiness_score,
    get_capability_rows,
)


def render_status_card(title, status, detail, icon="✅", active=True):
    color = "#059669" if active else "#D97706"
    bg = "rgba(16,185,129,0.12)" if active else "rgba(245,158,11,0.14)"
    border = "rgba(16,185,129,0.30)" if active else "rgba(245,158,11,0.30)"

    html = f"""
<div class="premium-card" style="padding:18px;border-radius:18px;border:1px solid {border};background:linear-gradient(135deg,{bg},rgba(255,255,255,0.018));box-shadow:0 8px 24px rgba(0,0,0,0.045);min-height:150px;margin-bottom:12px;">
<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px;">
<div style="font-size:22px;">{icon}</div>
<div style="padding:6px 10px;border-radius:999px;background:{bg};color:{color};font-size:12px;font-weight:850;white-space:nowrap;">{status}</div>
</div>
<div style="font-size:15px;font-weight:850;margin-bottom:8px;">{title}</div>
<div style="font-size:13px;color:#6B7280;line-height:1.55;">{detail}</div>
</div>
"""
    st.markdown(html, unsafe_allow_html=True)


def render_readiness_card(score, label, description):
    if score >= 85:
        color = "#059669"
        bg = "rgba(16,185,129,0.14)"
    elif score >= 65:
        color = "#2563EB"
        bg = "rgba(59,130,246,0.12)"
    elif score >= 40:
        color = "#D97706"
        bg = "rgba(245,158,11,0.14)"
    else:
        color = "#DC2626"
        bg = "rgba(239,68,68,0.12)"

    html = f"""
<div class="premium-card" style="padding:24px;border-radius:22px;border:1px solid rgba(128,128,128,0.22);background:linear-gradient(135deg,{bg},rgba(255,255,255,0.018));box-shadow:0 8px 26px rgba(0,0,0,0.055);margin-bottom:20px;">
<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:18px;margin-bottom:14px;">
<div>
<div style="font-size:13px;font-weight:850;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.4px;">Dataset Readiness Meter</div>
<div style="font-size:28px;font-weight:900;line-height:1.25;margin-top:6px;">{label}</div>
</div>
<div style="padding:10px 16px;border-radius:999px;background:{bg};color:{color};font-size:18px;font-weight:900;white-space:nowrap;">{score}/100</div>
</div>
<div style="height:12px;border-radius:999px;background:rgba(128,128,128,0.18);overflow:hidden;margin-bottom:14px;">
<div style="height:12px;width:{score}%;border-radius:999px;background:{color};"></div>
</div>
<div style="font-size:14px;color:#6B7280;line-height:1.6;">{description}</div>
</div>
"""
    st.markdown(html, unsafe_allow_html=True)


def render_quick_read(df, flags):
    total_sales = df["Sales"].sum() if flags["has_sales"] else 0
    top_region = get_top_value(df, "Region")
    top_category = get_top_value(df, "Category")
    top_product = get_top_value(df, "Product_Name")

    if flags["can_forecast"] and flags["can_hybrid_recommend"]:
        readout = (
            "This is a rich transaction dataset. The app can analyse sales performance, detect business concentration, "
            "forecast short-term sales, and generate hybrid product recommendations using customer-product behaviour."
        )
    elif flags["can_forecast"]:
        readout = (
            "This dataset supports time-based sales intelligence. The app can analyse performance and forecast short-term sales direction."
        )
    elif flags["can_recommend"]:
        readout = (
            "This dataset supports product intelligence. The app can analyse product/category performance and generate content-based recommendations."
        )
    elif flags["has_sales"]:
        readout = (
            "This dataset supports basic sales intelligence. The app can still summarise sales value and business performance."
        )
    else:
        readout = (
            "This dataset has limited analytics capability because key sales fields are missing."
        )

    html = f"""
<div class="premium-card" style="padding:22px;border-radius:22px;border:1px solid rgba(128,128,128,0.22);background:linear-gradient(135deg,rgba(79,139,249,0.10),rgba(16,185,129,0.055));box-shadow:0 8px 26px rgba(0,0,0,0.055);margin-bottom:20px;">
<div style="font-size:13px;font-weight:850;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.4px;margin-bottom:8px;">Executive Quick Read</div>
<div style="font-size:15px;color:#4B5563;line-height:1.75;margin-bottom:14px;">{readout}</div>
<div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;">
<div style="padding:12px;border-radius:14px;background:rgba(128,128,128,0.07);">
<div style="font-size:11px;font-weight:850;color:#9CA3AF;text-transform:uppercase;">Sales</div>
<div style="font-size:15px;font-weight:850;">{total_sales:,.2f}</div>
</div>
<div style="padding:12px;border-radius:14px;background:rgba(128,128,128,0.07);">
<div style="font-size:11px;font-weight:850;color:#9CA3AF;text-transform:uppercase;">Top Region</div>
<div style="font-size:15px;font-weight:850;overflow-wrap:anywhere;">{top_region}</div>
</div>
<div style="padding:12px;border-radius:14px;background:rgba(128,128,128,0.07);">
<div style="font-size:11px;font-weight:850;color:#9CA3AF;text-transform:uppercase;">Top Category</div>
<div style="font-size:15px;font-weight:850;overflow-wrap:anywhere;">{top_category}</div>
</div>
<div style="padding:12px;border-radius:14px;background:rgba(128,128,128,0.07);">
<div style="font-size:11px;font-weight:850;color:#9CA3AF;text-transform:uppercase;">Top Product</div>
<div style="font-size:15px;font-weight:850;overflow-wrap:anywhere;">{top_product}</div>
</div>
</div>
</div>
"""
    st.markdown(html, unsafe_allow_html=True)


def render_trend_chart(df):
    trend_df = df.copy()
    trend_df["Order_Date"] = pd.to_datetime(trend_df["Order_Date"], errors="coerce")
    trend_df = trend_df.dropna(subset=["Order_Date"])

    monthly_sales = (
        trend_df
        .set_index("Order_Date")
        .resample("ME")["Sales"]
        .sum()
        .reset_index()
    )

    if monthly_sales.empty:
        render_empty_state_card("Trend Analysis Unavailable", "RetailAI could not identify enough valid date records to build a reliable sales trend.", ["Order date or transaction date", "Sales, revenue, amount, or value field", "Multiple dated transactions"], "📈", "warning")
        return

    fig = go.Figure()

    fig.add_trace(go.Scatter(
        x=monthly_sales["Order_Date"],
        y=monthly_sales["Sales"],
        mode="lines+markers",
        name="Monthly Sales",
        hovertemplate="Month: %{x|%b %Y}<br>Sales: %{y:,.2f}<extra></extra>"
    ))

    fig.update_layout(
        template=get_template(),
        height=420,
        margin=dict(l=20, r=20, t=40, b=20),
        title="Sales Trend Over Time",
        xaxis_title="Month",
        yaxis_title="Sales"
    )

    st.plotly_chart(fig, use_container_width=True)

    first_sales = monthly_sales["Sales"].iloc[0]
    latest_sales = monthly_sales["Sales"].iloc[-1]

    growth_pct = ((latest_sales - first_sales) / first_sales) * 100 if first_sales != 0 else 0

    if growth_pct > 15:
        trend_text = (
            f"Sales increased by approximately {growth_pct:.1f}% across the detected timeline. "
            "This suggests business growth momentum or stronger demand over time."
        )
    elif growth_pct < -15:
        trend_text = (
            f"Sales decreased by approximately {abs(growth_pct):.1f}% over time. "
            "This may indicate slowing demand, seasonal decline, or operational issues worth investigating."
        )
    else:
        trend_text = (
            "Sales movement appears relatively stable across the detected timeline, without major long-term growth or decline."
        )

    render_insight_card(
        "Trend Interpretation",
        (
            f"{trend_text}\n\n"
            "Executive meaning: this timeline helps identify demand momentum, seasonal pressure, weak periods, and unusual sales spikes that may require business action."
        ),
        "📈",
    )


def render_contribution_chart(df, flags):
    donut_col = None

    if flags["has_category"]:
        donut_col = "Category"
    elif flags["has_region"]:
        donut_col = "Region"

    if not donut_col:
        render_empty_state_card("Contribution Analysis Unavailable", "RetailAI needs a category or regional field to explain how revenue is distributed across business segments.", ["Category, product category, or department", "Region, state, market, or location", "Sales, revenue, amount, or value field"], "🥧", "info")
        return

    donut_df = (
        df.groupby(donut_col)["Sales"]
        .sum()
        .reset_index()
        .sort_values("Sales", ascending=False)
    )

    fig = px.pie(
        donut_df,
        names=donut_col,
        values="Sales",
        hole=0.58,
        color_discrete_sequence=CHART_COLOR_SEQUENCE,
    )

    apply_retailai_chart_style(
        fig,
        height=420,
        title=f"{donut_col} Contribution",
        showlegend=True,
    )

    st.plotly_chart(fig, use_container_width=True)

    top_share = (donut_df.iloc[0]["Sales"] / donut_df["Sales"].sum()) * 100
    top_name = donut_df.iloc[0][donut_col]

    render_insight_card(
        "Contribution Interpretation",
        (
            f"{top_name} currently contributes the largest share of sales at approximately {top_share:.1f}% of detected revenue.\n\n"
            "Executive meaning: this view highlights whether performance is balanced or dependent on a narrow group of categories or regions."
        ),
        "🥧",
    )


def render_sales_distribution(df):
    fig = px.histogram(
        df,
        x="Sales",
        nbins=40,
        color_discrete_sequence=[CHART_COLOR_SEQUENCE[0]],
    )

    apply_retailai_chart_style(
        fig,
        height=380,
        title="Sales Distribution",
        showlegend=False,
    )

    st.plotly_chart(fig, use_container_width=True)

    median_sales = df["Sales"].median()
    mean_sales = df["Sales"].mean()

    if mean_sales > median_sales * 2:
        dist_text = (
            "The dataset is highly right-skewed, meaning a small number of large sales likely contribute a disproportionate amount of revenue."
        )
    else:
        dist_text = (
            "Sales values appear relatively balanced without extreme concentration from large transactions."
        )

    render_insight_card(
        "Distribution Insight",
        (
            f"Mean: {mean_sales:,.2f}\n"
            f"Median: {median_sales:,.2f}\n\n"
            f"{dist_text}"
        ),
        "📊"
    )

    st.caption(
        "Real-life meaning: skewed sales distributions are common in e-commerce because a few high-value orders often drive significant revenue."
    )


def render(df, pdf_bytes=None):
    if df.empty:
        render_empty_state_card("No Matching Records", "The current filter combination does not return any rows. Adjust the filters to restore the executive dashboard view.", ["Broaden region/category/segment filters", "Clear highly specific filter selections", "Confirm the uploaded file contains records"], "🔎", "warning")
        return

    flags = get_dataset_capability_flags(df)
    dataset_mode, dataset_icon, mode_badge = get_dataset_mode_label(df)
    readiness_score, readiness_label, readiness_desc = calculate_dataset_readiness_score(df)

    secondary_badge = f"{len(df):,} Records Loaded"

    hero_col1, hero_col2 = st.columns([13, 1])

    with hero_col1:
        render_hero_section(
            title="RetailAI Intelligence Platform",
            subtitle=(
                "An adaptive retail analytics dashboard that detects dataset capability, generates business intelligence, "
                "supports weekly forecasting, recommends related products, and exports executive-ready PDF reports."
            ),
            badge_text=f"{dataset_icon} {mode_badge}",
            secondary_badge=secondary_badge
        )

    with hero_col2:
        st.markdown("<br><br>", unsafe_allow_html=True)

        if pdf_bytes:
            st.download_button(
                label="📄",
                data=pdf_bytes,
                file_name="retailai_executive_intelligence_report.pdf",
                mime="application/pdf",
                help="Download Full PDF Report",
                key="overview_pdf_download"
            )

    if not flags["has_sales"]:
        render_empty_state_card(
            "Sales Intelligence Unavailable",
            "RetailAI could not identify a usable sales, revenue, amount, or value field. The dashboard is designed to remain stable instead of forcing invalid analysis.",
            ["Sales", "Revenue", "Amount", "Value", "Total"],
            "💳",
            "danger",
        )
        return

    render_quick_read(df, flags)
    render_readiness_card(readiness_score, readiness_label, readiness_desc)

    st.subheader("Business Snapshot")

    total_sales = df["Sales"].sum()
    avg_sales = df["Sales"].mean()
    total_records = len(df)

    total_orders = get_unique_count(df, "Order_ID") if "Order_ID" in df.columns else total_records
    total_customers = get_unique_count(df, "Customer_ID") if flags["has_customer"] else "N/A"
    total_products = get_unique_count(df, "Product_Name") if flags["has_product"] else "N/A"
    total_categories = get_unique_count(df, "Category") if flags["has_category"] else "N/A"
    date_range = get_valid_date_range(df)

    col1, col2, col3, col4 = st.columns(4)

    with col1:
        render_kpi_card("Total Sales", f"{total_sales:,.2f}", "Total value across current dataset view")

    with col2:
        render_kpi_card("Average Sale", f"{avg_sales:,.2f}", "Average sales value per row/transaction")

    with col3:
        render_kpi_card("Records", f"{total_records:,}", "Rows available in the current view")

    with col4:
        render_kpi_card("Orders", f"{total_orders:,}" if isinstance(total_orders, int) else total_orders, "Detected order count or row-based fallback")

    col5, col6, col7, col8 = st.columns(4)

    with col5:
        render_kpi_card("Customers", f"{total_customers}", "Available only when customer data exists")

    with col6:
        render_kpi_card("Products", f"{total_products}", "Available only when product data exists")

    with col7:
        render_kpi_card("Categories", f"{total_categories}", "Available only when category data exists")

    with col8:
        render_kpi_card("Date Range", date_range, "N/A if no real date column exists")

    st.markdown("---")

    st.subheader("AI Capability Engine")

    cap_cols = st.columns(4)

    for i, row in enumerate(get_capability_rows(df)):
        with cap_cols[i % 4]:
            render_status_card(
                title=row["label"],
                status=row["status"],
                detail=row["detail"],
                icon=row["icon"],
                active=row["active"],
            )

    st.info(
        """
        **How to read this:**  
        The app does not force every dataset into the same workflow. It checks what your file actually contains, then enables only the analysis, forecasting, and recommendation features that are valid.
        """
    )

    st.markdown("---")

    st.subheader("Visual Intelligence Center")

    visual_col1, visual_col2 = st.columns([1.25, 1])

    with visual_col1:
        if flags["can_forecast"]:
            render_trend_chart(df)
        else:
            render_empty_state_card(
                "Trend Intelligence Unavailable",
                "RetailAI needs both a sales field and a valid date field before it can build a time-based trend view.",
                ["Order date or transaction date", "Sales, revenue, amount, or value field", "Enough dated records for a timeline"],
                "📈",
                "info",
            )

    with visual_col2:
        render_contribution_chart(df, flags)

    st.markdown("---")

    dist_col1, dist_col2 = st.columns([1.2, 1])

    with dist_col1:
        render_sales_distribution(df)

    with dist_col2:
        st.subheader("Achievement Badges")

        render_kpi_card(
            "🏆 Top Region",
            get_top_value(df, "Region"),
            "Strongest sales region if region data exists"
        )

        render_kpi_card(
            "🔥 Top Product",
            get_top_value(df, "Product_Name"),
            "Highest sales product if product data exists"
        )

        render_kpi_card(
            "📦 Top Category",
            get_top_value(df, "Category"),
            "Strongest category if category data exists"
        )

    st.markdown("---")

    st.subheader("Business Health Score")

    health_score = calculate_business_health_score(df)

    render_score_card(
        "Overall Business Health",
        health_score,
        "A lightweight score based on sales strength, product variety, customer coverage, and dataset richness."
    )

    st.subheader("Executive Insights")

    insights = generate_executive_insights(df)

    if insights:
        insight_cols = st.columns(3)

        for i, insight in enumerate(insights):
            with insight_cols[i % 3]:
                render_insight_card(
                    insight["title"],
                    insight["body"],
                    insight["icon"]
                )
    else:
        render_empty_state_card("Executive Insights Unavailable", "RetailAI could not generate reliable executive insights from the available fields. The dataset may be too limited or too heavily filtered.", ["Sales field", "Product/category/region/customer fields", "Enough records after filtering"], "🧠", "info")

    st.markdown("---")

    st.subheader("Dataset Preview")

    preview_df = df.head(10).copy()

    st.dataframe(
        preview_df,
        use_container_width=True,
        hide_index=True
    )
