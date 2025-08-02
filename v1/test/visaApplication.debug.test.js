// Debug test to check visa application functionality
const request = require('supertest');

describe('Visa Application Debug Test', () => {
  it('should check if app can be imported', async () => {
    let app;
    try {
      app = require('../../app');
      expect(app).toBeDefined();
    } catch (error) {
      console.error('Error importing app:', error.message);
      throw error;
    }
  });

  it('should check if visa application model exists', async () => {
    let VisaApplication;
    try {
      VisaApplication = require('../models/visaApplicationModel');
      expect(VisaApplication).toBeDefined();
    } catch (error) {
      console.error('Error importing VisaApplication model:', error.message);
      throw error;
    }
  });

  it('should check if product controller exports visa functions', async () => {
    let productController;
    try {
      productController = require('../controllers/productController');
      expect(productController).toBeDefined();
      
      console.log('Available exports:', Object.keys(productController));
      console.log('initiateVisaApplication type:', typeof productController.initiateVisaApplication);
      console.log('initiateVisaApplication value:', productController.initiateVisaApplication);
      
      expect(productController.initiateVisaApplication).toBeDefined();
      expect(typeof productController.initiateVisaApplication).toBe('function');
      expect(productController.uploadVisaDocument).toBeDefined();
      expect(productController.getVisaApplicationDetails).toBeDefined();
      expect(productController.updateVisaApplicationStatus).toBeDefined();
    } catch (error) {
      console.error('Error importing product controller:', error.message);
      console.error('Available exports:', Object.keys(productController || {}));
      throw error;
    }
  });
});