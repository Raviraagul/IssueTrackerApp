const express = require('express');
const router = express.Router();
const pool = require('../db');
const { verifyToken } = require('./auth');

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
      SELECT
        snapshot_date,
        product_name,
        team,
        pre_production,
        yet_to_start,
        in_progress,
        completed_dev,
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
      SELECT
        snapshot_date,
        product_name,
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
      SELECT
        product_name,
        team,
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
// Monthly trend data for charts
router.get('/trend', verifyToken, async (req, res) => {
    try {
        const result = await pool.query(`
      SELECT
        TO_CHAR(snapshot_date, 'YYYY-MM')      AS month,
        product_name,
        ROUND(AVG(yet_to_start),  1)           AS yet_to_start,
        ROUND(AVG(in_progress),   1)           AS in_progress,
        ROUND(AVG(completed_dev), 1)           AS completed_dev,
        ROUND(AVG(pre_production),1)           AS pre_production,
        ROUND(AVG(total_active),  1)           AS total_active
      FROM report_snapshots
      GROUP BY month, product_name
      ORDER BY month, product_name
    `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── GET /api/reports/daily-movement ──────────────────────────────────────────
router.get('/daily-movement_old', verifyToken, async (req, res) => {
    const { date_from, date_to } = req.query;
    if (!date_from) return res.status(400).json({ error: 'date_from is required.' });
    const dateTo = date_to || date_from;

    try {
        // ── Snapshot data (pre-prod, yet-to-start etc) ────────────────────────
        const snapResult = await pool.query(`
            SELECT
                rs.snapshot_date,
                rs.product_name,
                rs.team,
                rs.yet_to_start,
                rs.in_progress,
                rs.completed_dev,
                rs.pre_production,
                rs.total_active
            FROM report_snapshots rs
            WHERE rs.snapshot_date BETWEEN $1 AND $2
            ORDER BY rs.snapshot_date DESC, rs.product_name, rs.team
        `, [date_from, dateTo]); // , rs.snapshot_time DESC, rs.snapshot_time,

        // ── New tickets per snapshot date/time/product/team ───────────────────
        const newResult = await pool.query(`
            SELECT
                t.date::date as snapshot_date,
                t.product_name,
                t.team,
                COUNT(*) as new_tickets
            FROM tickets t
            WHERE t.date::date BETWEEN $1 AND $2
            GROUP BY t.date::date, t.product_name, t.team
        `, [date_from, dateTo]);

        /* const newMap = {};
        newResult.rows.forEach(r => {
            const key = `${r.snapshot_date}_${r.product_name}_${r.team}`;
            newMap[key] = parseInt(r.new_tickets);
        }); */

        const newMap = {};
        newResult.rows.forEach(r => {
            const dateStr = r.snapshot_date instanceof Date
                ? r.snapshot_date.toLocaleDateString('en-CA')
                : String(r.snapshot_date).split('T')[0];
            const key = `${dateStr}_${r.product_name}_${r.team}`;
            newMap[key] = parseInt(r.new_tickets);
        });

        // ── Live move (active → fixed that day) per product/team ─────────────
        const liveResult = await pool.query(`
            SELECT
                t.status_changed_date as snapshot_date,
                t.product_name,
                t.team,
                COUNT(*) as live_move
            FROM tickets t
            WHERE t.status_norm = 'Fixed'
                AND t.status_changed_date BETWEEN $1 AND $2
            GROUP BY t.status_changed_date, t.product_name, t.team
        `, [date_from, dateTo]);

        const liveMap = {};
        liveResult.rows.forEach(r => {
            const key = `${r.snapshot_date}_${r.product_name}_${r.team}`;
            liveMap[key] = parseInt(r.live_move);
        });

        // ── Closed (active → closed that day) per product/team ───────────────
        const closedResult = await pool.query(`
            SELECT
                t.status_changed_date as snapshot_date,
                t.product_name,
                t.team,
                COUNT(*) as closed_count
            FROM tickets t
            WHERE t.status_norm = 'Closed'
                AND t.status_changed_date BETWEEN $1 AND $2
            GROUP BY t.status_changed_date, t.product_name, t.team
        `, [date_from, dateTo]);

        const closedMap = {};
        closedResult.rows.forEach(r => {
            const key = `${r.snapshot_date}_${r.product_name}_${r.team}`;
            closedMap[key] = parseInt(r.closed_count);
        });

        // ── Combine all data ──────────────────────────────────────────────────
        const rows = snapResult.rows.map(s => {
            /* const dateStr = s.snapshot_date instanceof Date
                ? s.snapshot_date.toISOString().split('T')[0]
                : String(s.snapshot_date); */

            const dateStr = s.snapshot_date instanceof Date
                ? s.snapshot_date.toLocaleDateString('en-CA')
                : String(s.snapshot_date).split('T')[0];

            const key = `${dateStr}_${s.product_name}_${s.team}`;
            const newKey = `${dateStr}_${s.product_name}_${s.team}`;

            const yet_to_start = parseInt(s.yet_to_start) || 0;
            const in_progress = parseInt(s.in_progress) || 0;
            const completed_dev = parseInt(s.completed_dev) || 0;
            const pre_prod = parseInt(s.pre_production) || 0;
            const new_tickets = newMap[newKey] || 0;
            const live_move = liveMap[key] || 0;
            const others = closedMap[key] || 0;

            const dev_pending = yet_to_start + in_progress + completed_dev;
            const total_issue = pre_prod + dev_pending;

            return {
                snapshot_date: dateStr,
                // snapshot_time: s.snapshot_time,
                product_name: s.product_name,
                team: s.team,
                live_move,
                others,
                pre_production: pre_prod,
                new_tickets,
                dev_pending,
                in_progress,
                yet_to_start,
                completed_dev,
                total_issue,
            };
        });

        // ── Compute product totals (sum of teams, excl live/closed) ──────────
        const productTotals = {};
        rows.forEach(r => {
            const key = `${r.snapshot_date}_${r.product_name}`;
            if (!productTotals[key]) productTotals[key] = 0;
            productTotals[key] += r.total_issue;
        });

        const finalRows = rows.map(r => ({
            ...r,
            product_total: productTotals[
                `${r.snapshot_date}_${r.product_name}`
            ] || 0,
        }));

        res.json(finalRows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/daily-movement', verifyToken, async (req, res) => {
    const { date_from, date_to } = req.query;
    if (!date_from) return res.status(400).json({ error: 'date_from is required.' });
    const dateTo = date_to || date_from;

    try {
        // Get all product+team combos
        const combosResult = await pool.query(`
            SELECT DISTINCT product_name, team
            FROM tickets
            ORDER BY product_name, team
        `);
        const combos = combosResult.rows;
        if (!combos.length) return res.json([]);

        // Generate every calendar day in range
        const datesResult = await pool.query(`
            SELECT generate_series(
                $1::date, $2::date, '1 day'::interval
            )::date AS report_date
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
            snapResult.rows.forEach(r => {
                snapMap[`${r.product_name}_${r.team}`] = r;
            });

            // Live Move — tickets that moved TO Fixed ON this exact date
            const liveResult = await pool.query(`
                SELECT t.product_name, t.team, COUNT(*) as cnt
                FROM ticket_status_history h
                JOIN tickets t ON t.ticket_no = h.ticket_no
                WHERE h.new_status = 'Fixed'
                  AND h.changed_date = $1
                GROUP BY t.product_name, t.team
            `, [date]);

            const liveMap = {};
            liveResult.rows.forEach(r => {
                liveMap[`${r.product_name}_${r.team}`] = parseInt(r.cnt);
            });

            // Closed — tickets that moved TO Closed ON this exact date
            const closedResult = await pool.query(`
                SELECT t.product_name, t.team, COUNT(*) as cnt
                FROM ticket_status_history h
                JOIN tickets t ON t.ticket_no = h.ticket_no
                WHERE h.new_status = 'Closed'
                  AND h.changed_date = $1
                GROUP BY t.product_name, t.team
            `, [date]);

            const closedMap = {};
            closedResult.rows.forEach(r => {
                closedMap[`${r.product_name}_${r.team}`] = parseInt(r.cnt);
            });

            // New tickets raised ON this exact date
            const newResult = await pool.query(`
                SELECT product_name, team, COUNT(*) as cnt
                FROM tickets WHERE date = $1
                GROUP BY product_name, team
            `, [date]);

            const newMap = {};
            newResult.rows.forEach(r => {
                newMap[`${r.product_name}_${r.team}`] = parseInt(r.cnt);
            });

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
                    snapshot_date: date,
                    product_name: c.product_name,
                    team: c.team,
                    live_move,
                    closed,
                    pre_production,
                    new_tickets,
                    dev_pending,
                    in_progress,
                    yet_to_start,
                    completed_dev,
                    total_issue,
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
            product_total: productTotals[
                `${r.snapshot_date}_${r.product_name}`
            ] || 0,
        }));

        res.json(finalRows);

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;