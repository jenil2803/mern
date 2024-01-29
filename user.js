const express = require('express');
const mysql = require('mysql2/promise'); 
const bodyParser = require('body-parser');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const app = express();
const port = 3001;


const jwtSecret = 'jenil';


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
 
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized - Token missing' });
  }

  jwt.verify(token, jwtSecret, { algorithms: ['HS256'] }, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Forbidden - Invalid token' });
    }
    req.user = user;
    next();
  });
}
app.post('/signup', async (req, res) => {
  const { username, password } = req.body;

  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters long' });
  }
  const connection = await pool.getConnection();

  try {
    const [duplicate] = await connection.query('SELECT * FROM user_details WHERE username = ?', [username]);

    if (duplicate.length > 0) {
      return res.status(402).json({ error: 'Username already exists. Please try another username.' });
    }

  
    const hashPass = crypto.createHash('sha256').update(password).digest('hex');

    const newUser = {
      username,
      password: hashPass,
    };


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

function generateToken(username) {
    return jwt.sign({ username }, jwtSecret, { expiresIn: '1h' });
  }
  

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
        const inputHashedPassword = crypto.createHash('sha256').update(password).digest('hex');
  
        if (storedHashedPassword !== inputHashedPassword) {
          return res.status(401).json({ error: 'Invalid username or password' });
        }
  
        try {
            const token = generateToken(username);

            console.log('Generated Token:', token);
    
            res.header('Content-Type', 'application/json').status(200).json({ message: 'User login successful!', token});
          } catch (error) {
          console.error('Error generating token:', error);
          res.status(500).json({ error: 'Token generation error' });
        }
      } finally {
        connection.release();
      }
    } catch (err) {
      console.error('Error:', err);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });
app.get('/data', authenticateToken, (req, res) => {
  const username = req.user.username;
    res.json({ message: 'valid user', username });
});
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});