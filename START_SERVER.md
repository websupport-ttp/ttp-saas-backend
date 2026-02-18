# Server Startup Guide

## Quick Start

1. **Install Dependencies**
   ```bash
   cd backend
   npm install
   ```

2. **Check Environment**
   ```bash
   node debug-server.js
   ```

3. **Start Server**
   ```bash
   # Development mode with auto-reload
   npm run dev
   
   # Or production mode
   npm start
   
   # Or debug mode
   node debug-server.js
   ```

4. **Access API Documentation**
   - API Docs: http://localhost:5000/api-docs
   - Health Check: http://localhost:5000/health
   - Reference API: http://localhost:5000/api/v1/reference/countries

## Troubleshooting

### Issue: "Cannot reach http://localhost:5000/api-docs"

**Possible Causes:**
1. Server not running
2. NODE_ENV set to 'test' (disables Swagger)
3. Port already in use
4. Missing dependencies

**Solutions:**

1. **Check if server is running:**
   ```bash
   curl http://localhost:5000/
   ```

2. **Force enable Swagger:**
   ```bash
   ENABLE_SWAGGER=true npm run dev
   ```

3. **Check port availability:**
   ```bash
   lsof -i :5000  # On macOS/Linux
   netstat -ano | findstr :5000  # On Windows
   ```

4. **Install missing dependencies:**
   ```bash
   npm install swagger-jsdoc swagger-ui-express
   ```

### Issue: "Server won't start"

1. **Check environment file:**
   - Ensure `.env` file exists in backend directory
   - Copy from `.env.example` if needed

2. **Check MongoDB connection:**
   - Ensure MongoDB is running
   - Check MONGODB_URI in .env

3. **Check Redis connection:**
   - Redis is optional but recommended
   - Server will continue without Redis

### Issue: "Reference API endpoints not working"

1. **Check if routes are registered:**
   ```bash
   curl http://localhost:5000/api/v1/reference/countries
   ```

2. **Check Amadeus configuration:**
   - Ensure AMADEUS_CLIENT_ID and AMADEUS_CLIENT_SECRET are set
   - Check AMADEUS_BASE_URL

## Environment Variables

Required variables in `.env`:
```env
NODE_ENV=development
PORT=5000
MONGODB_URI=mongodb://localhost:27017/travel-place
JWT_SECRET=your-jwt-secret-here

# Amadeus API (for reference data)
AMADEUS_BASE_URL=https://test.api.amadeus.com
AMADEUS_CLIENT_ID=your-amadeus-client-id
AMADEUS_CLIENT_SECRET=your-amadeus-client-secret

# Optional
REDIS_URL=redis://localhost:6379
ENABLE_SWAGGER=true
```

## API Endpoints

### Reference Data (New)
- `GET /api/v1/reference/countries` - Get countries list
- `GET /api/v1/reference/airports` - Get airports list
- `GET /api/v1/reference/airports/search?q=london` - Search airports
- `GET /api/v1/reference/airports/JFK` - Get airport details

### Health & Monitoring
- `GET /health` - Basic health check
- `GET /api-docs` - API documentation
- `GET /api-docs.json` - Raw Swagger JSON

## Testing

1. **Test server endpoints:**
   ```bash
   node test-server.js
   ```

2. **Test reference data:**
   ```bash
   node test-reference-data.js
   ```

## Development Tips

1. **Use nodemon for auto-reload:**
   ```bash
   npm run dev
   ```

2. **Enable debug logging:**
   ```bash
   DEBUG=* npm run dev
   ```

3. **Check logs:**
   - Server logs appear in console
   - Error logs in `logs/` directory (if configured)

4. **API Documentation:**
   - Always available at `/api-docs` when server is running
   - Raw JSON at `/api-docs.json`