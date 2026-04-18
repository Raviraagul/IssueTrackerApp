const express = require('express');
const router = express.Router();
const pool = require('../db');
const { verifyToken, adminOnly, editorOrAdmin, canEditTicket, getTeamFilter } = require('./auth');

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

        // ── Team filter from user role ────────────────────────────────────────
        // If user is scoped to a team (API/Web/App), restrict to that team only
        const teamScope = getTeamFilter(req.user);
        if (teamScope) {
            conditions.push(`team = $${i++}`);
            params.push(teamScope);
        } else if (team) {
            // Admin/Support/no-team users can filter by team manually
            conditions.push(`team = $${i++}`);
            params.push(team);
        }

        if (product) { conditions.push(`product_name = $${i++}`); params.push(product); }
        if (status) { conditions.push(`status_norm = $${i++}`); params.push(status); }
        if (priority) { conditions.push(`priority = $${i++}`); params.push(priority); }
        if (search) {
            conditions.push(`(
                ticket_no ILIKE $${i} OR
                company ILIKE $${i} OR
                module ILIKE $${i} OR
                issue_description ILIKE $${i} OR
                assigned_to ILIKE $${i}
            )`);
            params.push(`%${search}%`);
            i++;
        }

        // ── Created date filter ───────────────────────────────────────────────
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

        // ── Fixed date filter ─────────────────────────────────────────────────
        // Used by the Live Moved Tickets page to filter by when ticket was fixed
        if (req.query.fixed_date_from) {
            if (req.query.fixed_date_to) {
                conditions.push(`fixed_date BETWEEN $${i} AND $${i + 1}`);
                params.push(req.query.fixed_date_from, req.query.fixed_date_to);
                i += 2;
            } else {
                conditions.push(`fixed_date = $${i++}`);
                params.push(req.query.fixed_date_from);
            }
        }

        if (req.query.missing === 'true') {
            conditions.push(`last_seen_date::date < (
                SELECT MAX(snapshot_date::date) FROM report_snapshots
            )`);
        }

        const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

        // ── Export mode — bypass pagination ───────────────────────────────────
        // Pass export=true or limit=all to fetch all records for PDF export
        // Export orders by product_name then fixed_date for PDF grouping
        const isExport = req.query.export === 'true' || req.query.limit === 'all';

        if (isExport) {
            const data = await pool.query(
                `SELECT *,
                    CASE WHEN last_seen_date < (
                        SELECT MAX(snapshot_date) FROM report_snapshots
                    ) THEN true ELSE false END as is_missing
                FROM tickets ${where}
                ORDER BY product_name ASC, fixed_date ASC, ticket_no ASC`,
                params
            );
            return res.json({
                tickets: data.rows,
                total: data.rows.length,
                page: 1,
                totalPages: 1,
            });
        }

        const offset = (page - 1) * limit;

        const dataQuery = `
        SELECT *,
            CASE WHEN last_seen_date < (
                SELECT MAX(snapshot_date) FROM report_snapshots
            ) THEN true ELSE false END as is_missing 
        FROM tickets ${where}
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
        // Apply team scope for summary too
        const teamScope = getTeamFilter(req.user);
        const teamWhere = teamScope ? `WHERE team = '${teamScope}'` : '';

        const [kpi, byTeam, byProduct, byPriority] = await Promise.all([
            pool.query(`
                SELECT
                COUNT(*)                                            AS total,
                SUM(CASE WHEN status_norm = 'Yet to Start (Dev)'  THEN 1 ELSE 0 END) AS yet_to_start,
                SUM(CASE WHEN status_norm = 'In-Progress (Dev)'   THEN 1 ELSE 0 END) AS in_progress,
                SUM(CASE WHEN status_norm = 'Completed (Dev)'     THEN 1 ELSE 0 END) AS completed_dev,
                SUM(CASE WHEN status_norm = 'Pre Production'      THEN 1 ELSE 0 END) AS pre_production,
                SUM(CASE WHEN status_norm = 'Closed'              THEN 1 ELSE 0 END) AS closed
                FROM tickets ${teamWhere}
            `),
            pool.query(`
                SELECT team, status_norm, COUNT(*) AS count
                FROM tickets ${teamWhere}
                GROUP BY team, status_norm ORDER BY team, status_norm
            `),
            pool.query(`
                SELECT product_name, status_norm, COUNT(*) AS count
                FROM tickets ${teamWhere}
                GROUP BY product_name, status_norm ORDER BY product_name, status_norm
            `),
            pool.query(`
                SELECT priority, COUNT(*) AS count FROM tickets
                ${teamWhere ? teamWhere + ' AND' : 'WHERE'}
                    priority IS NOT NULL AND priority != ''
                GROUP BY priority ORDER BY count DESC
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
        const result = await pool.query('SELECT * FROM archive ORDER BY archived_at DESC');
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

// ── GET /api/tickets/:id/history ─────────────────────────────────────────────
router.get('/:id/history', verifyToken, async (req, res) => {
    try {
        const ticket = await pool.query(
            'SELECT ticket_no, team FROM tickets WHERE id = $1', [req.params.id]
        );
        if (!ticket.rows.length)
            return res.status(404).json({ error: 'Ticket not found.' });

        const teamScope = getTeamFilter(req.user);
        if (teamScope && ticket.rows[0].team !== teamScope)
            return res.status(403).json({ error: 'Access denied.' });

        const result = await pool.query(`
            SELECT * FROM ticket_status_history
            WHERE ticket_no = $1
            ORDER BY changed_date ASC, created_at ASC
        `, [ticket.rows[0].ticket_no]);

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

        const ticket = result.rows[0];

        // Team-scoped users can only view their own team's tickets
        const teamScope = getTeamFilter(req.user);
        if (teamScope && ticket.team !== teamScope) {
            return res.status(403).json({ error: 'Access denied.' });
        }

        res.json(ticket);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── PUT /api/tickets/:id ──────────────────────────────────────────────────────
// Admin → full access
// Editor (no team / Support) → can edit all tickets
// Editor (API/Web/App) → can only edit their team's tickets
// Viewer → cannot edit
router.put('/:id', verifyToken, editorOrAdmin, async (req, res) => {
    const {
        status_norm, assigned_to, fixed_date, comments, priority,
        root_cause, root_cause_category, fix_description, team,
    } = req.body;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Fetch existing ticket
        const existing = await client.query(
            'SELECT * FROM tickets WHERE id = $1', [req.params.id]
        );
        if (!existing.rows.length) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Ticket not found.' });
        }

        const ticket = existing.rows[0];

        // Check if user can edit this ticket
        if (!canEditTicket(req.user, ticket.team)) {
            await client.query('ROLLBACK');
            return res.status(403).json({
                error: `You can only edit ${req.user.team} team tickets.`
            });
        }

        // ── Status change detection ───────────────────────────────────────────
        const newStatus = status_norm || ticket.status_norm;
        const statusChanged = newStatus !== ticket.status_norm;
        const today = new Date().toLocaleDateString('en-CA');

        if (statusChanged) {
            // Write to ticket_status_history
            await client.query(`
                INSERT INTO ticket_status_history
                    (ticket_no, old_status, new_status, changed_date, method, changed_by)
                VALUES ($1, $2, $3, $4, 'manual', $5)
            `, [ticket.ticket_no, ticket.status_norm, newStatus, today, req.user.name]);

            // Recompute snapshot for today
            await computeSnapshot(client, today);
        }

        // ── Update ticket ─────────────────────────────────────────────────────
        const result = await client.query(`
            UPDATE tickets SET
                status_norm          = $1,
                status_changed_date  = $2,
                assigned_to          = $3,
                fixed_date           = $4,
                comments             = $5,
                priority             = $6,
                root_cause           = $7,
                root_cause_category  = $8,
                fix_description      = $9,
                team                 = $10,
                last_updated         = NOW()
            WHERE id = $11
        RETURNING *
        `, [
            newStatus,
            statusChanged ? today : ticket.status_changed_date,
            assigned_to || null,
            fixed_date || null,
            comments || null,
            priority || ticket.priority,
            root_cause || null,
            root_cause_category || null,
            fix_description || null,
            team || ticket.team,
            req.params.id,
        ]);

        if (!result.rows.length) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Ticket not found.' });
        }

        await client.query('COMMIT');
        res.json(result.rows[0]);

    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// ── computeSnapshot ───────────────────────────────────────────────────────────
async function computeSnapshot(client, date) {
    const statusResult = await client.query(`
        SELECT t.ticket_no, t.product_name, t.team,
            COALESCE(h.new_status, t.status_norm) AS current_status
        FROM tickets t
        LEFT JOIN LATERAL (
            SELECT new_status FROM ticket_status_history
            WHERE ticket_no = t.ticket_no AND changed_date <= $1
            ORDER BY changed_date DESC, created_at DESC LIMIT 1
        ) h ON true
        WHERE t.status_norm IS NOT NULL
    `, [date]);

    const combosResult = await client.query(
        `SELECT DISTINCT product_name, team FROM tickets`
    );

    const grid = {};
    combosResult.rows.forEach(c => {
        const key = `${c.product_name}_${c.team}`;
        grid[key] = {
            product_name: c.product_name, team: c.team,
            yet_to_start: 0, in_progress: 0, completed_dev: 0,
            pre_production: 0, live_move: 0, closed: 0, total_active: 0,
        };
    });

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

    const newResult = await client.query(`
        SELECT product_name, team, COUNT(*) as cnt
        FROM tickets WHERE date = $1 GROUP BY product_name, team
    `, [date]);

    const newMap = {};
    newResult.rows.forEach(r => {
        newMap[`${r.product_name}_${r.team}`] = parseInt(r.cnt);
    });

    for (const g of Object.values(grid)) {
        const key = `${g.product_name}_${g.team}`;
        await client.query(`
            INSERT INTO report_snapshots (
                snapshot_date, product_name, team,
                yet_to_start, in_progress, completed_dev,
                pre_production, live_move, closed, new_tickets, total_active
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
            ON CONFLICT (snapshot_date, product_name, team) DO UPDATE SET
                yet_to_start = $4, in_progress = $5, completed_dev = $6,
                pre_production = $7, live_move = $8, closed = $9,
                new_tickets = $10, total_active = $11
        `, [
            date, g.product_name, g.team,
            g.yet_to_start, g.in_progress, g.completed_dev,
            g.pre_production, g.live_move, g.closed,
            newMap[key] || 0, g.total_active,
        ]);
    }
}

module.exports = router;

/*
 * ── CONNECTION POOL TRANSACTION PATTERN ─────────────────────────────────────
 * Used whenever multiple queries must succeed or fail together (atomically).
 *
 * const client = await pool.connect();  // grab one dedicated connection
 * try {
 *     await client.query('BEGIN');       // start transaction
 *     await client.query('UPDATE ...');  // query 1 — same connection
 *     await client.query('INSERT ...');  // query 2 — same connection
 *     await client.query('COMMIT');      // all succeeded → save changes
 * } catch (err) {
 *     await client.query('ROLLBACK');    // something failed → undo all
 * } finally {
 *     client.release();                  // always return connection to pool
 * }
 *
 * Why not pool.query() directly?
 * pool.query() picks any free connection each time — different queries may
 * land on different connections, breaking the transaction guarantee.
 * ────────────────────────────────────────────────────────────────────────────
 */