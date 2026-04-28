const express = require('express')
const { z } = require('zod')
const { reconcilePayments } = require('./recouncli')

const router = express.Router()
const reconciliationRuns = []

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
  periodStart: z.string().datetime(),
  periodEnd: z.string().datetime(),
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

    res.status(200).json({ runId, result })
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
