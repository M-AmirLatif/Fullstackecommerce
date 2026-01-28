const mongoose = require('mongoose')

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    price: {
      type: Number,
      required: true,
    },
    originalPrice: {
      type: Number,
      default: null,
    },
    category: {
      type: String,
      required: true,
    },
    image: {
      type: String,
    },
    description: {
      type: String,
    },
    stock: {
      type: Number,
      default: 0,
    },
    inStock: {
      type: Boolean,
      default: true,
    },
    rating: {
      type: Number,
      min: 0,
      max: 5,
      default: 4.6,
    },
    reviewCount: {
      type: Number,
      min: 0,
      default: 0,
    },
    colors: {
      type: [String],
      default: [],
    },
    highlights: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
  },
)

module.exports = mongoose.models.Product || mongoose.model('Product', productSchema)
