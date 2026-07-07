<?php
$conn = new mysqli("localhost", "root", "", "project");

if ($conn->connect_error) {
    die("Connection failed: " . $conn->connect_error);
}

$sql = "SELECT * FROM students";
$result = $conn->query($sql);

if ($result->num_rows > 0) {
    while($row = $result->fetch_assoc()) {
        echo "Name: " . $row["student_name"] . " - Roll No: " . $row["roll_no"] . "<br>";
    }
} else {
    echo "No records found";
}

$conn->close();
?><?php
$servername = "localhost";
$username = "root";     // default XAMPP username
$password = "";         // default is empty
$dbname = "project";    // your database name

// Create connection
$conn = new mysqli($servername, $username, $password, $dbname);

// Check connection
if ($conn->connect_error) {
    die("Connection failed: " . $conn->connect_error);
}

echo "Connected successfully";
?>