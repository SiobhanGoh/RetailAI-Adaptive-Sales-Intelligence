import streamlit as st


FILTER_COLUMNS = {
    "Region": "Region",
    "Category": "Category",
    "Segment": "Segment",
    "State": "State",
}


def is_useful_filter_column(df, column):
    if column not in df.columns:
        return False

    values = df[column].dropna().astype(str).str.strip()
    values = values[
        (values != "")
        & (values.str.lower() != "unknown")
        & (values.str.lower() != "unknown product")
        & (values.str.lower() != "unknown customer")
    ]

    return values.nunique() > 0


def get_filter_options(df, column):
    if not is_useful_filter_column(df, column):
        return []

    values = (
        df[column]
        .dropna()
        .astype(str)
        .str.strip()
        .unique()
        .tolist()
    )

    values = sorted([
        v for v in values
        if v != ""
        and v.lower() != "unknown"
        and v.lower() != "unknown product"
        and v.lower() != "unknown customer"
    ])

    return values


def render_global_filters(df):
    filters = {}

    with st.sidebar.expander("🔎 Filters & Segmentation", expanded=False):
        st.caption("Filters appear only when your dataset has useful columns.")

        filter_count = 0

        for filter_key, column in FILTER_COLUMNS.items():
            options = get_filter_options(df, column)

            if options:
                selected_values = st.multiselect(
                    filter_key,
                    options=options,
                    default=[],
                    placeholder=f"All {filter_key}"
                )

                filters[column] = selected_values
                filter_count += 1

        active_count = sum(len(v) for v in filters.values())

        if filter_count == 0:
            st.info("No useful filter columns detected for this dataset.")
        elif active_count > 0:
            st.success(f"{active_count} active filter selection(s)")
        else:
            st.info("No filters applied")

    return filters


def apply_global_filters(df, filters):
    filtered_df = df.copy()

    for column, selected_values in filters.items():
        if column in filtered_df.columns and selected_values:
            filtered_df = filtered_df[
                filtered_df[column].astype(str).isin(selected_values)
            ]

    return filtered_df