import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import pool from './db/db.js';
import authRouter from './routes/auth.js';
import eventsRouter from './routes/events.js';
//the ./ means:
//"Start from the folder containing the current file."
//the ../ means:
//go up one folder

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());
app.use('/auth', authRouter);
app.use('/events',eventsRouter);

// Test route
app.get('/', (req, res) => {
  res.send('API is running');
});

// Test DB connection route
app.get('/test-db', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({ message: 'Database connected!', time: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database connection failed' });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});