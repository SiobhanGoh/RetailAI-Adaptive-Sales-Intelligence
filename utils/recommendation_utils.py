import pandas as pd
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.feature_extraction.text import TfidfVectorizer


def has_column(df, column):
    return df is not None and column in df.columns


def build_transaction_recommendations(df):
    if not has_column(df, "Customer_ID") or not has_column(df, "Product_Name") or not has_column(df, "Sales"):
        return None

    working_df = df.copy()

    working_df["Customer_ID"] = working_df["Customer_ID"].astype(str)
    working_df["Product_Name"] = working_df["Product_Name"].astype(str)
    working_df["Sales"] = pd.to_numeric(working_df["Sales"], errors="coerce").fillna(0)

    working_df = working_df[
        (working_df["Product_Name"].str.strip() != "")
        & (working_df["Product_Name"].str.lower() != "unknown product")
        & (working_df["Customer_ID"].str.strip() != "")
        & (working_df["Customer_ID"].str.lower() != "unknown customer")
    ]

    if working_df["Product_Name"].nunique() < 2 or working_df["Customer_ID"].nunique() < 2:
        return None

    pivot = pd.pivot_table(
        working_df,
        index="Customer_ID",
        columns="Product_Name",
        values="Sales",
        aggfunc="sum",
        fill_value=0
    )

    if pivot.shape[1] < 2 or pivot.shape[0] < 2:
        return None

    similarity = cosine_similarity(pivot.T)

    return pd.DataFrame(
        similarity,
        index=pivot.columns,
        columns=pivot.columns
    )


def build_content_recommendations(df):
    if not has_column(df, "Product_Name"):
        return None

    content_df = df.copy()
    content_df["Product_Name"] = content_df["Product_Name"].astype(str)

    content_df = content_df[
        (content_df["Product_Name"].str.strip() != "")
        & (content_df["Product_Name"].str.lower() != "unknown product")
    ]

    if content_df["Product_Name"].nunique() < 2:
        return None

    text_cols = ["Product_Name"]

    optional_text_cols = [
        "Category",
        "Sub_Category",
        "about_product",
        "Description",
        "Brand"
    ]

    for col in optional_text_cols:
        if col in content_df.columns:
            text_cols.append(col)

    content_df = (
        content_df[text_cols]
        .drop_duplicates(subset=["Product_Name"])
        .fillna("")
    )

    content_df["combined_text"] = content_df[text_cols].astype(str).agg(" ".join, axis=1)

    try:
        tfidf = TfidfVectorizer(stop_words="english", max_features=3000)
        text_matrix = tfidf.fit_transform(content_df["combined_text"])
    except ValueError:
        return None

    similarity = cosine_similarity(text_matrix)

    return pd.DataFrame(
        similarity,
        index=content_df["Product_Name"],
        columns=content_df["Product_Name"]
    )


def get_hybrid_recommendations(collab_sim, content_sim, product_name, top_n=5):
    if collab_sim is None:
        return get_content_recommendations(content_sim, product_name, top_n)

    if product_name not in collab_sim.columns:
        return get_content_recommendations(content_sim, product_name, top_n)

    collab_scores = collab_sim[product_name].drop(product_name, errors="ignore")

    if content_sim is not None and product_name in content_sim.columns:
        content_scores = content_sim[product_name].drop(product_name, errors="ignore")
    else:
        content_scores = pd.Series(dtype=float)

    all_products = collab_scores.index.union(content_scores.index)

    collab_scores = collab_scores.reindex(all_products).fillna(0)
    content_scores = content_scores.reindex(all_products).fillna(0)

    top_collab_score = collab_scores.max() if not collab_scores.empty else 0

    if top_collab_score <= 0.05:
        final_scores = (0.2 * collab_scores) + (0.8 * content_scores)
        method = "Content fallback"
    else:
        final_scores = (0.7 * collab_scores) + (0.3 * content_scores)
        method = "Hybrid"

    rec_df = (
        final_scores
        .sort_values(ascending=False)
        .head(top_n)
        .reset_index()
    )

    rec_df.columns = ["Recommended Product", "Similarity Score"]
    rec_df["Similarity Score"] = rec_df["Similarity Score"].round(4)
    rec_df["Recommendation Method"] = method

    return rec_df


def get_content_recommendations(content_sim, product_name, top_n=5):
    if content_sim is None or product_name not in content_sim.columns:
        return pd.DataFrame(columns=["Recommended Product", "Similarity Score", "Recommendation Method"])

    rec_df = (
        content_sim[product_name]
        .sort_values(ascending=False)
        .drop(product_name, errors="ignore")
        .head(top_n)
        .reset_index()
    )

    rec_df.columns = ["Recommended Product", "Similarity Score"]
    rec_df["Similarity Score"] = rec_df["Similarity Score"].round(4)
    rec_df["Recommendation Method"] = "Content-based"

    return rec_df


def get_confidence_label(score):
    if score >= 0.70:
        return "Strong Match", "High confidence recommendation"
    elif score >= 0.40:
        return "Moderate Match", "Useful recommendation, but review context"
    elif score > 0:
        return "Weak Match", "Limited similarity signal"
    else:
        return "Very Weak Match", "Low evidence recommendation"