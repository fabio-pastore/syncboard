const jwt = require('jsonwebtoken');

/**
 * Express middleware that verifies the JWT token from the Authorization header.
 *
 * Extracts the token from the `Bearer <token>` format, verifies it using the
 * JWT_SECRET from environment variables, and attaches the decoded user payload
 * (containing userId and username) to `req.user`. If the token is missing,
 * malformed, or invalid, the request is rejected with a 401 Unauthorized status.
 *
 * @param {import('express').Request} req - The Express request object.
 * @param {import('express').Response} res - The Express response object.
 * @param {import('express').NextFunction} next - The next middleware function.
 * @returns {void}
 */
function authMiddleware(req, res, next) {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
        return res.status(401).json({ error: "Unauthorized" });
    }

    const token = header.split(' ')[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.userId = decoded.userId;
        next();
    } catch (err) {
        return res.status(401).json({ error: "Unauthorized - Invalid token : " });
    }
}

module.exports = authMiddleware;