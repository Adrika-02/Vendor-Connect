const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Verify JWT token
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ message: 'Access token required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user) {
      return res.status(401).json({ message: 'Invalid token' });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(403).json({ message: 'Invalid or expired token' });
  }
};

// Check if user is a vendor
const requireVendor = (req, res, next) => {
  if (req.user.userType !== 'vendor') {
    return res.status(403).json({ message: 'Vendor access required' });
  }
  next();
};

// Check if user is a supplier
const requireSupplier = (req, res, next) => {
  if (req.user.userType !== 'supplier') {
    return res.status(403).json({ message: 'Supplier access required' });
  }
  next();
};

// Check if user is verified
const requireVerified = (req, res, next) => {
  if (!req.user.isVerified) {
    return res.status(403).json({ message: 'Account verification required' });
  }
  next();
};

module.exports = {
  authenticateToken,
  requireVendor,
  requireSupplier,
  requireVerified
};
