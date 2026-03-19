"""
import_excel.py
==============
Called by Node.js (import.js) when an Excel file is uploaded.

WHAT THIS FILE DOES:
  1. Reads the Excel file (3 team sheets: API, Web, App)
  2. Compares each ticket with what's already in the database
  3. Detects status changes and field updates
  4. Records every status change in history (for reports + charts)
  5. Returns everything as JSON to Node.js

HOW IT'S CALLED:
  python import_excel.py --file <path> --date <YYYY-MM-DD> --existing <json>

  --file     : path to the uploaded Excel file
  --date     : the snapshot date chosen by the admin (e.g. 2026-03-11)
  --existing : JSON string of all current tickets from the DB
               { "2026030901": { status_norm, status_changed_date, ... }, ... }

WHAT IT RETURNS (stdout as JSON):
  {
    tickets  : [ ...all tickets from Excel... ],
    changes  : [ ...unexpected field changes... ],
    history  : [ ...status change history entries... ],
    missing  : [ ...ticket numbers not in this import... ],
    stats    : { new, updated, missing, field_changes }
  }

To change status categories or mappings → edit config.py only.
"""

import sys
import json
import argparse
import pandas as pd
from pathlib import Path
import warnings
import numpy as np

# ── Setup ─────────────────────────────────────────────────────────────────────

# Make sure Python prints UTF-8 (handles special characters in ticket descriptions)
sys.stdout.reconfigure(encoding='utf-8')

# Suppress irrelevant Excel format warnings from openpyxl
warnings.filterwarnings("ignore", category=UserWarning)

# Allow importing config.py from the same folder as this script
sys.path.insert(0, str(Path(__file__).parent))

# Import all status config from config.py (single source of truth)
from config import (
    STATUS_CATEGORIES,   # { "yet_to_start": "Yet to Start (Dev)", ... }
    get_display_name,    # category key → display name
    get_category_key,    # raw Excel status → category key
)

# ── Constants ─────────────────────────────────────────────────────────────────

# Maps Excel sheet names → team labels used in the database
TEAM_SHEETS = {
    "Module Wise Issue - API": "API",
    "Module Wise Issue - Web": "Web",
    "Module Wise Issue - App": "App",
}

# Fields we track for unexpected changes (logged to change_history table)
# These are fields that shouldn't normally change but we want to audit
TRACKED_CHANGE_FIELDS = [
    "status_raw",    # raw status text from Excel
    "assigned_to",   # who the ticket is assigned to
    "fixed_status",  # fixed status text
    "comments",      # any comments
    "fixed_date",    # date the ticket was fixed
]


# ── Helper Functions ──────────────────────────────────────────────────────────

def clean(value):
    """
    Converts any Excel cell value to a clean string or None.
    - NaN / empty cells → None
    - Everything else → stripped string
    """
    if pd.isna(value):
        return None
    s = str(value).strip()
    return s if s else None


# ── Sheet Reader ──────────────────────────────────────────────────────────────

def read_sheet(file_path, sheet_name, team_label):
    """
    Reads one Excel sheet and returns a clean DataFrame.

    WHY THE COMPLEXITY:
    The Excel files have a dynamic header row — there are title rows
    at the top before the actual column headers. We scan each row
    until we find one containing "Ticket No", then use that as the header.

    WHAT IT RETURNS:
    A DataFrame where each row = one ticket, with columns normalized.
    Returns empty DataFrame if the sheet is malformed.
    """

    # Read raw without assuming any header
    raw = pd.read_excel(
        file_path, sheet_name=sheet_name, header=None, engine="openpyxl"
    )

    # Scan rows to find where "Ticket No" column header appears
    header_row = None
    for i, row in raw.iterrows():
        if any("Ticket No" in str(v) for v in row.values):
            header_row = i
            break

    # If no header found, this sheet is empty or has wrong format
    if header_row is None:
        return pd.DataFrame()

    # Slice from header row onwards, set first row as column names
    df = raw.iloc[header_row:].copy()
    df.columns = df.iloc[0]
    df = df.iloc[1:].reset_index(drop=True)
    df.columns = [str(c).strip() for c in df.columns]

    # Handle duplicate column names (Excel sometimes has repeated headers)
    # e.g. two columns both named "Module" → rename to "Module", "Module_1"
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

    # Normalize "Distomatic" column name → "Web/App" for consistency
    if "Distomatic" in df.columns and "Web/App" not in df.columns:
        df = df.rename(columns={"Distomatic": "Web/App"})

    # Remove rows where Ticket No is empty (blank/summary rows at bottom)
    df = df[
        df["Ticket No"].notna() &
        (df["Ticket No"].astype(str).str.strip() != "")
    ]

    # Add team label column (API / Web / App)
    df["_team"] = team_label

    # Normalize status: raw text → category key → display name
    df["Status_raw"]      = df["Status"].astype(str).str.strip()
    df["Status_category"] = df["Status_raw"].apply(get_category_key)
    df["Status_norm"]     = df["Status_category"].apply(get_display_name)

    # Normalize date columns to YYYY-MM-DD strings
    df["Date"] = pd.to_datetime(df["Date"], errors="coerce").dt.strftime("%Y-%m-%d")
    if "Fixed Date" in df.columns:
        df["Fixed Date"] = pd.to_datetime(
            df["Fixed Date"], errors="coerce"
        ).dt.strftime("%Y-%m-%d")

    # Ensure Ticket No is a clean string
    df["Ticket No"] = df["Ticket No"].astype(str).str.strip()

    # Replace all NaN with None (so JSON serialization works cleanly)
    df = df.replace({np.nan: None})

    return df


# ── Ticket Builder ────────────────────────────────────────────────────────────

def build_tickets(sheets, snapshot_date, existing_tickets, import_filename):
    """
    Processes all tickets from the Excel sheets.

    FOR EACH TICKET:
    - Builds the ticket data dict (all fields)
    - Compares with existing DB record to detect changes
    - If status changed → adds a history entry
    - If other fields changed → logs to changes list (audit trail)

    PARAMETERS:
    - sheets           : { team_label: DataFrame }
    - snapshot_date    : "YYYY-MM-DD" string (chosen by admin on import page)
    - existing_tickets : { ticket_no: { status_norm, status_changed_date, ... } }
    - import_filename  : original Excel filename (stored as changed_by in history)

    RETURNS:
    - tickets  : list of ticket dicts (all tickets from Excel)
    - changes  : list of unexpected field change dicts (audit log)
    - history  : list of status change history dicts
    - missing  : list of ticket_nos in DB but not in this Excel
    """

    tickets = []   # All tickets from this Excel → tickets table
    changes = []   # Unexpected field changes → change_history table
    history = []   # Status changes → ticket_status_history table

    # Track which ticket numbers appear in this Excel
    # Used at the end to find tickets missing from this import
    current_ticket_nos = set()

    for team_label, df in sheets.items():
        for _, row in df.iterrows():

            ticket_no   = clean(row.get("Ticket No"))
            status_norm = clean(row.get("Status_norm"))

            # Skip rows without a ticket number
            if not ticket_no:
                continue

            current_ticket_nos.add(ticket_no)

            # Look up this ticket in existing DB records
            prev = existing_tickets.get(ticket_no)

            # ── Status change detection ───────────────────────────────────────
            # We compare the status from Excel with what's in the DB.
            # If different → this is a status change event → record in history.

            status_changed_date = None

            if prev:
                # Existing ticket — compare statuses
                prev_status_norm = prev.get("status_norm", "")

                if prev_status_norm != status_norm:
                    # Status has changed in this import
                    status_changed_date = snapshot_date

                    # Record this change in history
                    # This is what powers the daily movement report and charts
                    history.append({
                        "ticket_no":    ticket_no,
                        "old_status":   prev_status_norm,
                        "new_status":   status_norm,
                        "raw_status":   clean(row.get("Status_raw")),
                        "changed_date": snapshot_date,
                        "method":       "import",
                        "changed_by":   import_filename,
                    })
                else:
                    # Status unchanged → carry forward existing changed date
                    status_changed_date = prev.get("status_changed_date")

                # ── Audit field changes ───────────────────────────────────────
                # Check other fields for unexpected changes.
                # This creates an audit trail in change_history table.
                # Example: someone changed a comment or fixed_date in the Excel.

                field_map = {
                    "status_raw":   clean(row.get("Status_raw")),
                    "assigned_to":  clean(row.get("Assigned to")),
                    "fixed_status": clean(row.get("Fixed status")),
                    "comments":     clean(row.get("Comments")),
                    "fixed_date":   clean(row.get("Fixed Date")),
                }

                for field in TRACKED_CHANGE_FIELDS:
                    new_val = field_map.get(field)
                    old_val = prev.get(field)
                    if new_val != old_val and (new_val or old_val):
                        changes.append({
                            "ticket_no":   ticket_no,
                            "team":        team_label,
                            "product":     clean(row.get("Product Name")),
                            "field_name":  field,
                            "old_value":   old_val,
                            "new_value":   new_val,
                            "change_type": "status_change"
                                           if field == "status_raw"
                                           else "field_update",
                        })

            else:
                # ── New ticket ────────────────────────────────────────────────
                # This ticket doesn't exist in DB yet.
                # Record its initial status in history so we know
                # when it first appeared and what status it started with.
                status_changed_date = snapshot_date

                history.append({
                    "ticket_no":    ticket_no,
                    "old_status":   prev_status_norm,
                    "new_status":   status_norm,
                    "raw_status":   clean(row.get("Status_raw")),
                    "changed_date": snapshot_date,
                    "method":       "import",
                    "changed_by":   import_filename,
                })

            # ── Build ticket dict ─────────────────────────────────────────────
            # Full ticket record — goes to the tickets table in the DB
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

    # ── Missing tickets ───────────────────────────────────────────────────────
    # Find tickets that exist in DB but were NOT in this Excel.
    # We don't delete them — their last_seen_date will be older than
    # the latest import, which is how the "Missing" badge works.
    missing = [
        ticket_no for ticket_no in existing_tickets
        if ticket_no not in current_ticket_nos
    ]

    return tickets, changes, history, missing


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    """
    Entry point — parses CLI arguments, runs the import, prints JSON result.
    Node.js reads the JSON from stdout and saves everything to the database.
    """

    parser = argparse.ArgumentParser()
    parser.add_argument("--file",     required=True, help="Path to Excel file")
    parser.add_argument("--date",     required=True, help="Snapshot date YYYY-MM-DD")
    parser.add_argument("--existing", default="{}",  help="JSON of existing DB tickets")
    parser.add_argument("--existing-file", default=None, help="Path to JSON file of existing DB tickets")
    args = parser.parse_args()

    # Parse existing tickets JSON passed from Node.js
    try:
        if args.existing_file:
            with open(args.existing_file, 'r', encoding='utf-8') as f:
                existing_tickets = json.load(f)
        else:
            existing_tickets = json.loads(args.existing)
    except Exception:
        existing_tickets = {}

    # Use just the filename (not full path) for history records
    import_filename = Path(args.file).name

    try:
        xl     = pd.ExcelFile(args.file)
        sheets = {}

        # Read each team sheet that exists in this Excel file
        for sheet_name, team_label in TEAM_SHEETS.items():
            if sheet_name in xl.sheet_names:
                df = read_sheet(args.file, sheet_name, team_label)
                if not df.empty:
                    sheets[team_label] = df

        if not sheets:
            raise ValueError("No valid team sheets found in the Excel file.")

        # Process all tickets — get tickets, audit changes, history, missing list
        tickets, changes, history, missing = build_tickets(
            sheets, args.date, existing_tickets, import_filename
        )

        # Summary counts for the import result card in the UI
        new_count     = sum(1 for t in tickets if t["sync_status"] == "New")
        updated_count = sum(1 for t in tickets if t["sync_status"] == "Updated")

        # Final result — Node.js reads this from stdout
        result = {
            "stats": {
                "new":           new_count,
                "updated":       updated_count,
                "missing":       len(missing),
                "field_changes": len(changes),
            },
            "tickets":  tickets,
            "changes":  changes,
            "history":  history,
            "missing":  missing,
        }

        print(json.dumps(result, default=str, allow_nan=False))

    except Exception as e:
        print(f"ERROR: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
