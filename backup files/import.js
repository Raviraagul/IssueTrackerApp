const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const pool = require('../db');
const { verifyToken, adminOnly } = require('./auth');

// ── File upload config ────────────────────────────────────────────────────────
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../../python/uploads');
        fs.mkdirSync(uploadDir, { recursive: true });
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, `import_${Date.now()}_${file.originalname}`);
    },
});

const upload = multer({
    storage,
    fileFilter: (req, file, cb) => {
        if (file.mimetype.includes('spreadsheet') ||
            file.originalname.match(/\.(xlsx|xls)$/)) {
            cb(null, true);
        } else {
            cb(new Error('Only Excel files (.xlsx, .xls) are allowed'));
        }
    },
    limits: { fileSize: 20 * 1024 * 1024 }, // 20MB max
});

// ── POST /api/import/upload ───────────────────────────────────────────────────
router.post('/upload', verifyToken, adminOnly, upload.single('file'), async (req, res) => {
    if (!req.file)
        return res.status(400).json({ error: 'No file uploaded.' });

    const { snapshot_date, snapshot_time = 'AM' } = req.body;
    if (!snapshot_date)
        return res.status(400).json({ error: 'snapshot_date is required.' });

    const filePath = req.file.path;
    const pythonDir = path.join(__dirname, '../../python');

    // Call Python script to parse + process the Excel
    const python = spawn('python', [
        path.join(pythonDir, 'import_excel.py'),
        '--file', filePath,
        '--date', snapshot_date,
        '--time', snapshot_time,
    ]);

    let output = '';
    let errors = '';

    python.stdout.on('data', (data) => { output += data.toString(); });
    python.stderr.on('data', (data) => { errors += data.toString(); });

    python.on('close', async (code) => {
        // Clean up uploaded file
        try { fs.unlinkSync(filePath); } catch { }

        if (code !== 0) {
            console.error('Python error:', errors);
            return res.status(500).json({
                error: 'Failed to process Excel file.',
                details: errors.split('\n').filter(Boolean).slice(-3).join(' | '),
            });
        }

        try {
            const result = JSON.parse(output);

            // Save to DB using the parsed result
            await saveImportToDB(result, req.user.id, snapshot_date, snapshot_time, req.file.originalname);

            res.json({
                success: true,
                message: 'Import completed successfully',
                stats: result.stats,
            });
        } catch (err) {
            console.error('Save error:', err.message);
            res.status(500).json({ error: 'Failed to save import data.', details: err.message });
        }
    });
});

// ── Save parsed data into PostgreSQL ─────────────────────────────────────────
async function saveImportToDB(result, userId, snapshotDate, snapshotTime, filename) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Upsert tickets (insert new, update existing)
        for (const t of result.tickets || []) {
            await client.query(`
        INSERT INTO tickets (
          ticket_no, date, company, product_name, platform, team,
          module, sub_module, issue_description, priority,
          status_raw, status_norm, assigned_to, comments,
          fixed_status, fixed_date, sync_status, last_updated
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
          $11,$12,$13,$14,$15,$16,$17,NOW()
        )
        ON CONFLICT (ticket_no) DO UPDATE SET
          status_raw    = EXCLUDED.status_raw,
          status_norm   = EXCLUDED.status_norm,
          assigned_to   = EXCLUDED.assigned_to,
          comments      = EXCLUDED.comments,
          fixed_status  = EXCLUDED.fixed_status,
          fixed_date    = EXCLUDED.fixed_date,
          last_updated  = NOW(),
          sync_status   = 'Updated'
      `, [
                t.ticket_no, t.date, t.company, t.product_name, t.platform, t.team,
                t.module, t.sub_module, t.issue_description, t.priority,
                t.status_raw, t.status_norm, t.assigned_to, t.comments,
                t.fixed_status, t.fixed_date || null, t.sync_status || 'New',
            ]);
        }

        // 2. Archive missing tickets
        for (const t of result.archived || []) {
            // Remove from tickets
            await client.query('DELETE FROM tickets WHERE ticket_no = $1', [t.ticket_no]);
            // Add to archive
            await client.query(`
        INSERT INTO archive (
          ticket_no, date, company, product_name, platform, team,
          module, issue_description, priority, status_raw, status_norm,
          archived_at, archive_reason
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW(),$12)
        ON CONFLICT DO NOTHING
      `, [
                t.ticket_no, t.date, t.company, t.product_name, t.platform, t.team,
                t.module, t.issue_description, t.priority, t.status_raw, t.status_norm,
                'Removed from SharePoint Excel',
            ]);
        }

        // 3. Log field changes
        for (const c of result.changes || []) {
            await client.query(`
        INSERT INTO change_history
          (ticket_no, team, product, field_name, old_value, new_value, changed_at, change_type)
        VALUES ($1,$2,$3,$4,$5,$6,NOW(),$7)
      `, [c.ticket_no, c.team, c.product, c.field_name,
            c.old_value, c.new_value, c.change_type]);
        }

        // 4. Save report snapshot
        for (const snap of result.snapshots || []) {
            await client.query(`
        INSERT INTO report_snapshots (
          snapshot_date, snapshot_time, product_name, team,
          pre_production, yet_to_start, in_progress,
          completed_dev, total_active
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      `, [
                snapshotDate, snapshotTime, snap.product_name, snap.team,
                snap.pre_production, snap.yet_to_start, snap.in_progress,
                snap.completed_dev, snap.total_active,
            ]);
        }

        // 5. Log the import
        await client.query(`
      INSERT INTO import_log
        (filename, snapshot_date, snapshot_time, imported_by,
         new_tickets, updated_tickets, archived_tickets, field_changes)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
    `, [
            filename, snapshotDate, snapshotTime, userId,
            result.stats.new, result.stats.updated,
            result.stats.archived, result.stats.field_changes,
        ]);

        await client.query('COMMIT');
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}

// ── GET /api/import/logs ──────────────────────────────────────────────────────
router.get('/logs', verifyToken, async (req, res) => {
    try {
        const result = await pool.query(`
      SELECT il.*, u.name AS imported_by_name
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

module.exports = router;