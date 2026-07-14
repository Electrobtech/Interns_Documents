const express = require('express');
const cors = require('cors');
const { pool, authenticate } = require('@lead/shared');

const app = express();
app.use(cors());
app.use(express.json());
app.use(authenticate);

app.get('/health', (_req, res) => res.json({ service: 'template', ok: true }));

// TODO: implement your routes here. Always scope queries by
// req.user.organizationId for multi-tenant isolation.

const PORT = process.env.PORT || 4009;
app.listen(PORT, () => console.log(`template-service on :${PORT}`));
