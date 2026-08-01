fetch('https://gst-insights-api.p.rapidapi.com')
  .then(r => console.log('OK', r.status))
  .catch(e => console.log('FAIL', e.message, e.cause && (e.cause.message || e.cause)));