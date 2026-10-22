from pathlib import Path
import numpy as np
import pandas as pd
import pytest
from utils.data_loader import prepare_adaptive_dataset
from utils.date_utils import parse_dates
from utils.forecasting_utils import (
    FEATURE_COLS, create_weekly_sales_data, generate_future_forecast,
    make_future_feature_row, train_weekly_knn_forecast,
)


def series(n=80):
    return pd.DataFrame({"Order_Date": pd.date_range("2020-01-05", periods=n, freq="W"),
                         "Sales": 100 + np.arange(n) * 2 + np.sin(np.arange(n)) * 10})


def test_default_data_retains_all_rows_and_correct_dates():
    raw = pd.read_csv(Path(__file__).resolve().parents[1]/"data/Superstore Sales Dataset.csv")
    clean, _ = prepare_adaptive_dataset(raw, date_format="%d/%m/%Y")
    assert len(clean) == len(raw) == 9800
    assert clean.Sales.sum() == pytest.approx(2261536.7827)
    assert clean.Order_Date.iloc[0] == pd.Timestamp("2017-11-08")
    assert (clean.Ship_Date >= clean.Order_Date).all()


def test_upload_date_conventions_and_iso_are_consistent():
    values = pd.Series(["08/11/2026", "2026-11-08", "bad"])
    assert parse_dates(values).iloc[:2].tolist() == [pd.Timestamp("2026-11-08")] * 2
    assert parse_dates(values, dayfirst=False).iloc[0] == pd.Timestamp("2026-08-11")
    assert pd.isna(parse_dates(values).iloc[2])


def test_current_and_future_targets_cannot_change_earlier_features():
    raw = series()
    before = create_weekly_sales_data(raw).set_index("Week")
    raw.loc[50:, "Sales"] += 1000000
    after = create_weekly_sales_data(raw).set_index("Week")
    pd.testing.assert_frame_equal(before.loc[:raw.Order_Date.iloc[50], FEATURE_COLS],
                                  after.loc[:raw.Order_Date.iloc[50], FEATURE_COLS])


def test_every_historical_feature_matches_prediction_time_definition():
    raw = series()
    raw.loc[30, "Sales"] = 0
    weekly = create_weekly_sales_data(raw)
    for _, row in weekly.iterrows():
        i = int(row.weeks_since_start)
        future = make_future_feature_row(row.Week, i, raw.Sales.iloc[:i].tolist())
        np.testing.assert_allclose(row[FEATURE_COLS].astype(float), future.iloc[0], atol=1e-10)


def test_short_history_keeps_full_lag_context_and_calendar_index():
    raw = series(22)
    weekly = create_weekly_sales_data(raw)
    class Recorder:
        def predict(self, x):
            self.x = x.copy()
            return [123.0]
    recorder = Recorder()
    generate_future_forecast(recorder, weekly, periods=1)
    expected = make_future_feature_row(raw.Order_Date.iloc[-1] + pd.Timedelta(weeks=1), 22, raw.Sales.tolist())
    pd.testing.assert_frame_equal(recorder.x, expected)


def test_forecast_evaluation_and_baseline_have_same_test_dates():
    weekly, predictions, metrics, future = train_weekly_knn_forecast(series())
    split = int(len(weekly) * .8)
    assert predictions.Week.tolist() == weekly.Week.iloc[split:].tolist()
    assert metrics['Naive_MAE'] == pytest.approx(np.abs(weekly.Weekly_Sales.iloc[split:] - weekly.lag_1.iloc[split:]).mean())
    assert metrics['Train_Weeks'] + metrics['Test_Weeks'] == len(weekly)
    assert len(future) == 4
    assert np.isfinite(future['Predicted Sales']).all()
    assert future['Future Week'].min() > predictions.Week.max()
