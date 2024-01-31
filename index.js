const express = require('express');
const mysql = require('mysql2/promise'); 
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');

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
 
    const connectionForCheck = await pool.getConnection();
    try {
      const existingUser = await connectionForCheck.query('SELECT COUNT(*) as count FROM user_details WHERE username = ?', [username]);
      if (existingUser[0].count > 0) {
        return res.status(409).json({ error: 'Username is already taken' });
      }
    } finally {
      connectionForCheck.release();
    }

    const saltRounds = 10;
    const hashPass = await bcrypt.hash(password, saltRounds);

    const newUser = {
      username,
      password: hashPass,
    };

    const connection = await pool.getConnection();

    try {
      const result = await connection.query('INSERT INTO user_details SET ?', newUser);
      console.log('Inserted new record with user_id:', result[0].insertId);
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
      const [rows] = await connection.query('SELECT * FROM user_details WHERE username = ?', [username]);

      if (rows.length === 0) {
        return res.status(401).json({ error: 'Invalid username or password' });
      }

      const storedHashedPassword = rows[0].password;

      
      const passwordMatch = await bcrypt.compare(password, storedHashedPassword);

      if (!passwordMatch) {
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
