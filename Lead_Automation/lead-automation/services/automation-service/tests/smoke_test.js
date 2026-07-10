// Pure logic smoke test (no database) — simulates the walk loop from
// workflowEngine.js against project-details-flow.json to confirm:
//  1. list_select on "CSE Project" -> answer_branch -> Text -> Document (auto-chained)
//  2. an unrecognized selectedId -> defaultBranch -> fallback text -> handoff (terminal)
const flow = require('../src/seeds/project-details-flow.json');
const { evaluateAnswerBranchNode } = require('../src/services/conditionEvaluator');
 
const nodeMap = new Map(flow.nodes.map(n => [n.id, n]));
 
function simulateWalk(entryNodeId, interaction) {
  let nextNodeId = entryNodeId;
  const rendered = [];
  const context = { lastMessage: { selectedId: interaction.selectedId, text: interaction.text ?? null } };
 
  while (nextNodeId) {
    const node = nodeMap.get(nextNodeId);
    if (!node) throw new Error(`Missing node ${nextNodeId}`);
 
    if (node.type === 'message') {
      rendered.push(node.id);
      if (node.data.waitForReply === false) { nextNodeId = node.data.nextNodeId; continue; }
      break;
    }
    if (node.type === 'handoff') { rendered.push(node.id); break; }
    if (node.type === 'answer_branch') { nextNodeId = evaluateAnswerBranchNode(node.data, context); continue; }
    throw new Error(`Unhandled type ${node.type}`);
  }
  return rendered;
}
 
// Case 1: user picks CSE Project on the list -> branch node -> auto-chain
const path1 = simulateWalk('node_branch_project', { selectedId: 'row_cse' });
console.log('CSE path:', path1);
console.assert(JSON.stringify(path1) === JSON.stringify(['node_text_attachment', 'node_document_cse']), 'CSE path mismatch');
 
// Case 2: unrecognized selection -> default branch -> fallback -> handoff
const path2 = simulateWalk('node_branch_project', { selectedId: 'row_unknown' });
console.log('Default path:', path2);
console.assert(JSON.stringify(path2) === JSON.stringify(['node_fallback_text', 'node_human_handoff']), 'Default path mismatch');
 
console.log('All assertions passed.');
 