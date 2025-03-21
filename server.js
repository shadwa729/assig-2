// Import required packages
const express = require('express');
const mysql = require('mysql');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken'); // Add this for JWT
const bodyParser = require('body-parser');
require('dotenv').config(); // Load environment variables from .env file

const app = express();
const port = process.env.PORT || 3000;

// Middleware to parse incoming requests with JSON payload
app.use(bodyParser.json());

// MySQL connection setup
const db = mysql.createConnection({
    host: process.env.DB_HOST,    // 'localhost'
    user: process.env.DB_USER,    // 'root'
    password: process.env.DB_PASSWORD,  // Empty by default in XAMPP
    database: process.env.DB_NAME  // 'infosecmgmt'
});

// Connect to MySQL
db.connect((err) => {
    if (err) {
        console.error('Error connecting to database:', err);
        return;
    }
    console.log('Connected to MySQL database');
});

// Middleware to verify JWT token
const verifyToken = (req, res, next) => {
    const token = req.header('Authorization');
    if (!token) return res.status(401).send('Access denied. No token provided.');

    const tokenWithoutBearer = token.split(' ')[1]; // Remove 'Bearer ' part
    jwt.verify(tokenWithoutBearer, process.env.JWT_SECRET, (err, decoded) => {
        if (err) return res.status(400).send('Invalid token');
        req.user = decoded;  // Store the decoded user info in the request object
        next();
    });
};

// Define /signup route for user registration
app.post('/signup', (req, res) => {
    const { name, username, password } = req.body;

    // Hash the password using bcrypt
    bcrypt.hash(password, 10, (err, hashedPassword) => {
        if (err) return res.status(500).send('Error hashing password');

        // Insert user into the database
        const query = 'INSERT INTO users (name, username, password) VALUES (?, ?, ?)';
        db.query(query, [name, username, hashedPassword], (err, result) => {
            if (err) return res.status(500).send('Error registering user');
            res.status(201).send('User registered successfully');
        });
    });
});

// Define /login route for user authentication
app.post('/login', (req, res) => {
    const { username, password } = req.body;

    // Check if username exists in the database
    const query = 'SELECT * FROM users WHERE username = ?';
    db.query(query, [username], (err, results) => {
        if (err) return res.status(500).send('Error checking user');
        if (results.length === 0) return res.status(400).send('User not found');

        const user = results[0];

        // Compare provided password with the stored hashed password
        bcrypt.compare(password, user.password, (err, isMatch) => {
            if (err) return res.status(500).send('Error comparing password');
            if (!isMatch) return res.status(400).send('Invalid credentials');

            // Create JWT token
            const token = jwt.sign({ id: user.id, username: user.username }, process.env.JWT_SECRET, { expiresIn: '1h' });

            res.json({ message: 'Login successful', token });
        });
    });
});

// Define PUT route for updating user details
app.put('/users/:id', verifyToken, (req, res) => {
    const { id } = req.params;
    const { name, username, password } = req.body;

    // Hash the new password if it's provided
    const hashedPassword = password ? bcrypt.hashSync(password, 10) : null;

    // Construct the update query
    let query = 'UPDATE users SET name = ?, username = ?';
    let values = [name, username];

    if (hashedPassword) {
        query += ', password = ?';
        values.push(hashedPassword);
    }

    query += ' WHERE id = ?';
    values.push(id);

    db.query(query, values, (err, result) => {
        if (err) return res.status(500).send('Error updating user');
        res.send('User updated successfully');
    });
});

// Define /products route for adding a product
app.post('/products', verifyToken, (req, res) => {
    const { pname, description, price, stock } = req.body;
    const query = 'INSERT INTO products (pname, description, price, stock, created_at) VALUES (?, ?, ?, ?, NOW())';
    
    db.query(query, [pname, description, price, stock], (err, result) => {
        if (err) return res.status(500).send('Error adding product');
        res.status(201).send('Product added successfully');
    });
});

// Define GET route for fetching all products
app.get('/products', verifyToken, (req, res) => {
    const query = 'SELECT * FROM products';
    
    db.query(query, (err, results) => {
        if (err) return res.status(500).send('Error fetching products');
        res.json(results);
    });
});

// Define GET route for fetching a single product by ID
app.get('/products/:pid', verifyToken, (req, res) => {
    const { pid } = req.params;
    const query = 'SELECT * FROM products WHERE pid = ?';
    
    db.query(query, [pid], (err, results) => {
        if (err) return res.status(500).send('Error fetching product');
        if (results.length === 0) return res.status(404).send('Product not found');
        res.json(results[0]);
    });
});

// Define PUT route for updating product details
app.put('/products/:pid', verifyToken, (req, res) => {
    const { pid } = req.params;
    const { pname, description, price, stock } = req.body;

    const query = 'UPDATE products SET pname = ?, description = ?, price = ?, stock = ? WHERE pid = ?';
    db.query(query, [pname, description, price, stock, pid], (err, result) => {
        if (err) return res.status(500).send('Error updating product');
        res.send('Product updated successfully');
    });
});

// Define DELETE route for deleting a product
app.delete('/products/:pid', verifyToken, (req, res) => {
    const { pid } = req.params;
    const query = 'DELETE FROM products WHERE pid = ?';
    
    db.query(query, [pid], (err, result) => {
        if (err) return res.status(500).send('Error deleting product');
        res.send('Product deleted successfully');
    });
});

// Start the server
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
