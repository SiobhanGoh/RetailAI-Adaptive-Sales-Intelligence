# app_pages/business_analysis.py

import html
import pandas as pd
import streamlit as st
import plotly.express as px

from utils.ui import (
    render_kpi_card,
    render_empty_state_card,
    apply_retailai_chart_style,
    get_retailai_plotly_template,
    CHART_COLOR_SEQUENCE,
    PASTEL_THEME,
)


def get_template():
    return get_retailai_plotly_template()


def safe(value):
    return html.escape(str(value))


def has_useful_column(df, column):
    if df is None or column not in df.columns:
        return False

    values = df[column].dropna().astype(str).str.strip()
    values = values[values != ""]
    values = values[values.str.lower() != "unknown"]

    return values.nunique() > 0


def make_grouped_sales(df, group_col, top_n=None):
    if df is None or df.empty:
        return None

    if "Sales" not in df.columns:
        return None

    if not has_useful_column(df, group_col):
        return None

    grouped = (
        df.groupby(group_col)["Sales"]
        .sum()
        .sort_values(ascending=False)
        .reset_index()
    )

    grouped = grouped[grouped[group_col].astype(str).str.lower() != "unknown"]

    if grouped.empty:
        return None

    if top_n:
        grouped = grouped.head(top_n)

    return grouped


def render_bar_chart(df, x_col, y_col, orientation="v", height=420):
    if df is None or df.empty:
        return None

    if orientation == "h":
        fig = px.bar(
            df,
            x=x_col,
            y=y_col,
            orientation="h",
            text=x_col,
            color_discrete_sequence=CHART_COLOR_SEQUENCE,
        )
    else:
        fig = px.bar(
            df,
            x=x_col,
            y=y_col,
            text=y_col,
            color_discrete_sequence=CHART_COLOR_SEQUENCE,
        )

    fig.update_traces(
        texttemplate="%{text:,.0f}",
        textposition="outside",
        marker_color=CHART_COLOR_SEQUENCE[0],
        marker_line_color="rgba(219,39,119,0.18)",
        marker_line_width=0.6,
    )

    apply_retailai_chart_style(
        fig,
        height=height,
        showlegend=False,
    )

    return fig


def get_chart_insight(grouped_df, label_col, value_col="Sales"):
    if grouped_df is None or grouped_df.empty:
        return None

    if label_col not in grouped_df.columns or value_col not in grouped_df.columns:
        return None

    total_value = grouped_df[value_col].sum()

    if total_value <= 0:
        return None

    top_3 = grouped_df.head(3).copy()
    top_3_value = top_3[value_col].sum()
    top_3_share = (top_3_value / total_value) * 100

    top_names = top_3[label_col].astype(str).tolist()

    top_3_items = []

    for index, row in top_3.iterrows():
        item_name = str(row[label_col])
        item_value = row[value_col]
        item_share = (item_value / total_value) * 100 if total_value else 0

        top_3_items.append({
            "name": item_name,
            "value": item_value,
            "share": item_share,
        })

    top_row = grouped_df.iloc[0]
    top_name = str(top_row[label_col])
    top_value = top_row[value_col]
    top_share = (top_value / total_value) * 100

    if len(grouped_df) >= 3:
        third_value = grouped_df.iloc[2][value_col]
    else:
        third_value = 0

    remaining_value = total_value - top_3_value
    remaining_share = (remaining_value / total_value) * 100 if total_value else 0

    if top_3_share >= 75:
        concentration_label = "Very High Concentration"
        risk_level = "High Dependency Risk"
        concentration_desc = (
            "A small group of leaders controls most of the sales value. "
            "This is powerful if intentional, but risky because performance depends heavily on a few contributors."
        )
        action = (
            "Protect the top contributors, but develop secondary performers to reduce over-dependence."
        )
    elif top_3_share >= 55:
        concentration_label = "Moderate Concentration"
        risk_level = "Manageable Dependency"
        concentration_desc = (
            "The top 3 contributors drive a meaningful share of sales, while the rest of the mix still provides some balance."
        )
        action = (
            "Support the top contributors while gradually strengthening mid-tier contributors."
        )
    elif top_3_share >= 35:
        concentration_label = "Balanced Mix"
        risk_level = "Healthy Diversification"
        concentration_desc = (
            "Sales are reasonably spread out. The business has clear leaders, but it is not overly dependent on only a few contributors."
        )
        action = (
            "Maintain broad support while using the top contributors as campaign or product planning anchors."
        )
    else:
        concentration_label = "Highly Diversified Distribution"
        risk_level = "Low Dependency Risk"
        concentration_desc = (
            "Sales are spread across many contributors, which reduces dependency risk but may make it harder to identify clear winners."
        )
        action = (
            "Use broader campaigns and recommendation strategies to discover where stronger winners can be developed."
        )

    if len(grouped_df) == 1:
        concentration_label = "Single Contributor View"
        risk_level = "Limited Comparison"
        concentration_desc = (
            "Only one contributor is available in this view, so concentration cannot be compared meaningfully."
        )
        action = (
            "Use a richer dataset or remove filters to compare more contributors."
        )

    return {
        "top_name": top_name,
        "top_value": top_value,
        "top_share": top_share,
        "top_3_names": top_names,
        "top_3_items": top_3_items,
        "top_3_value": top_3_value,
        "top_3_share": top_3_share,
        "remaining_value": remaining_value,
        "remaining_share": remaining_share,
        "third_value": third_value,
        "concentration_label": concentration_label,
        "risk_level": risk_level,
        "concentration_desc": concentration_desc,
        "action": action,
    }


def render_chart_explanation(title, insight, icon="💡"):
    if not insight:
        st.info("Not enough data to generate a chart-specific interpretation.")
        return

    ranked_items_html = ""

    for rank, item in enumerate(insight.get("top_3_items", []), start=1):
        ranked_items_html += f"""
<div style="
font-size:14px;
color:#374151;
line-height:1.55;
margin-bottom:6px;
">
<b>{rank}. {safe(item["name"])}</b> 
<span style="color:#6B7280;">({item["value"]:,.2f} | {item["share"]:.1f}%)</span>
</div>
"""

    st.markdown(
        f"""
<div class="premium-card" style="
padding:22px;
border-radius:20px;
border:1px solid rgba(249,168,212,0.28);
background:linear-gradient(135deg,rgba(255,255,255,0.86),rgba(252,231,243,0.30));
box-shadow:0 8px 24px rgba(31,41,55,0.06);
min-height:360px;
margin-top:4px;
">

<div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;">
<span style="font-size:20px;">{safe(icon)}</span>
<span style="
font-size:13px;
font-weight:850;
color:#9CA3AF;
text-transform:uppercase;
letter-spacing:0.4px;
">
{safe(title)}
</span>
</div>

<div style="
font-size:12px;
font-weight:800;
color:#9CA3AF;
text-transform:uppercase;
margin-bottom:8px;
">
Top 3 Contributors
</div>

<div style="
margin-bottom:14px;
">
{ranked_items_html}
</div>

<div style="
font-size:13px;
color:#6B7280;
line-height:1.6;
margin-bottom:18px;
">
Together, they contribute <b>{insight["top_3_share"]:.1f}%</b> of this chart's total sales.
The remaining contributors make up <b>{insight["remaining_share"]:.1f}%</b>.
</div>

<div style="
font-size:12px;
font-weight:800;
color:#9CA3AF;
text-transform:uppercase;
margin-bottom:6px;
">
Business Structure
</div>

<div style="
font-size:15px;
font-weight:850;
line-height:1.5;
margin-bottom:12px;
">
{safe(insight["concentration_label"])}
</div>

<div style="
font-size:13px;
color:#6B7280;
line-height:1.6;
margin-bottom:18px;
">
{safe(insight["concentration_desc"])}
</div>

<div style="
font-size:12px;
font-weight:800;
color:#9CA3AF;
text-transform:uppercase;
margin-bottom:6px;
">
Strategic Risk
</div>

<div style="
font-size:14px;
font-weight:750;
line-height:1.5;
margin-bottom:12px;
">
{safe(insight["risk_level"])}
</div>

<div style="
font-size:12px;
font-weight:800;
color:#9CA3AF;
text-transform:uppercase;
margin-bottom:6px;
">
Recommended Action
</div>

<div style="
font-size:13px;
color:#6B7280;
line-height:1.55;
">
{safe(insight["action"])}
</div>

</div>
        """,
        unsafe_allow_html=True
    )


def render_unavailable_card(title, reason):
    render_empty_state_card(
        f"{title} Unavailable",
        reason,
        ["A recognised sales/value field", "A useful grouping field", "Enough non-empty records after filtering"],
        "🧩",
        "info",
    )


def render_chart_section(section_title, chart_df, label_col, insight_title, icon, orientation="v", height=420):
    st.subheader(section_title)

    chart_col, insight_col = st.columns([2.1, 1])

    with chart_col:
        if chart_df is not None and not chart_df.empty:
            fig = render_bar_chart(
                chart_df,
                label_col if orientation == "v" else "Sales",
                "Sales" if orientation == "v" else label_col,
                orientation=orientation,
                height=height
            )
            st.plotly_chart(fig, use_container_width=True)
        else:
            render_unavailable_card(
                section_title,
                f"This dataset does not contain enough useful {label_col} information."
            )

    with insight_col:
        render_chart_explanation(
            insight_title,
            get_chart_insight(chart_df, label_col, "Sales"),
            icon
        )


def build_business_diagnostics(df):
    diagnostics = []

    if df is None or df.empty or "Sales" not in df.columns:
        return diagnostics

    dimensions = [
        ("Region", "Regional Dependency"),
        ("Category", "Category Concentration"),
        ("Segment", "Segment Dependence"),
        ("Product_Name", "Product Portfolio"),
    ]

    for col, label in dimensions:
        grouped = make_grouped_sales(df, col)
        insight = get_chart_insight(grouped, col, "Sales")

        if insight:
            diagnostics.append({
                "Signal": label,
                "Top 3 Share": f"{insight['top_3_share']:.1f}%",
                "Status": insight["concentration_label"],
                "Risk": insight["risk_level"],
            })

    return diagnostics



def render_business_alert(title, message, actions=None, icon="⚠️", tone="warning"):
    tone_styles = {
        "warning": ("#B45309", "rgba(255,237,213,0.78)", "rgba(251,191,36,0.34)"),
        "info": ("#0369A1", "rgba(224,242,254,0.72)", "rgba(147,197,253,0.34)"),
        "success": ("#047857", "rgba(220,252,231,0.72)", "rgba(134,239,172,0.34)"),
    }
    color, bg, border = tone_styles.get(tone, tone_styles["warning"])

    action_html = ""
    if actions:
        action_items = "".join(f"<li style='margin-bottom:5px;'>{safe(item)}</li>" for item in actions)
        action_html = (
            f"<div style='margin-top:12px;padding:12px 14px;border-radius:14px;"
            f"background:rgba(255,255,255,0.58);border:1px solid rgba(249,168,212,0.22);'>"
            f"<div style='font-size:12px;font-weight:850;color:{color};text-transform:uppercase;"
            f"letter-spacing:0.35px;margin-bottom:6px;'>Recommended focus</div>"
            f"<ul style='margin:0;padding-left:18px;color:#6B7280;font-size:13px;line-height:1.55;'>{action_items}</ul></div>"
        )

    html_block = (
        f"<div class='premium-card' style='padding:22px;border-radius:22px;border:1px solid {border};"
        f"background:linear-gradient(135deg,{bg},rgba(255,255,255,0.78));"
        f"box-shadow:0 8px 24px rgba(31,41,55,0.06);margin:12px 0 18px 0;"
        f"max-width:100%;overflow-wrap:anywhere;'>"
        f"<div style='display:flex;gap:14px;align-items:flex-start;'>"
        f"<div style='font-size:24px;line-height:1;flex:0 0 auto;'>{safe(icon)}</div>"
        f"<div style='flex:1;min-width:0;'>"
        f"<div style='font-size:15px;font-weight:900;color:#1F2937;margin-bottom:6px;'>{safe(title)}</div>"
        f"<div style='font-size:13px;color:#6B7280;line-height:1.6;'>{safe(message)}</div>"
        f"{action_html}</div></div></div>"
    )
    st.markdown(html_block, unsafe_allow_html=True)

def render_diagnostics_panel(df):
    diagnostics = build_business_diagnostics(df)

    if not diagnostics:
        return

    st.subheader("Strategic Business Diagnostics")

    st.caption(
        "This panel summarises whether sales are concentrated around a few winners or diversified across many contributors."
    )

    diag_df = pd.DataFrame(diagnostics)

    st.dataframe(diag_df, use_container_width=True)

    high_risk_count = sum("High" in item["Risk"] for item in diagnostics)

    if high_risk_count >= 2:
        render_business_alert(
            "Business Dependency Warning",
            "Multiple dimensions show high concentration. This can be commercially useful when intentional, but it increases exposure if one key contributor weakens.",
            ["Protect top performers", "Develop secondary contributors", "Monitor concentration over time"],
            "⚠️",
            "warning",
        )
    elif high_risk_count == 1:
        render_business_alert(
            "Dependency Watch",
            "One dimension shows elevated concentration. This is worth monitoring, especially if the concentration is not part of a deliberate business strategy.",
            ["Track the leading contributor", "Compare against the next two contributors", "Build backup growth areas"],
            "📌",
            "info",
        )
    else:
        st.success(
            "No major dependency risk detected across the available business dimensions."
        )


def render(df, full_df=None):
    st.title("Business Analysis")

    st.caption(
        "Interactive business intelligence view of sales patterns, product performance, and category performance."
    )

    if df.empty:
        render_empty_state_card("No Matching Records", "The current filter selection does not return any rows for business analysis.", ["Broaden filter selections", "Clear highly specific filters", "Confirm the uploaded dataset contains records"], "🔎", "warning")
        return

    if "Sales" not in df.columns:
        render_empty_state_card("Business Analysis Unavailable", "RetailAI could not identify a usable sales, revenue, amount, or value field for business analysis.", ["Sales", "Revenue", "Amount", "Value", "Total"], "💳", "danger")
        return

    filtered_region = make_grouped_sales(df, "Region")
    filtered_category = make_grouped_sales(df, "Category")
    filtered_segment = make_grouped_sales(df, "Segment")
    filtered_top_products = make_grouped_sales(df, "Product_Name", top_n=10)
    filtered_top_states = make_grouped_sales(df, "State", top_n=10)

    if has_useful_column(df, "Weekday"):
        filtered_weekday = (
            df.groupby("Weekday")["Sales"]
            .sum()
            .reindex([
                "Monday",
                "Tuesday",
                "Wednesday",
                "Thursday",
                "Friday",
                "Saturday",
                "Sunday"
            ])
            .fillna(0)
            .reset_index()
        )
    else:
        filtered_weekday = None

    st.subheader("Key Insights")

    best_region = filtered_region.iloc[0]["Region"] if filtered_region is not None and not filtered_region.empty else "N/A"
    best_category = filtered_category.iloc[0]["Category"] if filtered_category is not None and not filtered_category.empty else "N/A"
    best_segment = filtered_segment.iloc[0]["Segment"] if filtered_segment is not None and not filtered_segment.empty else "N/A"
    best_state = filtered_top_states.iloc[0]["State"] if filtered_top_states is not None and not filtered_top_states.empty else "N/A"

    c1, c2, c3, c4 = st.columns(4)

    with c1:
        render_kpi_card("Top Region", best_region, "Highest sales location in the current filtered view.")

    with c2:
        render_kpi_card("Top Category", best_category, "Product group generating the strongest sales contribution.")

    with c3:
        render_kpi_card("Top Segment", best_segment, "Customer segment currently contributing the most sales.")

    with c4:
        render_kpi_card("Top State", best_state, "Best-performing state based on current sales value.")

    st.markdown("---")

    render_diagnostics_panel(df)

    st.markdown("---")

    render_chart_section("Sales by Region", filtered_region, "Region", "Regional Interpretation", "📍")
    render_chart_section("Sales by Category", filtered_category, "Category", "Category Interpretation", "📦")
    render_chart_section("Sales by Segment", filtered_segment, "Segment", "Segment Interpretation", "👥")
    render_chart_section("Sales by Weekday", filtered_weekday, "Weekday", "Weekday Interpretation", "📅")

    st.subheader("Top 10 Products by Sales")

    product_col, product_insight_col = st.columns([2.1, 1])

    with product_col:
        if filtered_top_products is not None and not filtered_top_products.empty:
            product_chart = filtered_top_products.sort_values("Sales", ascending=True)

            fig = px.bar(
                product_chart,
                x="Sales",
                y="Product_Name",
                orientation="h",
                text="Sales",
            )

            fig.update_traces(
                texttemplate="%{text:,.0f}",
                textposition="outside",
                marker_color=CHART_COLOR_SEQUENCE[0],
                marker_line_color="rgba(219,39,119,0.18)",
                marker_line_width=0.6,
                hovertemplate="Product: %{y}<br>Sales: %{x:,.2f}<extra></extra>"
            )

            apply_retailai_chart_style(
                fig,
                height=470,
                title=None,
                showlegend=False,
            )

            fig.update_layout(
                yaxis_title="Product",
                xaxis_title="Sales",
                margin=dict(l=24, r=36, t=20, b=36),
            )

            st.plotly_chart(fig, use_container_width=True)

        else:
            render_unavailable_card(
                "Top Products",
                "This dataset does not contain product-level data."
            )

    with product_insight_col:
        render_chart_explanation(
            "Product Interpretation",
            get_chart_insight(filtered_top_products, "Product_Name", "Sales"),
            "🔥"
        )

    render_chart_section(
        "Top 10 States by Sales",
        filtered_top_states,
        "State",
        "State Interpretation",
        "🗺️"
    )

    st.markdown("---")

    if filtered_top_products is not None and not filtered_top_products.empty:
        st.subheader("Pareto Analysis")

        pareto_df = (
            filtered_top_products
            .sort_values("Sales", ascending=False)
            .copy()
        )

        pareto_df["Cumulative Sales"] = pareto_df["Sales"].cumsum()

        pareto_df["Cumulative %"] = (
            pareto_df["Cumulative Sales"]
            / pareto_df["Sales"].sum()
        ) * 100

        pareto_col1, pareto_col2 = st.columns([2.1, 1])

        with pareto_col1:
            fig = px.bar(
                pareto_df,
                x="Product_Name",
                y="Sales",
                text="Sales",
                color_discrete_sequence=[CHART_COLOR_SEQUENCE[0]],
            )

            fig.update_traces(
                marker_color=CHART_COLOR_SEQUENCE[0],
                marker_line_color="rgba(219,39,119,0.18)",
                marker_line_width=0.6,
                selector=dict(type="bar"),
            )

            fig.add_scatter(
                x=pareto_df["Product_Name"],
                y=pareto_df["Cumulative %"],
                mode="lines+markers",
                yaxis="y2",
                name="Cumulative %",
                line=dict(color="#FCA5A5", width=2.6),
                marker=dict(color="#FBCFE8", size=8, line=dict(color="#FB7185", width=1)),
            )

            apply_retailai_chart_style(
                fig,
                height=500,
                title=None,
                showlegend=True,
            )

            fig.update_layout(
                margin=dict(l=24, r=36, t=20, b=92),
                xaxis_title="Product",
                yaxis_title="Sales",
                legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1),
                yaxis2=dict(
                    title="Cumulative %",
                    overlaying="y",
                    side="right",
                    range=[0, 110],
                    gridcolor="rgba(0,0,0,0)",
                    zeroline=False,
                    tickfont=dict(color=PASTEL_THEME["muted"]),
                    title_font=dict(color=PASTEL_THEME["muted"]),
                ),
            )

            st.plotly_chart(fig, use_container_width=True)

        with pareto_col2:
            render_chart_explanation(
                "Pareto Interpretation",
                get_chart_insight(pareto_df, "Product_Name", "Sales"),
                "📈"
            )

    st.markdown("---")

    if "Order_Date" in df.columns:
        heatmap_df = df.copy()

        heatmap_df["Order_Date"] = pd.to_datetime(
            heatmap_df["Order_Date"],
            errors="coerce"
        )

        heatmap_df = heatmap_df.dropna(subset=["Order_Date"])

        if not heatmap_df.empty:
            heatmap_df["Month"] = heatmap_df["Order_Date"].dt.strftime("%b")
            heatmap_df["Weekday"] = heatmap_df["Order_Date"].dt.day_name()

            weekday_order = [
                "Monday",
                "Tuesday",
                "Wednesday",
                "Thursday",
                "Friday",
                "Saturday",
                "Sunday"
            ]

            month_order = [
                "Jan", "Feb", "Mar", "Apr", "May", "Jun",
                "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
            ]

            heatmap_pivot = (
                heatmap_df.pivot_table(
                    index="Weekday",
                    columns="Month",
                    values="Sales",
                    aggfunc="sum"
                )
                .reindex(weekday_order)
            )

            heatmap_pivot = heatmap_pivot[
                [m for m in month_order if m in heatmap_pivot.columns]
            ]

            st.subheader("Sales Activity Heatmap")

            heatmap_col1, heatmap_col2 = st.columns([2.1, 1])

            with heatmap_col1:
                fig = px.imshow(
                    heatmap_pivot,
                    aspect="auto",
                    text_auto=".0f",
                    color_continuous_scale=[
                        "#FFF7FB",
                        "#FCE7F3",
                        "#FBCFE8",
                        "#F9A8D4",
                        "#F472B6",
                    ],
                )

                apply_retailai_chart_style(
                    fig,
                    height=450,
                    title=None,
                    showlegend=False,
                )

                fig.update_layout(
                    margin=dict(l=24, r=24, t=20, b=28),
                    coloraxis_colorbar=dict(
                        title="Sales",
                        tickfont=dict(color=PASTEL_THEME["muted"]),
                        title_font=dict(color=PASTEL_THEME["muted"]),
                    ),
                )

                fig.update_xaxes(title_text="Month")
                fig.update_yaxes(title_text="Weekday")

                st.plotly_chart(fig, use_container_width=True)

            with heatmap_col2:
                heatmap_total = heatmap_df["Sales"].sum()

                # Find the strongest exact weekday + month cell, not the strongest
                # weekday and strongest month independently. This ensures the
                # interpretation matches the darkest/highest heatmap tile.
                heatmap_matrix = heatmap_pivot.fillna(0)
                strongest_cell_position = heatmap_matrix.stack().idxmax()
                strongest_day = strongest_cell_position[0]
                strongest_month = strongest_cell_position[1]
                strongest_cell_value = heatmap_matrix.loc[strongest_day, strongest_month]
                strongest_cell_share = (strongest_cell_value / heatmap_total) * 100 if heatmap_total else 0

                st.markdown(
                    f"""
<div class="premium-card" style="
padding:22px;
border-radius:20px;
border:1px solid rgba(249,168,212,0.28);
background:linear-gradient(135deg,rgba(255,255,255,0.86),rgba(252,231,243,0.30));
box-shadow:0 8px 24px rgba(31,41,55,0.06);
min-height:300px;
margin-top:4px;
">

<div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;">
<span style="font-size:20px;">🔥</span>
<span style="
font-size:13px;
font-weight:850;
color:#9CA3AF;
text-transform:uppercase;
letter-spacing:0.4px;
">
Heatmap Interpretation
</span>
</div>

<div style="
font-size:12px;
font-weight:800;
color:#9CA3AF;
text-transform:uppercase;
margin-bottom:6px;
">
Strongest Activity Pattern
</div>

<div style="
font-size:18px;
font-weight:850;
line-height:1.45;
margin-bottom:10px;
">
{safe(strongest_day)} + {safe(strongest_month)} <span style="color:#6B7280;font-weight:750;">({strongest_cell_value:,.0f})</span>
</div>

<div style="
font-size:13px;
color:#6B7280;
line-height:1.6;
margin-bottom:18px;
">
This strongest activity cell contributes around <b>{strongest_cell_share:.1f}%</b> of total sales activity in this view.
</div>

<div style="
font-size:12px;
font-weight:800;
color:#9CA3AF;
text-transform:uppercase;
margin-bottom:6px;
">
Business Meaning
</div>

<div style="
font-size:13px;
color:#6B7280;
line-height:1.6;
">
Use stronger days and months for campaigns, staffing, inventory planning, or promotional pushes.
This helps the business match operational effort with natural demand timing.
</div>

</div>
                    """,
                    unsafe_allow_html=True
                )

    render_business_alert(
        "Business Analysis Completed",
        "Use each chart and its explanation together to understand what is driving sales, concentration, and performance structure.",
        None,
        "✅",
        "success",
    )
