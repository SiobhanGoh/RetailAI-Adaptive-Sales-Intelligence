import numpy as np
import pandas as pd
import pytest
from utils.forecasting_utils import create_weekly_sales_data
from utils.evaluation import forecast_at_origin, recommendation_training, ranking_metrics


def test_recursive_predictions_cannot_see_future_targets_or_dataframe_attrs():
    source = pd.DataFrame({'Order_Date': pd.date_range('2020-01-05', periods=80, freq='W'),
                           'Sales': 100 + np.arange(80) * 2 + np.sin(np.arange(80)) * 20})
    original = create_weekly_sales_data(source)
    origin = 45
    cutoff = original.Week.iloc[origin]
    source.loc[source.Order_Date >= cutoff, 'Sales'] += 1e7
    poisoned = create_weekly_sales_data(source)
    pd.testing.assert_frame_equal(forecast_at_origin(original, origin), forecast_at_origin(poisoned, origin))


def test_recommendation_training_excludes_future_items_and_sales():
    data = pd.DataFrame({'Order_Date': pd.to_datetime(['2020-01-01'] * 4 + ['2020-02-01']),
                         'Order_ID': ['a', 'a', 'b', 'b', 'c'],
                         'Customer_ID': ['x', 'x', 'y', 'y', 'x'],
                         'Product_Name': ['red pen', 'blue pen', 'red pen', 'book', 'future secret'],
                         'Sales': [10, 20, 10, 30, 1e8]})
    train, collab, content, popularity = recommendation_training(data, pd.Timestamp('2020-01-15'))
    assert len(train) == 4
    assert 'future secret' not in collab.columns and 'future secret' not in content.columns
    assert 'future secret' not in popularity and popularity[0] == 'red pen'


def test_ranking_metrics_have_known_answers():
    result = ranking_metrics(['a', 'b', 'c', 'd', 'e'], {'a', 'c', 'z'})
    assert result['hit_rate_at_5'] == 1 and result['precision_at_5'] == .4
    assert result['recall_at_5'] == pytest.approx(2 / 3)
    assert result['ndcg_at_5'] == pytest.approx(1.5 / (1 + 1 / np.log2(3) + .5))
