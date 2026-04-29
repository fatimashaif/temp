import { useState, useEffect, FormEvent } from 'react'

interface ReconciliationRun {
  id: string
  periodStart: string
  periodEnd: string
  matchedCount: number
  unmatchedCount: number
  difference: number
  status: 'pending' | 'running' | 'complete' | 'failed'
}

function getBadgeClass(status: ReconciliationRun['status']) {
  switch (status) {
    case 'pending':
      return 'badge badge-pending'
    case 'running':
      return 'badge badge-running'
    case 'complete':
      return 'badge badge-complete'
    case 'failed':
      return 'badge badge-failed'
    default:
      return 'badge'
  }
}

export default function ReconciliationDashboard() {
  const [runs, setRuns] = useState<ReconciliationRun[]>([])
  const [error, setError] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    let mounted = true

    async function loadRuns() {
      try {
        const res = await fetch('http://localhost:3000/api/reconcile')
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`)
        }
        const data = await res.json()
        if (mounted) {
          setRuns(data.runs ?? [])
          setError(null)
        }
      } catch (err) {
        if (mounted) {
          setError('Unable to load reconciliation runs')
        }
      }
    }

    loadRuns()
    const interval = window.setInterval(loadRuns, 3000)
    return () => {
      mounted = false
      window.clearInterval(interval)
    }
  }, [])

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setUploadError(null)
    setUploadSuccess(null)

    if (!file) {
      setUploadError('Please choose a CSV file.')
      return
    }
    if (!periodStart || !periodEnd) {
      setUploadError('Please provide both period start and end dates.')
      return
    }

    const formData = new FormData()
    formData.append('file', file)
    formData.append('periodStart', new Date(periodStart).toISOString())
    formData.append('periodEnd', new Date(periodEnd).toISOString())
    if (notes) {
      formData.append('notes', notes)
    }

    try {
      const res = await fetch('http://localhost:3000/api/reconcile/upload', {
        method: 'POST',
        body: formData,
      })
      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error ?? `HTTP ${res.status}`)
      }
      await res.json()
      setUploadSuccess('CSV uploaded and reconciliation run created.')
      setFile(null)
      setPeriodStart('')
      setPeriodEnd('')
      setNotes('')
      setTimeout(() => setUploadSuccess(null), 4000)
    } catch (err: any) {
      setUploadError(err.message || 'Failed to upload CSV.')
    }
  }

  const formatAmount = (amount: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount)

  return (
    <section className="dashboard-card">
      <div className="dashboard-header">
        <h2>Reconciliation Runs</h2>
        <p>Polling the backend API every 3 seconds.</p>
      </div>

      <form className="upload-form" onSubmit={handleUpload}>
        <div className="form-row">
          <label>
            CSV File
            <input
              type="file"
              accept=".csv"
              onChange={(event) => {
                const selected = event.target.files?.[0] ?? null
                setFile(selected)
              }}
            />
          </label>
        </div>

        <div className="form-row">
          <label>
            Period Start
            <input
              type="datetime-local"
              value={periodStart}
              onChange={(event) => setPeriodStart(event.target.value)}
            />
          </label>

          <label>
            Period End
            <input
              type="datetime-local"
              value={periodEnd}
              onChange={(event) => setPeriodEnd(event.target.value)}
            />
          </label>
        </div>

        <div className="form-row">
          <label>
            Notes
            <input
              type="text"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Optional notes"
            />
          </label>
        </div>

        <div className="form-actions">
          <button type="submit">Upload CSV</button>
        </div>
      </form>

      {uploadError ? <div className="alert">{uploadError}</div> : null}
      {uploadSuccess ? <div className="success">{uploadSuccess}</div> : null}

      {error ? <div className="alert">{error}</div> : null}

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Period</th>
              <th>Matched</th>
              <th>Unmatched</th>
              <th>Discrepancy</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {runs.length === 0 ? (
              <tr>
                <td colSpan={5} className="empty-row">
                  No reconciliation runs found.
                </td>
              </tr>
            ) : (
              runs.map((run) => (
                <tr key={run.id}>
                  <td>
                    {run.periodStart} – {run.periodEnd}
                  </td>
                  <td>{run.matchedCount}</td>
                  <td>{run.unmatchedCount}</td>
                  <td>{formatAmount(run.difference)}</td>
                  <td>
                    <span className={getBadgeClass(run.status)}>{run.status}</span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
