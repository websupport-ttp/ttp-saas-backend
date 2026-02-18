# 🪣 AWS S3 Setup Guide

## 📋 **Current Status**

Your health check shows:
- ✅ **AWS SDK**: Fixed (now using v3)
- ❌ **S3 Bucket**: Does not exist yet
- ✅ **Credentials**: Configured in environment variables

## 🎯 **Quick Fix Options**

### Option 1: Create Bucket via AWS Console (Recommended)

1. **Go to AWS S3 Console**: https://s3.console.aws.amazon.com/
2. **Click "Create bucket"**
3. **Enter bucket name**: `thetravelplace-storage`
4. **Select region**: `Europe (Stockholm) eu-north-1`
5. **Keep default settings** and click "Create bucket"

### Option 2: Use AWS CLI (If installed)

```bash
# Install AWS CLI first (if not installed)
# Download from: https://aws.amazon.com/cli/

# Configure AWS CLI
aws configure
# Enter your Access Key ID
# Enter your Secret Access Key  
# Enter region: eu-north-1
# Enter output format: json

# Create the bucket
aws s3 mb s3://thetravelplace-storage --region eu-north-1
```

### Option 3: Alternative Bucket Name

If `thetravelplace-storage` is taken globally, try:
- `thetravelplace-storage-2025`
- `thetravelplace-files-storage`
- `your-company-travelplace-storage`

Then update your `.env` file:
```bash
AWS_S3_BUCKET_NAME=your-new-bucket-name
```

## 🔧 **Verify Setup**

After creating the bucket, test the connection:

```bash
cd backend
node test-s3-connection.js
```

Expected output:
```
✅ Bucket exists and is accessible
✅ Listed objects successfully
🎉 S3 connection test completed successfully!
```

## 🏥 **Health Check Results**

After setup, your health endpoint should show:

```json
{
  "s3": {
    "status": "healthy",
    "details": {
      "bucket": "configured and accessible",
      "region": "eu-north-1",
      "apiConnectivity": true
    }
  }
}
```

## 🔐 **Security Best Practices**

### IAM Permissions (Minimum Required)

Your AWS user should have these S3 permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject",
        "s3:ListBucket",
        "s3:HeadBucket"
      ],
      "Resource": [
        "arn:aws:s3:::thetravelplace-storage",
        "arn:aws:s3:::thetravelplace-storage/*"
      ]
    }
  ]
}
```

### Bucket Security Settings

Recommended bucket settings:
- ✅ **Block public access**: Enabled (default)
- ✅ **Versioning**: Enabled (optional)
- ✅ **Server-side encryption**: Enabled
- ✅ **Access logging**: Enabled (optional)

## 🚨 **Troubleshooting**

### Common Issues

| Error | Cause | Solution |
|-------|-------|----------|
| `NoSuchBucket` | Bucket doesn't exist | Create the bucket |
| `AccessDenied` | Wrong credentials/permissions | Check IAM permissions |
| `InvalidAccessKeyId` | Wrong access key | Verify AWS_ACCESS_KEY_ID |
| `UnknownError` | Network/connectivity | Check internet connection |

### Debug Commands

```bash
# Test AWS credentials
node diagnose-aws.js

# Test S3 connection
node test-s3-connection.js

# Check health endpoint
curl http://localhost:8080/health
```

## 📊 **Expected Health Improvement**

After S3 setup:

**Before**:
```json
{
  "summary": {
    "healthy": 6,
    "unhealthy": 1,
    "degraded": 1
  }
}
```

**After**:
```json
{
  "summary": {
    "healthy": 7,
    "unhealthy": 0,
    "degraded": 1
  }
}
```

## 🎯 **Next Steps**

1. ✅ **Create S3 bucket** (using one of the options above)
2. 🔄 **Restart your backend server**
3. 🏥 **Check health endpoint** - should show S3 as healthy
4. 🧪 **Test file upload** functionality
5. 📊 **Monitor S3 usage** in AWS Console

Once the S3 bucket is created, your application will have full file storage capabilities! 🚀