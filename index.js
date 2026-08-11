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

app.get('/v1/getParkingSlot', async (req, res) => {
  const { parkingSlot, plate } = req.query

  if (parkingSlot && plate) {
    return res.status(400).json({
      success: false,
      message: 'Please provide either parkingSlot or plate, not both',
    })
  }

  if (!plate && !parkingSlot) {
    return res.status(400).json({
      success: false,
      message: 'Missing required query parameter (parkingSlot or plate)',
    })
  }
  let rows = []

  try {
    const connection = await pool.getConnection()
    if (plate) {
      ;[rows] = await connection.query(
        'SELECT parking_slots.*, customers.plate, customers.park_start_time, customers.park_end_time FROM parking_slots LEFT JOIN customers ON parking_slots.id = customers.slot_id WHERE customers.plate = ? AND customers.deleted = 0',
        [plate],
      )
      connection.release()
      if (rows.length === 0) {
        return res
          .status(200)
          .json({ success: false, message: 'No parking slot found for the given plate' })
      }
    }
    if (parkingSlot) {
      ;[rows] = await connection.query(
        'SELECT parking_slots.*, customers.plate, customers.park_start_time, customers.park_end_time FROM parking_slots LEFT JOIN customers ON parking_slots.id = customers.slot_id WHERE parking_slots.id = ? AND customers.deleted = 0',
        [parkingSlot],
      )
      connection.release()
      if (rows.length === 0) {
        return res
          .status(200)
          .json({ success: false, message: 'No parking slot found for the given ID' })
      }
    }
    res.status(200).json(rows)
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: 'Failed to fetch parking slot', error: error.message })
  }
})

app.post('/v1/reserveParkingSlot', async (req, res) => {
  const { slot_id, plate, park_start_time, park_end_time, is_family, is_accessible } = req.body

  if (!slot_id || !plate || !park_start_time || !park_end_time) {
    return res.status(400).json({
      success: false,
      message: 'Missing required fields (slot_id, plate, park_start_time, park_end_time)',
    })
  }

  if (new Date(park_start_time) >= new Date(park_end_time)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid time period. park_start_time must be before park_end_time.',
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

    const allowedTypes = ['NORMAL']
    if (is_family) allowedTypes.push('FAMILY')
    if (is_accessible) allowedTypes.push('ACCESSIBLE')

    const [existingParkingSlot] = await connection.query(
      `SELECT * FROM parking_slots WHERE id = ? AND type IN (?)`,
      [slot_id, allowedTypes],
    )

    if (existingParkingSlot.length === 0) {
      connection.release()
      return res.status(200).json({
        success: false,
        message: 'Parking slot not found or bad attributes (is_family, is_accessible)',
      })
    }

    const [existingReservation] = await connection.query(
      'SELECT * FROM customers WHERE slot_id = ? AND ? < park_end_time AND ? > park_start_time AND deleted = 0',
      [slot_id, park_start_time, park_end_time],
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

app.delete('/v1/cancelReservation', async (req, res) => {
  const { plate } = req.query

  if (!plate) {
    return res.status(400).json({
      success: false,
      message: 'Missing required field (plate)',
    })
  }

  try {
    const connection = await pool.getConnection()

    const [rows] = await connection.query(
      'UPDATE customers SET deleted = 1 WHERE plate = ? AND park_end_time > NOW()',
      [plate],
    )

    connection.release()

    if (rows.affectedRows === 0) {
      return res
        .status(200)
        .json({ success: false, message: 'No reservation found for the given plate' })
    }

    res
      .status(200)
      .json({ success: true, message: rows.affectedRows + ' reservation cancelled successfully' })
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: 'Failed to cancel reservation', error: error.message })
  }
})

app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' })
})

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🚀 Server is running on port ${PORT}`)
    console.log(`📱 Environment: ${process.env.NODE_ENV || 'development'}`)
  })
}

module.exports = app
