"""POST /ai-agents/sales/draft-followup — grounds generation in the org's
sales knowledge base and the real lead record (name/stage/score/channel).

The LLM provider and embedding provider are mocked at their module
boundaries (app.services.sales_service.get_llm_provider,
app.knowledge.retriever.get_embedding_provider) rather than hitting real
Groq/Ollama: those aren't reachable in this sandbox (nor in most CI), and
mocking the boundary is also just correct test hygiene — these tests
should verify OUR code (lead lookup, prompt assembly, response validation,
audit logging), not a third-party API's uptime.
"""
from __future__ import annotations

import json
from unittest.mock import AsyncMock, patch

import pytest

from app.llm.base import LLMResponse

pytestmark = pytest.mark.asyncio

_FAKE_DRAFT = {
    "email": {"subject": "Following up", "body": "Hi there, following up on our chat."},
    "whatsapp": {"subject": None, "body": "Hey! Just checking in 🙂"},
    "call_script": {"subject": None, "body": "Open warm. Confirm budget. Handle price objection. Close with next step."},
}


def _mock_llm_provider():
    provider = AsyncMock()
    provider.agenerate = AsyncMock(
        return_value=LLMResponse(content=json.dumps(_FAKE_DRAFT), model="mock")
    )
    return provider


def _mock_empty_retrieval():
    """retriever.retrieve() with no knowledge chunks available — patches
    KnowledgeRetriever.retrieve directly so we never touch the embedding
    provider at all."""
    return patch(
        "app.services.sales_service.KnowledgeRetriever.retrieve",
        new=AsyncMock(return_value=([], True)),
    )


async def test_draft_followup_by_lead_id_pulls_real_lead_fields(client, org):
    with patch("app.services.sales_service.get_llm_provider", return_value=_mock_llm_provider()), \
         _mock_empty_retrieval(), \
         patch(
             "app.services.service_client.get_leads",
             new=AsyncMock(return_value=[
                 {
                     "id": str(org.lead_open_id),
                     "name": "Ananya Singh",
                     "stage": "qualified",
                     "score": 60,
                     "source": "instagram",
                 }
             ]),
         ):
        resp = await client.post(
            "/ai-agents/sales/draft-followup", json={"lead_id": str(org.lead_open_id)}
        )
    assert resp.status_code == 200
    body = resp.json()
    assert body["lead_name"] == "Ananya Singh"
    assert body["email"]["subject"] == "Following up"
    assert body["whatsapp"]["body"].startswith("Hey!")
    assert "opening" not in body["call_script"]["body"].lower()  # real content, not a template placeholder
    assert body["knowledge_sources_used"] == []


async def test_draft_followup_without_lead_id_uses_supplied_fields(client, org):
    with patch("app.services.sales_service.get_llm_provider", return_value=_mock_llm_provider()), \
         _mock_empty_retrieval():
        resp = await client.post(
            "/ai-agents/sales/draft-followup",
            json={"lead_name": "Walk-in Prospect", "company": "Acme Co", "stage": "new"},
        )
    assert resp.status_code == 200
    assert resp.json()["lead_name"] == "Walk-in Prospect"


async def test_draft_followup_malformed_llm_json_falls_back_to_raw_text(client, org):
    """If the LLM doesn't return valid JSON, the endpoint should degrade to
    a raw-text email body rather than 500ing — this is the fallback path
    CONTINUE_PROMPT.md's item 3 was asking to distinguish from a real
    provider failure."""
    provider = AsyncMock()
    provider.agenerate = AsyncMock(
        return_value=LLMResponse(content="Sorry, I can't produce JSON right now.", model="mock")
    )
    with patch("app.services.sales_service.get_llm_provider", return_value=provider), \
         _mock_empty_retrieval():
        resp = await client.post(
            "/ai-agents/sales/draft-followup", json={"lead_name": "Test Lead"}
        )
    assert resp.status_code == 200
    body = resp.json()
    assert "Sorry, I can't produce JSON" in body["email"]["body"]
    # The other two channels must still be well-formed, not missing keys.
    assert body["whatsapp"]["body"] == ""
    assert body["call_script"]["body"] == ""


async def test_draft_followup_embedding_provider_unreachable_degrades_gracefully(client, org):
    """KnowledgeRetriever.retrieve() now wraps the embedding-provider call
    (get_embedding_provider()/embedder.embed()) in a try/except: a
    connection failure there degrades to an empty, low-confidence RAG
    result instead of propagating as an unhandled 500. This is shared
    code, so it also fixes the older POST /sales/run endpoint, which hits
    the same retriever.

    Previously this test asserted the opposite (a raised ConnectionError)
    to document the gap as current, undesired behavior — now that the
    try/except exists, it asserts the graceful 200 it degrades to.
    """
    with patch("app.services.sales_service.get_llm_provider", return_value=_mock_llm_provider()), \
         patch(
             "app.knowledge.retriever.get_embedding_provider",
             side_effect=ConnectionError("embedding provider unreachable"),
         ):
        resp = await client.post(
            "/ai-agents/sales/draft-followup", json={"lead_name": "Test Lead"}
        )
    assert resp.status_code == 200
    body = resp.json()
    assert body["knowledge_sources_used"] == []
    assert body["email"]["subject"] == "Following up"
