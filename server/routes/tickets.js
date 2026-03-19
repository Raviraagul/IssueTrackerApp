const express = require('express');
const router = express.Router();
const pool = require('../db');
const { verifyToken, adminOnly } = require('./auth');

// ── GET /api/tickets ──────────────────────────────────────────────────────────
// Supports filters: team, product, status, priority, search, page, limit
router.get('/', verifyToken, async (req, res) => {
    try {
        const {
            team, product, status, priority,
            search, page = 1, limit = 50
        } = req.query;

        let conditions = [];
        let params = [];
        let i = 1;

        if (team) { conditions.push(`team = $${i++}`); params.push(team); }
        if (product) { conditions.push(`product_name = $${i++}`); params.push(product); }
        if (status) { conditions.push(`status_norm = $${i++}`); params.push(status); }
        if (priority) { conditions.push(`priority = $${i++}`); params.push(priority); }
        if (search) {
            conditions.push(`(
                ticket_no ILIKE $${i} OR
                company ILIKE $${i} OR
                module ILIKE $${i} OR
                issue_description ILIKE $${i}
            )`);
            params.push(`%${search}%`);
            i++;
        }
        if (req.query.date_from) {
            if (req.query.date_to) {
                conditions.push(`date BETWEEN $${i} AND $${i + 1}`);
                params.push(req.query.date_from, req.query.date_to);
                i += 2;
            } else {
                conditions.push(`date = $${i++}`);
                params.push(req.query.date_from);
            }
        }
        if (req.query.missing === 'true') {
            conditions.push(`last_seen_date < (
                SELECT MAX(snapshot_date) FROM report_snapshots
            )`);
        }

        const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
        const offset = (page - 1) * limit;

        const dataQuery = `
        SELECT *,
            CASE WHEN last_seen_date < (
                SELECT MAX(snapshot_date) FROM report_snapshots
            ) THEN true ELSE false END as is_missing 
        FROM tickets
        ${where}
        ORDER BY date DESC, ticket_no DESC
        LIMIT $${i} OFFSET $${i + 1}
        `;
        const countQuery = `SELECT COUNT(*) FROM tickets ${where}`;

        const [data, count] = await Promise.all([
            pool.query(dataQuery, [...params, limit, offset]),
            pool.query(countQuery, params),
        ]);

        res.json({
            tickets: data.rows,
            total: parseInt(count.rows[0].count),
            page: parseInt(page),
            totalPages: Math.ceil(count.rows[0].count / limit),
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── GET /api/tickets/summary ──────────────────────────────────────────────────
// Returns KPI counts grouped by team and product
router.get('/summary', verifyToken, async (req, res) => {
    try {
        const [kpi, byTeam, byProduct, byPriority] = await Promise.all([
            pool.query(`
                SELECT
                COUNT(*)                                            AS total,
                SUM(CASE WHEN status_norm = 'Yet to Start (Dev)'  THEN 1 ELSE 0 END) AS yet_to_start,
                SUM(CASE WHEN status_norm = 'In-Progress (Dev)'   THEN 1 ELSE 0 END) AS in_progress,
                SUM(CASE WHEN status_norm = 'Completed (Dev)'     THEN 1 ELSE 0 END) AS completed_dev,
                SUM(CASE WHEN status_norm = 'Pre Production'      THEN 1 ELSE 0 END) AS pre_production,
                SUM(CASE WHEN status_norm = 'Closed'              THEN 1 ELSE 0 END) AS closed
                FROM tickets
            `),
            pool.query(`
                SELECT team, status_norm, COUNT(*) AS count
                FROM tickets
                GROUP BY team, status_norm
                ORDER BY team, status_norm
            `),
            pool.query(`
                SELECT product_name, status_norm, COUNT(*) AS count
                FROM tickets
                GROUP BY product_name, status_norm
                ORDER BY product_name, status_norm
            `),
            pool.query(`
                SELECT priority, COUNT(*) AS count
                FROM tickets
                WHERE priority IS NOT NULL AND priority != ''
                GROUP BY priority
                ORDER BY count DESC
            `),
        ]);

        res.json({
            kpi: kpi.rows[0],
            byTeam: byTeam.rows,
            byProduct: byProduct.rows,
            byPriority: byPriority.rows,
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── GET /api/tickets/archive ──────────────────────────────────────────────────
router.get('/archive', verifyToken, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM archive ORDER BY archived_at DESC'
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── GET /api/tickets/changes ──────────────────────────────────────────────────
router.get('/changes', verifyToken, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM change_history ORDER BY changed_at DESC LIMIT 200'
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── GET /api/tickets/:id ──────────────────────────────────────────────────────
// GET single ticket
router.get('/:id', verifyToken, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT *,
            CASE WHEN last_seen_date < (
                SELECT MAX(snapshot_date) FROM report_snapshots
            ) THEN true ELSE false END as is_missing
            FROM tickets WHERE id = $1`,
            [req.params.id]
        );
        if (!result.rows.length)
            return res.status(404).json({ error: 'Ticket not found.' });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT update ticket (admin only)
router.put('/:id', verifyToken, adminOnly, async (req, res) => {
    const { assigned_to, fixed_date, comments } = req.body;
    try {
        const result = await pool.query(`
        UPDATE tickets
        SET assigned_to  = $1,
            fixed_date   = $2,
            comments     = $3,
            last_updated = NOW()
        WHERE id = $4
        RETURNING *
        `, [assigned_to || null, fixed_date || null, comments || null, req.params.id]);
        if (!result.rows.length)
            return res.status(404).json({ error: 'Ticket not found.' });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;