/**
 * Resolves a dotted field path ("contact.tags", "lastMessage.text") against
 * the evaluation context built for the current webhook event.
 */
function resolveField(context, fieldPath) {
  return fieldPath.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), context);
}
 
const OPERATORS = {
  equals: (a, b) => a === b,
  not_equals: (a, b) => a !== b,
  contains: (a, b) => Array.isArray(a) ? a.includes(b) : String(a ?? '').includes(b),
  matches_regex: (a, b) => new RegExp(b).test(String(a ?? '')),
  gt: (a, b) => Number(a) > Number(b),
  lt: (a, b) => Number(a) < Number(b),
  in: (a, b) => Array.isArray(b) && b.includes(a)
};
 
/**
 * Evaluates a condition node's rule list against context, first match wins.
 * Falls back to `elseNextNodeId` if nothing matches.
 */
function evaluateConditionNode(nodeData, context) {
  for (const rule of nodeData.rules) {
    const { field, operator, value } = rule.if;
    const fieldValue = resolveField(context, field);
    const op = OPERATORS[operator];
    if (!op) throw new Error(`Unsupported condition operator: ${operator}`);
    if (op(fieldValue, value)) {
      return rule.nextNodeId;
    }
  }
  return nodeData.elseNextNodeId ?? null;
}
 
/**
 * Evaluates an `answer_branch` node (the reference builder's "Conditional
 * Branching" node) — routes purely on the selectedId of the contact's last
 * button/list reply, independent of any other variable/context lookup.
 * First matching branch wins; falls back to `defaultBranch` (the builder's
 * "Default condition" pill) if nothing matches or the contact sent free text.
 */
function evaluateAnswerBranchNode(nodeData, context) {
  const selectedId = context.lastMessage?.selectedId;
  if (selectedId) {
    const match = nodeData.branches.find(b => b.matchOptionId === selectedId);
    if (match) return match.nextNodeId;
  }
  return nodeData.defaultBranch?.nextNodeId ?? null;
}
 
module.exports = { evaluateConditionNode, evaluateAnswerBranchNode, resolveField };