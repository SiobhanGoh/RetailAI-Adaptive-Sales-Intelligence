# utils/interpretation_utils.py

import pandas as pd


def safe_percent(part, whole):
    if whole == 0 or pd.isna(whole):
        return 0
    return (part / whole) * 100


def has_useful_column(df, column):
    if df is None or column not in df.columns:
        return False

    values = df[column].dropna().astype(str).str.strip()
    values = values[values != ""]
    values = values[values.str.lower() != "unknown"]

    return values.nunique() > 0


def interpret_share(label, share):
    if share >= 50:
        return (
            f"{label} contributes {share:.1f}% of the current view. "
            "That is a major concentration point. Great if intentional, but risky if the business depends too heavily on it."
        )
    elif share >= 30:
        return (
            f"{label} contributes {share:.1f}% of the current view. "
            "That is a strong performance driver. Protect it, promote it, and study what makes it work."
        )
    elif share >= 15:
        return (
            f"{label} contributes {share:.1f}% of the current view. "
            "That is a healthy contribution without looking overly dependent."
        )
    else:
        return (
            f"{label} contributes {share:.1f}% of the current view. "
            "Performance is fairly spread out, which usually means the business is more diversified."
        )


def get_top_share_interpretation(df, group_col, value_col="Sales"):
    if (
        df is None
        or df.empty
        or value_col not in df.columns
        or not has_useful_column(df, group_col)
    ):
        return None

    grouped = (
        df.groupby(group_col)[value_col]
        .sum()
        .sort_values(ascending=False)
    )

    grouped = grouped[
        grouped.index.astype(str).str.lower() != "unknown"
    ]

    if grouped.empty:
        return None

    top_name = grouped.index[0]
    top_value = grouped.iloc[0]
    total_value = grouped.sum()
    share = safe_percent(top_value, total_value)

    return {
        "top_name": top_name,
        "top_value": top_value,
        "share": share,
        "text": interpret_share(str(top_name), share)
    }


def get_top3_concentration_analysis(df, group_col, value_col="Sales"):
    if (
        df is None
        or df.empty
        or value_col not in df.columns
        or not has_useful_column(df, group_col)
    ):
        return None

    grouped = (
        df.groupby(group_col)[value_col]
        .sum()
        .sort_values(ascending=False)
    )

    grouped = grouped[
        grouped.index.astype(str).str.lower() != "unknown"
    ]

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
            "The top 3 contributors dominate the selected view. This creates strong focus, "
            "but the business may become vulnerable if one of these contributors weakens."
        )
    elif top3_share >= 55:
        concentration = "Moderate Concentration"
        risk = "Manageable Dependency"
        meaning = (
            "The top 3 contributors strongly influence performance, but there is still some useful diversification."
        )
    elif top3_share >= 35:
        concentration = "Balanced Mix"
        risk = "Healthy Diversification"
        meaning = (
            "The business has clear leaders without being overly dependent on only a few contributors."
        )
    else:
        concentration = "Highly Diversified Distribution"
        risk = "Low Dependency Risk"
        meaning = (
            "Sales are spread across many contributors. This lowers dependency risk but may make it harder to identify clear winners."
        )

    return {
        "top_3_names": list(top3.index),
        "top_3_share": top3_share,
        "remaining_share": remaining_share,
        "concentration": concentration,
        "risk": risk,
        "meaning": meaning,
    }


def compare_filtered_vs_full(filtered_df, full_df, group_col):
    if (
        filtered_df is None
        or full_df is None
        or filtered_df.empty
        or full_df.empty
        or "Sales" not in filtered_df.columns
        or "Sales" not in full_df.columns
        or not has_useful_column(filtered_df, group_col)
        or not has_useful_column(full_df, group_col)
    ):
        return None

    filtered_grouped = (
        filtered_df.groupby(group_col)["Sales"]
        .sum()
        .sort_values(ascending=False)
    )

    full_grouped = (
        full_df.groupby(group_col)["Sales"]
        .sum()
        .sort_values(ascending=False)
    )

    if filtered_grouped.empty or full_grouped.empty:
        return None

    filtered_top = filtered_grouped.index[0]
    full_rank_list = list(full_grouped.index)

    if filtered_top in full_rank_list:
        global_rank = full_rank_list.index(filtered_top) + 1
    else:
        global_rank = None

    return {
        "filtered_top": filtered_top,
        "global_rank": global_rank,
        "global_top": full_grouped.index[0]
    }


def generate_business_analysis_explanation(df, full_df=None):
    explanations = []

    if df is None or df.empty:
        return explanations

    if "Sales" not in df.columns:
        explanations.append({
            "title": "Sales Column Missing",
            "icon": "⚠️",
            "body": (
                "This dataset does not contain a usable sales/revenue column, "
                "so business performance explanations cannot be generated yet."
            )
        })
        return explanations

    total_sales = df["Sales"].sum()

    region = get_top_share_interpretation(df, "Region")
    category = get_top_share_interpretation(df, "Category")
    segment = get_top_share_interpretation(df, "Segment")
    product = get_top_share_interpretation(df, "Product_Name")

    region_top3 = get_top3_concentration_analysis(df, "Region")
    category_top3 = get_top3_concentration_analysis(df, "Category")
    product_top3 = get_top3_concentration_analysis(df, "Product_Name")

    region_compare = compare_filtered_vs_full(df, full_df, "Region")
    category_compare = compare_filtered_vs_full(df, full_df, "Category")

    if region:
        body = (
            f"{region['top_name']} is the leading region with {region['share']:.1f}% of sales. "
            f"{region['text']} "
        )

        if region_top3:
            top3_names = ", ".join([str(x) for x in region_top3["top_3_names"]])
            body += (
                f"The top 3 regions ({top3_names}) contribute {region_top3['top_3_share']:.1f}% together, "
                f"which indicates {region_top3['concentration'].lower()} and {region_top3['risk'].lower()}. "
            )

        if region_compare and region_compare["global_rank"]:
            body += (
                f"In the full dataset, this region ranks #{region_compare['global_rank']}. "
                "So if it rises to the top only after filtering, your filter is telling a very specific story."
            )

        explanations.append({
            "title": "Regional Performance",
            "icon": "📍",
            "body": body
        })

    if category:
        body = (
            f"{category['top_name']} is the strongest category with {category['share']:.1f}% of sales. "
            f"{category['text']} "
        )

        if category_top3:
            top3_names = ", ".join([str(x) for x in category_top3["top_3_names"]])
            body += (
                f"The top 3 categories ({top3_names}) contribute {category_top3['top_3_share']:.1f}% together. "
                f"This suggests {category_top3['concentration'].lower()}. "
            )

        body += "In practice, this can guide stock planning, homepage promotion, and bundle strategy."

        if category_compare and category_compare["global_rank"]:
            body += f" In the full dataset, this category ranks #{category_compare['global_rank']}."

        explanations.append({
            "title": "Category Driver",
            "icon": "📦",
            "body": body
        })

    if segment:
        explanations.append({
            "title": "Customer Segment Focus",
            "icon": "👥",
            "body": (
                f"{segment['top_name']} is the top segment with {segment['share']:.1f}% of sales. "
                "This helps identify which customer group is currently most valuable. "
                "For example, if Corporate dominates, B2B campaigns may deserve more attention."
            )
        })

    if product:
        body = (
            f"{product['top_name']} is the top product and contributes {product['share']:.1f}% of sales. "
        )

        if product_top3:
            top3_names = ", ".join([str(x) for x in product_top3["top_3_names"]])
            body += (
                f"The top 3 products ({top3_names}) contribute {product_top3['top_3_share']:.1f}% together. "
                f"This indicates {product_top3['concentration'].lower()} and {product_top3['risk'].lower()}. "
            )

        body += "A high share may suggest hero-product dependency, while a lower share means revenue is spread across more products."

        explanations.append({
            "title": "Hero Product Signal",
            "icon": "🔥",
            "body": body
        })

    if not region and not category and not segment and not product:
        explanations.append({
            "title": "Limited Dataset View",
            "icon": "🧩",
            "body": (
                f"The current view has total sales of {total_sales:,.2f}, but there are no useful Region, Category, "
                "Segment, or Product columns to break it down further. This is still useful for basic sales tracking, "
                "but not enough for deeper business segmentation."
            )
        })

    explanations.append({
        "title": "Real-Life Takeaway",
        "icon": "💡",
        "body": (
            f"The current filtered view has total sales of {total_sales:,.2f}. "
            "Use this like a business lens: it tells you where to focus campaigns, which areas to protect, "
            "and where the business may be too dependent on one product, category, or region."
        )
    })

    return explanations


def interpret_health_score(score):
    if score >= 80:
        return (
            "This is a strong health score. The dataset shows good sales strength, product variety, "
            "and enough activity to support meaningful decisions. Nice, this view is looking healthy."
        )
    elif score >= 60:
        return (
            "This is a moderate health score. The business view has useful signals, but there may still be room to improve "
            "customer diversity, product coverage, or sales consistency."
        )
    elif score >= 40:
        return (
            "This score suggests the business view has some useful information, but it may be limited by lower sales volume, "
            "few products, or a narrow customer base. Treat insights as early signals."
        )
    else:
        return (
            "This is a low health score. The selected view may be too small or too narrow. "
            "Try removing some filters or using a richer dataset before making major decisions."
        )


def interpret_forecast(metrics, future_df):
    wape = metrics["WAPE"]
    r2 = metrics["R2"]
    bias = metrics["Bias"]

    if wape <= 20:
        accuracy_text = (
            f"WAPE is {wape:.2f}%, which is strong for business forecasting. "
            "The model is making reasonably close weekly predictions."
        )
    elif wape <= 35:
        accuracy_text = (
            f"WAPE is {wape:.2f}%, which is moderate. "
            "This forecast is useful for direction, but exact values should be treated carefully."
        )
    else:
        accuracy_text = (
            f"WAPE is {wape:.2f}%, which is high. "
            "Sales are probably volatile, so this should be used as a rough planning guide only."
        )

    if r2 >= 0.5:
        r2_text = (
            f"R² is {r2:.4f}, meaning the model explains a fair amount of sales movement. "
            "It has learned useful weekly patterns."
        )
    elif r2 >= 0.2:
        r2_text = (
            f"R² is {r2:.4f}, meaning the model captures some signal, but there is still unexplained variation. "
            "This is common in retail because promotions, holidays, and stock levels are not included."
        )
    else:
        r2_text = (
            f"R² is {r2:.4f}, meaning the model has weak explanatory power. "
            "Use the forecast more like a trend hint than a precise prediction."
        )

    if bias > 0:
        bias_text = (
            f"The average bias is {bias:,.2f}, so the model tends to over-predict. "
            "In real life, this could lead to planning slightly too much stock."
        )
    elif bias < 0:
        bias_text = (
            f"The average bias is {bias:,.2f}, so the model tends to under-predict. "
            "In real life, this could cause underestimating demand and stocking too little."
        )
    else:
        bias_text = "The model has almost no average bias, so it is not clearly over- or under-predicting overall."

    future_text = ""

    if future_df is not None and not future_df.empty:
        first_value = future_df.iloc[0]["Predicted Sales"]
        last_value = future_df.iloc[-1]["Predicted Sales"]
        change = last_value - first_value
        change_pct = safe_percent(change, first_value)

        if change_pct > 10:
            future_text = (
                f"The next 4-week forecast trends upward by about {change_pct:.1f}%. "
                "This may be a cue to prepare extra stock, staffing, or marketing support."
            )
        elif change_pct < -10:
            future_text = (
                f"The next 4-week forecast trends downward by about {abs(change_pct):.1f}%. "
                "This may be a cue to be careful with overstocking and monitor demand closely."
            )
        else:
            future_text = (
                f"The next 4-week forecast is fairly stable, changing by about {change_pct:.1f}%. "
                "This suggests short-term demand may stay within a similar range."
            )

    return {
        "accuracy": accuracy_text,
        "r2": r2_text,
        "bias": bias_text,
        "future": future_text
    }


def get_future_trend_label(future_df):
    if future_df is None or future_df.empty:
        return "Unknown", "No future forecast available."

    first_value = future_df.iloc[0]["Predicted Sales"]
    last_value = future_df.iloc[-1]["Predicted Sales"]
    change = last_value - first_value
    change_pct = safe_percent(change, first_value)

    if change_pct > 10:
        return "📈 Upward Trend", f"Predicted sales increase by about {change_pct:.1f}% across the next 4 weeks."
    elif change_pct < -10:
        return "📉 Downward Trend", f"Predicted sales decrease by about {abs(change_pct):.1f}% across the next 4 weeks."
    else:
        return "➡️ Stable Trend", f"Predicted sales remain fairly stable, changing by about {change_pct:.1f}%."


def detect_forecast_anomalies(prediction_df):
    if prediction_df is None or prediction_df.empty:
        return pd.DataFrame()

    df = prediction_df.copy()
    df["Absolute_Error"] = df["Error"].abs()

    mean_error = df["Absolute_Error"].mean()
    std_error = df["Absolute_Error"].std()

    if pd.isna(std_error) or std_error == 0:
        return pd.DataFrame()

    threshold = mean_error + (1.5 * std_error)

    anomalies = df[df["Absolute_Error"] > threshold].copy()
    anomalies["Possible Meaning"] = (
        "Unusual demand movement, possible promotion effect, stock issue, holiday pattern, or missing business factor."
    )

    return anomalies


def interpret_recommendation(score, method, dataset_type):
    if score >= 0.70:
        strength = (
            "This is a strong recommendation. The product match has a high similarity score, "
            "so it is a good candidate for cross-selling, bundles, or similar-product display."
        )
    elif score >= 0.40:
        strength = (
            "This is a moderate recommendation. It has useful similarity, but it is worth checking whether the products make sense together."
        )
    elif score > 0:
        strength = (
            "This is a weak recommendation. It may still help with exploration, but the evidence is limited."
        )
    else:
        strength = (
            "This recommendation has almost no similarity signal. It should not be treated as reliable without more data."
        )

    if dataset_type == "transaction":
        method_text = (
            f"The method used is {method}. The app looks at customer-product purchase behavior first, "
            "then uses product/category similarity as backup when purchase data is sparse."
        )
    else:
        method_text = (
            "The method used is content-based filtering. The app compares product names, categories, "
            "and descriptions instead of customer purchase history."
        )

    real_life = (
        "In real life, this can support 'Customers may also like', product bundles, related-item panels, "
        "or sales team suggestions."
    )

    return {
        "strength": strength,
        "method": method_text,
        "real_life": real_life
    }


def get_recommendation_reason(score, method, dataset_type):
    if dataset_type == "transaction":
        if method == "Hybrid":
            return "Bought by similar customers + product/category similarity"
        if method == "Content fallback":
            return "Purchase data was weak, so product/category similarity was used"
        return "Customer-product purchase pattern"
    else:
        if score >= 0.7:
            return "Very similar product text/category"
        elif score >= 0.4:
            return "Similar category or product wording"
        elif score > 0:
            return "Loose product/category similarity"
        else:
            return "Very limited similarity signal"


def get_recommendation_opportunity_label(score, method, dataset_type):
    if dataset_type == "transaction" and method == "Hybrid":
        if score >= 0.70:
            return "High-Value Cross-Sell"
        elif score >= 0.40:
            return "Useful Cross-Sell"
        elif score > 0:
            return "Exploratory Pairing"
        return "Low-Signal Match"

    if method == "Content fallback":
        if score >= 0.70:
            return "Strong Similar-Product Match"
        elif score >= 0.40:
            return "Content-Based Backup Match"
        return "Weak Backup Match"

    if score >= 0.70:
        return "Strong Similar-Product Match"
    elif score >= 0.40:
        return "Product Discovery Match"
    elif score > 0:
        return "Light Similarity Signal"
    return "Low-Signal Match"


def generate_recommendation_business_explanation(
    selected_product,
    recommended_product,
    score,
    method,
    dataset_type
):
    selected_product = str(selected_product)
    recommended_product = str(recommended_product)

    if score >= 0.70:
        strength_text = (
            "The similarity score is strong, so this recommendation has enough signal to be considered for real product pairing."
        )
    elif score >= 0.40:
        strength_text = (
            "The similarity score is moderate, so this recommendation is useful as a business suggestion but should still be reviewed with product context."
        )
    elif score > 0:
        strength_text = (
            "The similarity score is still relatively weak, so this recommendation is better used for product discovery rather than an automatic bundle decision."
        )
    else:
        strength_text = (
            "The recommendation has very little similarity signal, so it should be treated carefully."
        )

    if dataset_type == "transaction" and method == "Hybrid":
        method_text = (
            f"{recommended_product} is recommended because the app found support from both customer purchase behaviour and product similarity. "
            f"In simple terms, customers who show interest in {selected_product} may also respond well to {recommended_product}, "
            "especially if both products fit a similar shopping need or buying journey."
        )
    elif method == "Content fallback":
        method_text = (
            f"The app did not have enough strong customer purchase history for this filtered view, so it used product similarity as the main backup. "
            f"{recommended_product} is still relevant because its product details, category, or naming pattern appear related to {selected_product}."
        )
    else:
        method_text = (
            f"{recommended_product} is recommended because it appears similar to {selected_product} based on product information such as name, category, sub-category, description, or brand. "
            "This is useful for showing related items when customer purchase history is limited."
        )

    business_text = (
        "From a business point of view, this can support related-product displays, bundle ideas, checkout suggestions, or sales team recommendations. "
        "It should not be treated as a guaranteed customer purchase, but it gives a practical starting point for cross-selling and product discovery."
    )

    return f"{method_text} {strength_text} {business_text}"


def generate_action_recommendations(df, dataset_type, forecast_metrics=None, future_df=None, rec_df=None):
    actions = []

    if df is None or df.empty:
        return actions

    category = get_top_share_interpretation(df, "Category")
    product = get_top_share_interpretation(df, "Product_Name")

    category_top3 = get_top3_concentration_analysis(df, "Category")
    product_top3 = get_top3_concentration_analysis(df, "Product_Name")

    if category:
        if category_top3 and category_top3["top_3_share"] >= 75:
            actions.append(
                f"Reduce category dependency risk: the top 3 categories contribute {category_top3['top_3_share']:.1f}% of value, so develop secondary categories."
            )
        elif category["share"] >= 30:
            actions.append(
                f"Double down carefully: {category['top_name']} is a strong driver at {category['share']:.1f}%. Consider focused promotions or bundles."
            )
        else:
            actions.append(
                "Maintain category diversity: sales/value is spread across categories, so broad campaigns may work better than relying on one category."
            )

    if product:
        if product_top3 and product_top3["top_3_share"] >= 75:
            actions.append(
                f"Protect hero products: the top 3 products contribute {product_top3['top_3_share']:.1f}% of sales. Keep availability and visibility high."
            )
        elif product["share"] >= 20:
            actions.append(
                f"Protect hero product: {product['top_name']} contributes {product['share']:.1f}% of sales. Keep stock availability and visibility high."
            )
        else:
            actions.append(
                "No single product dominates heavily, so product discovery and recommendation features can help spread sales across the catalog."
            )

    if forecast_metrics is not None:
        wape = forecast_metrics["WAPE"]

        if wape <= 20:
            actions.append("Forecast can support confident weekly planning, but still review promotions and stock constraints.")
        elif wape <= 35:
            actions.append("Use the forecast for directional planning, but add a safety buffer for inventory or staffing decisions.")
        else:
            actions.append("Forecast uncertainty is high, so avoid aggressive stock or staffing decisions based only on the model.")

    if future_df is not None and not future_df.empty:
        trend_label, trend_text = get_future_trend_label(future_df)
        actions.append(f"{trend_label}: {trend_text}")

    if rec_df is not None and not rec_df.empty:
        top_rec = rec_df.iloc[0]["Recommended Product"]
        top_score = rec_df.iloc[0]["Similarity Score"]
        method = rec_df.iloc[0]["Recommendation Method"]

        opportunity = get_recommendation_opportunity_label(top_score, method, dataset_type)

        if top_score >= 0.70:
            actions.append(
                f"{opportunity}: test {top_rec} as a related-product display, bundle candidate, or checkout recommendation."
            )
        elif top_score >= 0.40:
            actions.append(
                f"{opportunity}: review {top_rec} as a potential cross-sell idea before using it in campaigns."
            )
        else:
            actions.append(
                f"Exploratory recommendation: {top_rec} has a weaker similarity signal, so use it mainly for discovery or testing."
            )

    if not actions:
        actions.append(
            "This dataset supports basic sales tracking. For deeper recommendations, add product/category/customer columns."
        )

    return actions[:6]
