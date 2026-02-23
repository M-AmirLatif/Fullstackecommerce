const mongoose = require('mongoose')

const orderSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  idempotencyKey: {
    type: String,
    unique: true,
    sparse: true,
  },
  customerName: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
  },
  shipping: {
    phone: String,
    address: String,
    city: String,
    state: String,
    zip: String,
    country: String,
  },
  payment: {
    provider: { type: String, default: 'demo' },
    status: {
      type: String,
      enum: ['pending', 'succeeded', 'failed', 'refunded'],
      default: 'pending',
    },
    transactionId: { type: String, default: '' },
  },
  paidAt: {
    type: Date,
    default: null,
  },
  items: [
    {
      product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
      },
      name: String,
      price: Number,
      quantity: Number,
    },
  ],
  totalAmount: {
    type: Number,
    required: true,
  },
  status: {
    type: String,
    enum: ['Pending', 'Paid', 'Confirmed', 'Shipped', 'Delivered', 'Cancelled'],
    default: 'Pending',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
})

module.exports = mongoose.models.Order || mongoose.model('Order', orderSchema)
