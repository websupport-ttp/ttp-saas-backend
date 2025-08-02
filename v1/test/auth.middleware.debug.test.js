// Debug test to check auth middleware
describe('Auth Middleware Debug Test', () => {
  it('should check if auth middleware can be imported', async () => {
    let authMiddleware;
    try {
      authMiddleware = require('../middleware/authMiddleware');
      expect(authMiddleware).toBeDefined();
      
      console.log('Auth middleware exports:', Object.keys(authMiddleware));
      console.log('Full auth middleware object:', authMiddleware);
      
      expect(authMiddleware.authenticateUser).toBeDefined();
      expect(authMiddleware.authorizeRoles).toBeDefined();
      expect(authMiddleware.optionalAuthenticateUser).toBeDefined();
      
      console.log('optionalAuthenticateUser type:', typeof authMiddleware.optionalAuthenticateUser);
    } catch (error) {
      console.error('Error importing auth middleware:', error.message);
      throw error;
    }
  });
});