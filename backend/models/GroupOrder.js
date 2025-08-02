const mongoose = require('mongoose');

const groupOrderSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  creator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  targetQuantity: {
    type: Number,
    required: true,
    min: 1
  },
  currentQuantity: {
    type: Number,
    default: 0
  },
  maxParticipants: {
    type: Number,
    default: 50
  },
  participants: [{
    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      min: 1
    },
    joinedAt: {
      type: Date,
      default: Date.now
    }
  }],
  pricePerUnit: {
    type: Number,
    required: true
  },
  estimatedSavings: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['active', 'target_reached', 'ordered', 'delivered', 'cancelled'],
    default: 'active'
  },
  deadline: {
    type: Date,
    required: true
  },
  deliveryDate: {
    type: Date
  },
  deliveryLocation: {
    address: String,
    coordinates: {
      lat: Number,
      lng: Number
    }
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'partial', 'completed'],
    default: 'pending'
  },
  orderPlacedAt: {
    type: Date
  },
  deliveredAt: {
    type: Date
  },
  notes: {
    type: String
  },
  chatMessages: [{
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    message: {
      type: String,
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

// Index for efficient queries
groupOrderSchema.index({ status: 1, deadline: 1 });
groupOrderSchema.index({ product: 1, status: 1 });
groupOrderSchema.index({ creator: 1 });
groupOrderSchema.index({ 'participants.vendor': 1 });

// Calculate progress percentage
groupOrderSchema.virtual('progressPercentage').get(function() {
  return Math.min((this.currentQuantity / this.targetQuantity) * 100, 100);
});

// Check if target is reached
groupOrderSchema.virtual('isTargetReached').get(function() {
  return this.currentQuantity >= this.targetQuantity;
});

// Add participant to group order
groupOrderSchema.methods.addParticipant = function(vendorId, quantity) {
  // Check if vendor already participated
  const existingParticipant = this.participants.find(p => p.vendor.toString() === vendorId.toString());
  
  if (existingParticipant) {
    existingParticipant.quantity += quantity;
  } else {
    this.participants.push({
      vendor: vendorId,
      quantity: quantity
    });
  }
  
  this.currentQuantity += quantity;
  
  // Update status if target reached
  if (this.currentQuantity >= this.targetQuantity && this.status === 'active') {
    this.status = 'target_reached';
  }
};

// Remove participant from group order
groupOrderSchema.methods.removeParticipant = function(vendorId) {
  const participantIndex = this.participants.findIndex(p => p.vendor.toString() === vendorId.toString());
  
  if (participantIndex !== -1) {
    const removedQuantity = this.participants[participantIndex].quantity;
    this.participants.splice(participantIndex, 1);
    this.currentQuantity -= removedQuantity;
    
    // Update status if below target
    if (this.currentQuantity < this.targetQuantity && this.status === 'target_reached') {
      this.status = 'active';
    }
  }
};

// Add chat message
groupOrderSchema.methods.addMessage = function(senderId, message) {
  this.chatMessages.push({
    sender: senderId,
    message: message
  });
};

module.exports = mongoose.model('GroupOrder', groupOrderSchema);
