// Diagnose AWS connection issues
require('dotenv').config();
const { S3Client, ListBucketsCommand } = require('@aws-sdk/client-s3');

async function diagnoseAWS() {
  console.log('🔍 AWS Connection Diagnosis\n');
  
  // Check environment variables
  console.log('📋 Environment Variables:');
  console.log(`- AWS_REGION: ${process.env.AWS_REGION || 'NOT SET'}`);
  console.log(`- AWS_S3_BUCKET_NAME: ${process.env.AWS_S3_BUCKET_NAME || 'NOT SET'}`);
  console.log(`- AWS_ACCESS_KEY_ID: ${process.env.AWS_ACCESS_KEY_ID ? `${process.env.AWS_ACCESS_KEY_ID.substring(0, 8)}...` : 'NOT SET'}`);
  console.log(`- AWS_SECRET_ACCESS_KEY: ${process.env.AWS_SECRET_ACCESS_KEY ? `${process.env.AWS_SECRET_ACCESS_KEY.substring(0, 8)}...` : 'NOT SET'}\n`);

  if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    console.log('❌ Missing AWS credentials');
    return;
  }

  try {
    // Test basic AWS connectivity by listing buckets
    console.log('🔧 Testing AWS credentials...');
    
    const s3Client = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
      }
    });

    const listBucketsCommand = new ListBucketsCommand({});
    const result = await s3Client.send(listBucketsCommand);
    
    console.log('✅ AWS credentials are valid!');
    console.log(`📦 Found ${result.Buckets.length} existing buckets:`);
    
    if (result.Buckets.length > 0) {
      result.Buckets.forEach(bucket => {
        console.log(`  - ${bucket.Name} (created: ${bucket.CreationDate})`);
      });
    } else {
      console.log('  (No buckets found)');
    }

    // Check if our target bucket exists
    const targetBucket = process.env.AWS_S3_BUCKET_NAME;
    const bucketExists = result.Buckets.some(bucket => bucket.Name === targetBucket);
    
    if (bucketExists) {
      console.log(`\n✅ Target bucket "${targetBucket}" already exists!`);
    } else {
      console.log(`\n📦 Target bucket "${targetBucket}" does not exist yet`);
      console.log('💡 You can create it using the AWS Console or CLI');
    }

  } catch (error) {
    console.log('\n❌ AWS connection failed:');
    console.log(`Error Name: ${error.name}`);
    console.log(`Error Code: ${error.code || 'N/A'}`);
    console.log(`Error Message: ${error.message}`);
    
    // Provide specific guidance based on error
    if (error.code === 'InvalidAccessKeyId') {
      console.log('\n💡 Solutions:');
      console.log('- Check your AWS_ACCESS_KEY_ID is correct');
      console.log('- Ensure the access key is active in AWS IAM');
    } else if (error.code === 'SignatureDoesNotMatch') {
      console.log('\n💡 Solutions:');
      console.log('- Check your AWS_SECRET_ACCESS_KEY is correct');
      console.log('- Ensure there are no extra spaces or characters');
    } else if (error.code === 'AccessDenied') {
      console.log('\n💡 Solutions:');
      console.log('- Check IAM permissions for S3 access');
      console.log('- Ensure the user has S3 ListBuckets permission');
    } else if (error.name === 'UnknownError') {
      console.log('\n💡 This might be a network connectivity issue');
      console.log('- Check your internet connection');
      console.log('- Try again in a few minutes');
      console.log('- Check if AWS services are experiencing issues');
    }
  }
}

diagnoseAWS().catch(console.error);