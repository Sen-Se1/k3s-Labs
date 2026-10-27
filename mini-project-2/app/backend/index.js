const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

const requiredEnv = [
  'BACKEND_PORT',
  'POSTGRES_HOST',
  'POSTGRES_PORT',
  'POSTGRES_DB',
  'POSTGRES_USER',
  'POSTGRES_PASSWORD',
];

for (const name of requiredEnv) {
  if (!process.env[name]) {
    console.error(`Missing required environment variable: ${name}`);
    process.exit(1);
  }
}

const port = Number(process.env.BACKEND_PORT);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error('BACKEND_PORT must be a valid TCP port');
  process.exit(1);
}

const pool = new Pool({
  user: process.env.POSTGRES_USER,
  host: process.env.POSTGRES_HOST,
  database: process.env.POSTGRES_DB,
  password: process.env.POSTGRES_PASSWORD,
  port: Number(process.env.POSTGRES_PORT),
});

const app = express();

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'UP' });
});

app.get('/ready', async (req, res) => {
  try {
    await pool.query('SELECT 1');

    res.status(200).json({
      status: 'READY',
      database: 'CONNECTED',
    });
  } catch (err) {
    console.error('Readiness check failed:', err.message);

    res.status(503).json({
      status: 'NOT_READY',
      database: 'DISCONNECTED',
    });
  }
});

app.get('/api/tasks', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM tasks ORDER BY id ASC'
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/tasks', async (req, res) => {
  const { title, description, status } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO tasks (title, description, status)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [title, description, status || 'pending']
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.delete('/api/tasks/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      'DELETE FROM tasks WHERE id = $1',
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.listen(port, () => {
  console.log(`Backend listening on port ${port}`);
});