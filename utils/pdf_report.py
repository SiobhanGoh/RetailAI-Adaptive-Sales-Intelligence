# utils/pdf_report.py

import os
import tempfile
from io import BytesIO
from datetime import datetime

import matplotlib.pyplot as plt
import pandas as pd

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    Image,
    PageBreak,
)

from utils.insight_utils import calculate_business_health_score, generate_executive_insights
from utils.forecasting_utils import (
    train_weekly_knn_forecast,
    get_forecast_risk,
    generate_forecast_intelligence,
)
from utils.recommendation_utils import (
    build_transaction_recommendations,
    build_content_recommendations,
    get_hybrid_recommendations,
    get_content_recommendations,
    get_confidence_label,
)
from utils.interpretation_utils import (
    generate_business_analysis_explanation,
    interpret_forecast,
    get_future_trend_label,
    detect_forecast_anomalies,
    interpret_recommendation,
    get_recommendation_reason,
    get_recommendation_opportunity_label,
    generate_recommendation_business_explanation,
    generate_action_recommendations,
)


BRAND_BLUE = colors.HexColor("#2563EB")
DARK = colors.HexColor("#111827")
TEXT = colors.HexColor("#374151")
LIGHT_BLUE = colors.HexColor("#E8F0FE")
SOFT_GRAY = colors.HexColor("#F9FAFB")
BORDER = colors.HexColor("#D1D5DB")
GREEN = colors.HexColor("#059669")
AMBER = colors.HexColor("#D97706")
RED = colors.HexColor("#DC2626")
MUTED = colors.HexColor("#6B7280")


def clean_text(value):
    if value is None:
        return ""

    text = str(value)

    return (
        text
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )


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


def safe_percent(part, whole):
    if whole == 0 or pd.isna(whole):
        return 0
    return (part / whole) * 100


def get_status_color(value):
    value = str(value).lower()

    if (
        "strong" in value
        or "high confidence" in value
        or "controlled" in value
        or "enabled" in value
        or "stable" in value
        or "low risk" in value
        or "healthy" in value
    ):
        return GREEN

    if (
        "moderate" in value
        or "manageable" in value
        or "balanced" in value
        or "directional" in value
        or "normal" in value
        or "content-based" in value
    ):
        return AMBER

    if (
        "weak" in value
        or "high dependency" in value
        or "elevated" in value
        or "volatile" in value
        or "skipped" in value
        or "low confidence" in value
        or "overstock" in value
    ):
        return RED

    return TEXT


def get_dataset_mode_label(df, dataset_type):
    has_sales = "Sales" in df.columns
    has_date = has_useful_column(df, "Order_Date")
    has_product = has_useful_column(df, "Product_Name")
    has_customer = has_useful_column(df, "Customer_ID")
    has_category = has_useful_column(df, "Category")

    if has_sales and has_date and has_product and has_customer:
        return "Full Transaction Dataset"

    if has_sales and has_date:
        return "Time-Based Sales Dataset"

    if has_sales and (has_product or has_category):
        return "Category/Product Sales Dataset"

    if has_sales:
        return "Basic Sales Dataset"

    if has_product:
        return "Product Catalog Dataset"

    return str(dataset_type).replace("_", " ").title()


def make_chart_path(fig):
    temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=".png")
    fig.savefig(temp_file.name, bbox_inches="tight", dpi=170)
    plt.close(fig)
    return temp_file.name


def add_section_title(story, title, styles):
    story.append(Spacer(1, 12))
    story.append(Paragraph(clean_text(title), styles["SectionTitle"]))
    story.append(Spacer(1, 8))


def add_subsection_title(story, title, styles):
    story.append(Spacer(1, 8))
    story.append(Paragraph(clean_text(title), styles["SubsectionTitle"]))
    story.append(Spacer(1, 6))


def add_paragraph(story, text, styles):
    story.append(Paragraph(clean_text(text), styles["Body"]))
    story.append(Spacer(1, 8))


def add_bullet_list(story, items, styles):
    if not items:
        return

    for item in items:
        story.append(Paragraph(f"• {clean_text(item)}", styles["Body"]))
        story.append(Spacer(1, 4))

    story.append(Spacer(1, 6))


def add_callout(story, title, text, styles, tone="blue"):
    bg = LIGHT_BLUE
    border = BRAND_BLUE

    if tone == "green":
        bg = colors.HexColor("#ECFDF5")
        border = GREEN
    elif tone == "amber":
        bg = colors.HexColor("#FFFBEB")
        border = AMBER
    elif tone == "red":
        bg = colors.HexColor("#FEF2F2")
        border = RED
    elif tone == "gray":
        bg = SOFT_GRAY
        border = BORDER

    data = [[Paragraph(f"<b>{clean_text(title)}</b><br/>{clean_text(text)}", styles["Body"])]]

    table = Table(data, colWidths=[6.7 * inch])
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), bg),
        ("BOX", (0, 0), (-1, -1), 0.6, border),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))

    story.append(table)
    story.append(Spacer(1, 12))


def normalize_table_data(data, styles):
    normalized = []

    for row in data:
        normalized_row = []

        for cell in row:
            normalized_row.append(Paragraph(clean_text(cell), styles["TableCell"]))

        normalized.append(normalized_row)

    return normalized


def add_table(story, data, styles, col_widths=None, color_status_column=None):
    if not data:
        return

    table = Table(
        normalize_table_data(data, styles),
        repeatRows=1,
        colWidths=col_widths
    )

    base_style = [
        ("BACKGROUND", (0, 0), (-1, 0), LIGHT_BLUE),
        ("TEXTCOLOR", (0, 0), (-1, 0), DARK),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("GRID", (0, 0), (-1, -1), 0.3, BORDER),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, SOFT_GRAY]),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]

    if color_status_column is not None:
        for row_idx in range(1, len(data)):
            if len(data[row_idx]) > color_status_column:
                status_color = get_status_color(data[row_idx][color_status_column])
                base_style.append(("TEXTCOLOR", (color_status_column, row_idx), (color_status_column, row_idx), status_color))
                base_style.append(("FONTNAME", (color_status_column, row_idx), (color_status_column, row_idx), "Helvetica-Bold"))

    table.setStyle(TableStyle(base_style))

    story.append(table)
    story.append(Spacer(1, 12))


def create_bar_chart(df, group_col, value_col, title, top_n=10, horizontal=False):
    if not has_useful_column(df, group_col) or value_col not in df.columns:
        return None

    chart_df = (
        df.groupby(group_col)[value_col]
        .sum()
        .sort_values(ascending=False)
        .head(top_n)
    )

    chart_df = chart_df[chart_df.index.astype(str).str.lower() != "unknown"]

    if chart_df.empty:
        return None

    if horizontal:
        chart_df = chart_df.sort_values(ascending=True)

    fig, ax = plt.subplots(figsize=(7, 4))

    if horizontal:
        chart_df.plot(kind="barh", ax=ax, color="#2563EB")
        ax.set_xlabel(value_col)
        ax.set_ylabel(group_col.replace("_", " "))
    else:
        chart_df.plot(kind="bar", ax=ax, color="#2563EB")
        ax.set_xlabel(group_col.replace("_", " "))
        ax.set_ylabel(value_col)
        ax.tick_params(axis="x", rotation=30)

    ax.set_title(title)
    ax.grid(axis="y", alpha=0.25)
    fig.tight_layout()

    return make_chart_path(fig)


def create_forecast_chart(prediction_df):
    fig, ax = plt.subplots(figsize=(7, 4))

    ax.plot(
        prediction_df["Week"],
        prediction_df["Actual_Sales"],
        marker="o",
        label="Actual Sales",
        color="#2563EB",
    )

    ax.plot(
        prediction_df["Week"],
        prediction_df["Predicted_Sales"],
        marker="o",
        label="Predicted Sales",
        color="#059669",
    )

    ax.set_title("Actual vs Predicted Weekly Sales")
    ax.set_xlabel("Week")
    ax.set_ylabel("Sales")
    ax.legend()
    ax.grid(alpha=0.25)

    fig.autofmt_xdate()
    fig.tight_layout()

    return make_chart_path(fig)


def get_dataset_quality_table(df):
    missing_values = int(df.isna().sum().sum())
    duplicate_rows = int(df.duplicated().sum())
    usable_columns = len([col for col in df.columns if has_useful_column(df, col) or col == "Sales"])

    missing_pct = safe_percent(missing_values, len(df) * max(len(df.columns), 1))
    duplicate_pct = safe_percent(duplicate_rows, len(df))

    return [
        ["Quality Check", "Value"],
        ["Rows analysed", f"{len(df):,}"],
        ["Columns detected", f"{len(df.columns):,}"],
        ["Usable columns", f"{usable_columns:,}"],
        ["Missing values", f"{missing_values:,} ({missing_pct:.2f}%)"],
        ["Duplicate rows", f"{duplicate_rows:,} ({duplicate_pct:.2f}%)"],
    ]


def get_capability_table(df, dataset_type):
    has_sales = "Sales" in df.columns
    has_date = "Order_Date" in df.columns and pd.to_datetime(df["Order_Date"], errors="coerce").notna().sum() >= 10
    has_product = has_useful_column(df, "Product_Name")
    has_customer = has_useful_column(df, "Customer_ID")
    has_category = has_useful_column(df, "Category")
    has_region = has_useful_column(df, "Region")

    can_forecast = has_sales and has_date
    can_recommend = has_product
    can_hybrid = has_product and has_customer and dataset_type == "transaction"

    return [
        ["Capability", "Status", "Meaning"],
        ["Sales Analytics", "Enabled" if has_sales else "Skipped", "Requires a detected Sales/Revenue/Amount column."],
        ["Business Segmentation", "Enabled" if has_category or has_region else "Limited", "Uses category, region, segment, state, or product fields."],
        ["Forecasting", "Enabled" if can_forecast else "Skipped", "Requires sales values and usable date history."],
        ["Product Recommendations", "Hybrid Enabled" if can_hybrid else "Content-Based Enabled" if can_recommend else "Skipped", "Uses product data and customer behaviour when available."],
        ["Customer Behaviour Signal", "Enabled" if has_customer else "Limited", "Improves collaborative and hybrid recommendations."],
    ]


def get_top_summary(df, group_col):
    if "Sales" not in df.columns or not has_useful_column(df, group_col):
        return None

    grouped = df.groupby(group_col)["Sales"].sum().sort_values(ascending=False)
    grouped = grouped[grouped.index.astype(str).str.lower() != "unknown"]

    if grouped.empty:
        return None

    top_name = grouped.index[0]
    top_value = grouped.iloc[0]
    share = safe_percent(top_value, grouped.sum())

    return top_name, top_value, share


def get_top3_business_diagnostics(df):
    diagnostics = []

    if df is None or df.empty or "Sales" not in df.columns:
        return diagnostics

    dimensions = [
        ("Region", "Regional Dependency"),
        ("Category", "Category Concentration"),
        ("Segment", "Segment Dependence"),
        ("Product_Name", "Product Portfolio"),
        ("State", "Geographic State Concentration"),
    ]

    for group_col, signal in dimensions:
        if not has_useful_column(df, group_col):
            continue

        grouped = (
            df.groupby(group_col)["Sales"]
            .sum()
            .sort_values(ascending=False)
        )

        grouped = grouped[grouped.index.astype(str).str.lower() != "unknown"]

        if grouped.empty:
            continue

        total_value = grouped.sum()
        top3 = grouped.head(3)
        top3_share = safe_percent(top3.sum(), total_value)

        if top3_share >= 75:
            status = "Very High Concentration"
            risk = "High Dependency Risk"
            action = "Protect leaders but grow secondary contributors."
        elif top3_share >= 55:
            status = "Moderate Concentration"
            risk = "Manageable Dependency"
            action = "Support leaders while strengthening mid-tier contributors."
        elif top3_share >= 35:
            status = "Balanced Mix"
            risk = "Healthy Diversification"
            action = "Maintain broad support and use leaders as campaign anchors."
        else:
            status = "Highly Diversified"
            risk = "Low Dependency Risk"
            action = "Use discovery campaigns to identify stronger winners."

        top3_names = ", ".join([str(x) for x in top3.index])

        diagnostics.append({
            "signal": signal,
            "top3_names": top3_names,
            "top3_share": top3_share,
            "status": status,
            "risk": risk,
            "action": action,
        })

    return diagnostics


def build_business_summary_table(df):
    rows = [["Dimension", "Top Performer", "Sales / Value", "Share"]]

    for group_col in ["Region", "Category", "Segment", "Product_Name", "State"]:
        summary = get_top_summary(df, group_col)

        if summary:
            top_name, top_value, share = summary
            rows.append([
                group_col.replace("_", " "),
                str(top_name),
                f"{top_value:,.2f}",
                f"{share:.1f}%",
            ])

    return rows




def get_chart_interpretation(df, group_col):
    if df is None or df.empty or "Sales" not in df.columns or not has_useful_column(df, group_col):
        return None

    grouped = (
        df.groupby(group_col)["Sales"]
        .sum()
        .sort_values(ascending=False)
    )

    grouped = grouped[grouped.index.astype(str).str.lower() != "unknown"]

    if grouped.empty:
        return None

    total_value = grouped.sum()
    top3 = grouped.head(3)
    top3_share = safe_percent(top3.sum(), total_value)
    remaining_share = max(0, 100 - top3_share)

    if top3_share >= 75:
        concentration = "Very High Concentration"
        risk = "High Dependency Risk"
        meaning = (
            "A small number of contributors dominate this chart. This gives the business clear winners, "
            "but it also means performance may depend heavily on a few areas."
        )
        action = "Protect the leading contributors while developing secondary performers to reduce over-dependence."
    elif top3_share >= 55:
        concentration = "Moderate Concentration"
        risk = "Manageable Dependency"
        meaning = (
            "The top contributors are important performance drivers, while the remaining contributors still provide some balance."
        )
        action = "Support the top contributors while gradually strengthening mid-tier contributors."
    elif top3_share >= 35:
        concentration = "Balanced Mix"
        risk = "Healthy Diversification"
        meaning = (
            "Sales are reasonably spread out. The business has clear leaders but is not overly dependent on only a few contributors."
        )
        action = "Maintain broad support and use the strongest contributors as campaign or planning anchors."
    else:
        concentration = "Highly Diversified Distribution"
        risk = "Low Dependency Risk"
        meaning = (
            "Sales are spread across many contributors. This reduces dependency risk but may make it harder to identify clear winners."
        )
        action = "Use product discovery, segmentation, and campaigns to identify stronger growth pockets."

    top_rows = []

    for idx, (name, value) in enumerate(top3.items(), start=1):
        top_rows.append([
            str(idx),
            str(name),
            f"{value:,.2f}",
            f"{safe_percent(value, total_value):.1f}%",
        ])

    return {
        "top_rows": top_rows,
        "top3_share": top3_share,
        "remaining_share": remaining_share,
        "concentration": concentration,
        "risk": risk,
        "meaning": meaning,
        "action": action,
    }


def add_chart_interpretation_block(story, df, group_col, styles, chart_title):
    interpretation = get_chart_interpretation(df, group_col)

    if not interpretation:
        return

    add_subsection_title(story, f"{chart_title} — Interpretation", styles)

    top3_table = [["Rank", "Contributor", "Sales / Value", "Share"]] + interpretation["top_rows"]

    add_table(
        story,
        top3_table,
        styles,
        col_widths=[0.6 * inch, 3.1 * inch, 1.5 * inch, 1.0 * inch],
    )

    summary_rows = [
        ["Signal", "Result"],
        ["Top 3 Combined Share", f"{interpretation['top3_share']:.1f}%"],
        ["Remaining Contributors", f"{interpretation['remaining_share']:.1f}%"],
        ["Business Structure", interpretation["concentration"]],
        ["Strategic Risk", interpretation["risk"]],
    ]

    add_table(
        story,
        summary_rows,
        styles,
        col_widths=[2.2 * inch, 4.5 * inch],
        color_status_column=1,
    )

    tone = "red" if "High" in interpretation["risk"] else "amber" if "Manageable" in interpretation["risk"] else "green"

    add_callout(
        story,
        "Business Interpretation",
        f"{interpretation['meaning']} Recommended action: {interpretation['action']}",
        styles,
        tone=tone,
    )

def build_business_diagnostics_table(df):
    diagnostics = get_top3_business_diagnostics(df)

    rows = [["Signal", "Top 3 Contributors", "Top 3 Share", "Status", "Risk"]]

    for item in diagnostics:
        rows.append([
            item["signal"],
            item["top3_names"],
            f"{item['top3_share']:.1f}%",
            item["status"],
            item["risk"],
        ])

    return rows, diagnostics


def get_recommendation_summary(df, full_df, dataset_type):
    try:
        if df.empty or "Product_Name" not in df.columns:
            return None, None, None

        useful_products = df["Product_Name"].dropna().astype(str).str.strip()
        useful_products = useful_products[
            (useful_products != "")
            & (useful_products.str.lower() != "unknown product")
            & (useful_products.str.lower() != "unknown")
        ]

        if useful_products.nunique() < 2:
            return None, None, None

        if "Sales" in df.columns:
            valid_product_df = df[df["Product_Name"].astype(str).str.lower() != "unknown product"]

            selected_product = (
                valid_product_df.groupby("Product_Name")["Sales"]
                .sum()
                .sort_values(ascending=False)
                .index[0]
            )
        else:
            selected_product = useful_products.value_counts().index[0]

        model_df = df.copy()

        if df["Product_Name"].nunique() < 5 and full_df is not None:
            model_df = full_df.copy()

        content_matrix = build_content_recommendations(model_df)

        if content_matrix is None:
            return selected_product, None, None

        has_customer = (
            "Customer_ID" in model_df.columns
            and model_df["Customer_ID"].dropna().astype(str).str.strip().nunique() >= 2
            and "Unknown Customer" not in model_df["Customer_ID"].astype(str).unique()
        )

        if has_customer and dataset_type == "transaction":
            collab_matrix = build_transaction_recommendations(model_df)

            if collab_matrix is not None:
                rec_df = get_hybrid_recommendations(collab_matrix, content_matrix, selected_product, top_n=5)
                mode = "Hybrid Recommendation"
            else:
                rec_df = get_content_recommendations(content_matrix, selected_product, top_n=5)
                mode = "Content-Based Recommendation"
        else:
            rec_df = get_content_recommendations(content_matrix, selected_product, top_n=5)
            mode = "Content-Based Recommendation"

        return selected_product, rec_df, mode

    except Exception:
        return None, None, None


def build_recommendation_table(rec_df, dataset_type):
    rows = [["Recommended Product", "Score", "Strength", "Opportunity", "Reason", "Method"]]

    if rec_df is None or rec_df.empty:
        return rows

    for _, row in rec_df.iterrows():
        score = row["Similarity Score"]
        method = row.get("Recommendation Method", "N/A")
        confidence_label, _ = get_confidence_label(score)
        opportunity = get_recommendation_opportunity_label(score, method, dataset_type)
        reason = get_recommendation_reason(score, method, dataset_type)

        rows.append([
            str(row["Recommended Product"])[:75],
            f"{score:.4f}",
            confidence_label,
            opportunity,
            reason,
            method,
        ])

    return rows


def build_recommendation_explanation(selected_product, rec_df, dataset_type):
    if selected_product is None or rec_df is None or rec_df.empty:
        return None

    top_row = rec_df.iloc[0]
    top_product = top_row["Recommended Product"]
    top_score = top_row["Similarity Score"]
    method = top_row.get("Recommendation Method", "N/A")
    confidence_label, confidence_desc = get_confidence_label(top_score)
    opportunity = get_recommendation_opportunity_label(top_score, method, dataset_type)
    reason = get_recommendation_reason(top_score, method, dataset_type)
    interpretation = interpret_recommendation(top_score, method, dataset_type)

    explanation = generate_recommendation_business_explanation(
        selected_product=selected_product,
        recommended_product=top_product,
        score=top_score,
        method=method,
        dataset_type=dataset_type,
    )

    return {
        "top_product": top_product,
        "score": top_score,
        "method": method,
        "confidence": confidence_label,
        "confidence_desc": confidence_desc,
        "opportunity": opportunity,
        "reason": reason,
        "strength": interpretation["strength"],
        "method_text": interpretation["method"],
        "real_life": interpretation["real_life"],
        "explanation": explanation,
    }


def get_executive_conclusion(df, health_score, forecast_intelligence=None, recommendation_summary=None):
    conclusion_parts = []

    if "Sales" in df.columns:
        total_sales = pd.to_numeric(df["Sales"], errors="coerce").fillna(0).sum()
        conclusion_parts.append(
            f"The analysed view contains {total_sales:,.2f} in sales/value with a business health score of {health_score}/100."
        )
    else:
        conclusion_parts.append(
            f"The analysed view has a business health score of {health_score}/100, but no usable sales value was detected."
        )

    diagnostics = get_top3_business_diagnostics(df)

    high_dependency_count = sum("High" in item["risk"] for item in diagnostics)

    if high_dependency_count >= 2:
        conclusion_parts.append(
            "Multiple business dimensions show high dependency risk, so the business should avoid relying too heavily on a small number of contributors."
        )
    elif high_dependency_count == 1:
        conclusion_parts.append(
            "One business dimension shows elevated dependency risk, which is worth monitoring but may still be acceptable if the concentration is intentional."
        )
    elif diagnostics:
        conclusion_parts.append(
            "Sales distribution appears reasonably balanced across the available business dimensions."
        )

    if forecast_intelligence:
        conclusion_parts.append(
            f"Forecasting shows {forecast_intelligence['confidence_label'].lower()} and {forecast_intelligence['overall_risk'].lower()}."
        )

    if recommendation_summary:
        conclusion_parts.append(
            f"The strongest recommendation opportunity is {recommendation_summary['opportunity']} with a similarity score of {recommendation_summary['score']:.4f}."
        )

    conclusion_parts.append(
        "Use this report as a decision-support layer, then validate actions using business context such as promotions, stock availability, seasonality, pricing, and customer behaviour."
    )

    return " ".join(conclusion_parts)


def build_pdf_report(df, full_df, dataset_type, filters):
    buffer = BytesIO()

    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=36,
        leftMargin=36,
        topMargin=36,
        bottomMargin=36,
    )

    styles = getSampleStyleSheet()

    styles.add(ParagraphStyle(
        name="TitleCustom",
        parent=styles["Title"],
        fontSize=22,
        leading=28,
        textColor=DARK,
        spaceAfter=12,
    ))

    styles.add(ParagraphStyle(
        name="Subtitle",
        parent=styles["BodyText"],
        fontSize=10,
        leading=15,
        textColor=TEXT,
        spaceAfter=12,
    ))

    styles.add(ParagraphStyle(
        name="SectionTitle",
        parent=styles["Heading2"],
        fontSize=14,
        leading=18,
        textColor=BRAND_BLUE,
        spaceBefore=12,
        spaceAfter=8,
    ))

    styles.add(ParagraphStyle(
        name="SubsectionTitle",
        parent=styles["Heading3"],
        fontSize=11,
        leading=14,
        textColor=DARK,
        spaceBefore=10,
        spaceAfter=6,
    ))

    styles.add(ParagraphStyle(
        name="Body",
        parent=styles["BodyText"],
        fontSize=9,
        leading=13,
        textColor=TEXT,
    ))

    styles.add(ParagraphStyle(
        name="TableCell",
        parent=styles["BodyText"],
        fontSize=7.5,
        leading=9.5,
        textColor=TEXT,
    ))

    story = []
    temp_images = []

    health_score = calculate_business_health_score(df)
    insights = generate_executive_insights(df)
    readable_type = get_dataset_mode_label(df, dataset_type)
    generated_at = datetime.now().strftime("%Y-%m-%d %H:%M")

    has_sales = "Sales" in df.columns
    has_date = "Order_Date" in df.columns and pd.to_datetime(df["Order_Date"], errors="coerce").notna().sum() >= 10
    has_product = has_useful_column(df, "Product_Name")
    has_customer = has_useful_column(df, "Customer_ID")

    can_forecast = has_sales and has_date
    can_recommend = has_product
    can_hybrid = has_product and has_customer and dataset_type == "transaction"

    forecast_intelligence = None
    recommendation_summary = None

    story.append(Paragraph("RetailAI Executive Intelligence Report", styles["TitleCustom"]))
    story.append(Paragraph(
        "Generated from the RetailAI Intelligence Platform — an adaptive analytics system that turns uploaded sales data into business analysis, forecasting intelligence, and recommendation opportunities.",
        styles["Subtitle"]
    ))

    cover_data = [
        ["Report Field", "Value"],
        ["Generated At", generated_at],
        ["Dataset Mode", readable_type],
        ["Total Records", f"{len(df):,}"],
        ["Business Health Score", f"{health_score}/100"],
        ["Forecasting", "Enabled" if can_forecast else "Skipped"],
        ["Recommendations", "Hybrid Enabled" if can_hybrid else "Content-Based Enabled" if can_recommend else "Skipped"],
    ]

    if has_sales:
        cover_data.extend([
            ["Total Sales / Value", f"{pd.to_numeric(df['Sales'], errors='coerce').fillna(0).sum():,.2f}"],
            ["Average Sale / Value", f"{pd.to_numeric(df['Sales'], errors='coerce').fillna(0).mean():,.2f}"],
        ])

    add_table(story, cover_data, styles, col_widths=[2.2 * inch, 4.5 * inch], color_status_column=1)

    add_callout(
        story,
        "Executive Reading Guide",
        "This PDF summarises what the app found: dataset readiness, strategic business concentration, forecasting intelligence, recommendation opportunities, and final business actions.",
        styles,
        tone="blue",
    )

    add_section_title(story, "Dataset Quality & Capability Detection", styles)

    add_subsection_title(story, "Dataset Quality Snapshot", styles)
    add_table(story, get_dataset_quality_table(df), styles, col_widths=[2.4 * inch, 4.3 * inch])

    add_subsection_title(story, "Adaptive Capability Check", styles)
    add_table(
        story,
        get_capability_table(df, dataset_type),
        styles,
        col_widths=[1.7 * inch, 1.5 * inch, 3.5 * inch],
        color_status_column=1,
    )

    add_section_title(story, "Filter Context", styles)

    active_filters = [f"{col}: {', '.join(vals)}" for col, vals in filters.items() if vals]

    if active_filters:
        add_bullet_list(story, active_filters, styles)
    else:
        add_paragraph(story, "No filters were applied. This report reflects the current full active dataset.", styles)

    add_section_title(story, "Executive Insights", styles)

    if insights:
        for insight in insights:
            add_paragraph(story, f"{insight['title']}: {insight['body']}", styles)
    else:
        add_paragraph(story, "No executive insights were generated for this dataset.", styles)

    story.append(PageBreak())

    add_section_title(story, "Business Analysis Intelligence", styles)

    business_rows = build_business_summary_table(df)

    if len(business_rows) > 1:
        add_subsection_title(story, "Top Performer Summary", styles)
        add_table(
            story,
            business_rows,
            styles,
            col_widths=[1.25 * inch, 2.8 * inch, 1.35 * inch, 1.0 * inch],
        )
    else:
        add_paragraph(
            story,
            "Business analysis was limited because this dataset does not contain useful grouping columns such as Region, Category, Segment, Product, or State.",
            styles,
        )

    diagnostics_table, diagnostics = build_business_diagnostics_table(df)

    if len(diagnostics_table) > 1:
        add_subsection_title(story, "Strategic Business Diagnostics", styles)

        add_table(
            story,
            diagnostics_table,
            styles,
            col_widths=[1.35 * inch, 2.35 * inch, 0.85 * inch, 1.1 * inch, 1.05 * inch],
            color_status_column=4,
        )

        high_risk_count = sum("High" in item["risk"] for item in diagnostics)

        if high_risk_count >= 2:
            add_callout(
                story,
                "Business Dependency Warning",
                "Multiple dimensions show high dependency risk. This means sales may rely too heavily on a small group of regions, categories, segments, products, or states.",
                styles,
                tone="red",
            )
        elif high_risk_count == 1:
            add_callout(
                story,
                "Business Dependency Watch",
                "One dimension shows elevated dependency risk. This is worth monitoring, especially if the concentration is not intentional.",
                styles,
                tone="amber",
            )
        else:
            add_callout(
                story,
                "Business Diversification Signal",
                "No major high dependency risk was detected from the available business dimensions.",
                styles,
                tone="green",
            )

    chart_specs = []

    if has_sales:
        if has_useful_column(df, "Region"):
            chart_specs.append(("Region", "Sales", "Sales by Region", False))
        if has_useful_column(df, "Category"):
            chart_specs.append(("Category", "Sales", "Sales by Category", False))
        if has_useful_column(df, "Segment"):
            chart_specs.append(("Segment", "Sales", "Sales by Segment", False))
        if has_useful_column(df, "Product_Name"):
            chart_specs.append(("Product_Name", "Sales", "Top Products by Sales", True))
        if has_useful_column(df, "State"):
            chart_specs.append(("State", "Sales", "Top States by Sales", False))

    for group_col, value_col, title, horizontal in chart_specs:
        try:
            chart_path = create_bar_chart(df, group_col, value_col, title, top_n=10, horizontal=horizontal)

            if chart_path:
                temp_images.append(chart_path)
                story.append(Paragraph(clean_text(title), styles["SubsectionTitle"]))
                story.append(Image(chart_path, width=6.5 * inch, height=3.7 * inch))
                story.append(Spacer(1, 8))

                add_chart_interpretation_block(
                    story=story,
                    df=df,
                    group_col=group_col,
                    styles=styles,
                    chart_title=title,
                )
        except Exception:
            add_paragraph(story, f"{title} could not be generated for this dataset.", styles)

    business_explanations = generate_business_analysis_explanation(df, full_df)

    if business_explanations:
        add_subsection_title(story, "Overall Business Interpretation", styles)

        for item in business_explanations:
            add_callout(
                story,
                item.get("title", "Business Insight"),
                item.get("body", ""),
                styles,
                tone="blue",
            )

    if can_forecast:
        story.append(PageBreak())
        add_section_title(story, "Forecast Intelligence Engine", styles)

        try:
            weekly_df, prediction_df, metrics, future_df = train_weekly_knn_forecast(df)

            if weekly_df is not None:
                risk_label, risk_desc = get_forecast_risk(metrics)
                forecast_intelligence = generate_forecast_intelligence(weekly_df, prediction_df, metrics, future_df)
                forecast_interpretation = interpret_forecast(metrics, future_df)
                trend_label, trend_desc = get_future_trend_label(future_df)
                anomalies = detect_forecast_anomalies(prediction_df)

                metric_table = [
                    ["Metric", "Value", "Meaning"],
                    ["Model", "Weekly KNN", "Forecasting model used"],
                    ["RMSE", f"{metrics['RMSE']:,.2f}", "Large-error sensitivity"],
                    ["MAE", f"{metrics['MAE']:,.2f}", "Average forecast error"],
                    ["R²", f"{metrics['R2']:.4f}", "Model signal strength"],
                    ["WAPE", f"{metrics['WAPE']:.2f}%", "Business-friendly error rate"],
                    ["Forecast Risk", risk_label, risk_desc],
                ]

                add_subsection_title(story, "Forecast Model KPIs", styles)
                add_table(
                    story,
                    metric_table,
                    styles,
                    col_widths=[1.35 * inch, 1.35 * inch, 4.0 * inch],
                    color_status_column=1,
                )

                add_callout(
                    story,
                    "Accuracy Interpretation",
                    forecast_interpretation["accuracy"],
                    styles,
                    tone="blue",
                )

                add_callout(
                    story,
                    "Model Signal Interpretation",
                    forecast_interpretation["r2"],
                    styles,
                    tone="blue",
                )

                add_callout(
                    story,
                    "Forecast Bias Interpretation",
                    forecast_interpretation["bias"],
                    styles,
                    tone="gray",
                )

                intelligence_table = [
                    ["Intelligence Signal", "Result", "Explanation"],
                    [
                        "Forecast Confidence",
                        f"{forecast_intelligence['confidence_label']} ({forecast_intelligence['confidence_score']}/100)",
                        forecast_intelligence["confidence_description"],
                    ],
                    [
                        "Demand Stability",
                        forecast_intelligence["stability"]["level"],
                        forecast_intelligence["stability"]["description"],
                    ],
                    [
                        "Recent Momentum",
                        forecast_intelligence["momentum"]["level"],
                        forecast_intelligence["momentum"]["description"],
                    ],
                    [
                        "Inventory Pressure",
                        forecast_intelligence["inventory_pressure"]["level"],
                        forecast_intelligence["inventory_pressure"]["description"],
                    ],
                    [
                        "Spike Risk",
                        forecast_intelligence["spike_risk"]["level"],
                        forecast_intelligence["spike_risk"]["description"],
                    ],
                    [
                        "Overall Forecast Risk",
                        forecast_intelligence["overall_risk"],
                        forecast_intelligence["overall_description"],
                    ],
                ]

                add_subsection_title(story, "Forecast Intelligence Diagnostics", styles)
                add_table(
                    story,
                    intelligence_table,
                    styles,
                    col_widths=[1.55 * inch, 1.65 * inch, 3.5 * inch],
                    color_status_column=1,
                )

                add_callout(
                    story,
                    "RetailAI Forecast Readout",
                    forecast_intelligence["executive_summary"],
                    styles,
                    tone="blue",
                )

                add_callout(
                    story,
                    "Trend Direction Interpretation",
                    f"{trend_label}: {trend_desc}",
                    styles,
                    tone="green" if "Upward" in trend_label else "red" if "Downward" in trend_label else "amber",
                )

                if forecast_intelligence.get("recommended_actions"):
                    add_subsection_title(story, "Forecast Intelligence Action Plan", styles)
                    add_bullet_list(story, forecast_intelligence["recommended_actions"], styles)

                forecast_chart = create_forecast_chart(prediction_df)
                temp_images.append(forecast_chart)

                story.append(Paragraph("Actual vs Predicted Weekly Sales", styles["SubsectionTitle"]))
                story.append(Image(forecast_chart, width=6.5 * inch, height=3.7 * inch))
                story.append(Spacer(1, 8))

                add_callout(
                    story,
                    "How to Read This Visual",
                    "When the predicted line follows the actual line closely, the model is tracking demand well. Large gaps may point to promotions, holidays, stock-outs, sudden demand changes, or missing business factors.",
                    styles,
                    tone="blue",
                )

                if anomalies is not None and not anomalies.empty:
                    anomaly_table = [["Week", "Actual", "Predicted", "Error", "Possible Meaning"]]

                    anomaly_display = anomalies.head(8).copy()

                    for _, row in anomaly_display.iterrows():
                        anomaly_table.append([
                            str(row["Week"].date()) if hasattr(row["Week"], "date") else str(row["Week"]),
                            f"{row['Actual_Sales']:,.2f}",
                            f"{row['Predicted_Sales']:,.2f}",
                            f"{row['Error']:,.2f}",
                            row.get("Possible Meaning", "Unusual demand movement."),
                        ])

                    add_subsection_title(story, "Forecast Anomaly Check", styles)
                    add_table(
                        story,
                        anomaly_table,
                        styles,
                        col_widths=[0.9 * inch, 1.0 * inch, 1.0 * inch, 0.9 * inch, 2.9 * inch],
                    )

                    add_callout(
                        story,
                        "Anomaly Interpretation",
                        "Some weeks had unusually large forecast errors. Review these weeks manually because they may reflect campaigns, holidays, stock issues, data entry problems, or unexpected demand.",
                        styles,
                        tone="amber",
                    )
                else:
                    add_callout(
                        story,
                        "Anomaly Interpretation",
                        "No major unusual forecast-error weeks were detected. This suggests forecast errors are not being heavily distorted by obvious unusual weeks.",
                        styles,
                        tone="green",
                    )

                future_table = [["Future Week", "Predicted Sales"]]

                for _, row in future_df.iterrows():
                    future_table.append([
                        str(row["Future Week"].date()),
                        f"{row['Predicted Sales']:,.2f}",
                    ])

                add_subsection_title(story, "Next 4-Week Forecast", styles)
                add_table(story, future_table, styles, col_widths=[2.4 * inch, 4.3 * inch])

                if forecast_interpretation["future"]:
                    add_callout(
                        story,
                        "Planning Meaning",
                        forecast_interpretation["future"],
                        styles,
                        tone="blue",
                    )

                add_callout(
                    story,
                    "Forecasting Interpretation",
                    "The forecast should be used as directional planning guidance for inventory, staffing, weekly targets, and promotion timing. It should not be treated as a guaranteed sales promise.",
                    styles,
                    tone="gray",
                )
            else:
                add_paragraph(story, "Forecasting was skipped because there was not enough weekly sales history after feature engineering.", styles)

        except Exception:
            add_paragraph(story, "Forecasting section could not be generated for this dataset.", styles)
    else:
        story.append(PageBreak())
        add_section_title(story, "Forecast Intelligence Engine", styles)
        add_paragraph(
            story,
            "Forecasting was skipped because this dataset does not contain enough usable date-based sales history. Forecasting requires both sales values and date records.",
            styles,
        )

    story.append(PageBreak())
    add_section_title(story, "Recommendation Intelligence", styles)

    selected_product, rec_df, rec_mode = get_recommendation_summary(df, full_df, dataset_type)

    if selected_product is not None:
        add_paragraph(story, f"Reference Product: {selected_product}", styles)

    if rec_mode:
        add_paragraph(story, f"Recommendation Mode: {rec_mode}", styles)

    if rec_df is not None and not rec_df.empty:
        rec_table = build_recommendation_table(rec_df, dataset_type)

        add_subsection_title(story, "Recommended Product Matches", styles)
        add_table(
            story,
            rec_table,
            styles,
            col_widths=[1.75 * inch, 0.6 * inch, 0.85 * inch, 1.15 * inch, 1.65 * inch, 0.7 * inch],
            color_status_column=2,
        )

        recommendation_summary = build_recommendation_explanation(selected_product, rec_df, dataset_type)

        if recommendation_summary:
            summary_table = [
                ["Signal", "Result"],
                ["Selected Product", selected_product],
                ["Top Match", recommendation_summary["top_product"]],
                ["Similarity Score", f"{recommendation_summary['score']:.4f}"],
                ["Recommendation Confidence", recommendation_summary["confidence"]],
                ["Opportunity Type", recommendation_summary["opportunity"]],
                ["Simple Reason", recommendation_summary["reason"]],
                ["Recommendation Method", recommendation_summary["method"]],
            ]

            add_subsection_title(story, "Top Recommendation Intelligence", styles)
            add_table(
                story,
                summary_table,
                styles,
                col_widths=[2.2 * inch, 4.5 * inch],
                color_status_column=1,
            )

            add_callout(
                story,
                "Why This Recommendation?",
                recommendation_summary["explanation"],
                styles,
                tone="blue",
            )

            add_callout(
                story,
                "Recommendation Strength Meaning",
                recommendation_summary["strength"],
                styles,
                tone="green" if "strong" in recommendation_summary["confidence"].lower() else "amber" if "moderate" in recommendation_summary["confidence"].lower() else "red",
            )

            add_callout(
                story,
                "How To Use This In Business",
                recommendation_summary["real_life"],
                styles,
                tone="gray",
            )

            actions = generate_action_recommendations(
                df=df,
                dataset_type=dataset_type,
                forecast_metrics=None,
                future_df=None,
                rec_df=rec_df,
            )

            if actions:
                add_subsection_title(story, "Recommendation Action Plan", styles)
                add_bullet_list(story, actions, styles)
    else:
        add_paragraph(
            story,
            "Recommendations were skipped because the dataset does not contain enough usable product-level information.",
            styles,
        )

    story.append(PageBreak())
    add_section_title(story, "Executive Conclusion", styles)

    conclusion = get_executive_conclusion(
        df=df,
        health_score=health_score,
        forecast_intelligence=forecast_intelligence,
        recommendation_summary=recommendation_summary,
    )

    add_callout(
        story,
        "Final Readout",
        conclusion,
        styles,
        tone="blue",
    )

    add_section_title(story, "Final Action Plan", styles)

    final_actions = [
        "Review the strongest sales drivers and check whether the business is overly dependent on one region, category, segment, or product.",
        "Use the top-3 concentration diagnostics to balance growth focus with dependency risk management.",
        "Use forecasting as a planning signal for stock, staffing, promotions, and weekly targets, especially when confidence is moderate or high.",
        "Use recommendations as cross-sell or product discovery ideas, then validate them with commercial judgement.",
        "Improve future datasets by adding date, product, customer, category, promotion, stock, price, discount, cost, and profit fields where possible.",
    ]

    add_bullet_list(story, final_actions, styles)

    add_section_title(story, "Important Notes", styles)

    add_paragraph(
        story,
        "This report adapts automatically based on the uploaded dataset. Missing columns may cause some sections to be skipped intentionally rather than breaking the report.",
        styles,
    )

    add_paragraph(
        story,
        "Forecasts and recommendations are decision-support tools. They should be used alongside business context, domain knowledge, promotions, stock levels, seasonality, pricing information, and customer behaviour.",
        styles,
    )

    doc.build(story)

    for path in temp_images:
        try:
            os.remove(path)
        except Exception:
            pass

    buffer.seek(0)
    return buffer.getvalue()
