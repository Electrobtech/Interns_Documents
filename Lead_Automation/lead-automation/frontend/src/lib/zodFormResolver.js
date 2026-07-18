// Tiny react-hook-form <-> zod bridge, hand-rolled instead of pulling in the
// @hookform/resolvers package (not part of the approved dependency list —
// only @tanstack/react-query, zustand, zod, react-hook-form were requested).
// Implements the same contract RHF expects from a `resolver`:
//   (values) => Promise<{ values, errors }>
export function zodResolver(schema) {
  return async (values) => {
    const result = schema.safeParse(values);
    if (result.success) {
      return { values: result.data, errors: {} };
    }
    const errors = {};
    for (const issue of result.error.issues) {
      const path = issue.path.join('.') || '_root';
      if (!errors[path]) {
        errors[path] = { type: issue.code, message: issue.message };
      }
    }
    return { values: {}, errors };
  };
}
