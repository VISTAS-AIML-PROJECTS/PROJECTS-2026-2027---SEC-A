# URLNivox · Secure Web Link Analyzer

A redesigned Flask + vanilla JavaScript dashboard for understanding URL risk **before visiting a destination**. The app serves the frontend and API together. URL analysis uses local rules, structure signals, and the included trained ML model. No API key is needed.

## Start on Windows

1. Stop any older app terminal with Ctrl+C. Extract this ZIP completely into a **new folder** and open `URLNivox`.
2. Double-click **START-WINDOWS.bat**. It creates a fresh Python environment, installs the compatible app and ML dependencies, and checks the included model.
3. Open **http://127.0.0.1:5000**. Keep the terminal window open. Use Ctrl+F5 if your browser shows the earlier UI. The trained model is included; you do not need to train it again.

Python 3.11 or newer is required; Python 3.13 is supported. Initial dependency installation needs internet. Local analysis works without internet after setup. Node, Docker, CORS, and Live Server are not required.

Alternatively, in the VS Code PowerShell terminal **at the project root**, run one line at a time:

```powershell
py -m venv backend\venv
.\backend\venv\Scripts\python.exe -m pip install -r backend\requirements.txt
.\backend\venv\Scripts\python.exe backend\app.py
```

If `py` is unavailable but Python is installed, use `python` for the first command. Environment activation is not required, so PowerShell's activation policy does not block these commands.

macOS/Linux:

```bash
python3 -m venv backend/venv
backend/venv/bin/python -m pip install -r backend/requirements.txt
backend/venv/bin/python backend/app.py
```

## What changed

| Feature | What you can do |
| --- | --- |
| Analyzer home | Paste a URL, get its risk score and verdict, and view recent checks. |
| Single URL | Analyze a link and see a complete report, actual hostname, risk level, and next steps. |
| Batch check | Check 1–10 links locally, get per-line errors, open detailed reports, and export CSV. |
| Score explanation | Inspect direct rule points, structural contribution, ML weight, and final risk score. |
| Feature explorer | Expand all 24 ML input features with values and plain-language explanations. |
| Private check | Disable Save to history before analyzing. The response still appears in your browser. |
| Scan history · second page | View Total / Safe / Suspicious / Malicious counts, search, filter, paginate, reopen saved reports, and export the current page. |
| Reports | Copy plain text, download JSON, or Print / PDF from the report dialog. |
| ML insights | See the included Random Forest model, 40,000 labelled URLs, training split, and actual measured metrics. |
| Guide | English and Thanglish explanations, including ML setup and scoring. |
| Accessibility | Keyboard navigation, dialog focus handling, input errors, reduced-motion support, and responsive layouts. |

The uploaded database's earlier rows are retained. The app adds a `report_json` column automatically. Earlier rows have their original scores and reasons but no fabricated detailed report. The old machine-specific Windows virtual environment was excluded from this portable ZIP; the launcher recreates it.

## Model status: ready

This ZIP includes a real trained Random Forest, its 40,000-row labelled dataset, provenance, and matching evaluation report. The earlier upload had empty dataset/model files; the analyzer now loads the included artifact and uses it during each check. ML insights should show **Model loaded**, **40,000 labelled URLs**, and measured metrics.

The model uses 24 URL features. It was trained on 32,118 rows and evaluated on 7,882 held-out rows, with no overlap in the approximate domain groups. Source labels come from the published DEPHIDES dataset; see `docs/DATASET-SOURCE.md` and its included license.

| Measured classifier metric | Held-out result |
| --- | --- |
| Accuracy | 89.96% |
| Precision | 88.29% |
| Recall | 91.77% |
| F1 | 90.00% |
| ROC-AUC | 0.967739 |
| False negative rate | 8.23% |

These are **historical ML-only benchmark results**, not the accuracy of the full hybrid app or a guarantee about live links. The balanced sample does not represent real browsing prevalence. Source collection patterns can bias performance, and the domain grouper uses a small suffix list rather than the complete Public Suffix List. Metrics use binary threshold 0.5; the UI has three separate risk bands.

The initial candidate dataset made normal URL formatting look risky. It was replaced before delivery with real examples containing more varied paths. Empty root paths and `/` now use the same feature representation. The final dataset, model, and metrics all match; the rejected candidate is not included.

### Optional retraining

You can retrain directly on the included dataset:

```powershell
.\backend\venv\Scripts\python.exe backend\train_model.py
```

To regenerate the same documented dataset sample, run `backend/prepare_dataset.py` first. This downloads the pinned DEPHIDES source file and verifies its checksum. It does not visit any URL in that file. `--source-file` accepts a previously downloaded copy. No dataset download runs during ordinary app startup.

For your own CSV, use `url,label` columns. Benign labels include `benign`, `safe`, `0`; risky labels include `phishing`, `malicious`, `malware`, `1`. You need at least 200 valid rows, both classes, and enough domain groups to split. Verify the original dataset's label meaning before converting it. Unknown labels and invalid URLs are excluded; duplicates and conflicting labels are handled by the training script.

Training writes `trained_model.pkl` and `model_metrics.json`. Refresh ML insights after training. Missing, incompatible, or damaged artifacts produce an actionable status; Flask can still use clearly marked heuristic analysis. The Windows launcher stops if its model readiness check fails, so setup errors are visible.

Use the pinned ML dependencies in `backend/requirements.txt` with the same interpreter that starts Flask. Only load model artifacts you trained or trust. Pickle/joblib files can execute code.

## The actual scoring formula

1. **Rule score:** sum of triggered direct URL rule points, capped at 100.
2. **Structure score:** sum of triggered structural points. Add `round(structure × 0.40)` to the rule score, capped at 100. This is the heuristic score.
3. **With ML:** `round(heuristic × 0.60 + ML × 0.40)`. **Without ML:** use the heuristic score at full weight.

| Score | UI label | Existing API label |
| --- | --- | --- |
| 0–19 | Safe | Safe |
| 20–64 | Suspicious | Suspicious |
| 65–100 | Malicious | Malicious |

The current project's 20/65 thresholds are retained. The score is an index, **not a calibrated probability**. Exact component values appear in every new report.

## Privacy and scope

- No third-party URL lookups, no requests to submitted destinations, no DNS lookup of submitted destinations, no redirect following, no page content inspection, and no certificate verification.
- HTTPS detection reads the scheme only. It does not establish trustworthiness or a valid certificate.
- Common secret query values, embedded credentials, and fragments are redacted before returned URLs are saved. This is not a universal secret detector: arbitrary sensitive path values or unknown query keys may remain.
- History is in this app's SQLite database, not browser storage. Disabling saving affects subsequent checks only.
- A low score does not guarantee safety. Legitimate international domains, account pages, unusual ports, or file downloads can trigger heuristics.
- Host/domain explanations rely on static local lists; they do not verify live website content or ownership.
- The development server binds to loopback. Public deployment would require an appropriate production server, user authentication, and history isolation.

## Project files

```text
URLNivox/
  START-WINDOWS.bat
  README.md
  backend/
    app.py                  # Flask dashboard, APIs, persistence
    analyzer.py             # Validation, features, rules, hybrid scoring
    feature_extractor.py    # Shared model input order
    ml_model.py             # Optional model loading, readiness, prediction
    train_model.py           # Training and real held-out metrics
    prepare_dataset.py       # Reproducible source downloader / preparation
    dataset.csv              # 40,000 genuine labelled URL examples
    trained_model.pkl        # Included trained Random Forest
    model_metrics.json       # Actual held-out classifier results
    dataset_metadata.json    # Source, license, checksums and preparation
    check_ml_setup.py        # Local model readiness check
    requirements.txt
    requirements-ml.txt
  frontend/
    index.html
    static/                  # CSS, JS, local SVG icons
  database/
    database.sql
    secure_link_analyzer.db  # Original history retained
  docs/
    FEATURE-GUIDE-THANGLISH.md
    VALIDATION.md
    DATASET-SOURCE.md
    DATASET-LICENSE.txt
    ICON-LICENSE.txt
  tests/
    test_app.py
    test_trained_model.py
```

## API

| Endpoint | Purpose |
| --- | --- |
| `GET /api/health` | Server, ML readiness, and measured metrics |
| `POST /api/analyze` | `{ "url": "https://example.com", "save_history": true }` |
| `POST /api/analyze/batch` | `{ "urls": ["https://example.com"], "save_history": true }` |
| `GET /api/history` | `q`, `verdict`, `limit`, `offset` filters; saved totals |
| `GET /api/history/123` | Original full report, or a marked legacy summary |
| `DELETE /api/history` | Clear local history after the UI confirmation |

Local analysis is limited to 60 URLs per client per minute; a batch consumes one slot per URL. Requests are size-limited and history queries are parameterized.

Run the regression tests:

```powershell
.\backend\venv\Scripts\python.exe -m unittest discover -s tests -v
```

See `docs/VALIDATION.md` for what was and was not verified. Icons are bundled from Lucide; its license is included. No CDN, font service, or external frontend dependency is required.
