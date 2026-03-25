const express = require('express');
const router = express.Router();
const pool = require('../db');
const { verifyToken, getTeamFilter } = require('./auth');

// ── GET /api/reports/team-wise ────────────────────────────────────────────────
// Daily report grouped by team + application
router.get('/team-wise', verifyToken, async (req, res) => {
    try {
        const { date_from, date_to } = req.query;

        let dateFilter = '';
        let params = [];
        if (date_from && date_to) {
            dateFilter = 'WHERE snapshot_date BETWEEN $1 AND $2';
            params = [date_from, date_to];
        } else if (date_from) {
            dateFilter = 'WHERE snapshot_date = $1';
            params = [date_from];
        }

        const result = await pool.query(`
      SELECT snapshot_date, product_name, team,
        pre_production, yet_to_start, in_progress, completed_dev,
        total_active,
        (pre_production + yet_to_start + in_progress + completed_dev) AS total_issue
      FROM report_snapshots
      ${dateFilter}
      ORDER BY snapshot_date DESC, product_name, team
    `, params);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── GET /api/reports/overall ──────────────────────────────────────────────────
// Daily report grouped by application only
router.get('/overall', verifyToken, async (req, res) => {
    try {
        const { date_from, date_to } = req.query;
        let dateFilter = '';
        let params = [];
        if (date_from && date_to) {
            dateFilter = 'WHERE snapshot_date BETWEEN $1 AND $2';
            params = [date_from, date_to];
        } else if (date_from) {
            dateFilter = 'WHERE snapshot_date = $1';
            params = [date_from];
        }
        const result = await pool.query(`
      SELECT snapshot_date, product_name,
        SUM(pre_production)  AS pre_production,
        SUM(yet_to_start)    AS yet_to_start,
        SUM(in_progress)     AS in_progress,
        SUM(completed_dev)   AS completed_dev,
        SUM(total_active)    AS total_active,
        SUM(pre_production + yet_to_start + in_progress + completed_dev) AS total_issue
      FROM report_snapshots
      ${dateFilter}
      GROUP BY snapshot_date, product_name
      ORDER BY snapshot_date DESC, product_name
    `, params);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── GET /api/reports/summary ──────────────────────────────────────────────────
// Summary report with date range filter
router.get('/summary', verifyToken, async (req, res) => {
    try {
        const { date_from, date_to } = req.query;
        if (!date_from || !date_to)
            return res.status(400).json({ error: 'date_from and date_to are required.' });

        const result = await pool.query(`
            SELECT product_name, team,
                COUNT(DISTINCT snapshot_date)          AS total_snapshots,
                ROUND(AVG(yet_to_start),  1)           AS avg_yet_to_start,
                ROUND(AVG(in_progress),   1)           AS avg_in_progress,
                ROUND(AVG(completed_dev), 1)           AS avg_completed_dev,
                ROUND(AVG(pre_production),1)           AS avg_pre_production,
                ROUND(AVG(total_active),  1)           AS avg_total_active,
                MAX(total_active)                      AS max_active,
                MIN(total_active)                      AS min_active
            FROM report_snapshots
            WHERE snapshot_date BETWEEN $1 AND $2
            GROUP BY product_name, team
            ORDER BY product_name, team
        `, [date_from, date_to]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── GET /api/reports/trend ────────────────────────────────────────────────────
// range: 1W | 1M | 3M | 6M | 1Y
// 1W → daily (last 7 days)
// 1M → daily (last 30 days)
// 3M → weekly (last 3 months)
// 6M → monthly (last 6 months)
// 1Y → monthly (last 12 months)
router.get('/trend', verifyToken, async (req, res) => {
    try {
        const { product, team, range = '3M' } = req.query;

        // Apply team scope from JWT
        const teamScope = getTeamFilter(req.user);

        // ── Range → days + granularity ────────────────────────────────────────
        const rangeMap = {
            '1W': { days: 7, granularity: 'daily' },
            '1M': { days: 30, granularity: 'daily' },
            '3M': { days: 90, granularity: 'weekly' },
            '6M': { days: 180, granularity: 'monthly' },
            '1Y': { days: 365, granularity: 'monthly' },
        };
        const { days, granularity } = rangeMap[range] || rangeMap['3M'];

        // ── Period label based on granularity ─────────────────────────────────
        const periodExpr = granularity === 'daily'
            ? `TO_CHAR(rs.snapshot_date, 'DD Mon')`
            : granularity === 'weekly'
                ? `'W' || TO_CHAR(rs.snapshot_date, 'IW') || ' ' || TO_CHAR(rs.snapshot_date, 'YYYY')`
                : `TO_CHAR(rs.snapshot_date, 'Mon YYYY')`;

        const sortExpr = `MIN(rs.snapshot_date)`;

        // ── WHERE conditions ──────────────────────────────────────────────────
        const conditions = [`rs.snapshot_date >= CURRENT_DATE - INTERVAL '${days} days'`];
        const params = [];
        let i = 1;

        if (teamScope) {
            conditions.push(`rs.team = $${i++}`);
            params.push(teamScope);
        } else if (team) {
            conditions.push(`rs.team = $${i++}`);
            params.push(team);
        }
        if (product) {
            conditions.push(`rs.product_name = $${i++}`);
            params.push(product);
        }

        const where = 'WHERE ' + conditions.join(' AND ');

        // ── New tickets subquery filters ───────────────────────────────────────
        const ntTeamFilter = teamScope ? `AND t.team = '${teamScope}'`
            : team ? `AND t.team = '${team}'` : '';
        const ntProductFilter = product ? `AND t.product_name = '${product}'` : '';

        const result = await pool.query(`
            SELECT
                ${periodExpr}                           AS period,
                ${sortExpr}                             AS sort_key,
                rs.product_name,
                ROUND(AVG(rs.yet_to_start), 0)          AS yet_to_start,
                ROUND(AVG(rs.total_active), 0)          AS total_active,
                COUNT(DISTINCT h_fixed.id)              AS live_move,
                COUNT(DISTINCT h_closed.id)             AS closed,
                COALESCE(MAX(nt.new_tickets), 0)        AS new_tickets
            FROM report_snapshots rs
            LEFT JOIN ticket_status_history h_fixed
                ON h_fixed.changed_date = rs.snapshot_date
                AND h_fixed.new_status = 'Fixed'
                AND EXISTS (
                    SELECT 1 FROM tickets t
                    WHERE t.ticket_no = h_fixed.ticket_no
                    AND t.product_name = rs.product_name
                )
            LEFT JOIN ticket_status_history h_closed
                ON h_closed.changed_date = rs.snapshot_date
                AND h_closed.new_status = 'Closed'
                AND EXISTS (
                    SELECT 1 FROM tickets t
                    WHERE t.ticket_no = h_closed.ticket_no
                    AND t.product_name = rs.product_name
                )
            LEFT JOIN (
                SELECT
                    t.date          AS ticket_date,
                    t.product_name,
                    COUNT(*)        AS new_tickets
                FROM tickets t
                WHERE t.date >= CURRENT_DATE - INTERVAL '${days} days'
                ${ntTeamFilter}
                ${ntProductFilter}
                GROUP BY t.date, t.product_name
            ) nt ON nt.ticket_date = rs.snapshot_date
                AND nt.product_name = rs.product_name
            ${where}
            GROUP BY ${periodExpr}, rs.product_name
            ORDER BY sort_key, rs.product_name
        `, params);

        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── GET /api/reports/daily-movement ──────────────────────────────────────────
router.get('/daily-movement', verifyToken, async (req, res) => {
    const { date_from, date_to } = req.query;
    if (!date_from) return res.status(400).json({ error: 'date_from is required.' });
    const dateTo = date_to || date_from;

    try {
        // Get all product+team combos
        const combosResult = await pool.query(`
            SELECT DISTINCT product_name, team FROM tickets ORDER BY product_name, team
        `);
        const combos = combosResult.rows;
        if (!combos.length) return res.json([]);

        // Generate every calendar day in range
        const datesResult = await pool.query(`
            SELECT generate_series($1::date, $2::date, '1 day'::interval)::date AS report_date
            ORDER BY report_date DESC
        `, [date_from, dateTo]);

        const dates = datesResult.rows.map(r =>
            r.report_date instanceof Date
                ? r.report_date.toLocaleDateString('en-CA')
                : String(r.report_date).split('T')[0]
        );

        // For each date, forward-fill from nearest past snapshot
        // This handles days with no import — uses last known state
        const rows = [];

        for (const date of dates) {

            // Forward fill — get latest snapshot per product+team up to this date
            const snapResult = await pool.query(`
                SELECT DISTINCT ON (product_name, team)
                    snapshot_date, product_name, team,
                    yet_to_start, in_progress, completed_dev,
                    pre_production, total_active
                FROM report_snapshots
                WHERE snapshot_date <= $1
                ORDER BY product_name, team, snapshot_date DESC
            `, [date]);

            // Map snapshots by product+team
            const snapMap = {};
            snapResult.rows.forEach(r => { snapMap[`${r.product_name}_${r.team}`] = r; });

            // Live Move — tickets that moved TO Fixed ON this exact date
            const liveResult = await pool.query(`
                SELECT t.product_name, t.team, COUNT(*) as cnt
                FROM ticket_status_history h
                JOIN tickets t ON t.ticket_no = h.ticket_no
                WHERE h.new_status = 'Fixed' AND h.changed_date = $1
                GROUP BY t.product_name, t.team
            `, [date]);
            const liveMap = {};
            liveResult.rows.forEach(r => { liveMap[`${r.product_name}_${r.team}`] = parseInt(r.cnt); });

            // Closed — tickets that moved TO Closed ON this exact date
            const closedResult = await pool.query(`
                SELECT t.product_name, t.team, COUNT(*) as cnt
                FROM ticket_status_history h
                JOIN tickets t ON t.ticket_no = h.ticket_no
                WHERE h.new_status = 'Closed' AND h.changed_date = $1
                GROUP BY t.product_name, t.team
            `, [date]);
            const closedMap = {};
            closedResult.rows.forEach(r => { closedMap[`${r.product_name}_${r.team}`] = parseInt(r.cnt); });

            // New tickets raised ON this exact date
            const newResult = await pool.query(`
                SELECT product_name, team, COUNT(*) as cnt
                FROM tickets WHERE date = $1
                GROUP BY product_name, team
            `, [date]);

            const newMap = {};
            newResult.rows.forEach(r => { newMap[`${r.product_name}_${r.team}`] = parseInt(r.cnt); });

            // Build rows for this date using all combos
            combos.forEach(c => {
                const key = `${c.product_name}_${c.team}`;
                const snap = snapMap[key];

                const yet_to_start = parseInt(snap?.yet_to_start) || 0;
                const in_progress = parseInt(snap?.in_progress) || 0;
                const completed_dev = parseInt(snap?.completed_dev) || 0;
                const pre_production = parseInt(snap?.pre_production) || 0;
                const live_move = liveMap[key] || 0;
                const closed = closedMap[key] || 0;
                const new_tickets = newMap[key] || 0;
                const dev_pending = yet_to_start + in_progress + completed_dev;
                const total_issue = pre_production + dev_pending;

                rows.push({
                    snapshot_date: date, product_name: c.product_name, team: c.team,
                    live_move, closed, pre_production, new_tickets,
                    dev_pending, in_progress, yet_to_start, completed_dev, total_issue,
                });
            });
        }

        // Product totals
        const productTotals = {};
        rows.forEach(r => {
            const key = `${r.snapshot_date}_${r.product_name}`;
            if (!productTotals[key]) productTotals[key] = 0;
            productTotals[key] += r.total_issue;
        });

        const finalRows = rows.map(r => ({
            ...r,
            product_total: productTotals[`${r.snapshot_date}_${r.product_name}`] || 0,
        }));

        res.json(finalRows);

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
