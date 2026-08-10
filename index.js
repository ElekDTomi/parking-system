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

app.get('/v1/getParkingSlots', async (req, res) => {
  try {
    const connection = await pool.getConnection()
    const [rows] = await connection.query(
      'SELECT parking_slots.*, customers.plate, customers.park_start_time, customers.park_end_time FROM parking_slots LEFT JOIN customers ON parking_slots.id = customers.slot_id WHERE customers.park_start_time < NOW() AND customers.park_end_time > NOW() ORDER BY parking_slots.id',
    )
    connection.release()
    res.status(200).json(rows)
  } catch (error) {
    res.status(500).json({ status: 'Failed to fetch parking slots', error: error.message })
  }
})

app.use((req, res) => {
  res.status(404).json()
})

app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`)
  console.log(`📱 Environment: ${process.env.NODE_ENV || 'development'}`)
})

module.exports = app
