const fs = require('fs')
const path = require('path')
const request = require('supertest')
const mysql = require('mysql2/promise')
const dotenv = require('dotenv').config()

const api = request('http://localhost:5000')

const testPool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'sonrisa_user',
  password: process.env.DB_PASSWORD || 'sonrisa_password',
  database: process.env.DB_NAME || 'sonrisa_db',
  waitForConnections: true,
  connectionLimit: 5,
  queueLimit: 0,
})

let normalSlotId
let familySlotId
let accessibleSlotId
let reservedPlate

function shortPlate(prefix) {
  return `${prefix}${Date.now().toString().slice(-5)}`
}

function toSqlDateTime(date) {
  return date.toISOString().slice(0, 19).replace('T', ' ')
}

describe('Parking API integration tests', () => {
  beforeAll(async () => {
    const [normalRows] = await testPool.query(
      "SELECT id FROM parking_slots WHERE type = 'NORMAL' ORDER BY id LIMIT 1",
    )
    const [familyRows] = await testPool.query(
      "SELECT id FROM parking_slots WHERE type = 'FAMILY' ORDER BY id LIMIT 1",
    )
    const [accessibleRows] = await testPool.query(
      "SELECT id FROM parking_slots WHERE type = 'ACCESSIBLE' ORDER BY id LIMIT 1",
    )

    if (normalRows.length === 0 || familyRows.length === 0 || accessibleRows.length === 0) {
      throw new Error('Missing required parking slot types in seed data')
    }

    normalSlotId = normalRows[0].id
    familySlotId = familyRows[0].id
    accessibleSlotId = accessibleRows[0].id
  })

  afterAll(async () => {
    if (reservedPlate) {
      await testPool.query('DELETE FROM customers WHERE plate = ?', [reservedPlate])
    }
    await testPool.end()
  })

  test('00 - Database availability check', async () => {
    const [rows] = await testPool.query('SELECT 1 AS ok')
    expect(rows[0].ok).toBe(1)
  })

  test('GET /v1/getParkingSlots returns all slots view', async () => {
    const response = await api.get('/v1/getParkingSlots')

    expect(response.status).toBe(200)
    expect(Array.isArray(response.body)).toBe(true)
  })

  test('GET /v1/getParkingSlots?reserved=true returns reserved view', async () => {
    const response = await api.get('/v1/getParkingSlots').query({ reserved: 'true' })

    expect(response.status).toBe(200)
    expect(Array.isArray(response.body)).toBe(true)
  })

  test('GET /v1/getParkingSlot rejects missing query params', async () => {
    const response = await api.get('/v1/getParkingSlot')

    expect(response.status).toBe(400)
    expect(response.body.success).toBe(false)
  })

  test('GET /v1/getParkingSlot rejects when both query params are provided', async () => {
    const response = await api
      .get('/v1/getParkingSlot')
      .query({ parkingSlot: normalSlotId, plate: 'ABC-001' })

    expect(response.status).toBe(400)
    expect(response.body.success).toBe(false)
  })

  test('GET /v1/getParkingSlot returns a slot by id query', async () => {
    const response = await api.get('/v1/getParkingSlot').query({ parkingSlot: normalSlotId })

    expect(response.status).toBe(200)
    expect(Array.isArray(response.body) || response.body.success === false).toBe(true)
  })

  test('POST /v1/reserveParkingSlot rejects missing required fields', async () => {
    const response = await api.post('/v1/reserveParkingSlot').send({
      slot_id: normalSlotId,
      plate: 'TMISS001',
    })

    expect(response.status).toBe(400)
    expect(response.body.success).toBe(false)
  })

  test('POST /v1/reserveParkingSlot rejects invalid period', async () => {
    const start = new Date(Date.now() + 2 * 60 * 60 * 1000)
    const end = new Date(Date.now() + 60 * 60 * 1000)

    const response = await api.post('/v1/reserveParkingSlot').send({
      slot_id: normalSlotId,
      plate: 'TBAD001',
      park_start_time: toSqlDateTime(start),
      park_end_time: toSqlDateTime(end),
    })

    expect(response.status).toBe(400)
    expect(response.body.success).toBe(false)
  })

  test('POST /v1/reserveParkingSlot enforces FAMILY access rules', async () => {
    const start = new Date('2030-01-01T10:00:00Z')
    const end = new Date('2030-01-01T12:00:00Z')

    const denied = await api.post('/v1/reserveParkingSlot').send({
      slot_id: familySlotId,
      plate: 'TFNO001',
      park_start_time: toSqlDateTime(start),
      park_end_time: toSqlDateTime(end),
      is_family: false,
    })

    expect(denied.status).toBe(200)
    expect(denied.body.success).toBe(false)

    const allowed = await api.post('/v1/reserveParkingSlot').send({
      slot_id: familySlotId,
      plate: 'TFOK001',
      park_start_time: toSqlDateTime(start),
      park_end_time: toSqlDateTime(end),
      is_family: true,
    })

    if (allowed.status === 201) {
      await testPool.query('DELETE FROM customers WHERE plate = ?', ['TFOK001'])
    }

    expect([201, 400]).toContain(allowed.status)
  })

  test('POST /v1/reserveParkingSlot enforces ACCESSIBLE access rules', async () => {
    const start = new Date('2030-01-02T10:00:00Z')
    const end = new Date('2030-01-02T12:00:00Z')

    const denied = await api.post('/v1/reserveParkingSlot').send({
      slot_id: accessibleSlotId,
      plate: 'TANO001',
      park_start_time: toSqlDateTime(start),
      park_end_time: toSqlDateTime(end),
      is_accessible: false,
    })

    expect(denied.status).toBe(200)
    expect(denied.body.success).toBe(false)

    const allowed = await api.post('/v1/reserveParkingSlot').send({
      slot_id: accessibleSlotId,
      plate: 'TAOK001',
      park_start_time: toSqlDateTime(start),
      park_end_time: toSqlDateTime(end),
      is_accessible: true,
    })

    if (allowed.status === 201) {
      await testPool.query('DELETE FROM customers WHERE plate = ?', ['TAOK001'])
    }

    expect([201, 400]).toContain(allowed.status)
  })

  test('POST /v1/reserveParkingSlot creates a reservation on NORMAL slot', async () => {
    const start = new Date('2030-01-03T10:00:00Z')
    const end = new Date('2030-01-03T12:00:00Z')
    reservedPlate = shortPlate('TAPI')

    const response = await api.post('/v1/reserveParkingSlot').send({
      slot_id: normalSlotId,
      plate: reservedPlate,
      park_start_time: toSqlDateTime(start),
      park_end_time: toSqlDateTime(end),
    })

    expect(response.status).toBe(201)
    expect(response.body.success).toBe(true)
  })

  test('POST /v1/reserveParkingSlot rejects overlapping reservation', async () => {
    const overlapStart = new Date('2030-01-03T11:00:00Z')
    const overlapEnd = new Date('2030-01-03T13:00:00Z')

    const response = await api.post('/v1/reserveParkingSlot').send({
      slot_id: normalSlotId,
      plate: shortPlate('TOVR'),
      park_start_time: toSqlDateTime(overlapStart),
      park_end_time: toSqlDateTime(overlapEnd),
    })

    expect(response.status).toBe(400)
    expect(response.body.success).toBe(false)
  })

  test('DELETE /v1/cancelReservation rejects missing plate', async () => {
    const response = await api.delete('/v1/cancelReservation')

    expect(response.status).toBe(400)
    expect(response.body.success).toBe(false)
  })

  test('DELETE /v1/cancelReservation cancels reservation for plate', async () => {
    const response = await api.delete('/v1/cancelReservation').query({ plate: reservedPlate })

    expect(response.status).toBe(200)
    expect(response.body.success).toBe(true)
  })
})
