import ReconciliationDashboard from './ReconciliationDashboard'

function App() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>Reconciliation Dashboard</h1>
        <p>Live status from the backend reconciliation API.</p>
      </header>
      <main>
        <ReconciliationDashboard />
      </main>
    </div>
  )
}

export default App
