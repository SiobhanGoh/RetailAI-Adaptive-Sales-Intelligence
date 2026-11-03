"""Trim UCI Online Retail II to a browser-sized sample for the RetailAI app.

Source: Chen, D. (2012). Online Retail II [Dataset]. UCI Machine Learning Repository.
https://doi.org/10.24432/C5CG6D. Licensed CC BY 4.0.

Usage (download the zip from https://archive.ics.uci.edu/dataset/502/online+retail+ii first):
    python research/prepare_online_retail.py path/to/online_retail_II.xlsx

Steps, fixed in advance and applied in this order:
 1. Keep invoices dated 1 Dec 2010 to 9 Dec 2011 (the second sheet's full year).
 2. Drop rows without a customer ID.
 3. Drop exact duplicate rows, rows with a price of zero or less, bad-debt "A" invoices and
    non-product stock codes (postage, fees, manual adjustments, discounts, vouchers).
    Product codes are five digits, optionally followed by letters.
 4. Keep every row for a deterministic 40% of customers, chosen by hashing the customer ID,
    so each kept customer's full history (purchases and returns) stays intact.
Cancellations ("C" invoices with negative quantities) are kept: they are the returns.
"""
import hashlib
import re
import sys
from pathlib import Path

import pandas as pd

EXPECTED = ['Invoice', 'StockCode', 'Description', 'Quantity', 'InvoiceDate', 'Price', 'Customer ID', 'Country']
OUT = Path(__file__).resolve().parents[1] / 'data' / 'online_retail_ii_sample.csv'
SHARE = 0.40


def keep_customer(cid: float) -> bool:
    digest = hashlib.sha256(str(int(cid)).encode()).digest()
    return int.from_bytes(digest[:8], 'big') / 2**64 < SHARE


def main(path: str) -> None:
    sheets = pd.read_excel(path, sheet_name=None, dtype={'Invoice': str, 'StockCode': str})
    for name, frame in sheets.items():
        if list(frame.columns) != EXPECTED:
            raise SystemExit(f'Unexpected columns in sheet {name!r}: {list(frame.columns)}')
    raw = pd.concat(sheets.values(), ignore_index=True)
    steps = [('all rows, both sheets', len(raw))]

    df = raw[(raw.InvoiceDate >= '2010-12-01') & (raw.InvoiceDate < '2011-12-10')]
    steps.append(('1 Dec 2010 to 9 Dec 2011', len(df)))
    df = df[df['Customer ID'].notna()]
    steps.append(('with a customer ID', len(df)))
    df = df.drop_duplicates()
    df = df[(df.Price > 0) & ~df.Invoice.str.startswith('A') & df.StockCode.str.fullmatch(r'\d{5}[A-Za-z]*')]
    steps.append(('deduplicated, priced products only', len(df)))
    df = df[df['Customer ID'].map(keep_customer)]
    steps.append((f'{SHARE:.0%} of customers, full histories', len(df)))

    df = df.sort_values(['InvoiceDate', 'Invoice', 'StockCode'], kind='stable').copy()
    df['Customer ID'] = df['Customer ID'].astype(int).astype(str)
    df['InvoiceDate'] = df.InvoiceDate.dt.strftime('%Y-%m-%d %H:%M')
    df['Description'] = df.Description.fillna('').str.strip().map(lambda s: re.sub(r'\s+', ' ', s))
    df.to_csv(OUT, index=False)

    for label, n in steps:
        print(f'{n:>9,}  {label}')
    print(f'customers {df["Customer ID"].nunique():,}, invoices {df.Invoice.nunique():,}, '
          f'returns {df.Invoice.str.startswith("C").sum():,} rows, {OUT.stat().st_size / 1e6:.1f} MB -> {OUT.name}')


if __name__ == '__main__':
    main(sys.argv[1])
