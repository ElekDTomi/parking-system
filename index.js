const express = require('express')
const cors = require('cors')
const mysql = require('mysql2/promise')
require('dotenv').config()

const app = express()
const PORT = process.env.PORT || 5000

app.use(cors())
app.use(express.json())

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'sonrisa_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
})

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'Backend is running' })
})

app.get('/api/db-status', async (req, res) => {
  try {
    const connection = await pool.getConnection()
    const [rows] = await connection.query('SELECT 1')
    connection.release()
    res.status(200).json({ status: 'Database connected successfully' })
  } catch (error) {
    res.status(500).json({ status: 'Database connection failed', error: error.message })
  }
})

app.get('/api/users', async (req, res) => {
  try {
    const connection = await pool.getConnection()
    const [rows] = await connection.query('SELECT * FROM users LIMIT 10')
    connection.release()
    res.status(200).json({ data: rows })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' })
})

app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`)
  console.log(`📊 Database: ${process.env.DB_NAME || 'sonrisa_db'}`)
  console.log(`📱 Environment: ${process.env.NODE_ENV || 'development'}`)
})

module.exports = app
