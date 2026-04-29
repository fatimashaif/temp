const express = require('express')
const multer = require('multer')
const { z } = require('zod')
const { reconcilePayments } = require('./recouncli')

const upload = multer({ storage: multer.memoryStorage() })
const router = express.Router()
const reconciliationRuns = []

function splitCsvLine(line) {
  const cells = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (char === ',' && !inQuotes) {
      cells.push(current.trim())
      current = ''
      continue
    }

    current += char
  }

  cells.push(current.trim())
  return cells.map((value) => value.replace(/^"|"$/g, ''))
}

function parseCsvText(csvText) {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  if (lines.length === 0) {
    throw new Error('CSV file is empty')
  }

  const headers = splitCsvLine(lines[0]).map((header) => header.trim())
  const requiredHeaders = [
    'transactionId',
    'amount',
    'currency',
    'valueDate',
    'description',
    'reference',
  ]

  for (const requiredHeader of requiredHeaders) {
    if (!headers.includes(requiredHeader)) {
      throw new Error(`Missing CSV header: ${requiredHeader}`)
    }
  }

  return lines.slice(1).map((line, index) => {
    const values = splitCsvLine(line)
    const record = {}

    headers.forEach((header, idx) => {
      record[header] = values[idx] ?? ''
    })

    return {
      transactionId: String(record.transactionId ?? '').trim(),
      amount: Number(record.amount),
      currency: String(record.currency ?? '').trim(),
      valueDate: String(record.valueDate ?? '').trim(),
      description: String(record.description ?? '').trim(),
      reference: String(record.reference ?? '').trim(),
    }
  })
}

function buildRunResult(result) {
  return {
    ...result,
    matchedCount: result.matched.length,
    unmatchedCount: result.unmatched.bankOnly.length + result.unmatched.systemOnly.length,
    difference: result.summary.difference,
    status: 'complete',
  }
}

const ReconcileRequestSchema = z.object({
  bankData: z.array(
    z.object({
      transactionId: z.string(),
      amount: z.number(),
      currency: z.string(),
      valueDate: z.string(),
      description: z.string(),
      reference: z.string(),
    }),
  ),
  periodStart: z.string().refine((value) => {
    const date = new Date(value)
    return !Number.isNaN(date.getTime())
  }, { message: 'Invalid datetime' }),
  periodEnd: z.string().refine((value) => {
    const date = new Date(value)
    return !Number.isNaN(date.getTime())
  }, { message: 'Invalid datetime' }),
  notes: z.string().optional(),
})

router.post('/reconcile', async (req, res) => {
  try {
    const parsed = ReconcileRequestSchema.parse(req.body)
    const runId = crypto.randomUUID()
    const result = await reconcilePayments(
      parsed.bankData,
      new Date(parsed.periodStart),
      new Date(parsed.periodEnd),
    )

    const run = {
      id: runId,
      notes: parsed.notes ?? '',
      createdAt: new Date().toISOString(),
      result: buildRunResult(result),
    }
    reconciliationRuns.push(run)

    res.status(200).json({ runId, run })
  } catch (error) {
    res.status(500).json({ error: error?.stack ?? String(error) })
  }
})

router.post('/reconcile/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'CSV file is required' })
    }

    const { periodStart, periodEnd, notes } = req.body
    if (!periodStart || !periodEnd) {
      return res.status(400).json({ error: 'periodStart and periodEnd are required' })
    }

    const csv = req.file.buffer.toString('utf8')
    const bankData = parseCsvText(csv)
    const parsed = ReconcileRequestSchema.parse({ bankData, periodStart, periodEnd, notes })

    const runId = crypto.randomUUID()
    const result = await reconcilePayments(
      parsed.bankData,
      new Date(parsed.periodStart),
      new Date(parsed.periodEnd),
    )

    const run = {
      id: runId,
      notes: parsed.notes ?? '',
      createdAt: new Date().toISOString(),
      result: buildRunResult(result),
    }
    reconciliationRuns.push(run)

    res.status(200).json({ runId, run })
  } catch (error) {
    res.status(500).json({ error: error?.stack ?? String(error) })
  }
})

router.get('/reconcile/:id', async (req, res) => {
  const id = req.params.id
  const run = reconciliationRuns.find((entry) => entry.id === id)
  if (!run) {
    return res.status(404).json({ error: 'Run not found' })
  }

  res.json({
    id: run.id,
    notes: run.notes,
    createdAt: run.createdAt,
    ...run.result,
  })
})

router.get('/reconcile', async (req, res) => {
  console.log('Received query:', req.query)
  const id = req.query.id
  if (!id) {
    const runs = reconciliationRuns.map((entry) => ({
      id: entry.id,
      notes: entry.notes,
      createdAt: entry.createdAt,
      ...entry.result,
    }))
    return res.json({ runs })
  }

  const run = reconciliationRuns.find((entry) => entry.id === id)
  if (!run) {
    return res.status(404).json({ error: 'Run not found' })
  }

  res.json({
    id: run.id,
    notes: run.notes,
    createdAt: run.createdAt,
    ...run.result,
  })
})

module.exports = router
