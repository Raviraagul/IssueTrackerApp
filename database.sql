-- Users table (login + roles)
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'viewer' CHECK (role IN ('admin', 'viewer')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Tickets table (master data)
CREATE TABLE tickets (
    id SERIAL PRIMARY KEY,
    ticket_no VARCHAR(50) UNIQUE NOT NULL,
    date DATE,
    company VARCHAR(200),
    product_name VARCHAR(100),
    platform VARCHAR(20),
    team VARCHAR(10) CHECK (team IN ('API', 'Web', 'App')),
    module VARCHAR(150),
    sub_module VARCHAR(150),
    issue_description TEXT,
    priority VARCHAR(20),
    status_raw VARCHAR(100),
    status_norm VARCHAR(50),
    assigned_to VARCHAR(100),
    comments TEXT,
    fixed_status VARCHAR(100),
    fixed_date DATE,
    first_seen TIMESTAMP DEFAULT NOW(),
    last_updated TIMESTAMP DEFAULT NOW(),
    sync_status VARCHAR(20) DEFAULT 'New'
);

-- Archive table (tickets removed from SharePoint)
CREATE TABLE archive (
    id SERIAL PRIMARY KEY,
    ticket_no VARCHAR(50) NOT NULL,
    date DATE,
    company VARCHAR(200),
    product_name VARCHAR(100),
    platform VARCHAR(20),
    team VARCHAR(10),
    module VARCHAR(150),
    issue_description TEXT,
    priority VARCHAR(20),
    status_raw VARCHAR(100),
    status_norm VARCHAR(50),
    archived_at TIMESTAMP DEFAULT NOW(),
    archive_reason VARCHAR(200)
);

-- Change history (unexpected field changes)
CREATE TABLE change_history (
    id SERIAL PRIMARY KEY,
    ticket_no VARCHAR(50) NOT NULL,
    team VARCHAR(10),
    product VARCHAR(100),
    field_name VARCHAR(100),
    old_value TEXT,
    new_value TEXT,
    changed_at TIMESTAMP DEFAULT NOW(),
    change_type VARCHAR(50)
);

-- Import log (every Excel import)
CREATE TABLE import_log (
    id SERIAL PRIMARY KEY,
    filename VARCHAR(255),
    snapshot_date DATE,
    snapshot_time VARCHAR(5),
    imported_by INTEGER REFERENCES users(id),
    new_tickets INTEGER DEFAULT 0,
    updated_tickets INTEGER DEFAULT 0,
    archived_tickets INTEGER DEFAULT 0,
    field_changes INTEGER DEFAULT 0,
    imported_at TIMESTAMP DEFAULT NOW()
);

-- Report snapshots (team wise + overall history)
CREATE TABLE report_snapshots (
    id SERIAL PRIMARY KEY,
    snapshot_date DATE NOT NULL,
    snapshot_time VARCHAR(5),
    product_name VARCHAR(100),
    team VARCHAR(10),
    pre_production INTEGER DEFAULT 0,
    yet_to_start INTEGER DEFAULT 0,
    in_progress INTEGER DEFAULT 0,
    completed_dev INTEGER DEFAULT 0,
    total_active INTEGER DEFAULT 0,
    total_live_move INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Default admin user (password: Admin@123)
INSERT INTO users (name, email, password_hash, role)
VALUES (
    'Admin',
    'admin@issuetracker.com',
    '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
    'admin'
);