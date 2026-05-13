# app_pages/project_summary.py

import streamlit as st

from utils.ui import render_kpi_card
from utils.adaptive_utils import (
    get_unique_count,
    get_dataset_mode_label,
    get_dataset_capability_flags,
    calculate_dataset_readiness_score,
)


def render_card(title, body, icon="💡", min_height=175):
    html = f"""
<div class="premium-card" style="padding:20px;border-radius:20px;border:1px solid rgba(128,128,128,0.22);background:linear-gradient(135deg,rgba(255,255,255,0.055),rgba(255,255,255,0.018));box-shadow:0 8px 24px rgba(0,0,0,0.045);min-height:{min_height}px;margin-bottom:14px;">
<div style="font-size:24px;margin-bottom:10px;">{icon}</div>
<div style="font-size:15px;font-weight:850;margin-bottom:8px;">{title}</div>
<div style="font-size:13px;color:#6B7280;line-height:1.6;">{body}</div>
</div>
"""
    st.markdown(html, unsafe_allow_html=True)


def render_module_card(title, status, body, icon="✅", active=True):
    color = "#059669" if active else "#D97706"
    bg = "rgba(16,185,129,0.12)" if active else "rgba(245,158,11,0.14)"
    border = "rgba(16,185,129,0.28)" if active else "rgba(245,158,11,0.32)"

    html = f"""
<div class="premium-card" style="padding:18px;border-radius:18px;border:1px solid {border};background:linear-gradient(135deg,{bg},rgba(255,255,255,0.018));box-shadow:0 8px 24px rgba(0,0,0,0.045);min-height:165px;margin-bottom:14px;">
<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px;">
<div style="display:flex;align-items:center;gap:8px;">
<span style="font-size:22px;">{icon}</span>
<span style="font-size:15px;font-weight:850;">{title}</span>
</div>
<div style="padding:6px 10px;border-radius:999px;background:{bg};color:{color};font-size:11px;font-weight:850;white-space:nowrap;">{status}</div>
</div>
<div style="font-size:13px;color:#6B7280;line-height:1.6;">{body}</div>
</div>
"""
    st.markdown(html, unsafe_allow_html=True)


def render_pipeline_step(step_no, title, body, icon="⚙️"):
    html = f"""
<div class="premium-card" style="padding:18px;border-radius:18px;border:1px solid rgba(128,128,128,0.22);background:linear-gradient(135deg,rgba(79,139,249,0.08),rgba(255,255,255,0.018));box-shadow:0 8px 24px rgba(0,0,0,0.045);min-height:165px;margin-bottom:14px;">
<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
<div style="width:34px;height:34px;border-radius:999px;background:rgba(59,130,246,0.12);color:#2563EB;font-size:14px;font-weight:900;display:flex;align-items:center;justify-content:center;">{step_no}</div>
<div style="font-size:22px;">{icon}</div>
</div>
<div style="font-size:15px;font-weight:850;margin-bottom:8px;">{title}</div>
<div style="font-size:13px;color:#6B7280;line-height:1.6;">{body}</div>
</div>
"""
    st.markdown(html, unsafe_allow_html=True)


def render_hero(dataset_icon, mode_badge):
    html = f"""
<div class="premium-hero" style="padding:30px 32px;border-radius:24px;background:linear-gradient(135deg,rgba(79,139,249,0.14),rgba(16,185,129,0.08));border:1px solid rgba(128,128,128,0.18);box-shadow:0 10px 32px rgba(0,0,0,0.06);margin-bottom:28px;">
<div style="margin-bottom:14px;">
<span style="display:inline-block;padding:6px 12px;border-radius:999px;background:rgba(16,185,129,0.14);color:#059669;font-size:13px;font-weight:850;">{dataset_icon} {mode_badge}</span>
<span style="display:inline-block;padding:6px 12px;border-radius:999px;background:rgba(59,130,246,0.12);color:#2563EB;font-size:13px;font-weight:850;margin-left:8px;">Portfolio-Ready System</span>
</div>
<div style="font-size:36px;font-weight:900;line-height:1.12;margin-bottom:10px;">RetailAI Adaptive Analytics Engine</div>
<div style="font-size:15px;color:#6B7280;line-height:1.7;max-width:980px;">
This project is designed as a flexible retail intelligence platform rather than a fixed dashboard. It detects the uploaded dataset structure, enables valid analysis modules, explains business meaning, and exports executive-ready PDF reports.
</div>
</div>
"""
    st.markdown(html, unsafe_allow_html=True)


def render(df, forecast_results=None):
    st.title("Project Summary")
    st.caption("Portfolio-ready overview of the RetailAI Adaptive Sales Intelligence & Recommendation Platform.")

    if df.empty:
        st.warning("No data matches the selected filters.")
        return

    dataset_mode, dataset_icon, mode_badge = get_dataset_mode_label(df)
    flags = get_dataset_capability_flags(df)
    readiness_score, readiness_label, readiness_desc = calculate_dataset_readiness_score(df)

    has_sales = flags["has_sales"]
    can_forecast = flags["can_forecast"]
    can_recommend = flags["can_recommend"]
    can_hybrid_recommend = flags["can_hybrid_recommend"]

    render_hero(dataset_icon, mode_badge)

    st.subheader("Project Snapshot")

    total_records = len(df)
    total_sales = df["Sales"].sum() if has_sales else 0

    col1, col2, col3, col4 = st.columns(4)

    with col1:
        render_kpi_card("Dataset Mode", dataset_mode, "Detected automatically from uploaded columns")

    with col2:
        render_kpi_card("Records", f"{total_records:,}", "Usable rows in the current dataset view")

    with col3:
        render_kpi_card("Readiness", f"{readiness_score}/100", readiness_label)

    with col4:
        render_kpi_card(
            "ML Readiness",
            "Hybrid" if can_hybrid_recommend else "Forecast + Content" if can_forecast and can_recommend else "Forecast" if can_forecast else "Content" if can_recommend else "Basic",
            "Depends on date, product, and customer data availability"
        )

    st.info(f"**Dataset readiness:** {readiness_desc}")

    st.subheader("What Makes This Project Strong")

    s1, s2, s3 = st.columns(3)

    with s1:
        render_card(
            "Adaptive Dataset Handling",
            "The system does not assume every uploaded file has the same structure. It detects sales, date, product, customer, category, and location fields, then enables only valid features.",
            "🧠"
        )

    with s2:
        render_card(
            "Business-First Intelligence",
            "Charts are paired with explanations, top-3 contributor logic, dependency risk, confidence labels, and recommended actions so users understand what the numbers mean.",
            "📊"
        )

    with s3:
        render_card(
            "Decision Support Layer",
            "Forecasting, recommendations, diagnostics, and PDF exports are framed as practical decision-support tools for planning, campaigns, inventory, and product discovery.",
            "🧭"
        )

    st.subheader("Enabled Modules for Current Dataset")

    m1, m2 = st.columns(2)

    with m1:
        render_module_card(
            "Overview Intelligence",
            "Enabled",
            "Provides KPIs, executive quick read, readiness score, visual intelligence, business health score, and dataset preview.",
            "✅",
            True
        )

        render_module_card(
            "Business Analysis",
            "Enabled" if has_sales else "Limited",
            "Analyses sales by available business dimensions and explains concentration, dependency risk, and recommended actions.",
            "📈",
            has_sales
        )

    with m2:
        render_module_card(
            "Forecast Intelligence",
            "Enabled" if can_forecast else "Unavailable",
            "Uses weekly KNN forecasting and converts metrics into confidence, momentum, demand stability, inventory pressure, and action plans.",
            "🔮" if can_forecast else "⚠️",
            can_forecast
        )

        render_module_card(
            "Recommendation Intelligence",
            "Hybrid Enabled" if can_hybrid_recommend else "Content-Based Enabled" if can_recommend else "Unavailable",
            "Generates related product suggestions using content similarity and customer-product behaviour when available.",
            "🛒" if can_recommend else "⚠️",
            can_recommend
        )

    st.subheader("System Workflow")

    p1, p2, p3, p4 = st.columns(4)

    with p1:
        render_pipeline_step(
            "1",
            "Data Input",
            "User uploads CSV/Excel data or uses the default Superstore-style dataset.",
            "📥"
        )

    with p2:
        render_pipeline_step(
            "2",
            "Adaptive Detection",
            "The app maps columns, detects capabilities, cleans values, and prevents unsupported workflows from running.",
            "🧩"
        )

    with p3:
        render_pipeline_step(
            "3",
            "Intelligence Modules",
            "Valid pages are enabled for overview, business analysis, forecasting, recommendations, and PDF reporting.",
            "🧠"
        )

    with p4:
        render_pipeline_step(
            "4",
            "Decision Output",
            "Users receive charts, explanations, risk signals, recommendations, action plans, and downloadable reports.",
            "📄"
        )

    st.subheader("Technical Architecture")

    a1, a2, a3 = st.columns(3)

    with a1:
        render_card(
            "Input & Cleaning Layer",
            "CSV/Excel reading, default dataset fallback, column normalization, price cleaning, date parsing, feature engineering, and duplicate removal.",
            "📥",
            190
        )

    with a2:
        render_card(
            "Analytics & ML Layer",
            "Business aggregation, top-3 concentration logic, weekly KNN forecasting, TF-IDF product similarity, hybrid recommendations, and interpretation utilities.",
            "⚙️",
            190
        )

    with a3:
        render_card(
            "Presentation & Reporting Layer",
            "Streamlit multipage UI, Plotly visuals, premium card styling, filters, downloadable CSV outputs, and executive PDF report generation.",
            "🖥",
            190
        )

    st.subheader("Machine Learning & Intelligence Methods")

    ml1, ml2, ml3 = st.columns(3)

    with ml1:
        render_card(
            "Weekly KNN Forecasting",
            "The forecasting module aggregates sales weekly, engineers lag/rolling/date features, trains KNN regression, and generates a short-term 4-week forecast.",
            "🔮",
            190
        )

    with ml2:
        render_card(
            "Product Similarity",
            "The recommendation engine uses product text/category information to identify similar items for product discovery and related-item suggestions.",
            "🛒",
            190
        )

    with ml3:
        render_card(
            "Hybrid Recommendation Logic",
            "When customer purchase behaviour exists, the app combines collaborative signals with content similarity to strengthen recommendation relevance.",
            "🤖",
            190
        )

    st.subheader("Business Value")

    b1, b2 = st.columns(2)

    with b1:
        render_card(
            "For Business Users",
            "The platform helps users identify what is selling, where performance is concentrated, whether demand is rising or falling, and which products may support cross-selling.",
            "💼",
            170
        )

    with b2:
        render_card(
            "For Portfolio Reviewers",
            "This project demonstrates end-to-end data product thinking: ingestion, cleaning, adaptive logic, BI, forecasting, recommendations, UI/UX, reporting, and insight storytelling.",
            "🌟",
            170
        )

    st.subheader("Defensive Programming & Real-World Readiness")

    d1, d2, d3 = st.columns(3)

    with d1:
        render_card(
            "Graceful Fallbacks",
            "If forecasting or recommendations are not valid for a dataset, the app explains why instead of crashing.",
            "🛡",
            165
        )

    with d2:
        render_card(
            "Flexible Inputs",
            "The app accepts CSV and Excel files and attempts to standardize common real-world column naming differences.",
            "📂",
            165
        )

    with d3:
        render_card(
            "Filtered Reporting",
            "PDF exports respect the active filtered view, allowing users to generate focused reports for selected segments or categories.",
            "📄",
            165
        )

    st.subheader("Current Limitations")

    l1, l2 = st.columns(2)

    with l1:
        render_card(
            "Forecasting Limitations",
            "Forecast accuracy depends on enough historical sales data. The current model does not include promotions, holidays, stock levels, ad spend, discount rates, or profit margin.",
            "🔮",
            170
        )

    with l2:
        render_card(
            "Recommendation Limitations",
            "Recommendation quality depends on product variety and customer-product behaviour. If customer data is missing, the system falls back to content-based similarity.",
            "🛒",
            170
        )

    st.subheader("Future Improvements")

    f1, f2, f3 = st.columns(3)

    with f1:
        render_card(
            "Smarter Column Detection",
            "Add stronger fuzzy matching or semantic detection so unusual names like Revenue_MYR, TxnDate, ItemTitle, or CustomerNo can be mapped more accurately.",
            "🔍",
            185
        )

    with f2:
        render_card(
            "Advanced Forecasting",
            "Add model comparison, holiday features, promotional indicators, confidence intervals, and better trend fallback when data history is short.",
            "📈",
            185
        )

    with f3:
        render_card(
            "Richer Recommendation Evaluation",
            "Add basket analysis, customer segmentation, product bundle mining, recommendation diversity, and ranking evaluation metrics.",
            "🧺",
            185
        )

    st.success(
        """
        Portfolio positioning: RetailAI demonstrates a production-style analytics system that combines adaptive dataset handling, business intelligence, forecasting, recommendation systems, Streamlit app development, executive PDF reporting, and insight storytelling.
        """
    )

    st.markdown("---")
    st.caption("Built as a Final Year Project / portfolio project for data analytics, BI, and AI-oriented roles.")
