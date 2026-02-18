# Environment Configuration Guide

## Overview

This document outlines the environment variables required for The Travel Place API after the Cloudinary to Cloudflare migration and Amadeus JSON to XML API transition.

## Required Environment Variables

### Database Configuration

```bash
# MongoDB connection string
MONGODB_URI=mongodb://localhost:27017/travel-place
# or for MongoDB Atlas:
# MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/travel-place?retryWrites=true&w=majority
```

### JWT Configuration

```bash
# JWT secret for token signing (use a strong, random string)
JWT_SECRET=your-super-secret-jwt-key-here
JWT_EXPIRES_IN=7d
```

### Amadeus XML Configuration

```bash
# Amadeus XML SOAP API Configuration
AMADEUS_XML_ENDPOINT=https://webservices.amadeus.com/1ASIWXXXXXX
AMADEUS_XML_USERNAME=your_xml_username
AMADEUS_XML_PASSWORD=your_xml_password
AMADEUS_XML_OFFICE_ID=your_office_id

# Optional: XML service timeout settings
AMADEUS_XML_TIMEOUT=30000
AMADEUS_XML_RETRY_ATTEMPTS=3
```

### Cloudflare Configuration

```bash
# Cloudflare Images API Configuration
CLOUDFLARE_ACCOUNT_ID=your_cloudflare_account_id
CLOUDFLARE_API_TOKEN=your_cloudflare_api_token
CLOUDFLARE_IMAGES_HASH=your_images_hash
CLOUDFLARE_ZONE_ID=your_zone_id

# Optional: Cloudflare service settings
CLOUDFLARE_IMAGES_TIMEOUT=60000
CLOUDFLARE_MAX_FILE_SIZE=10485760
```

### Payment Gateway Configuration

```bash
# Paystack Configuration
PAYSTACK_SECRET_KEY=sk_test_your_paystack_secret_key
PAYSTACK_PUBLIC_KEY=pk_test_your_paystack_public_key

# Flutterwave Configuration (optional)
FLUTTERWAVE_SECRET_KEY=FLWSECK_TEST-your_flutterwave_secret_key
FLUTTERWAVE_PUBLIC_KEY=FLWPUBK_TEST-your_flutterwave_public_key
```

### Email Configuration

```bash
# Email service configuration (using SendGrid as example)
EMAIL_SERVICE=sendgrid
EMAIL_API_KEY=your_sendgrid_api_key
EMAIL_FROM=noreply@thetravelplace.com
EMAIL_FROM_NAME=The Travel Place

# Alternative: SMTP configuration
# EMAIL_SERVICE=smtp
# EMAIL_HOST=smtp.gmail.com
# EMAIL_PORT=587
# EMAIL_USER=your_email@gmail.com
# EMAIL_PASS=your_app_password
```

### SMS Configuration

```bash
# SMS service configuration (using Twilio as example)
SMS_SERVICE=twilio
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=+1234567890
```

### Application Configuration

```bash
# Application settings
NODE_ENV=production
PORT=3000
API_VERSION=v1

# CORS settings
CORS_ORIGIN=https://yourdomain.com
# For multiple origins: CORS_ORIGIN=https://yourdomain.com,https://admin.yourdomain.com

# Rate limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# File upload settings
MAX_FILE_SIZE=10485760
ALLOWED_FILE_TYPES=image/jpeg,image/png,image/gif,application/pdf
```

### Logging Configuration

```bash
# Logging settings
LOG_LEVEL=info
LOG_FILE_PATH=./logs/app.log
LOG_MAX_SIZE=10m
LOG_MAX_FILES=5

# Enable/disable specific log types
ENABLE_ACCESS_LOGS=true
ENABLE_ERROR_LOGS=true
ENABLE_DEBUG_LOGS=false
```

### Security Configuration

```bash
# Security settings
BCRYPT_SALT_ROUNDS=12
SESSION_SECRET=your-session-secret-key
CSRF_SECRET=your-csrf-secret-key

# API security
API_KEY_HEADER=X-API-Key
ADMIN_API_KEY=your-admin-api-key

# Password reset token expiry (in milliseconds)
PASSWORD_RESET_EXPIRES=600000

# Email verification token expiry
EMAIL_VERIFICATION_EXPIRES=86400000
```

### Third-Party Integrations

```bash
# Google OAuth (optional)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# Analytics (optional)
GOOGLE_ANALYTICS_ID=GA-XXXXXXXXX

# Monitoring (optional)
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
```

## Environment-Specific Configurations

### Development Environment (.env.development)

```bash
NODE_ENV=development
PORT=3000
LOG_LEVEL=debug
ENABLE_DEBUG_LOGS=true

# Use test/sandbox credentials
AMADEUS_XML_ENDPOINT=https://test.webservices.amadeus.com/1ASIWXXXXXX
PAYSTACK_SECRET_KEY=sk_test_your_test_key
CLOUDFLARE_ACCOUNT_ID=your_test_account_id

# Relaxed CORS for development
CORS_ORIGIN=http://localhost:3000,http://localhost:3001

# Disable rate limiting in development
RATE_LIMIT_MAX_REQUESTS=1000
```

### Staging Environment (.env.staging)

```bash
NODE_ENV=staging
PORT=3000
LOG_LEVEL=info

# Use staging/test credentials
AMADEUS_XML_ENDPOINT=https://test.webservices.amadeus.com/1ASIWXXXXXX
PAYSTACK_SECRET_KEY=sk_test_your_staging_key

# Staging-specific settings
CORS_ORIGIN=https://staging.yourdomain.com
RATE_LIMIT_MAX_REQUESTS=200
```

### Production Environment (.env.production)

```bash
NODE_ENV=production
PORT=3000
LOG_LEVEL=warn
ENABLE_DEBUG_LOGS=false

# Use production credentials
AMADEUS_XML_ENDPOINT=https://webservices.amadeus.com/1ASIWXXXXXX
PAYSTACK_SECRET_KEY=sk_live_your_production_key
CLOUDFLARE_ACCOUNT_ID=your_production_account_id

# Production security settings
CORS_ORIGIN=https://yourdomain.com
RATE_LIMIT_MAX_REQUESTS=100
BCRYPT_SALT_ROUNDS=12
```

## Removed Environment Variables

The following environment variables are no longer needed after the migration:

```bash
# REMOVED: Cloudinary configuration (no longer used)
# CLOUDINARY_CLOUD_NAME=your_cloud_name
# CLOUDINARY_API_KEY=your_api_key
# CLOUDINARY_API_SECRET=your_api_secret

# REMOVED: Amadeus JSON API configuration (replaced with XML)
# AMADEUS_API_KEY=your_amadeus_api_key
# AMADEUS_API_SECRET=your_amadeus_api_secret
# AMADEUS_BASE_URL=https://api.amadeus.com
```

## Environment Variable Validation

The application includes built-in environment variable validation. Required variables are checked at startup:

### Critical Variables (Application won't start without these)

- `MONGODB_URI`
- `JWT_SECRET`
- `AMADEUS_XML_ENDPOINT`
- `AMADEUS_XML_USERNAME`
- `AMADEUS_XML_PASSWORD`
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`

### Optional Variables (Application will start with defaults)

- `PORT` (defaults to 3000)
- `NODE_ENV` (defaults to 'development')
- `LOG_LEVEL` (defaults to 'info')
- `RATE_LIMIT_MAX_REQUESTS` (defaults to 100)

## Security Best Practices

### 1. Environment Variable Security

- **Never commit `.env` files** to version control
- Use different credentials for each environment
- Rotate API keys and secrets regularly
- Use strong, random values for JWT secrets

### 2. Production Security

```bash
# Use strong JWT secret (minimum 32 characters)
JWT_SECRET=$(openssl rand -base64 32)

# Use strong session secret
SESSION_SECRET=$(openssl rand -base64 32)

# Set appropriate CORS origins
CORS_ORIGIN=https://yourdomain.com

# Enable security headers
HELMET_ENABLED=true
```

### 3. API Key Management

- Store API keys in secure environment variable management systems
- Use least-privilege access for service accounts
- Monitor API key usage and set up alerts for unusual activity

## Environment Setup Scripts

### Setup Script for Development

```bash
#!/bin/bash
# setup-dev-env.sh

echo "Setting up development environment..."

# Copy example environment file
cp .env.example .env

# Generate JWT secret
JWT_SECRET=$(openssl rand -base64 32)
sed -i "s/your-jwt-secret-here/$JWT_SECRET/" .env

echo "Development environment setup complete!"
echo "Please update the following variables in .env:"
echo "- MONGODB_URI"
echo "- AMADEUS_XML_* credentials"
echo "- CLOUDFLARE_* credentials"
echo "- Payment gateway credentials"
```

### Validation Script

```bash
#!/bin/bash
# validate-env.sh

echo "Validating environment configuration..."

# Run the built-in validation
node v1/utils/validateEnv.js

if [ $? -eq 0 ]; then
    echo "✅ Environment validation passed"
else
    echo "❌ Environment validation failed"
    exit 1
fi
```

## Docker Configuration

### Docker Environment File

For Docker deployments, create a `.env.docker` file:

```bash
# Docker-specific overrides
MONGODB_URI=mongodb://mongo:27017/travel-place
PORT=3000

# Use Docker secrets for sensitive data
JWT_SECRET_FILE=/run/secrets/jwt_secret
AMADEUS_XML_PASSWORD_FILE=/run/secrets/amadeus_password
CLOUDFLARE_API_TOKEN_FILE=/run/secrets/cloudflare_token
```

### Docker Compose Environment

```yaml
# docker-compose.yml
version: '3.8'
services:
  app:
    build: .
    env_file:
      - .env.docker
    secrets:
      - jwt_secret
      - amadeus_password
      - cloudflare_token

secrets:
  jwt_secret:
    external: true
  amadeus_password:
    external: true
  cloudflare_token:
    external: true
```

## Troubleshooting

### Common Environment Issues

1. **Missing Required Variables**
   ```bash
   Error: Missing required environment variable: AMADEUS_XML_ENDPOINT
   ```
   Solution: Ensure all required variables are set in your `.env` file

2. **Invalid MongoDB URI**
   ```bash
   Error: MongooseError: Invalid connection string
   ```
   Solution: Check your `MONGODB_URI` format and credentials

3. **Cloudflare API Authentication Failed**
   ```bash
   Error: Cloudflare API authentication failed
   ```
   Solution: Verify your `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`

4. **XML Service Connection Failed**
   ```bash
   Error: Amadeus XML service connection failed
   ```
   Solution: Check your Amadeus XML credentials and endpoint URL

### Environment Debugging

Enable debug logging to troubleshoot environment issues:

```bash
LOG_LEVEL=debug
ENABLE_DEBUG_LOGS=true
```

### Health Check Endpoints

Use these endpoints to verify environment configuration:

```bash
# General health check
curl http://localhost:3000/api/v1/health

# Database connectivity
curl http://localhost:3000/api/v1/health/database

# Cloudflare service
curl http://localhost:3000/api/v1/health/cloudflare

# Amadeus XML service
curl http://localhost:3000/api/v1/health/amadeus-xml
```

## Migration Checklist

When migrating from the old configuration:

- [ ] Add new Amadeus XML environment variables
- [ ] Add new Cloudflare environment variables
- [ ] Remove old Cloudinary environment variables
- [ ] Remove old Amadeus JSON API variables
- [ ] Update any deployment scripts
- [ ] Update CI/CD pipeline configurations
- [ ] Test all environment configurations
- [ ] Update documentation and team knowledge

## Support

For environment configuration support:

1. Check the validation output: `node v1/utils/validateEnv.js`
2. Review application logs for specific error messages
3. Use health check endpoints to verify service connectivity
4. Ensure all required variables are properly set and formatted