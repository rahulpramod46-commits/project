const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname)));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'Admin.html'));
});

// 1. Database Configuration
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '', // ENTER YOUR PASSWORD HERE
    database: 'project'
});

// Connect to Database
db.connect((err) => {
    if (err) {
        console.log("❌ Database Connection Failed: " + err.message);
    } else {
        console.log("✅ MySQL Connected to 'project' database!");

        // Ensure the 'paid', 'paid_amount', 'status' columns exist in students table
        const alterPaidSQL = `ALTER TABLE students ADD COLUMN IF NOT EXISTS paid TINYINT(1) DEFAULT 0`;
        const alterPaidAmountSQL = `ALTER TABLE students ADD COLUMN IF NOT EXISTS paid_amount INT DEFAULT 0`;
        const alterStatusSQL = `ALTER TABLE students ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'PENDING'`;

        db.query(alterPaidSQL, (err) => {
            if (err && !err.message.includes("Duplicate")) {
                console.log("⚠️ Warning: Could not alter paid column - " + err.message);
            }
        });

        db.query(alterPaidAmountSQL, (err) => {
            if (err && !err.message.includes("Duplicate")) {
                console.log("⚠️ Warning: Could not alter paid_amount column - " + err.message);
            }
        });

        db.query(alterStatusSQL, (err) => {
            if (err && !err.message.includes("Duplicate")) {
                console.log("⚠️ Warning: Could not alter status column - " + err.message);
            }
        });

        console.log("✅ Table schema verified/updated");
    }
});

// 2. API to Register a New Student
app.post('/api/add-student', (req, res) => {
    const { roll_no, student_name, phone, branch, student_category, course_fee, exam_fee, password } = req.body;
    const sql = "INSERT INTO students (roll_no, student_name, phone, branch, student_category, course_fee, exam_fee, password) VALUES (?, ?, ?, ?, ?, ?, ?, ?)";

    db.query(sql, [roll_no, student_name, phone, branch, student_category, course_fee, exam_fee, password], (err, result) => {
        if (err) {
            console.log("❌ Error Saving Data: " + err.message);
            return res.status(500).send({ success: false, message: err.message });
        }
        res.send({ success: true, message: "Student Registered Successfully!" });
    });
});

// 3. API to Fetch All Students
app.get('/api/get-students', (req, res) => {
    const sql = "SELECT * FROM students";
    db.query(sql, (err, results) => {
        if (err) return res.status(500).send({ success: false });
        res.send({ success: true, students: results });
    });
});

// 3b. Get single student by roll_no
app.get('/api/get-student', (req, res) => {
    const roll_no = (req.query.roll_no || '').toString().trim().toUpperCase();
    if (!roll_no) return res.status(400).send({ success: false, message: 'roll_no query param required' });

    const sql = "SELECT * FROM students WHERE roll_no = ? LIMIT 1";
    db.query(sql, [roll_no], (err, results) => {
        if (err) return res.status(500).send({ success: false, message: err.message });
        if (!results.length) return res.status(404).send({ success: false, message: 'Student not found' });
        res.send({ success: true, student: results[0] });
    });
});

// 4. Student Login API
app.post('/api/student-login', (req, res) => {
    const { roll_no, password } = req.body;
    const sql = "SELECT * FROM students WHERE roll_no = ? AND password = ?";

    db.query(sql, [roll_no, password], (err, results) => {
        if (err) return res.status(500).send({ success: false, message: "Database Error" });

        if (results.length > 0) {
            res.send({ success: true, student: results[0] });
        } else {
            res.send({ success: false, message: "Invalid Credentials!" });
        }
    });
});

// 5. Update Payment Status
app.post('/api/update-payment-status', (req, res) => {
    const { roll_no, paid } = req.body;
    if (!roll_no) {
        return res.status(400).send({ success: false, message: "roll_no required" });
    }

    const paidValue = paid ? 1 : 0;

    // If it's marking as fully paid, set paid_amount to total; else reset to zero.
    const getSql = "SELECT course_fee, exam_fee, paid_amount FROM students WHERE roll_no = ?";
    db.query(getSql, [roll_no], (err, results) => {
        if (err) return res.status(500).send({ success: false, message: err.message });
        if (!results.length) return res.status(404).send({ success: false, message: "Student not found" });

        const student = results[0];
        const totalDue = Number(student.course_fee || 0) + Number(student.exam_fee || 0);
        const newPaidAmount = paidValue ? totalDue : 0;
        const statusValue = paidValue ? 'PAID' : 'PENDING';

        const updateSql = "UPDATE students SET paid = ?, paid_amount = ?, status = ? WHERE roll_no = ?";
        db.query(updateSql, [paidValue, newPaidAmount, statusValue, roll_no], (err, result) => {
            if (err) {
                console.log("❌ Error updating payment:", err.message);
                return res.status(500).send({ success: false, message: err.message });
            }
            res.send({ success: true, message: "Payment status updated", paid_amount: newPaidAmount, status: statusValue });
        });
    });
});

// 6. Record payment transaction from Student Portal
app.post('/api/record-payment', (req, res) => {
    const { roll_no, amount } = req.body;
    if (!roll_no || !amount || isNaN(amount) || Number(amount) <= 0) {
        return res.status(400).send({ success: false, message: "roll_no and positive amount are required" });
    }

    const amountNumber = Number(amount);

    const sql = "SELECT course_fee, exam_fee, paid_amount FROM students WHERE roll_no = ?";
    db.query(sql, [roll_no], (err, results) => {
        if (err) return res.status(500).send({ success: false, message: err.message });
        if (!results.length) return res.status(404).send({ success: false, message: "Student not found" });

        const student = results[0];
        const totalFee = Number(student.course_fee || 0) + Number(student.exam_fee || 0);
        const currentPaid = Number(student.paid_amount || 0);
        const newPaidAmount = Math.min(currentPaid + amountNumber, totalFee);
        const paidFlag = newPaidAmount >= totalFee ? 1 : 0;
        const statusValue = paidFlag ? 'PAID' : 'PENDING';

        const updateSql = "UPDATE students SET paid_amount = ?, paid = ?, status = ? WHERE roll_no = ?";
        db.query(updateSql, [newPaidAmount, paidFlag, statusValue, roll_no], (err, result) => {
            if (err) return res.status(500).send({ success: false, message: err.message });
            res.send({ success: true, message: "Payment recorded", paid_amount: newPaidAmount, status: statusValue, remaining: totalFee - newPaidAmount });
        });
    });
});

// 7. Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server is running on http://localhost:${PORT}`);
});