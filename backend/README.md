# Reconciliation Node.js App

A simple Node.js application with an Express route at `/api/reconcile`.

## Files

- `server.js` — app entrypoint
- `route.js` — Express route definitions
- `recouncli.js` — reconciliation service logic
- `package.json` — package definition

## Install

Run:

```bash
npm install
```

If PowerShell blocks `npm`, use `cmd.exe` or adjust your execution policy.

## Start

```bash
npm start
```

## API

- `POST /api/reconcile`
- `GET /api/reconcile?id=<runId>`

Request body example for POST:

```json
{
  "bankData": [
    {
      "transactionId": "tx-1",
      "amount": 19.99,
      "currency": "USD",
      "valueDate": "2026-04-01T10:00:00Z",
      "description": "Payment",
      "reference": "REF-1"
    }
  ],
  "periodStart": "2026-04-01T00:00:00Z",
  "periodEnd": "2026-04-30T23:59:59Z"
}
```
