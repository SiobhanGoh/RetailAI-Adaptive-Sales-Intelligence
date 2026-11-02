"""Consistent date parsing for the bundled data and user-selected upload convention."""
import pandas as pd


def parse_dates(values, *, dayfirst=True, date_format=None):
    if pd.api.types.is_datetime64_any_dtype(values):
        return pd.to_datetime(values, errors="coerce")
    if date_format:
        return pd.to_datetime(values, format=date_format, errors="coerce")
    # ISO dates are unambiguous: never reverse their month/day when dayfirst=True.
    text = values.astype("string").str.strip()
    iso = text.str.match(r"^\d{4}-\d{2}-\d{2}(?:$|[ T])", na=False)
    result = pd.Series(pd.NaT, index=values.index, dtype="datetime64[ns]")
    result.loc[iso] = pd.to_datetime(text.loc[iso], format="ISO8601", errors="coerce")
    result.loc[~iso] = pd.to_datetime(
        text.loc[~iso], format="mixed", dayfirst=dayfirst, errors="coerce"
    )
    return result
