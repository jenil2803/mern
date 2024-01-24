const express = require('express');
const mysql = require('mysql2/promise'); // Use promise version for async/await
const bodyParser = require('body-parser');
const crypto = require('crypto');

const app = express();
const port = 3000;

app.use(bodyParser.json());

const pool = mysql.createPool({
  host: 'localhost',
  user: 'jenil',
  password: 'admin',
  database: 'user_entry',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

app.post('/signup', async (req, res) => {
  const { username, password } = req.body;

  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters long' });
  }

  try {
    const hashPass = crypto.createHash('sha256').update(password).digest('hex');

    const newUser = {
      username,
      password: hashPass,
    };

    const connection = await pool.getConnection();

    try {
      await connection.query('INSERT INTO new_table SET ?', newUser);
      console.log('Inserted new record with user_id:', results.insertId);
      res.status(200).json({ message: 'User signed up successfully!' });
    } finally {
      connection.release();
    }
  } catch (err) {
    console.error('Error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    const connection = await pool.getConnection();

    try {
      const [rows] = await connection.query('SELECT * FROM new_table WHERE username = ?', [username]);

      if (rows.length === 0) {
        return res.status(401).json({ error: 'Invalid username or password' });
      }

      const storedHashedPassword = rows[0].password;
      const inputHashedPassword = crypto.createHash('sha256').update(password).digest('hex');

      if (storedHashedPassword !== inputHashedPassword) {
        return res.status(401).json({ error: 'Invalid username or password' });
      }

      res.status(200).json({ message: 'Login successful!' });
    } finally {
      connection.release();
    }
  } catch (err) {
    console.error('Error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
