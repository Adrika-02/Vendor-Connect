const express = require('express');
const { body, validationResult, query } = require('express-validator');
const Product = require('../models/Product');
const User = require('../models/User');
const { authenticateToken, requireSupplier } = require('../middleware/auth');

const router = express.Router();

// Get all products with filtering and pagination
router.get('/', [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('category').optional().isString(),
  query('minPrice').optional().isFloat({ min: 0 }),
  query('maxPrice').optional().isFloat({ min: 0 }),
  query('search').optional().isString()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Build filter object
    const filter = { isActive: true };
    
    if (req.query.category) {
      filter.category = req.query.category;
    }
    
    if (req.query.minPrice || req.query.maxPrice) {
      filter.price = {};
      if (req.query.minPrice) filter.price.$gte = parseFloat(req.query.minPrice);
      if (req.query.maxPrice) filter.price.$lte = parseFloat(req.query.maxPrice);
    }

    if (req.query.search) {
      filter.$text = { $search: req.query.search };
    }

    const products = await Product.find(filter)
      .populate('supplier', 'name companyName rating isVerified')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Product.countDocuments(filter);

    res.json({
      products,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Products fetch error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get single product by ID
router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate('supplier', 'name companyName rating isVerified address phone');

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    res.json({ product });
  } catch (error) {
    console.error('Product fetch error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create new product (suppliers only)
router.post('/', authenticateToken, requireSupplier, [
  body('name').trim().isLength({ min: 2 }).withMessage('Product name must be at least 2 characters'),
  body('description').trim().isLength({ min: 10 }).withMessage('Description must be at least 10 characters'),
  body('category').isIn(['vegetables', 'fruits', 'grains', 'spices', 'dairy', 'meat', 'seafood', 'oils', 'packaging', 'equipment', 'other']),
  body('price').isFloat({ min: 0 }).withMessage('Price must be a positive number'),
  body('unit').isIn(['kg', 'gram', 'liter', 'ml', 'piece', 'dozen', 'packet', 'box']),
  body('minimumOrderQuantity').isInt({ min: 1 }).withMessage('Minimum order quantity must be at least 1'),
  body('availableQuantity').isInt({ min: 0 }).withMessage('Available quantity must be non-negative')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const productData = {
      ...req.body,
      supplier: req.user._id
    };

    const product = new Product(productData);
    await product.save();

    await product.populate('supplier', 'name companyName rating isVerified');

    res.status(201).json({
      message: 'Product created successfully',
      product
    });
  } catch (error) {
    console.error('Product creation error:', error);
    res.status(500).json({ message: 'Server error during product creation' });
  }
});

// Update product (suppliers only, own products)
router.put('/:id', authenticateToken, requireSupplier, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Check if the supplier owns this product
    if (product.supplier.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to update this product' });
    }

    const allowedUpdates = [
      'name', 'description', 'price', 'availableQuantity', 'minimumOrderQuantity',
      'bulkDiscounts', 'specifications', 'tags', 'isActive', 'images'
    ];

    const updates = {};
    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    ).populate('supplier', 'name companyName rating isVerified');

    res.json({
      message: 'Product updated successfully',
      product: updatedProduct
    });
  } catch (error) {
    console.error('Product update error:', error);
    res.status(500).json({ message: 'Server error during product update' });
  }
});

// Delete product (suppliers only, own products)
router.delete('/:id', authenticateToken, requireSupplier, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Check if the supplier owns this product
    if (product.supplier.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to delete this product' });
    }

    await Product.findByIdAndDelete(req.params.id);

    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Product deletion error:', error);
    res.status(500).json({ message: 'Server error during product deletion' });
  }
});

// Get products by supplier
router.get('/supplier/:supplierId', async (req, res) => {
  try {
    const products = await Product.find({ 
      supplier: req.params.supplierId, 
      isActive: true 
    }).populate('supplier', 'name companyName rating isVerified');

    res.json({ products });
  } catch (error) {
    console.error('Supplier products fetch error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get my products (for suppliers)
router.get('/my/products', authenticateToken, requireSupplier, async (req, res) => {
  try {
    const products = await Product.find({ supplier: req.user._id })
      .sort({ createdAt: -1 });

    res.json({ products });
  } catch (error) {
    console.error('My products fetch error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get product categories
router.get('/meta/categories', (req, res) => {
  const categories = [
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
  ];
  
  res.json({ categories });
});

module.exports = router;
