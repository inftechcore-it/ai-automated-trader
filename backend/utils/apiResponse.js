export function ok(res, data = {}, status = 200) {
  return res.status(status).json({ success: true, ...data });
}

export function fail(res, status, message, code = 'ERROR', details) {
  return res.status(status).json({ success: false, message, code, details });
}
