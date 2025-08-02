// v1/test/testModels.js
// Test-specific model loader that ensures all models use the test database connection

const mongoose = require('mongoose');
const testDbManager = require('./testDbManager');

// Cache for loaded models
const modelCache = new Map();

/**
 * Load a model for testing, ensuring it uses the test database connection
 */
async function loadTestModel(modelName, modelPath) {
  // Ensure test database connection is ready
  await testDbManager.ensureConnection();
  
  // Return cached model if already loaded
  if (modelCache.has(modelName)) {
    return modelCache.get(modelName);
  }
  
  try {
    // Clear the require cache for the model to ensure fresh load
    delete require.cache[require.resolve(modelPath)];
    
    // Load the model
    const model = require(modelPath);
    
    // Cache the model
    modelCache.set(modelName, model);
    
    return model;
  } catch (error) {
    console.error(`Error loading test model ${modelName}:`, error);
    throw error;
  }
}

/**
 * Get all commonly used models for testing
 */
async function getTestModels() {
  const models = {};
  
  try {
    models.User = await loadTestModel('User', '../models/userModel');
    models.Ledger = await loadTestModel('Ledger', '../models/ledgerModel');
    models.Post = await loadTestModel('Post', '../models/postModel');
    models.Category = await loadTestModel('Category', '../models/categoryModel');
    models.VisaApplication = await loadTestModel('VisaApplication', '../models/visaApplicationModel');
    models.ServiceCharge = await loadTestModel('ServiceCharge', '../models/serviceChargeModel');
    models.Affiliate = await loadTestModel('Affiliate', '../models/affiliateModel');
    models.Wallet = await loadTestModel('Wallet', '../models/walletModel');
    models.WalletTransaction = await loadTestModel('WalletTransaction', '../models/walletTransactionModel');
    models.CommissionTransaction = await loadTestModel('CommissionTransaction', '../models/commissionTransactionModel');
    models.Referral = await loadTestModel('Referral', '../models/referralModel');
    models.Withdrawal = await loadTestModel('Withdrawal', '../models/withdrawalModel');
  } catch (error) {
    console.error('Error loading test models:', error);
    // Return empty models object if loading fails
  }
  
  return models;
}

/**
 * Clear model cache (useful for test cleanup)
 */
function clearModelCache() {
  modelCache.clear();
}

/**
 * Ensure all models are connected to the test database
 */
async function ensureModelsConnected() {
  await testDbManager.ensureConnection();
  
  // Verify connection state
  if (mongoose.connection.readyState !== 1) {
    throw new Error('Test database connection not ready');
  }
  
  console.log('Test models connected to database');
}

module.exports = {
  loadTestModel,
  getTestModels,
  clearModelCache,
  ensureModelsConnected
};