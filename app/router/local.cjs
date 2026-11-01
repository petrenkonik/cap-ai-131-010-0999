// Local-only approuter launcher: same routes as xs-app.json, but without XSUAA
// (authenticationMethod: none) and with the srv-api destination pointing at the
// local CAP server. Production (BTP) uses plain `npm start` with xs-app.json.
const approuter = require('@sap/approuter')

process.env.destinations ??= JSON.stringify([
  { name: 'srv-api', url: process.env.SRV_API_URL ?? 'http://localhost:4004' }
])

const xsappConfig = { ...require('./xs-app.json'), authenticationMethod: 'none' }

approuter().start({ port: process.env.PORT ?? 5100, xsappConfig })
