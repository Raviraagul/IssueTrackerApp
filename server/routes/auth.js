const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db');

// ── Middleware: verify JWT token ──────────────────────────────────────────────
const verifyToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Access denied. No token.' });
    try {
        req.user = jwt.verify(token, process.env.JWT_SECRET);
        next();
    } catch {
        res.status(403).json({ error: 'Invalid or expired token.' });
    }
};

// ── Middleware: admin only ────────────────────────────────────────────────────
const adminOnly = (req, res, next) => {
    if (req.user.role !== 'admin')
        return res.status(403).json({ error: 'Admin access required.' });
    next();
};

// ── Middleware: admin or editor ───────────────────────────────────────────────
const editorOrAdmin = (req, res, next) => {
    if (!['admin', 'editor'].includes(req.user.role))
        return res.status(403).json({ error: 'Editor or Admin access required.' });
    next();
};

// ── Helper: can user edit this ticket? ───────────────────────────────────────
// Admin    → always yes
// Editor (no team) → always yes
// Editor (Support team) → always yes
// Editor (API/Web/App team) → only if ticket.team matches user.team
// Viewer → never
const canEditTicket = (user, ticketTeam) => {
    if (user.role === 'admin') return true;
    if (user.role === 'viewer') return false;
    if (user.role === 'editor') {
        if (!user.team || user.team === 'Support') return true;
        return user.team === ticketTeam;
    }
    return false;
};

// ── Helper: get team filter for tickets query ─────────────────────────────────
// Returns the team to filter by, or null if user can see all teams
const getTeamFilter = (user) => {
    if (user.role === 'admin') return null;
    if (!user.team || user.team === 'Support') return null;
    return user.team; // API / Web / App — restrict to own team
};

// ── POST /api/auth/login ──────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password)
        return res.status(400).json({ error: 'Email and password are required.' });
    try {
        const result = await pool.query(
            'SELECT * FROM users WHERE email = $1 AND is_active = true', [email]
        );
        if (result.rows.length === 0)
            return res.status(401).json({ error: 'Invalid email or password.' });

        const user = result.rows[0];
        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid)
            return res.status(401).json({ error: 'Invalid email or password.' });

        const token = jwt.sign(
            {
                id: user.id,
                email: user.email,
                role: user.role,
                name: user.name,
                team: user.team || null,   // ← include team in token
            },
            process.env.JWT_SECRET,
            { expiresIn: '8h' }
        );
        res.json({
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                team: user.team || null,   // ← include team in response
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
router.get('/me', verifyToken, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT id, name, email, role, team, created_at FROM users WHERE id = $1',
            [req.user.id]
        );
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── GET /api/auth/users  (admin only) ────────────────────────────────────────
router.get('/users', verifyToken, adminOnly, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT id, name, email, role, team, is_active, created_at FROM users ORDER BY created_at DESC'
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── POST /api/auth/users  (admin only) ───────────────────────────────────────
router.post('/users', verifyToken, adminOnly, async (req, res) => {
    const { name, email, password, role, team } = req.body;
    if (!name || !email || !password)
        return res.status(400).json({ error: 'Name, email and password are required.' });

    // team is only relevant for editor/viewer — not for admin
    const assignedTeam = role === 'admin' ? null : (team || null);

    try {
        const hash = await bcrypt.hash(password, 10);
        const result = await pool.query(
            `INSERT INTO users (name, email, password_hash, role, team)
             VALUES ($1,$2,$3,$4,$5)
             RETURNING id, name, email, role, team`,
            [name, email, hash, role || 'viewer', assignedTeam]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        if (err.code === '23505')
            return res.status(400).json({ error: 'Email already exists.' });
        res.status(500).json({ error: err.message });
    }
});

// ── PUT /api/auth/users/:id  (admin only) ────────────────────────────────────
router.put('/users/:id', verifyToken, adminOnly, async (req, res) => {
    const { name, role, team, is_active } = req.body;

    // team is only relevant for editor/viewer — clear it for admin
    const assignedTeam = role === 'admin' ? null : (team || null);

    try {
        const result = await pool.query(
            `UPDATE users SET name=$1, role=$2, team=$3, is_active=$4
             WHERE id=$5
             RETURNING id, name, email, role, team, is_active`,
            [name, role, assignedTeam, is_active, req.params.id]
        );
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── PUT /api/auth/change-password (own password) ──────────────────────────────
router.put('/change-password', verifyToken, async (req, res) => {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password)
        return res.status(400).json({ error: 'Both fields are required.' });
    if (new_password.length < 6)
        return res.status(400).json({ error: 'New password must be at least 6 characters.' });
    try {
        const result = await pool.query(
            'SELECT * FROM users WHERE id = $1', [req.user.id]
        );
        const user = result.rows[0];
        const valid = await bcrypt.compare(current_password, user.password_hash);
        if (!valid)
            return res.status(401).json({ error: 'Current password is incorrect.' });
        const hash = await bcrypt.hash(new_password, 10);
        await pool.query(
            'UPDATE users SET password_hash = $1 WHERE id = $2',
            [hash, req.user.id]
        );
        res.json({ message: 'Password changed successfully.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── PUT /api/auth/update-name (own name) ──────────────────────────────────────
router.put('/update-name', verifyToken, async (req, res) => {
    const { name } = req.body;
    if (!name || !name.trim())
        return res.status(400).json({ error: 'Name cannot be empty.' });
    try {
        const result = await pool.query(
            'UPDATE users SET name = $1 WHERE id = $2 RETURNING id, name, email, role, team',
            [name.trim(), req.user.id]
        );
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── PUT /api/auth/reset-password/:id (admin resets anyone's password) ─────────
router.put('/reset-password/:id', verifyToken, adminOnly, async (req, res) => {
    const { new_password } = req.body;
    if (!new_password || new_password.length < 6)
        return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    try {
        const hash = await bcrypt.hash(new_password, 10);
        await pool.query(
            'UPDATE users SET password_hash = $1 WHERE id = $2',
            [hash, req.params.id]
        );
        res.json({ message: 'Password reset successfully.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
module.exports.verifyToken = verifyToken;
module.exports.adminOnly = adminOnly;
module.exports.editorOrAdmin = editorOrAdmin;
module.exports.canEditTicket = canEditTicket;
module.exports.getTeamFilter = getTeamFilter;
