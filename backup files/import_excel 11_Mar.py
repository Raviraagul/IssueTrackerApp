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
import warnings
import numpy as np

sys.stdout.reconfigure(encoding='utf-8')
warnings.filterwarnings("ignore", category=UserWarning)

sys.path.insert(0, str(Path(__file__).parent))
from config import (
    STATUS_MAP, STATUS_CATEGORIES,
    ACTIVE_CATEGORY_KEYS, LIVE_MOVE_CATEGORY_KEY,
    DEFAULT_CATEGORY_KEY, get_display_name,
    get_category_key, is_active, is_live_move
)

ACTIVE_STATUSES = {'yet_to_start', 'in_progress', 'completed_dev', 'pre_prod'}
RESOLVED_STATUSES = {'fixed', 'closed'}

def clean(value):
    if pd.isna(value):
        return None
    return str(value).strip()

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

def read_sheet(file_path, sheet_name, team_label):
    raw = pd.read_excel(
        file_path, sheet_name=sheet_name, header=None, engine="openpyxl"
    )

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
    df.columns = [str(c).strip() for c in df.columns]

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

    if "Distomatic" in df.columns and "Web/App" not in df.columns:
        df = df.rename(columns={"Distomatic": "Web/App"})

    df = df[
        df["Ticket No"].notna() &
        (df["Ticket No"].astype(str).str.strip() != "")
    ]

    df["_team"] = team_label
    df["Status_raw"]      = df["Status"].astype(str).str.strip()
    df["Status_category"] = df["Status_raw"].apply(get_category_key)
    df["Status_norm"]     = df["Status_category"].apply(get_display_name)

    df["Date"] = pd.to_datetime(df["Date"], errors="coerce").dt.strftime("%Y-%m-%d")
    if "Fixed Date" in df.columns:
        df["Fixed Date"] = pd.to_datetime(
            df["Fixed Date"], errors="coerce"
        ).dt.strftime("%Y-%m-%d")

    df["Ticket No"] = df["Ticket No"].astype(str).str.strip()
    df = df.replace({np.nan: None})
    return df


def build_tickets(sheets, snapshot_date, existing_tickets):
    """
    Build ticket list with status_changed_date tracking.
    existing_tickets: dict of ticket_no -> {status_norm, status_changed_date}
    """
    tickets  = []
    archived = []
    changes  = []

    current_ticket_nos = set()

    for team_label, df in sheets.items():
        for _, row in df.iterrows():
            ticket_no    = clean(row.get("Ticket No"))
            status_norm  = clean(row.get("Status_norm"))
            status_cat   = clean(row.get("Status_category"))

            if not ticket_no:
                continue

            current_ticket_nos.add(ticket_no)

            # Determine status_changed_date
            status_changed_date = None
            prev = existing_tickets.get(ticket_no)

            if prev:
                prev_status_norm = prev.get("status_norm", "")
                prev_cat         = get_category_key(prev_status_norm) if prev_status_norm else None
                prev_changed     = prev.get("status_changed_date")

                # Status changed from active → fixed or closed on this date
                if (prev_cat in ACTIVE_STATUSES and
                    status_cat in RESOLVED_STATUSES):
                    status_changed_date = snapshot_date
                else:
                    # Keep existing status_changed_date
                    status_changed_date = prev_changed

                # Track field changes
                for field in EXPECTED_CHANGE_FIELDS:
                    field_map = {
                        "status_raw":   clean(row.get("Status_raw")),
                        "assigned_to":  clean(row.get("Assigned to")),
                        "fixed_status": clean(row.get("Fixed status")),
                        "comments":     clean(row.get("Comments")),
                        "fixed_date":   clean(row.get("Fixed Date")),
                    }
                    new_val = field_map.get(field)
                    old_val = prev.get(field)
                    if new_val != old_val and (new_val or old_val):
                        changes.append({
                            "ticket_no":  ticket_no,
                            "team":       team_label,
                            "product":    clean(row.get("Product Name")),
                            "field_name": field,
                            "old_value":  old_val,
                            "new_value":  new_val,
                            "change_type": "status_change"
                                if field == "status_raw" else "field_update",
                        })

            tickets.append({
                "ticket_no":           ticket_no,
                "date":                clean(row.get("Date")),
                "company":             clean(row.get("Company")),
                "product_name":        clean(row.get("Product Name")),
                "platform":            clean(row.get("Web/App")),
                "team":                team_label,
                "module":              clean(row.get("Module")),
                "sub_module":          clean(row.get("Sub Module",
                                       row.get(" Sub Module",
                                       row.get("Module_1", "")))),
                "issue_description":   clean(row.get("Issue Description")),
                "priority":            clean(row.get("Priority")),
                "status_raw":          clean(row.get("Status_raw")),
                "status_norm":         status_norm,
                "assigned_to":         clean(row.get("Assigned to")),
                "comments":            clean(row.get("Comments")),
                "fixed_status":        clean(row.get("Fixed status")),
                "fixed_date":          clean(row.get("Fixed Date")),
                "status_changed_date": status_changed_date,
                "last_seen_date":      snapshot_date,
                "sync_status":         "Updated" if prev else "New",
            })

    # Detect archived tickets (in DB but not in Excel anymore)
    """ for ticket_no, prev in existing_tickets.items():
        if ticket_no not in current_ticket_nos:
            archived.append(ticket_no) """

    # Tickets not in this import — mark as missing (don't archive)
    missing = [
        ticket_no for ticket_no in existing_tickets
        if ticket_no not in current_ticket_nos
    ]

    # return tickets, archived, changes
    return tickets, missing, changes


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
                "live_move":      live_move,
                "total_active":   total_active,
            })
    return snapshots


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--file",     required=True)
    parser.add_argument("--date",     required=True)
    parser.add_argument("--time",     default="AM")
    parser.add_argument("--existing", default="{}",
                        help="JSON string of existing tickets from DB")
    args = parser.parse_args()

    try:
        existing_tickets = json.loads(args.existing)
    except Exception:
        existing_tickets = {}

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

        tickets, archived, changes = build_tickets(
            sheets, args.date, existing_tickets
        )
        snapshots = build_snapshots(sheets, args.date, args.time)

        new_count     = sum(1 for t in tickets if t["sync_status"] == "New")
        updated_count = sum(1 for t in tickets if t["sync_status"] == "Updated")

        result = {
            "stats": {
                "new":           new_count,
                "updated":       updated_count,
                "archived":      len(archived),
                "field_changes": len(changes),
            },
            "tickets":    tickets,
            "archived":   archived,
            "changes":    changes,
            "snapshots":  snapshots,
            "categories": STATUS_CATEGORIES,
        }

        try:
            print(json.dumps(result, default=str, allow_nan=False))
        except ValueError as e:
            print("JSON ERROR:", e, file=sys.stderr)
            sys.exit(1)

    except Exception as e:
        print(f"ERROR: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()