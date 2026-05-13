# utils/forecasting_utils.py

import pandas as pd
import numpy as np

from sklearn.neighbors import KNeighborsRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score


FEATURE_COLS = [
    "week_of_year",
    "month",
    "quarter",
    "year",
    "weeks_since_start",
    "week_sin",
    "week_cos",
    "lag_1",
    "lag_2",
    "lag_3",
    "lag_4",
    "lag_8",
    "lag_12",
    "rolling_mean_2",
    "rolling_mean_4",
    "rolling_mean_8",
    "rolling_std_2",
    "rolling_std_4",
    "rolling_std_8",
    "diff_1",
    "pct_change_1",
]


def safe_percent(part, whole):
    if whole == 0 or pd.isna(whole):
        return 0
    return (part / whole) * 100


def safe_divide(part, whole):
    if whole == 0 or pd.isna(whole):
        return 0
    return part / whole


def create_weekly_sales_data(df):
    if df is None or df.empty:
        return None

    if "Order_Date" not in df.columns or "Sales" not in df.columns:
        return None

    working_df = df.copy()

    working_df["Order_Date"] = pd.to_datetime(
        working_df["Order_Date"],
        errors="coerce"
    )

    working_df["Sales"] = pd.to_numeric(
        working_df["Sales"],
        errors="coerce"
    )

    working_df = working_df.dropna(subset=["Order_Date", "Sales"])
    working_df = working_df[working_df["Sales"] >= 0]

    if working_df.empty:
        return None

    weekly_df = (
        working_df.set_index("Order_Date")
        .resample("W")["Sales"]
        .sum()
        .reset_index()
    )

    weekly_df = weekly_df.rename(columns={"Order_Date": "Week", "Sales": "Weekly_Sales"})

    if len(weekly_df) < 20:
        return None

    weekly_df["week_of_year"] = weekly_df["Week"].dt.isocalendar().week.astype(int)
    weekly_df["month"] = weekly_df["Week"].dt.month
    weekly_df["quarter"] = weekly_df["Week"].dt.quarter
    weekly_df["year"] = weekly_df["Week"].dt.year
    weekly_df["weeks_since_start"] = range(len(weekly_df))

    weekly_df["week_sin"] = np.sin(2 * np.pi * weekly_df["week_of_year"] / 52)
    weekly_df["week_cos"] = np.cos(2 * np.pi * weekly_df["week_of_year"] / 52)

    for lag in [1, 2, 3, 4, 8, 12]:
        weekly_df[f"lag_{lag}"] = weekly_df["Weekly_Sales"].shift(lag)

    for window in [2, 4, 8]:
        weekly_df[f"rolling_mean_{window}"] = weekly_df["Weekly_Sales"].shift(1).rolling(window).mean()
        weekly_df[f"rolling_std_{window}"] = weekly_df["Weekly_Sales"].shift(1).rolling(window).std()

    weekly_df["diff_1"] = weekly_df["Weekly_Sales"].diff(1)
    weekly_df["pct_change_1"] = weekly_df["Weekly_Sales"].pct_change(1)

    weekly_df = weekly_df.replace([np.inf, -np.inf], np.nan)
    weekly_df = weekly_df.dropna()

    if len(weekly_df) < 10:
        return None

    return weekly_df


def make_future_feature_row(next_week, week_index, sales_history):
    week_of_year = int(next_week.isocalendar().week)

    row = {
        "week_of_year": week_of_year,
        "month": next_week.month,
        "quarter": (next_week.month - 1) // 3 + 1,
        "year": next_week.year,
        "weeks_since_start": week_index,
        "week_sin": np.sin(2 * np.pi * week_of_year / 52),
        "week_cos": np.cos(2 * np.pi * week_of_year / 52),
    }

    for lag in [1, 2, 3, 4, 8, 12]:
        row[f"lag_{lag}"] = sales_history[-lag] if len(sales_history) >= lag else sales_history[-1]

    for window in [2, 4, 8]:
        recent_values = sales_history[-window:] if len(sales_history) >= window else sales_history
        row[f"rolling_mean_{window}"] = np.mean(recent_values)
        row[f"rolling_std_{window}"] = np.std(recent_values)

    previous_sales = sales_history[-1]
    second_previous_sales = sales_history[-2] if len(sales_history) >= 2 else previous_sales

    row["diff_1"] = previous_sales - second_previous_sales
    row["pct_change_1"] = (
        (previous_sales - second_previous_sales) / second_previous_sales
        if second_previous_sales != 0 else 0
    )

    return pd.DataFrame([row])[FEATURE_COLS]


def generate_future_forecast(model, weekly_df, periods=4):
    last_week = weekly_df["Week"].max()
    sales_history = weekly_df["Weekly_Sales"].tolist()

    future_rows = []

    for i in range(1, periods + 1):
        next_week = last_week + pd.Timedelta(weeks=i)
        feature_row = make_future_feature_row(
            next_week=next_week,
            week_index=len(sales_history),
            sales_history=sales_history
        )

        predicted_sales = model.predict(feature_row)[0]
        predicted_sales = max(predicted_sales, 0)

        future_rows.append({
            "Future Week": next_week,
            "Predicted Sales": predicted_sales
        })

        sales_history.append(predicted_sales)

    return pd.DataFrame(future_rows)


def get_forecast_risk(metrics):
    wape = metrics["WAPE"]
    r2 = metrics["R2"]

    if wape <= 20 and r2 >= 0.5:
        return "Low Risk", "Forecast is relatively stable and suitable for directional planning."
    elif wape <= 35:
        return "Moderate Risk", "Forecast is useful for planning, but should be reviewed with business context."
    else:
        return "High Risk", "Forecast has higher uncertainty. Use it as a rough guide, not an exact prediction."


def classify_forecast_confidence(metrics):
    if metrics is None:
        return 0, "Unknown", "Forecast confidence cannot be calculated because model metrics are unavailable."

    wape = metrics.get("WAPE", 999)
    r2 = metrics.get("R2", 0)
    bias = abs(metrics.get("Bias", 0))
    mae = metrics.get("MAE", 0)

    score = 100

    if wape <= 15:
        score -= 0
    elif wape <= 25:
        score -= 12
    elif wape <= 35:
        score -= 25
    elif wape <= 50:
        score -= 40
    else:
        score -= 55

    if r2 >= 0.65:
        score -= 0
    elif r2 >= 0.40:
        score -= 8
    elif r2 >= 0.20:
        score -= 18
    elif r2 >= 0:
        score -= 28
    else:
        score -= 38

    if mae > 0:
        bias_to_error_ratio = abs(safe_divide(bias, mae))
        if bias_to_error_ratio > 1:
            score -= 14
        elif bias_to_error_ratio > 0.5:
            score -= 8

    score = int(max(5, min(score, 100)))

    if score >= 80:
        label = "High Confidence"
        desc = "The forecast is strong enough to support short-term planning, while still being reviewed alongside promotions, holidays, and stock availability."
    elif score >= 60:
        label = "Moderate Confidence"
        desc = "The forecast is useful as a directional planning guide, but decisions should include a safety buffer."
    elif score >= 40:
        label = "Low Confidence"
        desc = "The model has some useful signal, but uncertainty is high. Use it mainly to understand direction, not exact sales numbers."
    else:
        label = "Very Low Confidence"
        desc = "The forecast is unstable. Treat it as an early warning view rather than a reliable planning number."

    return score, label, desc


def analyze_demand_stability(weekly_df):
    if weekly_df is None or weekly_df.empty or "Weekly_Sales" not in weekly_df.columns:
        return {
            "cv": 0,
            "level": "Unknown",
            "description": "Demand stability cannot be calculated because weekly sales history is unavailable.",
            "icon": "❔"
        }

    sales = pd.to_numeric(weekly_df["Weekly_Sales"], errors="coerce").dropna()

    if sales.empty:
        return {
            "cv": 0,
            "level": "Unknown",
            "description": "Demand stability cannot be calculated because weekly sales values are unavailable.",
            "icon": "❔"
        }

    mean_sales = sales.mean()
    std_sales = sales.std()
    cv = safe_divide(std_sales, mean_sales)

    if cv < 0.15:
        level = "Stable Demand"
        icon = "🟢"
        description = (
            f"Weekly sales are quite consistent with a volatility ratio of {cv:.2f}. "
            "This is good for inventory planning because demand does not swing aggressively."
        )
    elif cv < 0.35:
        level = "Moderate Stability"
        icon = "🟡"
        description = (
            f"Weekly sales move moderately with a volatility ratio of {cv:.2f}. "
            "Planning is possible, but inventory buffers are still recommended."
        )
    else:
        level = "Volatile Demand"
        icon = "🔴"
        description = (
            f"Weekly sales fluctuate strongly with a volatility ratio of {cv:.2f}. "
            "This may reflect promotion effects, seasonal spikes, inconsistent demand, or missing business factors."
        )

    return {
        "cv": cv,
        "level": level,
        "description": description,
        "icon": icon
    }


def analyze_recent_momentum(weekly_df):
    if weekly_df is None or weekly_df.empty or "Weekly_Sales" not in weekly_df.columns:
        return {
            "change_pct": 0,
            "level": "Unknown",
            "description": "Recent sales momentum cannot be calculated because weekly sales history is unavailable.",
            "icon": "❔"
        }

    sales = pd.to_numeric(weekly_df["Weekly_Sales"], errors="coerce").dropna()

    if len(sales) < 8:
        return {
            "change_pct": 0,
            "level": "Limited History",
            "description": "There are not enough recent weeks to compare momentum reliably.",
            "icon": "🧩"
        }

    recent_avg = sales.tail(4).mean()
    previous_avg = sales.tail(8).head(4).mean()
    change_pct = safe_percent(recent_avg - previous_avg, previous_avg)

    if change_pct > 12:
        level = "Rising Momentum"
        icon = "📈"
        description = (
            f"Recent weekly sales are about {change_pct:.1f}% higher than the previous 4-week period. "
            "This may signal demand growth, campaign impact, or seasonal lift."
        )
    elif change_pct < -12:
        level = "Softening Momentum"
        icon = "📉"
        description = (
            f"Recent weekly sales are about {abs(change_pct):.1f}% lower than the previous 4-week period. "
            "This may signal demand cooling, weaker campaigns, or lower recent activity."
        )
    else:
        level = "Steady Momentum"
        icon = "➡️"
        description = (
            f"Recent weekly sales changed by about {change_pct:.1f}% compared with the previous 4-week period. "
            "This suggests short-term sales momentum is relatively steady."
        )

    return {
        "change_pct": change_pct,
        "level": level,
        "description": description,
        "icon": icon
    }


def analyze_inventory_pressure(future_df, weekly_df):
    if (
        future_df is None
        or future_df.empty
        or weekly_df is None
        or weekly_df.empty
        or "Predicted Sales" not in future_df.columns
        or "Weekly_Sales" not in weekly_df.columns
    ):
        return {
            "level": "Unknown",
            "description": "Inventory pressure cannot be calculated because forecast or weekly sales history is unavailable.",
            "icon": "❔"
        }

    predicted_avg = pd.to_numeric(future_df["Predicted Sales"], errors="coerce").dropna().mean()
    recent_avg = pd.to_numeric(weekly_df["Weekly_Sales"], errors="coerce").dropna().tail(8).mean()

    pressure_pct = safe_percent(predicted_avg - recent_avg, recent_avg)

    if pressure_pct > 15:
        level = "High Inventory Pressure"
        icon = "📦"
        description = (
            f"Forecasted weekly demand is about {pressure_pct:.1f}% above the recent average. "
            "Prepare stock buffers, review supplier lead time, and monitor fast-moving items."
        )
    elif pressure_pct < -15:
        level = "Overstock Caution"
        icon = "🧊"
        description = (
            f"Forecasted weekly demand is about {abs(pressure_pct):.1f}% below the recent average. "
            "Avoid aggressive restocking and watch for slow-moving inventory."
        )
    else:
        level = "Normal Inventory Pressure"
        icon = "🛒"
        description = (
            f"Forecasted weekly demand is close to recent sales levels, changing by about {pressure_pct:.1f}%. "
            "Maintain normal replenishment but keep monitoring weekly movement."
        )

    return {
        "pressure_pct": pressure_pct,
        "level": level,
        "description": description,
        "icon": icon
    }


def detect_weekly_spike_risk(weekly_df):
    if weekly_df is None or weekly_df.empty or "Weekly_Sales" not in weekly_df.columns:
        return {
            "count": 0,
            "level": "Unknown",
            "description": "Spike risk cannot be calculated because weekly sales history is unavailable.",
            "icon": "❔",
            "spike_weeks": pd.DataFrame()
        }

    df = weekly_df[["Week", "Weekly_Sales"]].copy()
    df["Weekly_Sales"] = pd.to_numeric(df["Weekly_Sales"], errors="coerce")
    df = df.dropna()

    if len(df) < 8:
        return {
            "count": 0,
            "level": "Limited History",
            "description": "There are not enough weekly records to identify spike risk reliably.",
            "icon": "🧩",
            "spike_weeks": pd.DataFrame()
        }

    mean_sales = df["Weekly_Sales"].mean()
    std_sales = df["Weekly_Sales"].std()

    if pd.isna(std_sales) or std_sales == 0:
        return {
            "count": 0,
            "level": "Low Spike Risk",
            "description": "Weekly sales do not show obvious extreme spikes.",
            "icon": "✅",
            "spike_weeks": pd.DataFrame()
        }

    threshold = mean_sales + (1.5 * std_sales)
    spike_weeks = df[df["Weekly_Sales"] > threshold].copy()

    if len(spike_weeks) >= 4:
        level = "High Spike Risk"
        icon = "⚠️"
        description = (
            f"{len(spike_weeks)} unusually high-sales weeks were detected. "
            "This suggests demand may be influenced by campaigns, seasonality, bulk orders, or special events."
        )
    elif len(spike_weeks) >= 1:
        level = "Moderate Spike Risk"
        icon = "📌"
        description = (
            f"{len(spike_weeks)} unusually high-sales week(s) were detected. "
            "Review these weeks before making inventory or staffing decisions."
        )
    else:
        level = "Low Spike Risk"
        icon = "✅"
        description = "No major sales spike weeks were detected from the weekly history."

    spike_weeks["Spike Threshold"] = threshold

    return {
        "count": len(spike_weeks),
        "level": level,
        "description": description,
        "icon": icon,
        "spike_weeks": spike_weeks
    }


def generate_forecast_intelligence(weekly_df, prediction_df, metrics, future_df):
    confidence_score, confidence_label, confidence_desc = classify_forecast_confidence(metrics)
    stability = analyze_demand_stability(weekly_df)
    momentum = analyze_recent_momentum(weekly_df)
    inventory = analyze_inventory_pressure(future_df, weekly_df)
    spike_risk = detect_weekly_spike_risk(weekly_df)

    wape = metrics.get("WAPE", 999) if metrics else 999
    r2 = metrics.get("R2", 0) if metrics else 0
    bias = metrics.get("Bias", 0) if metrics else 0

    risk_points = 0

    if confidence_score < 60:
        risk_points += 2
    elif confidence_score < 80:
        risk_points += 1

    if stability["level"] == "Volatile Demand":
        risk_points += 2
    elif stability["level"] == "Moderate Stability":
        risk_points += 1

    if "High" in spike_risk["level"]:
        risk_points += 2
    elif "Moderate" in spike_risk["level"]:
        risk_points += 1

    if wape > 35:
        risk_points += 2
    elif wape > 20:
        risk_points += 1

    if r2 < 0.2:
        risk_points += 1

    if abs(bias) > metrics.get("MAE", 1):
        risk_points += 1

    if risk_points <= 2:
        overall_risk = "Controlled Forecast Risk"
        overall_icon = "🟢"
        overall_desc = (
            "Forecast risk is manageable. The model can support short-term planning, especially when combined with business context."
        )
    elif risk_points <= 5:
        overall_risk = "Moderate Forecast Risk"
        overall_icon = "🟡"
        overall_desc = (
            "Forecast risk is present but usable. Treat the forecast as a planning guide and apply buffers for stock or staffing decisions."
        )
    else:
        overall_risk = "Elevated Forecast Risk"
        overall_icon = "🔴"
        overall_desc = (
            "Forecast risk is high. Demand may be volatile or difficult to explain with the current dataset. Avoid relying on exact forecast values alone."
        )

    executive_summary = (
        f"{confidence_label} with {stability['level'].lower()} and {momentum['level'].lower()}. "
        f"{inventory['level']} is detected for the next 4 weeks. {overall_desc}"
    )

    actions = []

    if confidence_score >= 80:
        actions.append("Use the forecast for weekly sales planning, while still checking promotions and stock constraints.")
    elif confidence_score >= 60:
        actions.append("Use the forecast directionally and add a safety buffer before making stock or staffing decisions.")
    else:
        actions.append("Treat the forecast as an early warning signal, not as an exact sales commitment.")

    if stability["level"] == "Volatile Demand":
        actions.append("Investigate what causes sales swings, such as campaigns, holidays, large orders, or stock availability.")
    elif stability["level"] == "Stable Demand":
        actions.append("Stable demand allows smoother replenishment planning and more predictable weekly targets.")

    if inventory["level"] == "High Inventory Pressure":
        actions.append("Prepare extra stock coverage and monitor fast-moving items to reduce stock-out risk.")
    elif inventory["level"] == "Overstock Caution":
        actions.append("Avoid over-ordering and review slow-moving products before replenishing.")

    if spike_risk["count"] > 0:
        actions.append("Review detected spike weeks before using the forecast for major operational decisions.")

    if "Softening" in momentum["level"]:
        actions.append("Monitor whether the recent slowdown continues before committing to aggressive campaigns or purchases.")
    elif "Rising" in momentum["level"]:
        actions.append("Prepare campaign, inventory, and staffing support if the rising sales momentum continues.")

    return {
        "confidence_score": confidence_score,
        "confidence_label": confidence_label,
        "confidence_description": confidence_desc,
        "stability": stability,
        "momentum": momentum,
        "inventory_pressure": inventory,
        "spike_risk": spike_risk,
        "overall_risk": overall_risk,
        "overall_icon": overall_icon,
        "overall_description": overall_desc,
        "executive_summary": executive_summary,
        "recommended_actions": actions[:6],
    }


def train_weekly_knn_forecast(df):
    weekly_df = create_weekly_sales_data(df)

    if weekly_df is None or len(weekly_df) < 10:
        return None, None, None, None

    X = weekly_df[FEATURE_COLS]
    y = weekly_df["Weekly_Sales"]

    split_index = int(len(weekly_df) * 0.8)

    X_train = X.iloc[:split_index]
    X_test = X.iloc[split_index:]
    y_train = y.iloc[:split_index]
    y_test = y.iloc[split_index:]

    if len(X_train) < 5 or len(X_test) < 2:
        return None, None, None, None

    n_neighbors = min(5, len(X_train))

    model = KNeighborsRegressor(
        n_neighbors=n_neighbors,
        weights="uniform",
        metric="euclidean"
    )

    model.fit(X_train, y_train)

    predictions = model.predict(X_test)

    rmse = mean_squared_error(y_test, predictions) ** 0.5
    mae = mean_absolute_error(y_test, predictions)

    try:
        r2 = r2_score(y_test, predictions)
    except Exception:
        r2 = 0

    y_test_safe = y_test.replace(0, np.nan)

    mape = np.mean(np.abs((y_test_safe - predictions) / y_test_safe)) * 100
    mape = 0 if pd.isna(mape) else mape

    smape = np.mean(
        2 * np.abs(predictions - y_test) / (np.abs(y_test) + np.abs(predictions))
    ) * 100
    smape = 0 if pd.isna(smape) else smape

    total_actual = np.sum(np.abs(y_test))

    if total_actual == 0:
        wape = 0
    else:
        wape = np.sum(np.abs(y_test - predictions)) / total_actual * 100

    bias = np.mean(predictions - y_test)

    metrics = {
        "Model": "Weekly KNN",
        "RMSE": rmse,
        "MAE": mae,
        "R2": r2,
        "MAPE": mape,
        "sMAPE": smape,
        "WAPE": wape,
        "Bias": bias,
    }

    prediction_df = pd.DataFrame({
        "Week": weekly_df.iloc[split_index:]["Week"],
        "Actual_Sales": y_test.values,
        "Predicted_Sales": predictions,
        "Error": y_test.values - predictions,
    })

    final_model = KNeighborsRegressor(
        n_neighbors=min(5, len(X)),
        weights="uniform",
        metric="euclidean"
    )

    final_model.fit(X, y)

    future_df = generate_future_forecast(final_model, weekly_df, periods=4)

    return weekly_df, prediction_df, metrics, future_df
