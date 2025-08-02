const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  phone: {
    type: String,
    required: true
  },
  userType: {
    type: String,
    enum: ['vendor', 'supplier'],
    required: true
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  profileImage: {
    type: String,
    default: null
  },
  address: {
    street: String,
    city: String,
    state: String,
    pincode: String,
    coordinates: {
      lat: Number,
      lng: Number
    }
  },
  // Vendor specific fields
  businessName: {
    type: String,
    required: function() { return this.userType === 'vendor'; }
  },
  businessType: {
    type: String,
    enum: ['street-food', 'restaurant', 'cafe', 'catering', 'other'],
    required: function() { return this.userType === 'vendor'; }
  },
  // Supplier specific fields
  companyName: {
    type: String,
    required: function() { return this.userType === 'supplier'; }
  },
  gstNumber: {
    type: String,
    required: function() { return this.userType === 'supplier'; }
  },
  businessLicense: {
    type: String,
    required: function() { return this.userType === 'supplier'; }
  },
  rating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  totalRatings: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Index for geospatial queries
userSchema.index({ "address.coordinates": "2dsphere" });

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Calculate average rating
userSchema.methods.updateRating = function(newRating) {
  this.totalRatings += 1;
  this.rating = ((this.rating * (this.totalRatings - 1)) + newRating) / this.totalRatings;
};

module.exports = mongoose.model('User', userSchema);
