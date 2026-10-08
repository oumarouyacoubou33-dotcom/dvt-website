const express = require('express');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

const app = express();
const JWT_SECRET = 'dvt_secret_key_2026';

app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use('/uploads', express.static('uploads')); // Shafin karbar hotuna/bidiyoyi

// Tsara hanyar adana fayiloli daga storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = './uploads';
        if (!fs.existsSync(dir)){
            fs.mkdirSync(dir);
        }
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

let db;

// Saita SQLite Database
(async () => {
    db = await open({
        filename: './dvt_database.db',
        driver: sqlite3.Database
    });

    await db.exec(`
        CREATE TABLE IF NOT EXISTS news (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            category TEXT NOT NULL,
            content TEXT NOT NULL,
            image TEXT,
            date_published DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    await db.exec(`
        CREATE TABLE IF NOT EXISTS admins (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE,
            password TEXT
        )
    `);

    const adminExists = await db.get('SELECT * FROM admins WHERE username = ?', ['admin']);
    if (!adminExists) {
        const hashedPassword = await bcrypt.hash('admin123', 10);
        await db.run('INSERT INTO admins (username, password) VALUES (?, ?)', ['admin', hashedPassword]);
        console.log('An ƙira Default Admin: Username: admin | Password: admin123');
    }

    console.log('SQLite Database ta shirya!');
})();

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, message: 'Babu izinin shiga' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ success: false, message: 'Token din ya ƙare ko ba daidai ba' });
        req.user = user;
        next();
    });
}

// PUBLIC APIs
app.get('/api/news', async (req, res) => {
    try {
        const news = await db.all('SELECT * FROM news ORDER BY id DESC');
        res.json({ success: true, data: news });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ADMIN APIs
app.post('/api/admin/login', async (req, res) => {
    const { username, password } = req.body;
    const admin = await db.get('SELECT * FROM admins WHERE username = ?', [username]);
    if (!admin) return res.status(400).json({ success: false, message: 'Wannan sunan ba ya nan' });

    const validPassword = await bcrypt.compare(password, admin.password);
    if (!validPassword) return res.status(400).json({ success: false, message: 'Password ba daidai ba' });

    const token = jwt.sign({ id: admin.id, username: admin.username }, JWT_SECRET, { expiresIn: '12h' });
    res.json({ success: true, token });
});

// Ƙara Labari Sabo tare da Loda Fayil daga Storage
app.post('/api/admin/news', authenticateToken, upload.single('mediaFile'), async (req, res) => {
    const { title, category, content, imageUrl } = req.body;
    if (!title || !category || !content) {
        return res.status(400).json({ success: false, message: 'Cika dukkan wurare masu muhimmanci' });
    }

    let finalMediaPath = imageUrl || '';
    if (req.file) {
        finalMediaPath = '/uploads/' + req.file.filename;
    }

    await db.run(
        'INSERT INTO news (title, category, content, image) VALUES (?, ?, ?, ?)',
        [title, category, content, finalMediaPath]
    );
    res.json({ success: true, message: 'An yi nasarar wallafa labari!' });
});

app.delete('/api/admin/news/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    await db.run('DELETE FROM news WHERE id = ?', [id]);
    res.json({ success: true, message: 'An goge labari!' });
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server na aiki a http://localhost:${PORT}`));
