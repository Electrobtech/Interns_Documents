// shared/src/asyncHandler.js
//
// Express 4 (this repo's version) does not catch rejected promises
// returned from async route handlers — that's only automatic in
// Express 5. An `async (req, res) => { ... await pool.query(...) }`
// handler that throws produces an unhandled promise rejection, and
// Node's default behavior (since v15) is to crash the whole process
// on an unhandled rejection. That's the actual mechanism behind the
// auth-service crash: a bad UUID made a query reject, nothing was
// listening for that rejection, and the process died.
//
// Wrapping every handler in this closes that hole generically — any
// future thrown error (DB down, bad input, a bug) becomes next(err)
// instead of a crash, and lands in the error-handling middleware in
// index.js instead.
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = { asyncHandler };