const express = require("express");
const mysql = require("mysql2/promise");
const bodyParser = require("body-parser");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");

const app = express();
const port = 3001;

const jwtSecret = "jenil";

app.use(bodyParser.json());

const pool = mysql.createPool({
  host: "localhost",
  user: "jenil",
  password: "admin",
  database: "user_entry",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});
const pooll = mysql.createPool({
  host: "localhost",
  user: "jenil",
  password: "admin",
  database: "todo",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});
function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Unauthorized - Token missing" });
  }

  const data=jwt.verify(token, jwtSecret, { algorithms: ["HS256"] } )

    req.user=data
    next();
  };



//<---------------------------------------------------login and signup------------------------------------------------>



app.post("/signup", async (req, res) => {
  const { username, password } = req.body;

  if (password.length < 8) {
    return res
      .status(400)
      .json({ error: "Password must be at least 8 characters long" });
  }
  const connection = await pool.getConnection();

  try {
    const [duplicate] = await connection.query(
      "SELECT * FROM user_details WHERE username = ?",
      [username]
    );

    if (duplicate.length > 0) {
      return res
        .status(402)
        .json({
          error: "Username already exists. Please try another username.",
        });
    }

    const hashPass = crypto.createHash("sha256").update(password).digest("hex");

    const newUser = {
      username,
      password: hashPass,
    };

    try {
      const result = await connection.query(
        "INSERT INTO user_details SET ?",
        newUser
      );
      console.log("Inserted new record with user_id:", result[0].insertId);
      res.status(200).json({ message: "User signed up successfully!" });
    } finally {
      connection.release();
    }
  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});


  function generateToken(userId, username) {
    const payload = {
      user: {
        
        id: userId,
        username: username
      }
    };


  return jwt.sign(payload, jwtSecret, { expiresIn: "1h" });
  }

app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    const connection = await pool.getConnection();

    try {
      const [rows] = await connection.query(
        "SELECT * FROM user_details WHERE username = ?",
        [username]
      );

      if (rows.length === 0) {
        return res.status(401).json({ error: "Invalid username or password" });
      }
      const user_id1 = await connection.query(
        "SELECT user_id FROM user_details WHERE username = ?",
        [username]
      );
      const user_id =user_id1[0][0].user_id;
      const storedHashedPassword = rows[0].password;
      const inputHashedPassword = crypto
        .createHash("sha256")
        .update(password)
        .digest("hex");

      if (storedHashedPassword !== inputHashedPassword) {
        return res.status(401).json({ error: "Invalid username or password" });
      }

      try {
        const token = generateToken(user_id,username);

        console.log("Generated Token:", token);

        res
          .header("Content-Type", "application/json")
          .status(200)
          .json({ message: "User login successful!", token });
      } catch (error) {
        console.error("Error generating token:", error);
        res.status(500).json({ error: "Token generation error" });
      }
    } finally {
      connection.release();
    }
  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});
app.get("/data", authenticateToken, (req, res) => {
  const userId = req.user.user.id;
  const username = req.user;
  res.json({ message: "valid user", userId });
});


//<--------------------------------------------------TASK-------------------------------------------------->



app.post("/todoadd", authenticateToken, async (req, res) => {
  const { task, completed_task } = req.body;
  const userId = req.user.user.id;
  try {
    const [result] = await pooll.query(
      "INSERT INTO todo_table (task, completed_task, user_id) VALUES (?, ?, ?)",
      [task, completed_task, userId]
    );
    const insertedTodo = {
      id: result.insertId,
      task,
      completed_task,
      userId
    };
    res.status(201).json(insertedTodo);
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});
app.get("/tododisplay", authenticateToken, async (req, res) => {
  const userId = req.user.user.id;
  try {
    const [rows] = await pooll.query("SELECT * FROM todo_table where user_id = ?",[userId]);
    res.json(rows);
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});
app.put("/todoupdate/:task", authenticateToken, async (req, res) => {
  const task = req.params.task;
  const userId = req.user.user.id;
  const Index = parseInt(req.query.Index);
  const completed_task = req.body.completed_task;

  if (completed_task === undefined) {
    return res
      .status(400)
      .json({ error: "Missing completed_task in the request body" });
  }
  try {
    const [rows] = await pooll.query(
      "SELECT * FROM todo_table WHERE task = ? AND user_id= ?",
      [task, userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Todo not found" });
    }
    if(Index === undefined) {
      await pooll.query(
        "UPDATE todo_table SET completed_task = ? WHERE task = ? AND user_id= ?",
        [completed_task, task, userId]
      );
    } 
    else{
      await pooll.query(
      "UPDATE todo_table SET completed_task = ? WHERE task = ? AND user_id= ? AND `Index`= ?",
      [completed_task, task, userId, Index]
    )};

    res.json({ message: "Todo completion status updated successfully" });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.delete("/tododelete/:task", authenticateToken, async (req, res) => {
  const task = req.params.task;
  const userId = req.user.user.id;
  const Index = parseInt(req.query.Index);

  try {
    const [rows] = await pooll.query(
      "SELECT * FROM todo_table WHERE task = ? AND user_id= ?",
      [task, userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Todo not found" });
    }

    await pooll.query("DELETE FROM todo_table WHERE task = ? AND user_id= ? AND `Index`=?", [task, userId, Index]);
    res.json({ message: "Todo deleted successfully" });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
