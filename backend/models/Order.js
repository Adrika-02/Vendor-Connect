const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  orderNumber: {
    type: String,
    unique: true,
    required: true
  },
  vendor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  supplier: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  orderType: {
    type: String,
    enum: ['individual', 'group'],
    required: true
  },
  groupOrder: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'GroupOrder',
    required: function() { return this.orderType === 'group'; }
  },
  items: [{
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      min: 1
    },
    unitPrice: {
      type: Number,
      required: true
    },
    totalPrice: {
      type: Number,
      required: true
    },
    discountApplied: {
      type: Number,
      default: 0
    }
  }],
  totalAmount: {
    type: Number,
    required: true
  },
  discountAmount: {
    type: Number,
    default: 0
  },
  finalAmount: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'],
    default: 'pending'
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed', 'refunded'],
    default: 'pending'
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'upi', 'card', 'bank_transfer'],
    default: 'cash'
  },
  deliveryAddress: {
    street: String,
    city: String,
    state: String,
    pincode: String,
    coordinates: {
      lat: Number,
      lng: Number
    }
  },
  expectedDeliveryDate: {
    type: Date
  },
  actualDeliveryDate: {
    type: Date
  },
  trackingInfo: {
    trackingNumber: String,
    carrier: String,
    updates: [{
      status: String,
      message: String,
      timestamp: {
        type: Date,
        default: Date.now
      },
      location: String
    }]
  },
  notes: {
    vendorNotes: String,
    supplierNotes: String,
    deliveryNotes: String
  },
  rating: {
    score: {
      type: Number,
      min: 1,
      max: 5
    },
    review: String,
    ratedAt: Date
  }
}, {
  timestamps: true
});

// Generate order number before saving
orderSchema.pre('save', async function(next) {
  if (!this.orderNumber) {
    const date = new Date();
    const dateStr = date.getFullYear().toString() + 
                   (date.getMonth() + 1).toString().padStart(2, '0') + 
                   date.getDate().toString().padStart(2, '0');
    
    // Find the last order of the day
    const lastOrder = await this.constructor.findOne({
      orderNumber: new RegExp(`^VC${dateStr}`)
    }).sort({ orderNumber: -1 });
    
    let sequence = 1;
    if (lastOrder) {
      const lastSequence = parseInt(lastOrder.orderNumber.slice(-4));
      sequence = lastSequence + 1;
    }
    
    this.orderNumber = `VC${dateStr}${sequence.toString().padStart(4, '0')}`;
  }
  next();
});

// Index for efficient queries
orderSchema.index({ vendor: 1, createdAt: -1 });
orderSchema.index({ supplier: 1, createdAt: -1 });
orderSchema.index({ status: 1 });
orderSchema.index({ orderNumber: 1 });
orderSchema.index({ groupOrder: 1 });

// Add tracking update
orderSchema.methods.addTrackingUpdate = function(status, message, location = null) {
  this.trackingInfo.updates.push({
    status,
    message,
    location
  });
};

// Calculate savings compared to individual pricing
orderSchema.methods.calculateSavings = function() {
  let totalSavings = 0;
  this.items.forEach(item => {
    totalSavings += item.discountApplied * item.quantity;
  });
  return totalSavings;
};

module.exports = mongoose.model('Order', orderSchema);
