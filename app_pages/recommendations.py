# app_pages/recommendations.py

import html
import streamlit as st
import plotly.graph_objects as go
from textwrap import dedent

from utils.recommendation_utils import (
    build_transaction_recommendations,
    build_content_recommendations,
    get_hybrid_recommendations,
    get_content_recommendations,
    get_confidence_label,
)

from utils.interpretation_utils import (
    interpret_recommendation,
    get_recommendation_reason,
    generate_recommendation_business_explanation,
    get_recommendation_opportunity_label,
    generate_action_recommendations,
)


def safe(value):
    return html.escape(str(value))


def short_text(text, max_len=90):
    text = str(text)
    return text if len(text) <= max_len else text[:max_len] + "..."


def get_strength_style(score):
    if score >= 0.70:
        return {
            "label": "Strong",
            "color": "#059669",
            "bg": "rgba(16,185,129,0.14)",
            "border": "rgba(16,185,129,0.38)",
            "soft_bg": "rgba(16,185,129,0.08)",
            "bar": "#059669",
        }

    if score >= 0.40:
        return {
            "label": "Moderate",
            "color": "#D97706",
            "bg": "rgba(245,158,11,0.16)",
            "border": "rgba(245,158,11,0.40)",
            "soft_bg": "rgba(245,158,11,0.08)",
            "bar": "#D97706",
        }

    if score > 0:
        return {
            "label": "Weak",
            "color": "#DC2626",
            "bg": "rgba(239,68,68,0.14)",
            "border": "rgba(239,68,68,0.38)",
            "soft_bg": "rgba(239,68,68,0.07)",
            "bar": "#DC2626",
        }

    return {
        "label": "Very Weak",
        "color": "#6B7280",
        "bg": "rgba(107,114,128,0.13)",
        "border": "rgba(107,114,128,0.32)",
        "soft_bg": "rgba(107,114,128,0.07)",
        "bar": "#6B7280",
    }


def get_opportunity_style(opportunity):
    opportunity = str(opportunity).lower()

    if "high-value" in opportunity or "strong" in opportunity:
        return {
            "color": "#059669",
            "bg": "rgba(16,185,129,0.13)",
            "border": "rgba(16,185,129,0.34)",
        }

    if "useful" in opportunity or "discovery" in opportunity or "content-based" in opportunity:
        return {
            "color": "#2563EB",
            "bg": "rgba(59,130,246,0.12)",
            "border": "rgba(59,130,246,0.32)",
        }

    if "exploratory" in opportunity or "light" in opportunity or "backup" in opportunity:
        return {
            "color": "#D97706",
            "bg": "rgba(245,158,11,0.15)",
            "border": "rgba(245,158,11,0.35)",
        }

    return {
        "color": "#6B7280",
        "bg": "rgba(107,114,128,0.12)",
        "border": "rgba(107,114,128,0.30)",
    }


def render_summary_card(title, value, body, icon="💡", score=None):
    if score is not None:
        style = get_strength_style(score)
        border = style["border"]
        bg = f"linear-gradient(135deg,{style['soft_bg']},rgba(255,255,255,0.018))"
    else:
        border = "rgba(128,128,128,0.22)"
        bg = "linear-gradient(135deg,rgba(255,255,255,0.055),rgba(255,255,255,0.018))"

    st.markdown(
        dedent(f"""
        <div class="premium-card" style="padding:18px;border-radius:18px;border:1px solid {border};background:{bg};box-shadow:0 8px 24px rgba(0,0,0,0.045);min-height:180px;margin-bottom:12px;overflow-wrap:anywhere;">
            <div style="font-size:20px;margin-bottom:8px;">{safe(icon)}</div>
            <div style="font-size:12px;font-weight:800;color:#9CA3AF;text-transform:uppercase;margin-bottom:6px;">{safe(title)}</div>
            <div style="font-size:18px;font-weight:850;line-height:1.4;margin-bottom:10px;">{safe(value)}</div>
            <div style="font-size:13px;color:#6B7280;line-height:1.55;">{safe(body)}</div>
        </div>
        """),
        unsafe_allow_html=True
    )


def render_mission_card(icon, title, body):
    st.markdown(
        dedent(f"""
        <div class="premium-card" style="padding:18px;border-radius:18px;border:1px solid rgba(128,128,128,0.22);background:linear-gradient(135deg,rgba(255,255,255,0.055),rgba(255,255,255,0.018));box-shadow:0 8px 24px rgba(0,0,0,0.045);min-height:150px;margin-bottom:14px;">
            <div style="font-size:22px;margin-bottom:8px;">{safe(icon)}</div>
            <div style="font-size:12px;font-weight:850;color:#9CA3AF;text-transform:uppercase;margin-bottom:8px;">{safe(title)}</div>
            <div style="font-size:14px;line-height:1.6;color:#4B5563;">{safe(body)}</div>
        </div>
        """),
        unsafe_allow_html=True
    )


def render_recommendation_explanation_card(
    selected_product,
    recommended_product,
    similarity_score,
    method,
    active_dataset_type
):
    explanation = generate_recommendation_business_explanation(
        selected_product=selected_product,
        recommended_product=recommended_product,
        score=similarity_score,
        method=method,
        dataset_type=active_dataset_type
    )

    opportunity_label = get_recommendation_opportunity_label(
        score=similarity_score,
        method=method,
        dataset_type=active_dataset_type
    )

    strength_style = get_strength_style(similarity_score)
    opportunity_style = get_opportunity_style(opportunity_label)

    html_block = f"""
<div class="premium-card" style="padding:22px;border-radius:20px;border:1px solid {strength_style['border']};background:linear-gradient(135deg,{strength_style['soft_bg']},rgba(79,139,249,0.035));box-shadow:0 8px 24px rgba(0,0,0,0.045);margin-bottom:14px;">
<div style="display:flex;align-items:center;justify-content:space-between;gap:14px;margin-bottom:14px;">
<div>
<div style="font-size:12px;font-weight:850;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.4px;margin-bottom:6px;">
Recommendation Explanation
</div>
<div style="font-size:21px;font-weight:900;line-height:1.35;">
{safe(opportunity_label)}
</div>
</div>
<div style="padding:8px 13px;border-radius:999px;background:{strength_style['bg']};color:{strength_style['color']};border:1px solid {strength_style['border']};font-size:13px;font-weight:850;white-space:nowrap;">
Similarity {similarity_score:.4f}
</div>
</div>
<div style="display:inline-block;padding:7px 12px;border-radius:999px;background:{opportunity_style['bg']};color:{opportunity_style['color']};border:1px solid {opportunity_style['border']};font-size:13px;font-weight:850;margin-bottom:14px;">
{safe(strength_style['label'])} Recommendation Signal
</div>
<div style="font-size:14px;color:#4B5563;line-height:1.7;margin-bottom:14px;">
{safe(explanation)}
</div>
<div style="font-size:13px;color:#6B7280;line-height:1.6;">
<b>Selected product:</b> {safe(short_text(selected_product, 100))}<br>
<b>Recommended product:</b> {safe(short_text(recommended_product, 100))}<br>
<b>Method:</b> {safe(method)}
</div>
</div>
"""

    st.markdown(html_block, unsafe_allow_html=True)


def render_compact_recommendation_card(idx, row):
    recommended_product = row["Recommended Product"]
    score = row["Similarity Score"]
    method = row["Recommendation Method"]
    opportunity = row.get("Opportunity", "")
    confidence_label, _ = get_confidence_label(score)

    strength_style = get_strength_style(score)
    opportunity_style = get_opportunity_style(opportunity)

    html_block = f"""
<div class="premium-card" style="padding:10px 4px 4px 4px;border-radius:18px;background:linear-gradient(135deg,{strength_style['soft_bg']},rgba(255,255,255,0.018));margin-bottom:4px;">
<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:14px;margin-bottom:12px;">
<div>
<div style="font-size:12px;font-weight:850;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.4px;margin-bottom:5px;">
Recommendation #{idx + 1}
</div>
<div style="font-size:19px;font-weight:900;line-height:1.35;overflow-wrap:anywhere;">
{safe(short_text(recommended_product, 120))}
</div>
</div>
<div style="padding:8px 12px;border-radius:999px;background:{strength_style['bg']};color:{strength_style['color']};border:1px solid {strength_style['border']};font-size:13px;font-weight:850;white-space:nowrap;">
{safe(confidence_label)}
</div>
</div>
<div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;">
<div style="padding:12px;border-radius:14px;background:{strength_style['bg']};border:1px solid {strength_style['border']};">
<div style="font-size:11px;font-weight:800;color:{strength_style['color']};text-transform:uppercase;margin-bottom:4px;">Similarity</div>
<div style="font-size:17px;font-weight:850;color:{strength_style['color']};">{score:.4f}</div>
</div>
<div style="padding:12px;border-radius:14px;background:rgba(128,128,128,0.07);">
<div style="font-size:11px;font-weight:800;color:#9CA3AF;text-transform:uppercase;margin-bottom:4px;">Method</div>
<div style="font-size:14px;font-weight:800;line-height:1.35;">{safe(method)}</div>
</div>
<div style="padding:12px;border-radius:14px;background:rgba(128,128,128,0.07);">
<div style="font-size:11px;font-weight:800;color:#9CA3AF;text-transform:uppercase;margin-bottom:4px;">Opportunity</div>
<div style="font-size:14px;font-weight:800;line-height:1.35;">{safe(opportunity)}</div>
</div>
</div>
</div>
"""

    st.markdown(html_block, unsafe_allow_html=True)


def render_recommendation_cards(rec_df, selected_product, active_dataset_type):
    st.subheader("Recommendation Cards")

    st.markdown(
        """
        <style>
        div[data-testid="stExpander"] {
            margin-top: 8px;
            margin-bottom: 4px;
        }

        div[data-testid="stExpander"] details {
            border-radius: 14px !important;
        }

        div[data-testid="stExpander"] summary {
            font-size: 14px;
            font-weight: 700;
        }
        </style>
        """,
        unsafe_allow_html=True
    )

    for idx, row in rec_df.iterrows():
        recommended_product = row["Recommended Product"]
        score = row["Similarity Score"]
        method = row["Recommendation Method"]
        reason = row.get("Reason", "")
        confidence_label, confidence_desc = get_confidence_label(score)

        explanation = generate_recommendation_business_explanation(
            selected_product=selected_product,
            recommended_product=recommended_product,
            score=score,
            method=method,
            dataset_type=active_dataset_type
        )

        strength_style = get_strength_style(score)

        with st.container(border=True):
            st.markdown(
                f"""
<div style="
height:4px;
border-radius:999px;
background:{strength_style['bar']};
margin:-4px 0 12px 0;
opacity:0.9;
"></div>
                """,
                unsafe_allow_html=True
            )

            render_compact_recommendation_card(idx, row)

            with st.expander(
                f"Why this recommendation? — {short_text(recommended_product, 80)}",
                expanded=False
            ):
                st.markdown(
                    f"""
**Why this recommendation?**

{explanation}

---

**Simple reason:** {reason}

**Confidence note:** {confidence_desc}

**Recommendation strength:** {confidence_label}
                    """
                )

        st.markdown("<div style='height:14px;'></div>", unsafe_allow_html=True)


def has_enough_product_data(df):
    return (
        "Product_Name" in df.columns
        and df["Product_Name"].dropna().astype(str).str.strip().nunique() >= 2
    )


def has_enough_customer_data(df):
    return (
        "Customer_ID" in df.columns
        and df["Customer_ID"].dropna().astype(str).str.strip().nunique() >= 2
    )


def render(filtered_df, full_df, dataset_type):
    st.title("AI Product Recommendation System")
    st.caption("Find similar products, cross-sell ideas, and product discovery opportunities from your dataset.")

    if filtered_df.empty:
        st.warning("No data matches the selected filters.")
        return

    if not has_enough_product_data(filtered_df):
        st.warning("Recommendations are unavailable because this dataset does not contain enough product-level data.")
        st.info("Recommendations need at least a product/item column with more than one unique product.")
        return

    use_fallback = False
    model_df = filtered_df.copy()

    has_customer = has_enough_customer_data(filtered_df)

    if has_customer and dataset_type == "transaction":
        unique_products = filtered_df["Product_Name"].nunique()
        unique_customers = filtered_df["Customer_ID"].nunique()

        if unique_products < 5 or unique_customers < 3:
            model_df = full_df.copy()
            use_fallback = True

        content_matrix = build_content_recommendations(model_df)
        collab_matrix = build_transaction_recommendations(model_df)

        if content_matrix is None:
            st.error("Not enough product information to generate recommendations.")
            return

        if collab_matrix is None:
            st.warning("Not enough customer purchase history for collaborative recommendations. Using product similarity instead.")
            collab_matrix = None

        product_list = sorted(content_matrix.columns.tolist())
        st.success("Hybrid recommendation mode active → customer behavior + product similarity.")

    else:
        if filtered_df["Product_Name"].nunique() < 5:
            model_df = full_df.copy()
            use_fallback = True

        content_matrix = build_content_recommendations(model_df)

        if content_matrix is None:
            st.error("Not enough product information to generate recommendations.")
            return

        collab_matrix = None
        product_list = sorted(content_matrix.columns.tolist())
        st.info("Content-based recommendation mode active → product names, categories, and descriptions.")

    if use_fallback:
        st.warning("Current filters leave too little data, so recommendations are generated using the full dataset.")

    control_col1, control_col2 = st.columns([4, 1])

    with control_col1:
        selected_product = st.selectbox(
            "Search or choose a product",
            product_list,
            help="Type to search product names quickly."
        )

    with control_col2:
        top_n = st.slider("Top N", min_value=3, max_value=10, value=5)

    if collab_matrix is not None:
        rec_df = get_hybrid_recommendations(collab_matrix, content_matrix, selected_product, top_n)
        active_dataset_type = "transaction"
    else:
        rec_df = get_content_recommendations(content_matrix, selected_product, top_n)
        active_dataset_type = "product_catalog"

    if rec_df.empty:
        st.warning("No recommendations found for this product.")
        return

    rec_df["Reason"] = rec_df.apply(
        lambda row: get_recommendation_reason(
            row["Similarity Score"],
            row["Recommendation Method"],
            active_dataset_type
        ),
        axis=1
    )

    rec_df["Opportunity"] = rec_df.apply(
        lambda row: get_recommendation_opportunity_label(
            row["Similarity Score"],
            row["Recommendation Method"],
            active_dataset_type
        ),
        axis=1
    )

    top_match = rec_df.iloc[0]["Recommended Product"]
    top_score = rec_df.iloc[0]["Similarity Score"]
    rec_method = rec_df.iloc[0]["Recommendation Method"]

    confidence_label, confidence_desc = get_confidence_label(top_score)
    rec_interpretation = interpret_recommendation(top_score, rec_method, active_dataset_type)

    st.subheader("Recommendation Intelligence")

    c1, c2, c3, c4 = st.columns(4)

    with c1:
        render_summary_card(
            "Selected Product",
            short_text(selected_product, 65),
            "Product currently used as the recommendation reference.",
            "🛍"
        )

    with c2:
        render_summary_card(
            "Top Match",
            short_text(top_match, 65),
            "Highest recommendation candidate based on similarity patterns.",
            "🔥",
            score=top_score
        )

    with c3:
        render_summary_card(
            "Similarity Score",
            f"{top_score:.4f}",
            rec_interpretation["strength"],
            "🎯",
            score=top_score
        )

    with c4:
        render_summary_card(
            "Confidence",
            confidence_label,
            confidence_desc,
            "🧠",
            score=top_score
        )

    render_recommendation_explanation_card(
        selected_product=selected_product,
        recommended_product=top_match,
        similarity_score=top_score,
        method=rec_method,
        active_dataset_type=active_dataset_type
    )

    st.markdown("---")

    st.subheader("How the App Found These Matches")

    explain_col1, explain_col2 = st.columns(2)

    with explain_col1:
        render_summary_card(
            "Recommendation Logic",
            rec_method,
            rec_interpretation["method"],
            "⚙️"
        )

    with explain_col2:
        render_summary_card(
            "Business Use",
            "Cross-sell & discovery",
            rec_interpretation["real_life"],
            "📈"
        )

    st.markdown("---")

    st.subheader("Recommended Products")

    table_col, chart_col = st.columns([1.15, 1])

    with table_col:
        display_df = rec_df.copy()
        display_df.index = range(1, len(display_df) + 1)
        st.dataframe(display_df, use_container_width=True)

        csv = rec_df.to_csv(index=False).encode("utf-8")
        st.download_button(
            "Download Recommendations",
            data=csv,
            file_name="product_recommendations.csv",
            mime="text/csv",
            key="recommendation_download"
        )

    with chart_col:
        chart_df = rec_df.copy()
        chart_df["Short Product Name"] = chart_df["Recommended Product"].apply(lambda x: short_text(x, 55))
        chart_df = chart_df.sort_values("Similarity Score", ascending=True)
        chart_df["Bar Color"] = chart_df["Similarity Score"].apply(lambda x: get_strength_style(x)["bar"])

        fig = go.Figure()

        fig.add_trace(go.Bar(
            x=chart_df["Similarity Score"],
            y=chart_df["Short Product Name"],
            orientation="h",
            marker=dict(color=chart_df["Bar Color"]),
            hovertemplate="Product: %{customdata}<br>Similarity: %{x:.4f}<extra></extra>",
            customdata=chart_df["Recommended Product"]
        ))

        theme = st.get_option("theme.base")
        template = "plotly_dark" if theme == "dark" else "plotly_white"

        fig.update_layout(
            template=template,
            height=430,
            margin=dict(l=20, r=20, t=30, b=20),
            xaxis_title="Similarity Strength",
            yaxis_title="Recommended Product"
        )

        st.plotly_chart(fig, use_container_width=True)

    st.markdown("---")

    render_recommendation_cards(
        rec_df=rec_df,
        selected_product=selected_product,
        active_dataset_type=active_dataset_type
    )

    st.markdown("---")

    st.subheader("Recommendation Mission Board")
    st.caption("Business actions suggested based on product similarity and customer behavior patterns.")

    actions = generate_action_recommendations(
        df=filtered_df,
        dataset_type=active_dataset_type,
        forecast_metrics=None,
        future_df=None,
        rec_df=rec_df
    )

    mission_icons = ["🎯", "🛒", "📦", "📈", "💡", "🚀"]
    mission_titles = [
        "Cross-Sell Move",
        "Bundle Opportunity",
        "Inventory Focus",
        "Growth Signal",
        "Discovery Boost",
        "Next Best Action"
    ]

    cols = st.columns(2)

    for i, action in enumerate(actions):
        with cols[i % 2]:
            render_mission_card(
                mission_icons[i % len(mission_icons)],
                mission_titles[i % len(mission_titles)],
                action
            )

    st.success(f"Best recommendation candidate detected → {short_text(top_match, 100)}")
