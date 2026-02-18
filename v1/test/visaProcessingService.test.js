// v1/test/visaProcessingService.test.js
const visaProcessingService = require('../services/visaProcessingService');

describe('Visa Processing Service', () => {
  describe('calculateVisaFees', () => {
    it('should calculate fees for US tourist visa', async () => {
      const result = await visaProcessingService.calculateVisaFees('US', 'Tourist', 'Standard', 'Nigeria');
      
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('visaFee');
      expect(result.data).toHaveProperty('serviceFee');
      expect(result.data).toHaveProperty('total');
      expect(result.data.total).toBeGreaterThan(0);
    });

    it('should calculate higher fees for express processing', async () => {
      const standardResult = await visaProcessingService.calculateVisaFees('US', 'Tourist', 'Standard', 'Nigeria');
      const expressResult = await visaProcessingService.calculateVisaFees('US', 'Tourist', 'Express', 'Nigeria');
      
      expect(expressResult.data.total).toBeGreaterThan(standardResult.data.total);
    });
  });

  describe('getVisaRequirements', () => {
    it('should return visa requirements for a country', async () => {
      const result = await visaProcessingService.getVisaRequirements('US', 'Tourist', 'Nigeria');
      
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('requirements');
      expect(result.data).toHaveProperty('fees');
      expect(result.data).toHaveProperty('documentTypes');
    });
  });

  describe('verifyDocuments', () => {
    it('should verify document structure', async () => {
      const mockDocuments = [
        {
          documentType: 'International Passport',
          cloudinaryUrl: 'https://example.com/passport.jpg',
          filename: 'passport.jpg',
          mimetype: 'image/jpeg',
          size: 1024000
        }
      ];

      const result = await visaProcessingService.verifyDocuments(mockDocuments, 'Tourist', 'US');
      
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('overallStatus');
      expect(result.data).toHaveProperty('documents');
      expect(Array.isArray(result.data.documents)).toBe(true);
    });
  });

  describe('submitVisaApplication', () => {
    it('should handle application submission gracefully', async () => {
      const mockApplication = {
        applicationReference: 'VISA-TEST-123',
        destinationCountry: 'US',
        visaType: 'Tourist',
        urgency: 'Standard',
        personalInformation: {
          firstName: 'John',
          lastName: 'Doe',
          dateOfBirth: '1990-01-01',
          gender: 'Male',
          nationality: 'Nigeria'
        },
        passportDetails: {
          passportNumber: 'A12345678',
          issueDate: '2020-01-01',
          expiryDate: '2030-01-01'
        },
        travelPurpose: 'Tourism',
        travelDates: {
          startDate: '2024-06-01',
          endDate: '2024-06-15'
        },
        guestEmail: 'john.doe@example.com',
        guestPhoneNumber: '+2348012345678',
        documents: []
      };

      try {
        const result = await visaProcessingService.submitVisaApplication(mockApplication);
        
        // Should either succeed or fail gracefully
        if (result.success) {
          expect(result.data).toHaveProperty('externalReference');
          expect(result.data).toHaveProperty('status');
        }
      } catch (error) {
        // External API might not be available in test environment
        expect(error.message).toContain('Failed to submit visa application');
      }
    });
  });

  describe('checkVisaStatus', () => {
    it('should handle status check gracefully', async () => {
      try {
        const result = await visaProcessingService.checkVisaStatus('TEST-REF-123', 'VISA-TEST-123');
        
        if (result.success) {
          expect(result.data).toHaveProperty('status');
          expect(result.data).toHaveProperty('statusDescription');
        }
      } catch (error) {
        // External API might not be available in test environment
        expect(error.message).toContain('Failed to retrieve visa application status');
      }
    });
  });
});