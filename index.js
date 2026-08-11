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

app.get('/v1/getParkingSlots', async (req, res) => {
  const { reserved = 'false' } = req.query

  let rows = []

  try {
    const connection = await pool.getConnection()
    if (reserved === 'true') {
      ;[rows] = await connection.query(
        'SELECT parking_slots.*, customers.plate, customers.park_start_time, customers.park_end_time FROM parking_slots INNER JOIN customers ON parking_slots.id = customers.slot_id AND customers.park_start_time < NOW() AND customers.park_end_time > NOW() AND customers.deleted = 0 ORDER BY parking_slots.id',
      )
    } else {
      ;[rows] = await connection.query(
        'SELECT parking_slots.*, customers.plate, customers.park_start_time, customers.park_end_time FROM parking_slots LEFT JOIN customers ON parking_slots.id = customers.slot_id AND customers.park_start_time < NOW() AND customers.park_end_time > NOW() AND customers.deleted = 0 ORDER BY parking_slots.id',
      )
    }
    connection.release()
    res.status(200).json(rows)
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: 'Failed to fetch parking slots', error: error.message })
  }
})

app.post('/v1/reserveParkingSlot', async (req, res) => {
  const { slot_id, plate, park_start_time, park_end_time } = req.body

  if (!slot_id || !plate || !park_start_time || !park_end_time) {
    return res.status(400).json({
      success: false,
      message: 'Missing required fields (slot_id, plate, park_start_time, park_end_time)',
    })
  }

  const nowDate = new Date()

  if (new Date(park_start_time) < nowDate && new Date(park_end_time) < nowDate) {
    return res.status(400).json({
      success: false,
      message: 'Invalid time period. Please select a future time period.',
    })
  }

  try {
    const connection = await pool.getConnection()

    const [existingParkingSlot] = await connection.query(
      'SELECT * FROM parking_slots WHERE id = ?',
      [slot_id],
    )

    if (existingParkingSlot.length === 0) {
      connection.release()
      return res.status(200).json({ success: false, message: 'Parking slot not found' })
    }

    const [existingReservation] = await connection.query(
      'SELECT * FROM customers WHERE slot_id = ? AND park_end_time < ? AND deleted = 0',
      [slot_id, park_end_time],
    )

    if (existingReservation.length > 0) {
      connection.release()
      return res.status(400).json({
        success: false,
        message: 'Parking slot is already reserved for the selected time period',
      })
    }

    const [rows] = await connection.query(
      'INSERT INTO customers (slot_id, plate, park_start_time, park_end_time) VALUES (?, ?, ?, ?)',
      [slot_id, plate, park_start_time, park_end_time],
    )
    connection.release()
    res.status(201).json({ success: true, message: 'Parking slot reserved successfully' })
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: 'Failed to reserve parking slot', error: error.message })
  }
})

app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' })
})

app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`)
  console.log(`📱 Environment: ${process.env.NODE_ENV || 'development'}`)
})

module.exports = app
