# retailai-mcp-server

The RetailAI sales engine as a [Model Context Protocol](https://modelcontextprotocol.io) server. Any app or IDE that speaks MCP can then answer questions about a sales file by calling the same, tested code the web app uses, instead of guessing numbers.

> "Forecast Drinks for the next 8 weeks." "What happens to units if Convenience goes up 10%?" "Which weeks in 2025 were unusual, and why?"

Everything runs on your machine. Files are read locally; nothing is uploaded.

## Tools

| Tool | What it answers |
|---|---|
| `retailai_describe_dataset` | What is in the file: rows, dates, recognised columns, data-quality notes, and the categories, regions and states you can filter by |
| `retailai_sales_summary` | Net sales, orders, average order, customers, units, margin for a period, against the previous period and last year, with a breakdown |
| `retailai_forecast` | Weekly sales 1–12 weeks ahead with a calibrated 80% range, and each model's past error |
| `retailai_price_sensitivity` | How strongly units respond to price, per category, with a 95% range |
| `retailai_price_what_if` | Projected change in units and sales for a price change, per week, flagged when outside prices ever seen |
| `retailai_find_products` | Product ids by name |
| `retailai_product_suggestions` | What sells in the same orders, best sellers nearby, look-alikes |
| `retailai_unusual_weeks` | Weeks far above or below the 13 before them, with what drove them |

Every tool is read-only and takes `dataset`: a bundled sample (`kedai-amber`, `online-retail`, `superstore`) or an absolute path to your own `.csv`, `.tsv` or `.txt` export. If dates like 03/04/2024 are ambiguous, pass `date_order` (`dmy` or `mdy`) to every tool you call. Column names do not need to match exactly; they are detected the same way as in the app.

## Set it up, step by step

**1. Get the code.** You need [Node.js](https://nodejs.org) 20 or newer.

```bash
git clone https://github.com/SiobhanGoh/RetailAI-Adaptive-Sales-Intelligence.git
cd RetailAI-Adaptive-Sales-Intelligence
npm ci            # the engine's own dependencies
cd mcp
npm ci
npm run build     # makes mcp/dist/index.js
```

**2. Check it works.** This starts the server, calls every tool on the sample stores, and prints `Smoke test passed`:

```bash
npm run smoke
```

**3. Tell your MCP client about it.** Most clients have a JSON settings file with an `mcpServers` section. Add this, with the real path to your checkout:

```json
{
  "mcpServers": {
    "retailai": {
      "command": "node",
      "args": ["/full/path/to/RetailAI-Adaptive-Sales-Intelligence/mcp/dist/index.js"]
    }
  }
}
```

Restart the client. The eight `retailai_` tools should appear.

**4. Ask.** Start with "Describe the kedai-amber dataset", then ask anything in plain words. To use your own data, give the full path to the CSV file.

To explore the tools by hand without a client: `npx @modelcontextprotocol/inspector node dist/index.js`.

## How far to trust the numbers

The answers come with the same caveats as the app, and the tools say so in their results:

- **Forecast ranges** are split-conformal. Checked on later weeks, the 80% range held 71.2% (4 weeks ahead) and 68.6% (12 weeks) of outcomes on the Superstore sample, and 75–94% on the other two. See the main README.
- **Price sensitivity**: on the synthetic Kedai Amber store, whose true values are known, the truth fell inside the estimated range for all 7 categories. It learns from discounts, so a price rise is flagged as guesswork. On wholesale data, where bigger orders get lower prices, it overstates sensitivity.

## How it is built

`src/index.ts` registers the tools (MCP TypeScript SDK v2, stdio). It imports the engine from `../src/engine`, and `npm run build` bundles both into one file with esbuild. `src/data.ts` loads and caches datasets by path and modification time. `scripts/smoke.ts` is the self-check, and it also runs in CI.
