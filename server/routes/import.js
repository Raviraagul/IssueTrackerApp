const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const pool = require('../db');
const { verifyToken, adminOnly } = require('./auth');

// ── Multer setup ──────────────────────────────────────────────────────────────
const uploadDir = path.join(__dirname, '../../python/uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const ts = Date.now();
        const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
        cb(null, `${ts}_${safe}`);
    },
});
const upload = multer({ storage });

// ── POST /api/import/upload ───────────────────────────────────────────────────
router.post('/upload', verifyToken, adminOnly,
    upload.single('file'), async (req, res) => {

        // const { snapshot_date, snapshot_time = 'AM' } = req.body;
        const { snapshot_date } = req.body;
        const filePath = req.file?.path;

        if (!filePath)
            return res.status(400).json({ error: 'No file uploaded.' });
        if (!snapshot_date)
            return res.status(400).json({ error: 'snapshot_date is required.' });

        try {
            // ── Fetch existing tickets from DB to pass to Python ─────────────────
            const existingRows = await pool.query(`
      SELECT ticket_no, status_norm, status_raw,
             status_changed_date, assigned_to,
             fixed_status, comments, fixed_date
      FROM tickets
    `);

            const existingMap = {};
            existingRows.rows.forEach(r => {
                existingMap[r.ticket_no] = {
                    status_norm: r.status_norm,
                    status_raw: r.status_raw,
                    status_changed_date: r.status_changed_date
                        ? r.status_changed_date.toISOString().split('T')[0]
                        : null,
                    assigned_to: r.assigned_to,
                    fixed_status: r.fixed_status,
                    comments: r.comments,
                    fixed_date: r.fixed_date
                        ? r.fixed_date.toISOString().split('T')[0]
                        : null,
                };
            });

            // ── Spawn Python ──────────────────────────────────────────────────────
            const pythonScript = path.join(__dirname, '../../python/import_excel.py');
            const result = await new Promise((resolve, reject) => {
                /* const py = spawn('python', [
                    pythonScript,
                    '--file', filePath,
                    '--date', snapshot_date,
                    // '--time', snapshot_time,
                    '--existing', JSON.stringify(existingMap),
                ]); */

                // Write existingMap to a temp file instead of passing as CLI arg
                const tmpFile = path.join(__dirname, '../../python/existing_tmp.json');
                fs.writeFileSync(tmpFile, JSON.stringify(existingMap));

                const py = spawn('python', [
                    pythonScript,
                    '--file', filePath,
                    '--date', snapshot_date,
                    '--existing-file', tmpFile,
                ]);

                let stdout = '';
                let stderr = '';
                py.stdout.on('data', d => stdout += d.toString());
                py.stderr.on('data', d => stderr += d.toString());
                py.on('close', code => {
                    // Clean up temp file after Python finishes
                    try { fs.unlinkSync(tmpFile); } catch (_) { }
                    if (code !== 0) {
                        reject(new Error(stderr || 'Python script failed'));
                    } else {
                        try {
                            resolve(JSON.parse(stdout));
                        } catch {
                            reject(new Error('Failed to parse Python output'));
                        }
                    }
                });
            });

            // const { tickets, archived, changes, snapshots, stats } = result;
            const { tickets, changes, history, missing } = result;
            // console.log('New tickets from Python:', tickets.filter(t => t.sync_status === 'New').map(t => t.ticket_no));
            // ── Save to DB in a transaction ───────────────────────────────────────
            const client = await pool.connect();
            try {
                await client.query('BEGIN');

                let newCount = 0;
                let updatedCount = 0;

                for (const t of tickets) {
                    const existing = existingMap[t.ticket_no];

                    if (!existing) {
                        // New ticket
                        await client.query(`
                        INSERT INTO tickets (
                            ticket_no, date, company, product_name, platform, team,
                            module, sub_module, issue_description, priority,
                            status_raw, status_norm, assigned_to, comments,
                            fixed_status, fixed_date, status_changed_date,
                            last_seen_date, sync_status, first_seen, last_updated
                        ) VALUES (
                            $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
                            $11,$12,$13,$14,$15,$16,$17,$18,$19,NOW(),NOW()
                        )
                        `, [
                            t.ticket_no, t.date, t.company, t.product_name, t.platform,
                            t.team, t.module, t.sub_module, t.issue_description, t.priority,
                            t.status_raw, t.status_norm, t.assigned_to, t.comments,
                            t.fixed_status, t.fixed_date, t.status_changed_date,
                            t.last_seen_date, 'New',
                        ]);
                        newCount++;
                    } else {
                        // Update existing
                        await client.query(`
                        UPDATE tickets SET
                            date=$2, company=$3, product_name=$4, platform=$5,
                            team=$6, module=$7, sub_module=$8, issue_description = COALESCE($9, issue_description),
                            priority=$10, status_raw=$11, status_norm=$12,
                            assigned_to = COALESCE($13, assigned_to), comments = COALESCE(comments, $14),
                            fixed_status=$15, fixed_date = COALESCE(fixed_date, $16), status_changed_date=$17,
                            last_seen_date=$18,
                            sync_status='Updated', last_updated=NOW()
                        WHERE ticket_no=$1
                        `, [
                            t.ticket_no, t.date, t.company, t.product_name, t.platform,
                            t.team, t.module, t.sub_module, t.issue_description, t.priority,
                            t.status_raw, t.status_norm, t.assigned_to, t.comments,
                            t.fixed_status, t.fixed_date, t.status_changed_date,
                            t.last_seen_date,
                        ]);
                        updatedCount++;
                    }
                }

                // Save change history
                for (const c of changes) {
                    await client.query(`
                    INSERT INTO change_history
                        (ticket_no, team, product, field_name, old_value, new_value, change_type)
                    VALUES ($1,$2,$3,$4,$5,$6,$7)
                    `, [
                        c.ticket_no, c.team, c.product,
                        c.field_name, c.old_value, c.new_value, c.change_type,
                    ]);
                }

                // Save status history
                for (const h of history) {
                    await client.query(`
                        INSERT INTO ticket_status_history
                            (ticket_no, old_status, new_status, raw_status,
                            changed_date, method, changed_by)
                        VALUES ($1, $2, $3, $4, $5, $6, $7)
                    `, [
                        h.ticket_no, h.old_status, h.new_status, h.raw_status || null,
                        h.changed_date, h.method, h.changed_by,
                    ]);
                }

                // Recompute snapshot for this import date
                await computeSnapshot(client, snapshot_date);
                await client.query(`
                    INSERT INTO import_log
                    (filename, snapshot_date, imported_by,
                    new_tickets, updated_tickets, missing_tickets)
                    VALUES ($1,$2,$3,$4,$5,$6)
                `, [
                    req.file.originalname, snapshot_date,
                    req.user.id, newCount, updatedCount, missing.length,
                ]);

                await client.query('COMMIT');

                res.json({
                    message: 'Import successful',
                    stats: {
                        new: newCount,
                        updated: updatedCount,
                        missing: missing.length, // archived.length,
                        field_changes: changes.length,
                    },
                });

            } catch (err) {
                await client.query('ROLLBACK');
                throw err;
            } finally {
                client.release();
            }

        } catch (err) {
            res.status(500).json({ error: err.message || 'Failed to process Excel file.' });
        } finally {
            if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
        }
    });

// ── GET /api/import/logs ──────────────────────────────────────────────────────
router.get('/logs', verifyToken, adminOnly, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT il.*, u.name as imported_by_name
            FROM import_log il
            LEFT JOIN users u ON il.imported_by = u.id
            ORDER BY il.imported_at DESC
            LIMIT 50
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

async function computeSnapshot(client, date) {

    // Get latest status of every ticket as of this date
    // Uses DISTINCT ON to get the most recent history row ≤ date per ticket
    // Falls back to ticket's current status_norm if no history row exists yet
    const statusResult = await client.query(`
        SELECT
            t.ticket_no,
            t.product_name,
            t.team,
            COALESCE(h.new_status, t.status_norm) AS current_status
        FROM tickets t
        LEFT JOIN LATERAL (
            SELECT new_status
            FROM ticket_status_history
            WHERE ticket_no = t.ticket_no
              AND changed_date <= $1
            ORDER BY changed_date DESC, created_at DESC
            LIMIT 1
        ) h ON true
        WHERE t.status_norm IS NOT NULL
    `, [date]);

    // Get all known product+team combos
    const combosResult = await client.query(`
        SELECT DISTINCT product_name, team FROM tickets
    `);

    // Initialize grid with zeros for every product+team combo
    const grid = {};
    combosResult.rows.forEach(c => {
        const key = `${c.product_name}_${c.team}`;
        grid[key] = {
            product_name: c.product_name,
            team: c.team,
            yet_to_start: 0,
            in_progress: 0,
            completed_dev: 0,
            pre_production: 0,
            live_move: 0,
            closed: 0,
            total_active: 0,
        };
    });

    // Count tickets per status per product+team
    statusResult.rows.forEach(r => {
        const key = `${r.product_name}_${r.team}`;
        if (!grid[key]) return;
        const g = grid[key];
        const s = r.current_status;
        if (s === 'Yet to Start (Dev)') { g.yet_to_start++; g.total_active++; }
        else if (s === 'In-Progress (Dev)') { g.in_progress++; g.total_active++; }
        else if (s === 'Completed (Dev)') { g.completed_dev++; g.total_active++; }
        else if (s === 'Pre Production') { g.pre_production++; g.total_active++; }
        else if (s === 'Fixed') { g.live_move++; }
        else if (s === 'Closed') { g.closed++; }
    });

    // Count new tickets raised ON this exact date
    const newResult = await client.query(`
        SELECT product_name, team, COUNT(*) as cnt
        FROM tickets
        WHERE date = $1
        GROUP BY product_name, team
    `, [date]);

    const newMap = {};
    newResult.rows.forEach(r => {
        newMap[`${r.product_name}_${r.team}`] = parseInt(r.cnt);
    });

    // Upsert each product+team combo into report_snapshots
    for (const g of Object.values(grid)) {
        const key = `${g.product_name}_${g.team}`;
        await client.query(`
            INSERT INTO report_snapshots (
                snapshot_date, product_name, team,
                yet_to_start, in_progress, completed_dev,
                pre_production, live_move, closed,
                new_tickets, total_active
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
            ON CONFLICT (snapshot_date, product_name, team)
            DO UPDATE SET
                yet_to_start   = $4,
                in_progress    = $5,
                completed_dev  = $6,
                pre_production = $7,
                live_move      = $8,
                closed         = $9,
                new_tickets    = $10,
                total_active   = $11
        `, [
            date,
            g.product_name, g.team,
            g.yet_to_start, g.in_progress, g.completed_dev,
            g.pre_production, g.live_move, g.closed,
            newMap[key] || 0,
            g.total_active,
        ]);
    }
}

module.exports = router;