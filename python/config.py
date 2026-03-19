# =============================================================================
# config.py — SINGLE SOURCE OF TRUTH
# =============================================================================
# To rename a category: change the VALUE on the right side only
# To add a new Excel status: add a line to STATUS_MAP
# To move a status to a different category: change its value in STATUS_MAP
# =============================================================================

# ── Standard category display names ──────────────────────────────────────────
# KEY        = internal code (never change)
# VALUE      = display name shown in reports and dashboard (change freely)

STATUS_CATEGORIES = {
    "yet_to_start":  "Yet to Start (Dev)",
    "in_progress":   "In-Progress (Dev)",
    "completed_dev": "Completed (Dev)",
    "pre_prod":      "Pre Production",
    "fixed":         "Fixed",            # Live Move — resolved and deployed
    "closed":        "Closed",           # Invalid / Enhancement / other
}

# ── Map Excel raw status values → category key ────────────────────────────────
# Left  = exact value from Excel (lowercase)
# Right = category key from STATUS_CATEGORIES above

STATUS_MAP = {
    # Yet to Start
    "pending":                          "yet_to_start",

    # In Progress
    "inprogress":                       "in_progress",
    "in progress":                      "in_progress",
    "in-progress":                      "in_progress",

    # Completed Dev
    "dev completed":                    "completed_dev",
    "dev completed ":                   "completed_dev",

    # Pre Production
    "pre production":                   "pre_prod",
    "preproduction":                    "pre_prod",

    # Fixed (Live Move)
    "fixed":                            "fixed",
    "production":                       "fixed",

    # Closed (everything else)
    "closed":                           "closed",
    "invalid":                          "closed",
    "not an issue":                     "closed",
    "can't recreate":                   "closed",
    "cant recreate":                    "closed",
    "front end(invalid)":               "closed",
    "not able to recreate":             "closed",
    "enhancement":                      "closed",
    "enhancement done":                 "closed",
    "moved to enhancement":             "closed",
    "next release(fixed)":              "closed",
    "hold":                             "closed",
}

# ── Active categories (counted in Dev Overall Pending Issues in reports) ──────
# Fixed and Closed are NOT active — they are resolved
ACTIVE_CATEGORY_KEYS = {
    "yet_to_start",
    "in_progress",
    "completed_dev",
    "pre_prod",
}

# ── Live Move category (fills Total Live Move column in reports) ──────────────
LIVE_MOVE_CATEGORY_KEY = "fixed"

# ── Default category if Excel status is not in STATUS_MAP ────────────────────
DEFAULT_CATEGORY_KEY = "yet_to_start"

# ── Helper: get display name from category key ────────────────────────────────
def get_display_name(category_key: str) -> str:
    return STATUS_CATEGORIES.get(category_key, category_key)

# ── Helper: normalize a raw Excel status string → display name ────────────────
def normalize_status(raw_status: str) -> str:
    key = STATUS_MAP.get(str(raw_status).strip().lower(), DEFAULT_CATEGORY_KEY)
    return get_display_name(key)

# ── Helper: get category key from raw status ──────────────────────────────────
def get_category_key(raw_status: str) -> str:
    return STATUS_MAP.get(str(raw_status).strip().lower(), DEFAULT_CATEGORY_KEY)

# ── Helper: check if a category key is active ────────────────────────────────
def is_active(category_key: str) -> bool:
    return category_key in ACTIVE_CATEGORY_KEYS

# ── Helper: check if a category key is live move ─────────────────────────────
def is_live_move(category_key: str) -> bool:
    return category_key == LIVE_MOVE_CATEGORY_KEY
