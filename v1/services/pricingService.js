const ServiceCharge = require('../models/serviceChargeModel');
const Tax = require('../models/taxModel');
const Discount = require('../models/discountModel');

class PricingService {
  /**
   * Calculate final price with all charges, taxes, and discounts
   * @param {Object} params - Pricing parameters
   * @param {Number} params.basePrice - Base price of the service
   * @param {String} params.serviceType - Type of service (flights, hotels, etc.)
   * @param {String} params.userRole - User role for role-based discounts
   * @param {String} params.discountCode - Optional discount code
   * @param {String} params.providerCode - Optional provider code for provider-specific discounts
   * @param {String} params.country - Country for tax calculation (default: 'NG')
   * @returns {Object} Detailed price breakdown
   */
  async calculatePrice(params) {
    const {
      basePrice,
      serviceType,
      userRole = 'User',
      discountCode,
      providerCode,
      country = 'NG'
    } = params;

    if (!basePrice || basePrice <= 0) {
      throw new Error('Invalid base price');
    }

    if (!serviceType) {
      throw new Error('Service type is required');
    }

    const breakdown = {
      basePrice,
      serviceCharges: [],
      taxes: [],
      discounts: [],
      subtotal: basePrice,
      totalServiceCharges: 0,
      totalTaxes: 0,
      totalDiscounts: 0,
      finalPrice: basePrice
    };

    // 1. Apply Service Charges
    const serviceCharges = await this.getApplicableServiceCharges(serviceType);
    for (const charge of serviceCharges) {
      const chargeAmount = charge.type === 'percentage'
        ? (breakdown.subtotal * charge.value) / 100
        : charge.value;

      breakdown.serviceCharges.push({
        id: charge._id,
        name: charge.name,
        type: charge.type,
        value: charge.value,
        amount: chargeAmount
      });

      breakdown.totalServiceCharges += chargeAmount;
    }

    breakdown.subtotal += breakdown.totalServiceCharges;

    // 2. Apply Discounts
    const discounts = await this.getApplicableDiscounts({
      serviceType,
      userRole,
      discountCode,
      providerCode
    });

    for (const discount of discounts) {
      let discountValue = 0;
      
      if (discount.type === 'role-based') {
        discountValue = discount.getDiscountForRole(userRole);
      } else {
        discountValue = discount.value || 0;
      }

      let discountAmount = 0;
      if (discount.type === 'percentage' || discount.type === 'role-based') {
        discountAmount = (breakdown.subtotal * discountValue) / 100;
      } else {
        discountAmount = discountValue;
      }

      // Apply max discount limit
      if (discount.maxDiscountAmount && discountAmount > discount.maxDiscountAmount) {
        discountAmount = discount.maxDiscountAmount;
      }

      // Check min purchase amount
      if (discount.minPurchaseAmount && breakdown.subtotal < discount.minPurchaseAmount) {
        continue; // Skip this discount
      }

      breakdown.discounts.push({
        id: discount._id,
        name: discount.name,
        code: discount.code,
        type: discount.type,
        value: discountValue,
        amount: discountAmount
      });

      breakdown.totalDiscounts += discountAmount;

      // If discount is not stackable, break after first discount
      if (!discount.isStackable) {
        break;
      }
    }

    breakdown.subtotal -= breakdown.totalDiscounts;

    // 3. Apply Taxes
    const taxes = await this.getApplicableTaxes(serviceType, country);
    for (const tax of taxes) {
      const taxAmount = (breakdown.subtotal * tax.rate) / 100;

      breakdown.taxes.push({
        id: tax._id,
        name: tax.name,
        type: tax.type,
        rate: tax.rate,
        amount: taxAmount,
        isInclusive: tax.isInclusive
      });

      if (!tax.isInclusive) {
        breakdown.totalTaxes += taxAmount;
      }
    }

    breakdown.finalPrice = breakdown.subtotal + breakdown.totalTaxes;

    // Round to 2 decimal places
    breakdown.finalPrice = Math.round(breakdown.finalPrice * 100) / 100;
    breakdown.subtotal = Math.round(breakdown.subtotal * 100) / 100;
    breakdown.totalServiceCharges = Math.round(breakdown.totalServiceCharges * 100) / 100;
    breakdown.totalTaxes = Math.round(breakdown.totalTaxes * 100) / 100;
    breakdown.totalDiscounts = Math.round(breakdown.totalDiscounts * 100) / 100;

    return breakdown;
  }

  /**
   * Get applicable service charges for a service type
   */
  async getApplicableServiceCharges(serviceType) {
    return await ServiceCharge.find({
      isActive: true,
      $or: [
        { appliesTo: 'all' },
        { appliesTo: serviceType }
      ]
    }).sort({ priority: -1 });
  }

  /**
   * Get applicable taxes for a service type and country
   */
  async getApplicableTaxes(serviceType, country = 'NG') {
    return await Tax.find({
      isActive: true,
      country,
      $or: [
        { appliesTo: 'all' },
        { appliesTo: serviceType }
      ]
    }).sort({ priority: -1 });
  }

  /**
   * Get applicable discounts
   */
  async getApplicableDiscounts({ serviceType, userRole, discountCode, providerCode }) {
    const filter = {
      isActive: true,
      $or: [
        { appliesTo: 'all' },
        { appliesTo: serviceType }
      ]
    };

    // Add date filter
    const now = new Date();
    filter.$and = [
      { $or: [{ validFrom: { $exists: false } }, { validFrom: { $lte: now } }] },
      { $or: [{ validUntil: { $exists: false } }, { validUntil: { $gte: now } }] },
      { $or: [{ usageLimit: { $exists: false } }, { $expr: { $lt: ['$usageCount', '$usageLimit'] } }] }
    ];

    // If discount code provided, prioritize it
    if (discountCode) {
      const codeDiscount = await Discount.findOne({
        ...filter,
        code: discountCode.toUpperCase()
      });
      
      if (codeDiscount && codeDiscount.isValid()) {
        return [codeDiscount];
      }
    }

    // Get role-based discounts
    const roleDiscounts = await Discount.find({
      ...filter,
      type: 'role-based'
    }).sort({ priority: -1 });

    // Get provider-specific discounts if provider code is provided
    if (providerCode) {
      const providerDiscounts = await Discount.find({
        ...filter,
        type: 'provider-specific',
        'provider.code': providerCode
      }).sort({ priority: -1 });

      return [...providerDiscounts, ...roleDiscounts];
    }

    return roleDiscounts;
  }

  /**
   * Validate and apply discount code
   */
  async validateDiscountCode(code, serviceType, amount, userRole) {
    if (!code) {
      throw new Error('Discount code is required');
    }

    const discount = await Discount.findOne({ code: code.toUpperCase() });

    if (!discount) {
      throw new Error('Invalid discount code');
    }

    if (!discount.isValid()) {
      throw new Error('Discount code is expired or no longer valid');
    }

    if (!discount.canApplyToService(serviceType)) {
      throw new Error(`Discount code cannot be applied to ${serviceType}`);
    }

    if (discount.minPurchaseAmount && amount < discount.minPurchaseAmount) {
      throw new Error(`Minimum purchase amount of ${discount.minPurchaseAmount} required`);
    }

    return discount;
  }
}

module.exports = new PricingService();
