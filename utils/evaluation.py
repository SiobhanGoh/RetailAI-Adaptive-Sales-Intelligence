"""Frozen retrospective checks; no tuning or model selection from these results."""
import numpy as np
import pandas as pd
from sklearn.neighbors import KNeighborsRegressor
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from utils.forecasting_utils import FEATURE_COLS, create_weekly_sales_data, generate_future_forecast
from utils.recommendation_utils import (
    build_transaction_recommendations, build_content_recommendations,
    get_hybrid_recommendations, get_content_recommendations,
)


def forecast_at_origin(weekly, origin, horizon=4):
    """origin is the first unseen row; the complete future is unavailable to fitting."""
    train = weekly.iloc[:origin].copy()
    if len(train) < 5:
        raise ValueError("At least five training rows are required.")
    # pandas copies attrs when slicing: explicitly remove future history from attrs.
    history_end = int(train.weeks_since_start.iloc[-1]) + 1
    train.attrs['sales_history'] = list(weekly.attrs['sales_history'][:history_end])
    model = make_pipeline(StandardScaler(), KNeighborsRegressor(n_neighbors=5, weights='uniform'))
    model.fit(train[FEATURE_COLS], train.Weekly_Sales)
    return generate_future_forecast(model, train, periods=horizon)


def error_metrics(actual, predicted):
    actual, predicted = np.asarray(actual), np.asarray(predicted)
    errors = predicted - actual
    return {'n': len(actual), 'MAE': float(np.abs(errors).mean()),
            'RMSE': float(np.sqrt(np.square(errors).mean())),
            'WAPE_pct': float(np.abs(errors).sum() / np.abs(actual).sum() * 100)}


def rolling_forecasts(clean, horizon=4):
    weekly = create_weekly_sales_data(clean)
    first = int(len(weekly) * .8)
    rows = []
    for origin in range(first, len(weekly) - horizon + 1):
        predictions = forecast_at_origin(weekly, origin, horizon)
        for step in range(horizon):
            truth = weekly.iloc[origin + step]
            rows.append({'origin': str(weekly.Week.iloc[origin - 1].date()),
                         'target': str(truth.Week.date()), 'horizon': step + 1,
                         'train_weeks': origin, 'actual': float(truth.Weekly_Sales),
                         'knn': float(predictions['Predicted Sales'].iloc[step]),
                         'last_week': float(weekly.Weekly_Sales.iloc[origin - 1]),
                         'last_four_mean': float(weekly.Weekly_Sales.iloc[origin - 4:origin].mean())})
    frame = pd.DataFrame(rows)
    metrics = {}
    for label, subset in [('all', frame)] + [(str(h), frame.loc[frame.horizon == h]) for h in range(1, horizon + 1)]:
        metrics[label] = {model: error_metrics(subset.actual, subset[model])
                          for model in ['knn', 'last_week', 'last_four_mean']}
    return frame, {'protocol': 'Expanding training window; fixed scaled 5-neighbour uniform KNN; recursive horizons 1–4.',
                   'origins': frame.origin.nunique(), 'first_origin': frame.origin.min(),
                   'last_origin': frame.origin.max(), 'metrics': metrics,
                   'limitations': 'Retrospective, previously explored data. Overlapping horizons are dependent. No hyperparameter tuning or independent external claim.'}


def recommendation_training(clean, cutoff):
    train = clean.loc[clean.Order_Date <= cutoff].copy()
    collab = build_transaction_recommendations(train)
    content = build_content_recommendations(train)
    popularity = (train[['Order_ID', 'Product_Name']].drop_duplicates()
                  .groupby('Product_Name').size().sort_values(ascending=False, kind='stable').index.tolist())
    return train, collab, content, popularity


def ranking_metrics(recommended, relevant, k=5):
    recommended = recommended[:k]
    hits = [int(item in relevant) for item in recommended]
    dcg = sum(hit / np.log2(rank + 2) for rank, hit in enumerate(hits))
    ideal = sum(1 / np.log2(rank + 2) for rank in range(min(len(relevant), k)))
    return {'hit_rate_at_5': float(any(hits)), 'precision_at_5': sum(hits) / k,
            'recall_at_5': sum(hits) / len(relevant), 'ndcg_at_5': float(dcg / ideal)}


def evaluate_recommendations(clean, k=5):
    dates = sorted(clean.Order_Date.dropna().unique())
    cutoff = pd.Timestamp(dates[int(len(dates) * .8) - 1])
    train, collab, content, popularity = recommendation_training(clean, cutoff)
    catalog = set(train.Product_Name)
    test = clean.loc[clean.Order_Date > cutoff]
    baskets = [set(group.Product_Name) for _, group in test.groupby('Order_ID')]
    multi = [basket for basket in baskets if len(basket) >= 2]
    queries, skipped_seed, skipped_target, all_targets, eligible_targets = [], 0, 0, 0, 0
    cache = {}
    unique_recs = {model: set() for model in ['hybrid', 'content', 'popularity']}
    for basket in multi:
        for seed in sorted(basket):
            if seed not in catalog:
                skipped_seed += 1
                continue
            relevant = (basket - {seed}) & catalog
            all_targets += len(basket - {seed})
            eligible_targets += len(relevant)
            if not relevant:
                skipped_target += 1
                continue
            if seed not in cache:
                cache[seed] = {
                    'hybrid': get_hybrid_recommendations(collab, content, seed, k)['Recommended Product'].tolist(),
                    'content': get_content_recommendations(content, seed, k)['Recommended Product'].tolist(),
                    'popularity': [item for item in popularity if item != seed][:k],
                }
            for model, recs in cache[seed].items():
                assert seed not in recs and set(recs) <= catalog
                unique_recs[model].update(recs)
                queries.append({'model': model, **ranking_metrics(recs, relevant, k)})
    if not queries:
        raise ValueError('No eligible held-out baskets for recommendation evaluation.')
    results = pd.DataFrame(queries).groupby('model').mean().to_dict(orient='index')
    for model in results:
        results[model]['catalog_coverage'] = len(unique_recs[model]) / len(catalog)
    return {'protocol': 'Chronological basket completion: each known seed predicts other known items in a held-out order. All matrices, TF-IDF vocabulary and popularity use training rows only.',
            'cutoff': str(cutoff.date()), 'train_rows': len(train), 'test_rows': len(test),
            'training_catalog_size': len(catalog), 'test_orders': len(baskets),
            'test_multi_item_orders': len(multi), 'evaluated_seed_queries': len(queries) // 3,
            'unknown_seed_queries_excluded': skipped_seed, 'no_known_targets_excluded': skipped_target,
            'known_target_fraction_for_known_seeds': eligible_targets / all_targets,
            'metrics': results,
            'limitations': 'Retrospective proxy for product suggestions, not personalised next-purchase or online conversion testing. Cold items excluded from ranking metrics; queries from the same order are dependent. Fixed blend weights, no tuning.'}
