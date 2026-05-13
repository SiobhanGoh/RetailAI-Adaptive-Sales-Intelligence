import streamlit as st
import plotly.graph_objects as go
import pandas as pd

from utils.forecasting_utils import (
    train_weekly_knn_forecast,
    get_forecast_risk,
    generate_forecast_intelligence,
)

from utils.interpretation_utils import (
    interpret_forecast,
    get_future_trend_label,
    detect_forecast_anomalies,
    generate_action_recommendations,
)

from utils.ui import render_kpi_card


def get_template():
    theme = st.get_option("theme.base")
    return "plotly_dark" if theme == "dark" else "plotly_white"


def render_insight_card(title, value, body, icon="💡"):
    st.markdown(
        f"""
        <div class="premium-card" style="
            padding:18px;
            border-radius:18px;
            border:1px solid rgba(128,128,128,0.22);
            background:linear-gradient(135deg,rgba(255,255,255,0.055),rgba(255,255,255,0.018));
            box-shadow:0 8px 24px rgba(0,0,0,0.045);
            min-height:165px;
            margin-bottom:12px;
        ">
            <div style="font-size:20px;margin-bottom:8px;">{icon}</div>
            <div style="font-size:12px;font-weight:800;color:#9CA3AF;text-transform:uppercase;margin-bottom:6px;">
                {title}
            </div>
            <div style="font-size:20px;font-weight:850;line-height:1.3;margin-bottom:8px;">
                {value}
            </div>
            <div style="font-size:13px;color:#6B7280;line-height:1.55;">
                {body}
            </div>
        </div>
        """,
        unsafe_allow_html=True
    )


def render_mission_card(icon, title, action):
    st.markdown(
        f"""
        <div class="premium-card" style="
            padding:18px;
            border-radius:18px;
            border:1px solid rgba(128,128,128,0.22);
            background:linear-gradient(135deg,rgba(255,255,255,0.06),rgba(255,255,255,0.018));
            box-shadow:0 8px 24px rgba(0,0,0,0.045);
            min-height:145px;
            margin-bottom:14px;
        ">
            <div style="font-size:22px;margin-bottom:8px;">{icon}</div>
            <div style="font-size:12px;font-weight:850;color:#9CA3AF;text-transform:uppercase;margin-bottom:8px;">
                {title}
            </div>
            <div style="font-size:14px;line-height:1.6;color:#4B5563;">
                {action}
            </div>
        </div>
        """,
        unsafe_allow_html=True
    )


def render_confidence_bar(score, label, description):
    score = max(0, min(int(score), 100))

    if score >= 80:
        color = "#059669"
        bg = "rgba(16,185,129,0.14)"
    elif score >= 60:
        color = "#D97706"
        bg = "rgba(245,158,11,0.14)"
    else:
        color = "#DC2626"
        bg = "rgba(239,68,68,0.14)"

    html = f"""
<div class="premium-card" style="
padding:24px;
border-radius:22px;
border:1px solid rgba(128,128,128,0.22);
background:linear-gradient(135deg,rgba(79,139,249,0.09),rgba(16,185,129,0.055));
box-shadow:0 8px 26px rgba(0,0,0,0.055);
margin-bottom:20px;
">

<div style="
display:flex;
justify-content:space-between;
align-items:flex-start;
gap:18px;
margin-bottom:14px;
">

<div>
<div style="
font-size:13px;
font-weight:850;
color:#9CA3AF;
text-transform:uppercase;
letter-spacing:0.4px;
">
Forecast Confidence Meter
</div>

<div style="
font-size:30px;
font-weight:900;
line-height:1.2;
margin-top:6px;
">
{label}
</div>
</div>

<div style="
padding:10px 16px;
border-radius:999px;
background:{bg};
color:{color};
font-size:18px;
font-weight:900;
white-space:nowrap;
">
{score}/100
</div>

</div>

<div style="
height:12px;
border-radius:999px;
background:rgba(128,128,128,0.18);
overflow:hidden;
margin-bottom:14px;
">

<div style="
height:12px;
width:{score}%;
border-radius:999px;
background:{color};
"></div>

</div>

<div style="
font-size:14px;
color:#6B7280;
line-height:1.6;
">
{description}
</div>

</div>
"""

    st.markdown(html, unsafe_allow_html=True)


def render_decision_card(actions, title="Forecast Mission Board"):
    if not actions:
        return

    st.subheader(title)

    st.caption(
        "The app turns forecast results into practical business missions — what to monitor, protect, and act on next."
    )

    mission_icons = ["🎯", "🛒", "📦", "📈", "⚠️", "💡"]
    mission_titles = [
        "Focus Move",
        "Sales Opportunity",
        "Inventory Check",
        "Trend Watch",
        "Risk Alert",
        "Next Best Action",
    ]

    cols = st.columns(2)

    for i, action in enumerate(actions):
        with cols[i % 2]:
            render_mission_card(
                mission_icons[i % len(mission_icons)],
                mission_titles[i % len(mission_titles)],
                action
            )


def render_intelligence_snapshot(intelligence):
    st.subheader("Forecast Intelligence Engine")

    st.caption(
        "This layer converts raw forecasting metrics into business risk, demand behaviour, inventory pressure, and planning actions."
    )

    render_confidence_bar(
        intelligence["confidence_score"],
        intelligence["confidence_label"],
        intelligence["confidence_description"]
    )

    s1, s2, s3, s4 = st.columns(4)

    with s1:
        render_insight_card(
            "Demand Stability",
            intelligence["stability"]["level"],
            intelligence["stability"]["description"],
            intelligence["stability"]["icon"]
        )

    with s2:
        render_insight_card(
            "Recent Momentum",
            intelligence["momentum"]["level"],
            intelligence["momentum"]["description"],
            intelligence["momentum"]["icon"]
        )

    with s3:
        render_insight_card(
            "Inventory Pressure",
            intelligence["inventory_pressure"]["level"],
            intelligence["inventory_pressure"]["description"],
            intelligence["inventory_pressure"]["icon"]
        )

    with s4:
        render_insight_card(
            "Spike Risk",
            intelligence["spike_risk"]["level"],
            intelligence["spike_risk"]["description"],
            intelligence["spike_risk"]["icon"]
        )

    risk_col, summary_col = st.columns([1, 1.6])

    with risk_col:
        render_insight_card(
            "Overall Forecast Risk",
            intelligence["overall_risk"],
            intelligence["overall_description"],
            intelligence["overall_icon"]
        )

    with summary_col:
        st.info(
            f"""
            **RetailAI Forecast Readout:**  
            {intelligence["executive_summary"]}
            """
        )

    if intelligence.get("recommended_actions"):
        render_decision_card(
            intelligence["recommended_actions"],
            title="Forecast Intelligence Action Plan"
        )


def render(df):
    st.title("Weekly Sales Forecasting")
    st.caption("A planning view that predicts short-term weekly sales and explains what the forecast means for real business decisions.")

    if df.empty:
        st.warning("No records found. Try adjusting your filters.")
        return

    if "Sales" not in df.columns:
        st.warning("Forecasting is unavailable because this dataset does not contain a sales column.")
        return

    if "Order_Date" not in df.columns:
        st.warning("Forecasting is unavailable because this dataset does not contain a date column.")
        return

    valid_date_count = df["Order_Date"].notna().sum()

    if valid_date_count < 10:
        st.warning(
            "Forecasting is unavailable because there are too few usable date records. "
            "Try using a dataset with more sales history."
        )
        return

    with st.spinner("Training weekly KNN forecasting model..."):
        weekly_df, prediction_df, metrics, future_df = train_weekly_knn_forecast(df)

    if weekly_df is None:
        st.error(
            "Not enough weekly sales history to train the forecasting model. "
            "This model needs around 30 usable weekly records after feature engineering."
        )
        st.info(
            """
            **Real-life meaning:**  
            Forecasting needs a proper sales timeline. If your dataset only covers a few days or weeks, the app cannot learn reliable demand patterns yet.
            """
        )
        return

    risk_label, risk_desc = get_forecast_risk(metrics)
    forecast_interpretation = interpret_forecast(metrics, future_df)
    trend_label, trend_desc = get_future_trend_label(future_df)
    anomalies = detect_forecast_anomalies(prediction_df)
    intelligence = generate_forecast_intelligence(weekly_df, prediction_df, metrics, future_df)

    st.subheader("Forecast Model KPIs")

    c1, c2, c3, c4 = st.columns(4)

    with c1:
        render_kpi_card("RMSE", f"{metrics['RMSE']:,.2f}", "Large-error sensitivity. Lower is better.")

    with c2:
        render_kpi_card("MAE", f"{metrics['MAE']:,.2f}", "Average weekly prediction error. Lower is better.")

    with c3:
        render_kpi_card("WAPE", f"{metrics['WAPE']:.2f}%", "Business-friendly forecast error rate. Lower is better.")

    with c4:
        render_kpi_card("Forecast Risk", risk_label, risk_desc)

    st.markdown("---")

    render_intelligence_snapshot(intelligence)

    st.markdown("---")

    st.subheader("Forecast Summary")

    summary_col1, summary_col2, summary_col3 = st.columns(3)

    with summary_col1:
        render_insight_card("Trend Direction", trend_label, trend_desc, "📈")

    with summary_col2:
        render_insight_card("Accuracy Check", f"WAPE {metrics['WAPE']:.2f}%", forecast_interpretation["accuracy"], "🎯")

    with summary_col3:
        render_insight_card("Bias Check", f"{metrics['Bias']:,.2f}", forecast_interpretation["bias"], "⚖️")

    st.subheader("Next 4-Week Sales Forecast")

    future_display = future_df.copy()
    future_display["Predicted Sales"] = future_display["Predicted Sales"].round(2)
    future_display.index = range(1, len(future_display) + 1)

    forecast_col1, forecast_col2 = st.columns([1.2, 1])

    with forecast_col1:
        st.dataframe(future_display, use_container_width=True)

    with forecast_col2:
        render_insight_card(
            "Planning Meaning",
            "Short-term demand guide",
            forecast_interpretation["future"] if forecast_interpretation["future"] else (
                "Use these values as directional hints for inventory, staffing, and weekly sales targets."
            ),
            "🛒"
        )

        render_insight_card(
            "Inventory Readiness",
            intelligence["inventory_pressure"]["level"],
            intelligence["inventory_pressure"]["description"],
            intelligence["inventory_pressure"]["icon"]
        )

        st.caption(
            "Generated recursively using the trained weekly KNN model. Treat this as planning guidance, not an exact sales promise."
        )

    st.markdown("---")

    st.subheader("Actual vs Predicted Weekly Sales")

    chart_col, explanation_col = st.columns([2.2, 1])

    with chart_col:
        fig = go.Figure()

        fig.add_trace(go.Scatter(
            x=prediction_df["Week"],
            y=prediction_df["Actual_Sales"],
            mode="lines+markers",
            name="Actual Sales",
            hovertemplate="Week: %{x}<br>Actual: %{y:,.2f}<extra></extra>"
        ))

        fig.add_trace(go.Scatter(
            x=prediction_df["Week"],
            y=prediction_df["Predicted_Sales"],
            mode="lines+markers",
            name="Predicted Sales",
            hovertemplate="Week: %{x}<br>Predicted: %{y:,.2f}<extra></extra>"
        ))

        fig.update_layout(
            template=get_template(),
            height=470,
            margin=dict(l=20, r=20, t=30, b=20),
            legend=dict(orientation="h", yanchor="bottom", y=1.02, x=0),
            xaxis_title="Week",
            yaxis_title="Sales"
        )

        st.plotly_chart(fig, use_container_width=True)

    with explanation_col:
        render_insight_card(
            "How to Read This",
            "Line closeness matters",
            (
                "When the predicted line follows the actual line closely, the model is tracking demand well. "
                "Large gaps may point to promotions, holidays, stock-outs, sudden demand changes, or missing business factors."
            ),
            "📊"
        )

        render_insight_card(
            "Model Signal",
            f"R² {metrics['R2']:.4f}",
            forecast_interpretation["r2"],
            "🧠"
        )

        render_insight_card(
            "Confidence Meaning",
            intelligence["confidence_label"],
            intelligence["confidence_description"],
            "🧭"
        )

    st.markdown("---")

    st.subheader("Forecast Anomaly Check")

    anomaly_col1, anomaly_col2 = st.columns([1.4, 1])

    with anomaly_col1:
        if anomalies.empty:
            st.success("No major unusual forecast-error weeks detected.")

            anomaly_summary = pd.DataFrame({
                "Status": ["No major anomalies detected"],
                "Meaning": ["Forecast errors are not unusually large compared with the model’s normal error range."]
            })

            st.dataframe(anomaly_summary, use_container_width=True)

        else:
            anomaly_display = anomalies.copy()
            anomaly_display["Actual_Sales"] = anomaly_display["Actual_Sales"].round(2)
            anomaly_display["Predicted_Sales"] = anomaly_display["Predicted_Sales"].round(2)
            anomaly_display["Error"] = anomaly_display["Error"].round(2)
            anomaly_display["Absolute_Error"] = anomaly_display["Absolute_Error"].round(2)
            anomaly_display.index = range(1, len(anomaly_display) + 1)

            st.warning("Some unusual weeks were detected where prediction error was much larger than usual.")
            st.dataframe(anomaly_display, use_container_width=True)

    with anomaly_col2:
        if anomalies.empty:
            render_insight_card(
                "Anomaly Meaning",
                "Stable error pattern",
                (
                    "Good sign. The model did not find weeks where forecast error was unusually extreme, "
                    "so the forecast is not being heavily distorted by obvious unusual weeks."
                ),
                "✅"
            )
        else:
            render_insight_card(
                "Anomaly Meaning",
                f"{len(anomalies)} unusual week(s)",
                (
                    "Review these weeks manually. Large errors may come from campaigns, holidays, stock issues, data entry problems, or unexpected demand."
                ),
                "⚠️"
            )

        spike_weeks = intelligence["spike_risk"].get("spike_weeks", pd.DataFrame())

        if spike_weeks is not None and not spike_weeks.empty:
            render_insight_card(
                "Historical Spike Warning",
                intelligence["spike_risk"]["level"],
                intelligence["spike_risk"]["description"],
                intelligence["spike_risk"]["icon"]
            )

    st.markdown("---")

    actions = generate_action_recommendations(
        df=df,
        dataset_type="transaction",
        forecast_metrics=metrics,
        future_df=future_df,
        rec_df=None
    )

    render_decision_card(actions)

    with st.expander("View full forecast metrics, intelligence diagnostics, and prediction table"):
        st.subheader("Full Forecast Metrics")

        metrics_df = pd.DataFrame({
            "Metric": list(metrics.keys()),
            "Value": list(metrics.values())
        })

        st.dataframe(metrics_df, use_container_width=True)

        st.subheader("Forecast Intelligence Diagnostics")

        diagnostics = pd.DataFrame({
            "Signal": [
                "Confidence Score",
                "Demand Stability",
                "Volatility Ratio",
                "Recent Momentum",
                "Momentum Change %",
                "Inventory Pressure",
                "Inventory Pressure %",
                "Spike Risk",
                "Spike Weeks",
                "Overall Risk",
            ],
            "Value": [
                f"{intelligence['confidence_score']}/100",
                intelligence["stability"]["level"],
                f"{intelligence['stability'].get('cv', 0):.2f}",
                intelligence["momentum"]["level"],
                f"{intelligence['momentum'].get('change_pct', 0):.2f}%",
                intelligence["inventory_pressure"]["level"],
                f"{intelligence['inventory_pressure'].get('pressure_pct', 0):.2f}%",
                intelligence["spike_risk"]["level"],
                intelligence["spike_risk"]["count"],
                intelligence["overall_risk"],
            ]
        })

        st.dataframe(diagnostics, use_container_width=True)

        spike_weeks = intelligence["spike_risk"].get("spike_weeks", pd.DataFrame())
        if spike_weeks is not None and not spike_weeks.empty:
            st.subheader("Historical Sales Spike Weeks")
            spike_display = spike_weeks.copy()
            spike_display["Weekly_Sales"] = spike_display["Weekly_Sales"].round(2)
            spike_display["Spike Threshold"] = spike_display["Spike Threshold"].round(2)
            spike_display.index = range(1, len(spike_display) + 1)
            st.dataframe(spike_display, use_container_width=True)

        st.subheader("Forecast Prediction Table")

        display_df = prediction_df.copy()
        display_df["Actual_Sales"] = display_df["Actual_Sales"].round(2)
        display_df["Predicted_Sales"] = display_df["Predicted_Sales"].round(2)
        display_df["Error"] = display_df["Error"].round(2)
        display_df.index = range(1, len(display_df) + 1)

        st.dataframe(display_df, use_container_width=True)

        csv = display_df.to_csv(index=False).encode("utf-8")

        st.download_button(
            "Download Forecast Results",
            data=csv,
            file_name="weekly_knn_forecast_results.csv",
            mime="text/csv",
            key="forecast_download"
        )
