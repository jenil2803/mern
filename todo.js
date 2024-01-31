const express = require("express");
const mysql = require("mysql2/promise");
const bodyParser = require("body-parser");
const jwt = require("jsonwebtoken");

const app = express();
const port = 3002;

const jwtSecret = "jenil";

app.use(bodyParser.json());

const pool = mysql.createPool({
  host: "localhost",
  user: "jenil",
  password: "admin",
  database: "todo",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

app.post("/todoadd", authenticateToken, async (req, res) => {
  const { task, completed_task } = req.body;

  try {
    const [result] = await pool.query(
      "INSERT INTO todo_table (task, completed_task) VALUES (?, ?)",
      [task, completed_task]
    );
    const insertedTodo = {
      id: result.insertId,
      task,
      completed_task,
    };
    res.status(201).json(insertedTodo);
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/tododisplay", authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM todo_table");
    res.json(rows);
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.put("/todoupdate/:task", authenticateToken,async (req, res) => {
  const task = req.params.task;
  const completed_task = req.body.completed_task;

  if (completed_task === undefined) {
    return res
      .status(400)
      .json({ error: "Missing completed_task in the request body" });
  }
  try {
    const [rows] = await pool.query("SELECT * FROM todo_table WHERE task = ?", [
      task,
    ]);

    if (rows.length === 0) {
      return res.status(404).json({ error: "Todo not found" });
    }

    await pool.query(
      "UPDATE todo_table SET completed_task = ? WHERE task = ?",
      [completed_task, task]
    );

    res.json({ message: "Todo completion status updated successfully" });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.delete("/tododelete/:task", authenticateToken,async (req, res) => {
  const task = req.params.task;

  try {
    const [rows] = await pool.query("SELECT * FROM todo_table WHERE task = ?", [
      task,
    ]);

    if (rows.length === 0) {
      console.log(task);
      return res.status(404).json({ error: "Todo not found" });
    }

    await pool.query("DELETE FROM todo_table WHERE task = ?", [task]);
    res.json({ message: "Todo deleted successfully" });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});
function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) {
    return res.status(401).json({ error: "Unauthorized - Token missing" });
  }

  jwt.verify(token, jwtSecret, { algorithms: ["HS256"] }, (err, user) => {
    if (err) {
      if (err.name === "TokenExpiredError") {
        return res.status(401).json({ error: "Unauthorized - Token expired" });
      } else {
        return res.status(403).json({ error: "Forbidden - Invalid token" });
      }
    }
    req.user = user;
    next();
  });
}
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
