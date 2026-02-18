# Vercel Deployment Guide for TTP Backend API

## 🚀 Quick Deployment Steps

### 1. Install Vercel CLI (if not already installed)
```bash
npm install -g vercel
```

### 2. Login to Vercel
```bash
vercel login
```

### 3. Deploy to Vercel
```bash
# For first deployment
vercel

# For subsequent deployments
vercel --prod
```

## 🔧 Environment Variables Setup

Before deploying, you need to set up environment variables in Vercel. You can do this via:

### Option 1: Vercel Dashboard
1. Go to your project in Vercel Dashboard
2. Navigate to Settings → Environment Variables
3. Add the following variables:

### Option 2: Vercel CLI
```bash
# Set environment variables via CLI
vercel env add MONGODB_URI
vercel env add REDIS_URL
vercel env add JWT_SECRET
vercel env add CLOUDINARY_CLOUD_NAME
vercel env add CLOUDINARY_API_KEY
vercel env add CLOUDINARY_API_SECRET
vercel env add PAYSTACK_SECRET_KEY
vercel env add AMADEUS_API_KEY
vercel env add AMADEUS_API_SECRET
vercel env add TWILIO_ACCOUNT_SID
vercel env add TWILIO_AUTH_TOKEN
```

## 📋 Required Environment Variables

```env
# Database
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/ttp_backend
REDIS_URL=redis://username:password@host:port

# JWT
JWT_SECRET=your_super_secret_jwt_key
JWT_EXPIRES_IN=7d

# Cloudinary
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Paystack
PAYSTACK_SECRET_KEY=sk_live_your_secret_key
PAYSTACK_PUBLIC_KEY=pk_live_your_public_key

# Travel APIs
AMADEUS_API_KEY=your_amadeus_key
AMADEUS_API_SECRET=your_amadeus_secret
RATEHAWK_API_KEY=your_ratehawk_key
ALLIANZ_API_KEY=your_allianz_key

# Communication
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_token
TWILIO_PHONE_NUMBER=+1234567890

# Application URLs
FRONTEND_URL=https://your-frontend-domain.vercel.app
BACKEND_URL=https://your-backend-domain.vercel.app
```

## 🔗 Custom Domain Setup

### 1. Add Custom Domain
```bash
vercel domains add yourdomain.com
```

### 2. Configure DNS
Add these DNS records to your domain provider:
- **Type**: CNAME
- **Name**: @ (or your subdomain)
- **Value**: cname.vercel-dns.com

### 3. Assign Domain to Project
```bash
vercel domains assign yourdomain.com your-project-name
```

## 📊 Monitoring & Logs

### View Deployment Logs
```bash
vercel logs
```

### View Function Logs
```bash
vercel logs --follow
```

### Check Deployment Status
```bash
vercel ls
```

## 🛠️ Troubleshooting

### Common Issues:

1. **Function Timeout**: Increase `maxDuration` in vercel.json
2. **Memory Issues**: Increase `memory` allocation in vercel.json
3. **Cold Starts**: Consider using Vercel Pro for better performance
4. **Database Connection**: Ensure MongoDB allows connections from 0.0.0.0/0

### Debug Commands:
```bash
# Check project info
vercel inspect

# View environment variables
vercel env ls

# Remove deployment
vercel remove
```

## 🔄 CI/CD with GitHub

1. Connect your GitHub repository to Vercel
2. Enable automatic deployments
3. Set up branch protection rules
4. Configure preview deployments for pull requests

## 📈 Performance Optimization

1. **Enable Edge Caching**: Configure appropriate cache headers
2. **Use CDN**: Vercel automatically provides CDN
3. **Optimize Bundle Size**: Use `.vercelignore` to exclude unnecessary files
4. **Database Optimization**: Use connection pooling and indexes

## 🔒 Security Considerations

1. **Environment Variables**: Never commit secrets to git
2. **CORS Configuration**: Configure appropriate CORS settings
3. **Rate Limiting**: Implement rate limiting for API endpoints
4. **Authentication**: Ensure JWT secrets are secure
5. **HTTPS**: Vercel provides HTTPS by default

## 📱 API Endpoints After Deployment

Your API will be available at:
- **Base URL**: `https://your-project.vercel.app`
- **API Routes**: `https://your-project.vercel.app/api/v1/*`
- **Documentation**: `https://your-project.vercel.app/api-docs`
- **Health Check**: `https://your-project.vercel.app/health`

## 🎯 Post-Deployment Checklist

- [ ] Test all API endpoints
- [ ] Verify database connections
- [ ] Check environment variables
- [ ] Test authentication flows
- [ ] Verify third-party integrations
- [ ] Monitor function performance
- [ ] Set up alerts and monitoring
- [ ] Update frontend API URLs
- [ ] Test CORS configuration
- [ ] Verify SSL certificate

## 📞 Support

If you encounter issues:
1. Check Vercel documentation: https://vercel.com/docs
2. Review function logs in Vercel dashboard
3. Test locally with `vercel dev`
4. Contact Vercel support for platform issues