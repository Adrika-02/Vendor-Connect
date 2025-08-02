const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  category: {
    type: String,
    required: true,
    enum: [
      'vegetables',
      'fruits',
      'grains',
      'spices',
      'dairy',
      'meat',
      'seafood',
      'oils',
      'packaging',
      'equipment',
      'other'
    ]
  },
  supplier: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  images: [{
    type: String
  }],
  price: {
    type: Number,
    required: true,
    min: 0
  },
  unit: {
    type: String,
    required: true,
    enum: ['kg', 'gram', 'liter', 'ml', 'piece', 'dozen', 'packet', 'box']
  },
  minimumOrderQuantity: {
    type: Number,
    required: true,
    min: 1
  },
  availableQuantity: {
    type: Number,
    required: true,
    min: 0
  },
  bulkDiscounts: [{
    minQuantity: {
      type: Number,
      required: true
    },
    discountPercentage: {
      type: Number,
      required: true,
      min: 0,
      max: 100
    }
  }],
  specifications: {
    brand: String,
    origin: String,
    quality: {
      type: String,
      enum: ['premium', 'standard', 'economy']
    },
    shelfLife: String,
    storageInstructions: String
  },
  tags: [{
    type: String,
    lowercase: true
  }],
  isActive: {
    type: Boolean,
    default: true
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
  totalSold: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Index for search functionality
productSchema.index({ name: 'text', description: 'text', tags: 'text' });
productSchema.index({ category: 1, supplier: 1 });
productSchema.index({ price: 1 });

// Calculate bulk discount price
productSchema.methods.getBulkPrice = function(quantity) {
  let applicableDiscount = 0;
  
  for (const discount of this.bulkDiscounts) {
    if (quantity >= discount.minQuantity && discount.discountPercentage > applicableDiscount) {
      applicableDiscount = discount.discountPercentage;
    }
  }
  
  return this.price * (1 - applicableDiscount / 100);
};

// Update rating
productSchema.methods.updateRating = function(newRating) {
  this.totalRatings += 1;
  this.rating = ((this.rating * (this.totalRatings - 1)) + newRating) / this.totalRatings;
};

module.exports = mongoose.model('Product', productSchema);
