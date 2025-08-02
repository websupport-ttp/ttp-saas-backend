# Affiliate Marketing System Deployment Guide

## Overview

This guide provides comprehensive instructions for deploying the affiliate marketing system to production environments.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Variables](#environment-variables)
3. [Database Setup](#database-setup)
4. [Migration Scripts](#migration-scripts)
5. [Deployment Steps](#deployment-steps)
6. [Health Checks](#health-checks)
7. [Monitoring](#monitoring)
8. [Rollback Procedures](#rollback-procedures)
9. [Troubleshooting](#troubleshooting)

## Prerequisites

### System Requirements

- **Node.js**: Version 18.0.0 or higher
- **MongoDB**: Version 5.0 or higher
- **Redis**: Version 6.0 or higher (for caching and rate limiting)
- **Memory**: Minimum 2GB RAM
- **Storage**: Minimum 10GB available space
- **Network**: HTTPS support required for production

### Dependencies

Ensure all required packages are installed:

```bash
npm install
```

### External Services

- **Paystack Account**: For withdrawal processing
- **Email Service**: For notifications (SMTP configured)
- **SMS Service**: Twilio account for SMS notifications

## Environment Variables

### Required Environment Variables

Create a `.env` file with the following variables:

```bash
# Application Environment
NODE_ENV=production
PORT=5000
CLIENT_URL=https://your-frontend-domain.com

# MongoDB Configuration
MONGO_URI=mongodb://username:password@host:port/database_name
# For MongoDB Atlas: mongodb+srv://username:password@cluster.mongodb.net/database_name

# Redis Configuration  
REDIS_URL=redis://username:password@host:port
# For Redis Cloud: redis://username:password@host:port

# JWT Configuration
JWT_ACCESS_SECRET=your-super-secure-access-secret-key-min-32-chars
JWT_ACCESS_LIFETIME=15m
JWT_REFRESH_SECRET=your-super-secure-refresh-secret-key-min-32-chars
JWT_REFRESH_LIFETIME=30d

# Email Configuration (for notifications)
EMAIL_HOST=smtp.your-email-provider.com
EMAIL_PORT=587
EMAIL_USERNAME=your-email@domain.com
EMAIL_PASSWORD=your-email-password
EMAIL_FROM=noreply@your-domain.com

# SMS Configuration (Twilio)
TWILIO_ACCOUNT_SID=your-twilio-account-sid
TWILIO_AUTH_TOKEN=your-twilio-auth-token
TWILIO_PHONE_NUMBER=+1234567890

# Paystack Configuration
PAYSTACK_SECRET_KEY=sk_live_your-paystack-secret-key
PAYSTACK_PUBLIC_KEY=pk_live_your-paystack-public-key

# Security Configuration
COOKIE_SECRET=your-cookie-secret-key-min-32-chars
ALLOWED_ORIGINS=https://your-frontend-domain.com,https://admin.your-domain.com

# Affiliate System Specific
AFFILIATE_QR_BASE_URL=https://your-domain.com/referral
AFFILIATE_COMMISSION_RATES_FLIGHTS=2.5
AFFILIATE_COMMISSION_RATES_HOTELS=3.0
AFFILIATE_COMMISSION_RATES_INSURANCE=5.0
AFFILIATE_COMMISSION_RATES_VISA=10.0

# Webhook Configuration
WEBHOOK_SECRET=your-webhook-secret-key-min-32-chars

# Rate Limiting Configuration
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_AFFILIATE_MAX=50
RATE_LIMIT_WITHDRAWAL_MAX=5

# Monitoring and Logging
LOG_LEVEL=info
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
```

### Environment Variable Validation

The system includes environment variable validation. Missing or invalid variables will prevent startup.

### Security Best Practices

1. **Never commit `.env` files** to version control
2. **Use strong, unique secrets** for JWT and cookies
3. **Rotate secrets regularly** in production
4. **Use environment-specific configurations**
5. **Limit access** to environment variables

## Database Setup

### MongoDB Configuration

1. **Create Database**: Create a dedicated database for the application
2. **User Permissions**: Create a user with read/write permissions
3. **Connection Limits**: Configure appropriate connection pool limits
4. **Backup Strategy**: Set up automated backups

### MongoDB Atlas Setup (Recommended)

```bash
# Example connection string for MongoDB Atlas
MONGO_URI=mongodb+srv://username:password@cluster0.abc123.mongodb.net/travel_place_prod?retryWrites=true&w=majority
```

### Redis Configuration

1. **Memory Allocation**: Allocate sufficient memory for caching
2. **Persistence**: Configure appropriate persistence settings
3. **Security**: Enable authentication and encryption
4. **Monitoring**: Set up Redis monitoring

## Migration Scripts

### Running Migrations

Before deploying, run database migrations to create necessary indexes:

```bash
# Check current migration status
node v1/migrations/migrate.js status

# Run all migrations
node v1/migrations/migrate.js up

# Verify migrations completed successfully
node v1/migrations/migrate.js check
```

### Migration Commands

```bash
# Run migrations
npm run migrate:up
# or
node v1/migrations/migrate.js migrate

# Check migration status
npm run migrate:status
# or  
node v1/migrations/migrate.js status

# Rollback migrations (if needed)
npm run migrate:down
# or
node v1/migrations/migrate.js rollback
```

### Expected Migration Output

```
🚀 Starting affiliate system migrations...

📋 Migration 001: Creating affiliate system indexes...
✓ Affiliate collection indexes created
✓ Wallet collection indexes created  
✓ WalletTransaction collection indexes created
✓ CommissionTransaction collection indexes created
✓ Referral collection indexes created
✓ Withdrawal collection indexes created
✅ Migration 001 completed successfully

🎉 All migrations completed successfully!
```

## Deployment Steps

### 1. Pre-deployment Checklist

- [ ] Environment variables configured
- [ ] Database accessible and configured
- [ ] Redis accessible and configured
- [ ] External services (Paystack, email, SMS) configured
- [ ] SSL certificates installed
- [ ] Domain names configured
- [ ] Firewall rules configured
- [ ] Backup systems in place

### 2. Application Deployment

```bash
# Clone repository
git clone https://github.com/your-org/travel-place-api.git
cd travel-place-api

# Install dependencies
npm ci --production

# Set up environment variables
cp .env.example .env
# Edit .env with production values

# Run database migrations
node v1/migrations/migrate.js up

# Start application
npm start
```

### 3. Process Management (PM2 Recommended)

```bash
# Install PM2 globally
npm install -g pm2

# Create PM2 ecosystem file
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'travel-place-api',
    script: 'server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 5000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    max_memory_restart: '1G',
    node_args: '--max-old-space-size=1024'
  }]
};
EOF

# Start with PM2
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Set up PM2 startup script
pm2 startup
```

### 4. Reverse Proxy Configuration (Nginx)

```nginx
server {
    listen 80;
    server_name api.your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.your-domain.com;

    ssl_certificate /path/to/ssl/certificate.crt;
    ssl_certificate_key /path/to/ssl/private.key;

    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req zone=api burst=20 nodelay;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Health check endpoint
    location /health {
        proxy_pass http://localhost:5000/health;
        access_log off;
    }
}
```

## Health Checks

### Application Health Endpoints

The system provides several health check endpoints:

```bash
# Basic health check
curl https://api.your-domain.com/health

# Detailed health check
curl https://api.your-domain.com/health/detailed

# Affiliate system health
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
     https://api.your-domain.com/api/v1/affiliates/health
```

### Health Check Script

Create a health check script for monitoring:

```bash
#!/bin/bash
# health-check.sh

API_URL="https://api.your-domain.com"
ADMIN_TOKEN="your-admin-token"

echo "Checking application health..."

# Basic health check
HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" $API_URL/health)
if [ $HEALTH_STATUS -eq 200 ]; then
    echo "✅ Application is healthy"
else
    echo "❌ Application health check failed (HTTP $HEALTH_STATUS)"
    exit 1
fi

# Database connectivity
DB_STATUS=$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
                 $API_URL/api/v1/affiliates/health | jq -r '.data.services.database.status')
if [ "$DB_STATUS" = "healthy" ]; then
    echo "✅ Database is healthy"
else
    echo "❌ Database health check failed"
    exit 1
fi

# Redis connectivity  
REDIS_STATUS=$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
                    $API_URL/api/v1/affiliates/health | jq -r '.data.services.redis.status')
if [ "$REDIS_STATUS" = "healthy" ]; then
    echo "✅ Redis is healthy"
else
    echo "⚠️ Redis health check failed (non-critical)"
fi

echo "🎉 All health checks passed!"
```

### Automated Health Monitoring

Set up automated health monitoring with cron:

```bash
# Add to crontab (crontab -e)
*/5 * * * * /path/to/health-check.sh >> /var/log/health-check.log 2>&1
```

## Monitoring

### Application Metrics

Monitor these key metrics:

1. **Response Times**: API endpoint response times
2. **Error Rates**: 4xx and 5xx error rates
3. **Throughput**: Requests per second
4. **Database Performance**: Query execution times
5. **Memory Usage**: Application memory consumption
6. **CPU Usage**: Server CPU utilization

### Affiliate-Specific Metrics

1. **Commission Processing**: Commission calculation and payment times
2. **Withdrawal Processing**: Withdrawal request processing times
3. **QR Code Generation**: QR code generation performance
4. **Referral Tracking**: Referral attribution accuracy
5. **Wallet Operations**: Wallet transaction processing times

### Logging Configuration

Configure structured logging:

```javascript
// Example logging configuration
const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ 
      filename: 'logs/error.log', 
      level: 'error' 
    }),
    new winston.transports.File({ 
      filename: 'logs/combined.log' 
    })
  ]
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}
```

### Alerting

Set up alerts for:

- Application downtime
- High error rates (>5%)
- Slow response times (>2s)
- Database connection failures
- Failed withdrawal processing
- High memory usage (>80%)
- Disk space low (<10%)

## Rollback Procedures

### Application Rollback

```bash
# Stop current application
pm2 stop travel-place-api

# Switch to previous version
git checkout previous-stable-tag

# Install dependencies
npm ci --production

# Restart application
pm2 start travel-place-api
```

### Database Rollback

```bash
# Rollback migrations if needed
node v1/migrations/migrate.js rollback

# Restore from backup if necessary
mongorestore --uri="$MONGO_URI" /path/to/backup
```

### Configuration Rollback

```bash
# Restore previous environment configuration
cp .env.backup .env

# Restart application
pm2 restart travel-place-api
```

## Troubleshooting

### Common Issues

#### 1. Database Connection Failures

```bash
# Check MongoDB connectivity
mongo "$MONGO_URI" --eval "db.adminCommand('ping')"

# Check connection string format
echo $MONGO_URI

# Verify user permissions
mongo "$MONGO_URI" --eval "db.runCommand({connectionStatus: 1})"
```

#### 2. Redis Connection Issues

```bash
# Test Redis connectivity
redis-cli -u "$REDIS_URL" ping

# Check Redis memory usage
redis-cli -u "$REDIS_URL" info memory
```

#### 3. High Memory Usage

```bash
# Check Node.js memory usage
pm2 monit

# Analyze memory leaks
node --inspect server.js
```

#### 4. Slow API Responses

```bash
# Check database query performance
# Enable MongoDB profiler
mongo "$MONGO_URI" --eval "db.setProfilingLevel(2)"

# Analyze slow queries
mongo "$MONGO_URI" --eval "db.system.profile.find().sort({ts: -1}).limit(5)"
```

#### 5. Failed Withdrawals

```bash
# Check Paystack service status
curl -H "Authorization: Bearer $PAYSTACK_SECRET_KEY" \
     https://api.paystack.co/bank

# Review withdrawal logs
tail -f logs/combined.log | grep "withdrawal"
```

### Log Analysis

```bash
# Monitor application logs
tail -f logs/combined.log

# Filter error logs
grep "ERROR" logs/combined.log | tail -20

# Monitor affiliate-specific logs
grep "affiliate\|commission\|withdrawal" logs/combined.log | tail -20
```

### Performance Optimization

1. **Database Indexes**: Ensure all necessary indexes are created
2. **Connection Pooling**: Optimize MongoDB connection pool size
3. **Caching**: Implement Redis caching for frequently accessed data
4. **Query Optimization**: Analyze and optimize slow database queries
5. **Memory Management**: Monitor and optimize memory usage

## Security Considerations

### Production Security Checklist

- [ ] HTTPS enabled with valid SSL certificates
- [ ] Environment variables secured
- [ ] Database authentication enabled
- [ ] Redis authentication enabled
- [ ] Rate limiting configured
- [ ] Input validation implemented
- [ ] CORS properly configured
- [ ] Security headers implemented
- [ ] Webhook signature verification enabled
- [ ] Regular security updates applied

### Security Monitoring

Monitor for:
- Unusual API access patterns
- Failed authentication attempts
- Suspicious affiliate registrations
- Abnormal withdrawal patterns
- Rate limit violations

## Backup and Recovery

### Database Backups

```bash
# Create automated backup script
#!/bin/bash
BACKUP_DIR="/backups/mongodb"
DATE=$(date +%Y%m%d_%H%M%S)

mongodump --uri="$MONGO_URI" --out="$BACKUP_DIR/$DATE"
tar -czf "$BACKUP_DIR/backup_$DATE.tar.gz" -C "$BACKUP_DIR" "$DATE"
rm -rf "$BACKUP_DIR/$DATE"

# Keep only last 7 days of backups
find "$BACKUP_DIR" -name "backup_*.tar.gz" -mtime +7 -delete
```

### Application Backups

```bash
# Backup application files and configuration
tar -czf "/backups/app/app_backup_$(date +%Y%m%d_%H%M%S).tar.gz" \
    --exclude=node_modules \
    --exclude=logs \
    --exclude=.git \
    /path/to/application
```

## Support and Maintenance

### Regular Maintenance Tasks

1. **Weekly**: Review application logs and performance metrics
2. **Monthly**: Update dependencies and security patches
3. **Quarterly**: Review and rotate security keys
4. **Annually**: Comprehensive security audit

### Support Contacts

- **Technical Support**: tech-support@your-domain.com
- **Security Issues**: security@your-domain.com
- **Emergency Contact**: +1-xxx-xxx-xxxx

### Documentation Updates

Keep this deployment guide updated with:
- Configuration changes
- New environment variables
- Updated procedures
- Lessons learned from incidents