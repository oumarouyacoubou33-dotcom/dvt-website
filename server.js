require('dotenv').config();
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');

const app = express();
const JWT_SECRET = process.env.JWT_SECRET || 'dvt_secret_key_2026';

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Supabase Setup
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Cloudinary Setup
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Multer Storage configured for Cloudinary
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'student_association_tv',
    resource_type: 'auto'
  }
});

const upload = multer({ storage: storage });

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

// PUBLIC APIs - Fetching News/Posts
app.get('/api/news', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('posts')
            .select('*')
            .order('id', { ascending: false });

        if (error) throw error;
        res.json({ success: true, data: data });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ADMIN LOGIN API
app.post('/api/admin/login', async (req, res) => {
    const { username, password } = req.body;

    if (username === 'admin' && password === 'admin123') {
        const token = jwt.sign({ username: 'admin' }, JWT_SECRET, { expiresIn: '12h' });
        return res.json({ success: true, token });
    }

    res.status(400).json({ success: false, message: 'Username ko Password ba daidai ba' });
});

// Create Post with Cloudinary upload
app.post('/api/admin/news', authenticateToken, upload.single('mediaFile'), async (req, res) => {
    try {
        const { title, category, content, imageUrl } = req.body;
        if (!title || !category || !content) {
            return res.status(400).json({ success: false, message: 'Cika dukkan wurare masu muhimmanci' });
        }

        let finalMediaPath = imageUrl || '';
        if (req.file) {
            finalMediaPath = req.file.path;
        }

        const { data, error } = await supabase
            .from('posts')
            .insert([{ title, category, content, media_url: finalMediaPath }]);

        if (error) throw error;

        res.json({ success: true, message: 'An yi nasarar wallafa labari!' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Delete Post API
app.delete('/api/admin/news/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { error } = await supabase
            .from('posts')
            .delete()
            .eq('id', id);

        if (error) throw error;
        res.json({ success: true, message: 'An goge labari!' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server na aiki a http://localhost:${PORT}`));
