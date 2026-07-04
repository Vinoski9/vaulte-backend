// Must run AFTER `protect`, since it relies on req.user being set from the JWT.
const isAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access only' })
  }
  next()
}

module.exports = isAdmin