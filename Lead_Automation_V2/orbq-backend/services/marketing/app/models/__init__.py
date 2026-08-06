"""orbq-marketing is a stateless capability host — it owns no domain tables.
Campaign/audience/broadcast persistence lives in orbq-ai-agents (§9.3: only the
platform core is gateway-routed; agent services stay internal-only)."""
