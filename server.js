// Backend básico para gestión de admins
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const session = require('express-session');
const cors = require('cors');
const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());
app.use(session({
    secret: 'supersecretkey',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
}));

// Inicializar DB
const db = new sqlite3.Database('./users.db', (err) => {
    if (err) throw err;
    db.run(`CREATE TABLE IF NOT EXISTS admins (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        password TEXT
    )`, () => {
        // Crear usuario Kamina si no existe
        db.get('SELECT * FROM admins WHERE username = ?', ['Kamina'], (err, row) => {
            if (!row) {
                bcrypt.hash('admin123', 10, (err, hash) => {
                    db.run('INSERT INTO admins (username, password) VALUES (?, ?)', ['Kamina', hash]);
                });
            }
        });
    });
});

function requireLogin(req, res, next) {
    if (!req.session.user) return res.status(401).json({ error: 'No autenticado' });
    next();
}

function requireKamina(req, res, next) {
    if (req.session.user !== 'Kamina') return res.status(403).json({ error: 'Solo Kamina puede hacer esto' });
    next();
}

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    db.get('SELECT * FROM admins WHERE username = ?', [username], (err, user) => {
        if (!user) return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
        bcrypt.compare(password, user.password, (err, same) => {
            if (!same) return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
            req.session.user = username;
            res.json({ success: true, username });
        });
    });
});

app.post('/api/logout', (req, res) => {
    req.session.destroy(() => res.json({ success: true }));
});

app.get('/api/admins', requireLogin, requireKamina, (req, res) => {
    db.all('SELECT username FROM admins', [], (err, rows) => {
        res.json(rows.map(r => r.username));
    });
});

app.post('/api/admins', requireLogin, requireKamina, (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Faltan datos' });
    bcrypt.hash(password, 10, (err, hash) => {
        db.run('INSERT INTO admins (username, password) VALUES (?, ?)', [username, hash], (err) => {
            if (err) return res.status(400).json({ error: 'Usuario ya existe' });
            res.json({ success: true });
        });
    });
});

app.delete('/api/admins/:username', requireLogin, requireKamina, (req, res) => {
    const { username } = req.params;
    if (username === 'Kamina') return res.status(400).json({ error: 'No puedes borrar a Kamina' });
    db.run('DELETE FROM admins WHERE username = ?', [username], function(err) {
        if (err) return res.status(500).json({ error: 'Error eliminando usuario' });
        res.json({ success: true });
    });
});

app.get('/api/whoami', (req, res) => {
    res.json({ user: req.session.user || null });
});

app.listen(PORT, () => console.log('Backend corriendo en http://localhost:' + PORT));
