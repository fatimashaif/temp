const express = require('express')
const cors = require('cors')
const route = require('./route')

const app = express()
app.use(cors())
app.use(express.json())
app.use('/api', route)

const port = process.env.PORT || 3000
app.listen(port, () => {
  console.log(`Reconciliation app listening on http://localhost:${port}`)
})
