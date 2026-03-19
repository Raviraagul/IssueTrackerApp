"""
import_excel.py
Called by Node.js when an Excel file is uploaded.
Reads all 3 team sheets, detects changes, returns JSON to Node.js.

To change status categories or mappings → edit config.py only.
"""

import sys
import json
import argparse
import pandas as pd
from pathlib import Path

import sys
import warnings
import numpy as np

sys.stdout.reconfigure(encoding='utf-8') # set utf-8 encoding for stdout
warnings.filterwarnings("ignore", category=UserWarning) # ignore pandas warnings

# Import config — single source of truth
sys.path.insert(0, str(Path(__file__).parent))
from config import (
    STATUS_MAP, STATUS_CATEGORIES,
    ACTIVE_CATEGORY_KEYS, LIVE_MOVE_CATEGORY_KEY,
    DEFAULT_CATEGORY_KEY, get_display_name,
    get_category_key, is_active, is_live_move
)

# ── Helper: clean pandas values for JSON ─────────────────────────────────────
def clean(value):
    if pd.isna(value):
        return None
    return str(value).strip()

# ── Sheet definitions ─────────────────────────────────────────────────────────
TEAM_SHEETS = {
    "Module Wise Issue - API": "API",
    "Module Wise Issue - Web": "Web",
    "Module Wise Issue - App": "App",
}

EXPECTED_CHANGE_FIELDS = [
    "status_raw", "assigned_to", "fixed_status", "comments", "fixed_date"
]

TRACKED_FIELDS = [
    "issue_description", "priority", "product_name", "module", "company"
]


# ── Read one team sheet ───────────────────────────────────────────────────────
def read_sheet(file_path, sheet_name, team_label):
    # raw = pd.read_excel(file_path, sheet_name=sheet_name, header=None) # This loads using openpyxl automatically, which is slower.

    raw = pd.read_excel(file_path, sheet_name=sheet_name, header=None, engine="openpyxl") # This loads using openpyxl automatically. This prevents pandas from trying multiple engines.

    # Find header row
    header_row = None
    for i, row in raw.iterrows():
        if any("Ticket No" in str(v) for v in row.values):
            header_row = i
            break

    if header_row is None:
        return pd.DataFrame()

    df = raw.iloc[header_row:].copy()
    df.columns = df.iloc[0]
    df = df.iloc[1:].reset_index(drop=True)

    # Strip whitespace from column names
    df.columns = [str(c).strip() for c in df.columns]

    # Handle duplicate column names
    seen = {}
    new_cols = []
    for c in df.columns:
        if c in seen:
            seen[c] += 1
            new_cols.append(f"{c}_{seen[c]}")
        else:
            seen[c] = 0
            new_cols.append(c)
    df.columns = new_cols

    # Rename Distomatic → Web/App for App sheet
    if "Distomatic" in df.columns and "Web/App" not in df.columns:
        df = df.rename(columns={"Distomatic": "Web/App"})

    # Drop empty rows
    df = df[
        df["Ticket No"].notna() &
        (df["Ticket No"].astype(str).str.strip() != "")
    ]

    df["_team"] = team_label

    # Normalize status using config
    df["Status_raw"]      = df["Status"].astype(str).str.strip()
    df["Status_category"] = df["Status_raw"].apply(get_category_key)
    df["Status_norm"]     = df["Status_category"].apply(get_display_name)

    # Parse dates
    df["Date"] = pd.to_datetime(df["Date"], errors="coerce").dt.strftime("%Y-%m-%d")
    if "Fixed Date" in df.columns:
        df["Fixed Date"] = pd.to_datetime(
            df["Fixed Date"], errors="coerce"
        ).dt.strftime("%Y-%m-%d")

    df["Ticket No"] = df["Ticket No"].astype(str).str.strip()

    # Replace NaN with None (for valid JSON output)
    df = df.replace({np.nan: None})

    return df


# ── Build flat ticket list ────────────────────────────────────────────────────
def build_tickets(sheets):
    tickets = []
    for team_label, df in sheets.items():
        for _, row in df.iterrows():
            tickets.append({
                "ticket_no":         clean(row.get("Ticket No")),
                "date":              clean(row.get("Date")),
                "company":           clean(row.get("Company")),
                "product_name":      clean(row.get("Product Name")),
                "platform":          clean(row.get("Web/App")),
                "team":              team_label,
                "module":            clean(row.get("Module")),
                "sub_module":        clean(row.get("Sub Module",
                                    row.get(" Sub Module",
                                    row.get("Module_1", "")))),
                "issue_description": clean(row.get("Issue Description")),
                "priority":          clean(row.get("Priority")),
                "status_raw":        clean(row.get("Status_raw")),
                "status_norm":       clean(row.get("Status_norm")),
                "assigned_to":       clean(row.get("Assigned to")),
                "comments":          clean(row.get("Comments")),
                "fixed_status":      clean(row.get("Fixed status")),
                "fixed_date":        clean(row.get("Fixed Date")),
                "sync_status":       "New",
            })
    return tickets


# ── Build report snapshots ────────────────────────────────────────────────────
def build_snapshots(sheets, snapshot_date, snapshot_time):
    snapshots = []
    for team_label, df in sheets.items():
        for product in ["Salesmatic", "Distomatic"]:
            sub = df[df["Product Name"].astype(str).str.strip() == product]

            yet_to_start  = int((sub["Status_category"] == "yet_to_start").sum())
            in_progress   = int((sub["Status_category"] == "in_progress").sum())
            completed_dev = int((sub["Status_category"] == "completed_dev").sum())
            pre_prod      = int((sub["Status_category"] == "pre_prod").sum())
            live_move     = int((sub["Status_category"] == LIVE_MOVE_CATEGORY_KEY).sum())
            total_active  = int(sub["Status_category"].apply(is_active).sum())

            snapshots.append({
                "snapshot_date":  snapshot_date,
                "snapshot_time":  snapshot_time,
                "product_name":   product,
                "team":           team_label,
                "yet_to_start":   yet_to_start,
                "in_progress":    in_progress,
                "completed_dev":  completed_dev,
                "pre_production": pre_prod,
                "live_move":      live_move,       # ← fills Total Live Move column
                "total_active":   total_active,
            })
    return snapshots


# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--file",  required=True, help="Path to Excel file")
    parser.add_argument("--date",  required=True, help="Snapshot date YYYY-MM-DD")
    parser.add_argument("--time",  default="AM",  help="AM or PM")
    args = parser.parse_args()

    try:
        xl     = pd.ExcelFile(args.file)
        sheets = {}

        for sheet_name, team_label in TEAM_SHEETS.items():
            if sheet_name in xl.sheet_names:
                df = read_sheet(args.file, sheet_name, team_label)
                if not df.empty:
                    sheets[team_label] = df

        if not sheets:
            raise ValueError("No valid team sheets found in the Excel file.")

        tickets   = build_tickets(sheets)
        snapshots = build_snapshots(sheets, args.date, args.time)

        result = {
            "stats": {
                "new":           len(tickets),
                "updated":       0,
                "archived":      0,
                "field_changes": 0,
            },
            "tickets":   tickets,
            "archived":  [],
            "changes":   [],
            "snapshots": snapshots,
            # Pass category names to Node.js so DB stays in sync
            "categories": STATUS_CATEGORIES,
        }

        # ── To find the NaN values ──────────────────────────────────────────
        """ import math

        def find_nan(obj, path="root"):
            if isinstance(obj, dict):
                for k, v in obj.items():
                    find_nan(v, f"{path}.{k}")
            elif isinstance(obj, list):
                for i, v in enumerate(obj):
                    find_nan(v, f"{path}[{i}]")
            elif isinstance(obj, float) and math.isnan(obj):
                print(f"NaN found at: {path}", file=sys.stderr)

        find_nan(result) """

        try:
            print(json.dumps(result, default=str, allow_nan=False))
        except ValueError as e:
            print("JSON ERROR:", e, file=sys.stderr)
            print("RESULT SAMPLE:", result, file=sys.stderr)
            sys.exit(1)

        # print(json.dumps(result, ensure_ascii=False, default=str))

    except Exception as e:
        print(f"ERROR: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
