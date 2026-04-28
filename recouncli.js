const payments = [
  {
    id: 'p1',
    externalRef: 'INV-1001',
    amount: 19.99,
    currency: 'USD',
    createdAt: new Date('2026-04-01T10:00:00Z'),
    status: 'pending',
  },
  {
    id: 'p2',
    externalRef: 'INV-1002',
    amount: 49.5,
    currency: 'USD',
    createdAt: new Date('2026-04-05T12:30:00Z'),
    status: 'pending',
  },
  {
    id: 'p3',
    externalRef: 'INV-1003',
    amount: 120.0,
    currency: 'USD',
    createdAt: new Date('2026-04-07T08:15:00Z'),
    status: 'pending',
  },
]

function findMatch(bankRecord, candidates) {
  return candidates.find((p) => p.amount === bankRecord.amount)
}

function isInPeriod(date, periodStart, periodEnd) {
  return date >= periodStart && date <= periodEnd
}

function parseBankDate(isoString) {
  return new Date(isoString)
}

function calculateDelta(bankAmount, systemAmount) {
  return bankAmount - systemAmount
}

async function markReconciled(paymentId) {
  const payment = payments.find((p) => p.id === paymentId)
  if (payment && payment.status === 'pending') {
    payment.status = 'reconciled'
  }
}

async function reconcilePayments(bankData, periodStart, periodEnd) {
  const systemPayments = payments.filter((payment) =>
    isInPeriod(payment.createdAt, periodStart, periodEnd),
  )

  const matched = []
  const discrepancies = []
  const matchedPaymentIds = new Set()
  const matchedBankIds = new Set()

  for (const bankRecord of bankData) {
    const bankDate = parseBankDate(bankRecord.valueDate)
    if (!isInPeriod(bankDate, periodStart, periodEnd)) continue

    const remaining = systemPayments.filter((p) => !matchedPaymentIds.has(p.id))
    const match = findMatch(bankRecord, remaining)
    if (match) {
      matched.push({ bankRecord, payment: match })
      matchedPaymentIds.add(match.id)
      matchedBankIds.add(bankRecord.transactionId)
      await markReconciled(match.id)
      const delta = calculateDelta(bankRecord.amount, match.amount)
      if (delta !== 0) {
        discrepancies.push({ bankRecord, payment: match, amountDelta: delta })
      }
    }
  }

  const totalBankAmount = bankData.reduce((sum, record) => sum + record.amount, 0)
  const totalSystemAmount = systemPayments.reduce((sum, payment) => sum + payment.amount, 0)
  const difference = calculateDelta(totalBankAmount, totalSystemAmount)

  const bankOnly = bankData.filter((record) => !matchedBankIds.has(record.transactionId))
  const systemOnly = systemPayments.filter((payment) => !matchedPaymentIds.has(payment.id))

  return {
    id: crypto.randomUUID(),
    matched,
    unmatched: { bankOnly, systemOnly },
    discrepancies,
    summary: {
      totalBankAmount,
      totalSystemAmount,
      difference,
    },
  }
}

module.exports = {
  reconcilePayments,
  payments,
}
