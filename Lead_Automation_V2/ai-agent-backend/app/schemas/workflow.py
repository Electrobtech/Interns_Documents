from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class WorkflowNode(BaseModel):
    id: str
    kind: str  # trigger | condition | action
    type: str = ""
    label: str = ""
    config: dict[str, Any] = Field(default_factory=dict)


class WorkflowEdge(BaseModel):
    from_: str = Field(..., alias="from")
    to: str
    branch: str | None = None  # "yes" | "no" on edges leaving a condition

    model_config = {"populate_by_name": True}


class PromptToNodesIn(BaseModel):
    prompt: str = Field(..., min_length=1, description="Natural-language automation description")


class PromptToNodesOut(BaseModel):
    workflow_name: str = "Untitled workflow"
    nodes: list[WorkflowNode] = Field(default_factory=list)
    edges: list[WorkflowEdge] = Field(default_factory=list)
    summary: str = ""
    warnings: list[Any] = Field(default_factory=list)
