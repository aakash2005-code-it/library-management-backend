const express = require('express');
const cors = require('cors');
require('dotenv').config();
require('./db');
function verifyAdmin(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'No token provided' });

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}
const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('Library Management System API is running!');
});

const PORT = process.env.PORT || 5000;
const db = require('./db');

app.post('/books', verifyAdmin, (req, res) => {
  db.query('SELECT * FROM books', (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(results);
  });
});
app.post('/borrow', (req, res) => {
  const { book_id, member_id } = req.body;

  const checkQuery = 'SELECT available_copies FROM books WHERE book_id = ?';
  db.query(checkQuery, [book_id], (err, results) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (results.length === 0) return res.status(404).json({ error: 'Book not found' });
    if (results[0].available_copies <= 0) return res.status(400).json({ error: 'No copies available' });

    const insertQuery = `
      INSERT INTO borrowing_records (book_id, member_id, due_date)
      VALUES (?, ?, DATE_ADD(CURDATE(), INTERVAL 14 DAY))
    `;
    db.query(insertQuery, [book_id, member_id], (err, result) => {
      if (err) return res.status(500).json({ error: 'Database error' });

      const updateQuery = 'UPDATE books SET available_copies = available_copies - 1 WHERE book_id = ?';
      db.query(updateQuery, [book_id], (err) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json({ message: 'Book borrowed successfully', record_id: result.insertId });
      });
    });
  });
});
app.put('/return', (req, res) => {
  const { record_id } = req.body;

  const updateRecord = `
    UPDATE borrowing_records 
    SET return_date = CURDATE() 
    WHERE record_id = ? AND return_date IS NULL
  `;
  db.query(updateRecord, [record_id], (err, result) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Record not found or already returned' });
    }

    const getBookId = 'SELECT book_id FROM borrowing_records WHERE record_id = ?';
    db.query(getBookId, [record_id], (err, results) => {
      if (err) return res.status(500).json({ error: 'Database error' });

      const bookId = results[0].book_id;
      const updateBook = 'UPDATE books SET available_copies = available_copies + 1 WHERE book_id = ?';
      db.query(updateBook, [bookId], (err) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json({ message: 'Book returned successfully' });
      });
    });
  });
});
app.get('/fines/:memberId', (req, res) => {
  const { memberId } = req.params;

  const query = `
    SELECT f.fine_id, b.title, f.fine_amount, f.paid
    FROM fines f
    JOIN borrowing_records br ON f.record_id = br.record_id
    JOIN books b ON br.book_id = b.book_id
    WHERE f.member_id = ?
  `;
  db.query(query, [memberId], (err, results) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json(results);
  });
});
app.get('/books', (req, res) => {
  const { search } = req.query;

  let query = 'SELECT * FROM books';
  let params = [];

  if (search) {
    query += ' WHERE title LIKE ? OR author LIKE ? OR genre LIKE ?';
    const searchTerm = `%${search}%`;
    params = [searchTerm, searchTerm, searchTerm];
  }

  db.query(query, params, (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(results);
  });
});
app.post('/members', verifyAdmin, (req, res) => {
  const { name, email, phone } = req.body;

  if (!name || !email) {
    return res.status(400).json({ error: 'Name and email are required' });
  }

  const query = `
    INSERT INTO members (name, email, phone)
    VALUES (?, ?, ?)
  `;
  db.query(query, [name, email, phone || null], (err, result) => {
    if (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(400).json({ error: 'A member with this email already exists' });
      }
      return res.status(500).json({ error: 'Database error' });
    }
    res.json({ message: 'Member added successfully', member_id: result.insertId });
  });
});
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

app.post('/signup', async (req, res) => {
  const { name, email, password, phone } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and password are required' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    const query = `
      INSERT INTO members (name, email, password, phone, role)
      VALUES (?, ?, ?, ?, 'member')
    `;
    db.query(query, [name, email, hashedPassword, phone || null], (err, result) => {
      if (err) {
        if (err.code === 'ER_DUP_ENTRY') {
          return res.status(400).json({ error: 'An account with this email already exists' });
        }
        return res.status(500).json({ error: 'Database error' });
      }
      res.json({ message: 'Account created successfully! Please log in.' });
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});
app.post('/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  // First check members table
  const memberQuery = 'SELECT * FROM members WHERE email = ?';
  db.query(memberQuery, [email], async (err, members) => {
    if (err) return res.status(500).json({ error: 'Database error' });

    if (members.length > 0) {
      const member = members[0];
      const isMatch = await bcrypt.compare(password, member.password);
      if (!isMatch) return res.status(401).json({ error: 'Invalid email or password' });

      const token = jwt.sign(
        { id: member.member_id, email: member.email, role: 'member' },
        process.env.JWT_SECRET,
        { expiresIn: '1d' }
      );

      return res.json({
        message: 'Login successful',
        token,
        user: { id: member.member_id, name: member.name, email: member.email, role: 'member' },
      });
    }

    // If not found in members, check admins table
    const adminQuery = 'SELECT * FROM admins WHERE email = ?';
    db.query(adminQuery, [email], async (err, admins) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      if (admins.length === 0) return res.status(401).json({ error: 'Invalid email or password' });

      const admin = admins[0];
      const isMatch = await bcrypt.compare(password, admin.password);
      if (!isMatch) return res.status(401).json({ error: 'Invalid email or password' });

      const token = jwt.sign(
        { id: admin.admin_id, email: admin.email, role: 'admin' },
        process.env.JWT_SECRET,
        { expiresIn: '1d' }
      );

      res.json({
        message: 'Login successful',
        token,
        user: { id: admin.admin_id, name: admin.name, email: admin.email, role: 'admin' },
      });
    });
  });
});
app.get('/stats', (req, res) => {
  const stats = {};

  db.query('SELECT COUNT(*) as total FROM books', (err, result) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    stats.totalBooks = result[0].total;

    db.query('SELECT COUNT(*) as total FROM members', (err, result) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      stats.totalMembers = result[0].total;

      db.query('SELECT COUNT(*) as total FROM borrowing_records WHERE return_date IS NULL', (err, result) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        stats.currentlyBorrowed = result[0].total;

        db.query('SELECT COUNT(*) as total FROM fines WHERE paid = false', (err, result) => {
          if (err) return res.status(500).json({ error: 'Database error' });
          stats.unpaidFines = result[0].total;
          res.json(stats);
        });
      });
    });
  });
});
app.get('/books/:id', (req, res) => {
  const { id } = req.params;
  const query = `
    SELECT b.*, 
    COUNT(br.record_id) as total_borrows,
    SUM(CASE WHEN br.return_date IS NULL THEN 1 ELSE 0 END) as currently_borrowed
    FROM books b
    LEFT JOIN borrowing_records br ON b.book_id = br.book_id
    WHERE b.book_id = ?
    GROUP BY b.book_id
  `;
  db.query(query, [id], (err, results) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (results.length === 0) return res.status(404).json({ error: 'Book not found' });
    res.json(results[0]);
  });
});
app.get('/overdue', (req, res) => {
  const query = `
    SELECT br.record_id, br.due_date, 
    DATEDIFF(CURDATE(), br.due_date) AS days_overdue,
    m.name AS member_name, m.email AS member_email,
    b.title AS book_title
    FROM borrowing_records br
    JOIN members m ON br.member_id = m.member_id
    JOIN books b ON br.book_id = b.book_id
    WHERE br.return_date IS NULL AND br.due_date < CURDATE()
    ORDER BY days_overdue DESC
  `;
  db.query(query, (err, results) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json(results);
  });
});
app.get('/history/:memberId', (req, res) => {
  const { memberId } = req.params;
  const query = `
    SELECT br.record_id, b.title AS book_title, b.author,
    br.borrow_date, br.due_date, br.return_date,
    CASE 
      WHEN br.return_date IS NOT NULL THEN 'Returned'
      WHEN br.due_date < CURDATE() THEN 'Overdue'
      ELSE 'Borrowed'
    END AS status
    FROM borrowing_records br
    JOIN books b ON br.book_id = b.book_id
    WHERE br.member_id = ?
    ORDER BY br.borrow_date DESC
  `;
  db.query(query, [memberId], (err, results) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json(results);
  });
});
app.get('/members/:id', (req, res) => {
  const { id } = req.params;

  const memberQuery = 'SELECT member_id, name, email, phone, joined_date FROM members WHERE member_id = ?';
  db.query(memberQuery, [id], (err, members) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (members.length === 0) return res.status(404).json({ error: 'Member not found' });

    const historyQuery = `
      SELECT br.record_id, b.title AS book_title,
      br.borrow_date, br.due_date, br.return_date,
      CASE 
        WHEN br.return_date IS NOT NULL THEN 'Returned'
        WHEN br.due_date < CURDATE() THEN 'Overdue'
        ELSE 'Borrowed'
      END AS status
      FROM borrowing_records br
      JOIN books b ON br.book_id = b.book_id
      WHERE br.member_id = ?
      ORDER BY br.borrow_date DESC
    `;
    db.query(historyQuery, [id], (err, history) => {
      if (err) return res.status(500).json({ error: 'Database error' });

      const finesQuery = `
        SELECT f.fine_amount, f.paid FROM fines f WHERE f.member_id = ?
      `;
      db.query(finesQuery, [id], (err, fines) => {
        if (err) return res.status(500).json({ error: 'Database error' });

        const totalFines = fines.reduce((sum, f) => sum + parseFloat(f.fine_amount), 0);
        const unpaidFines = fines.filter(f => !f.paid).reduce((sum, f) => sum + parseFloat(f.fine_amount), 0);

        res.json({
          member: members[0],
          history,
          totalBorrows: history.length,
          currentlyBorrowed: history.filter(h => h.status !== 'Returned').length,
          totalFines,
          unpaidFines,
        });
      });
    });
  });
});
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});