// Test S3 connection
require('dotenv').config();
const { S3Client, HeadBucketCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');

async function testS3Connection() {
  console.log('🔍 Testing S3 Connection...\n');
  
  // Check environment variables
  console.log('📋 Environment Variables:');
  console.log(`- AWS_REGION: ${process.env.AWS_REGION || 'NOT SET'}`);
  console.log(`- AWS_S3_BUCKET_NAME: ${process.env.AWS_S3_BUCKET_NAME || 'NOT SET'}`);
  console.log(`- AWS_ACCESS_KEY_ID: ${process.env.AWS_ACCESS_KEY_ID ? 'SET' : 'NOT SET'}`);
  console.log(`- AWS_SECRET_ACCESS_KEY: ${process.env.AWS_SECRET_ACCESS_KEY ? 'SET' : 'NOT SET'}\n`);

  if (!process.env.AWS_S3_BUCKET_NAME || !process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    console.log('❌ Missing required AWS environment variables');
    return;
  }

  try {
    // Initialize S3 client
    const s3Client = new S3Client({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
      }
    });

    console.log('🔧 S3 Client initialized successfully');

    // Test 1: Check if bucket exists
    console.log('\n📦 Testing bucket access...');
    try {
      const headBucketCommand = new HeadBucketCommand({ 
        Bucket: process.env.AWS_S3_BUCKET_NAME 
      });
      await s3Client.send(headBucketCommand);
      console.log('✅ Bucket exists and is accessible');
    } catch (error) {
      if (error.name === 'NoSuchBucket') {
        console.log('❌ Bucket does not exist');
        console.log(`💡 Create bucket: aws s3 mb s3://${process.env.AWS_S3_BUCKET_NAME} --region ${process.env.AWS_REGION}`);
        return;
      } else if (error.name === 'AccessDenied') {
        console.log('❌ Access denied - check credentials and permissions');
        return;
      } else {
        throw error;
      }
    }

    // Test 2: List objects (limited)
    console.log('\n📁 Testing list objects...');
    try {
      const listCommand = new ListObjectsV2Command({
        Bucket: process.env.AWS_S3_BUCKET_NAME,
        MaxKeys: 5
      });
      const result = await s3Client.send(listCommand);
      console.log(`✅ Listed objects successfully (${result.KeyCount || 0} objects found)`);
    } catch (error) {
      console.log('❌ Failed to list objects:', error.message);
      return;
    }

    console.log('\n🎉 S3 connection test completed successfully!');
    console.log('✅ Your S3 setup is working correctly');

  } catch (error) {
    console.log('\n❌ S3 connection test failed:');
    console.log(`Error: ${error.message}`);
    
    if (error.code === 'InvalidAccessKeyId') {
      console.log('💡 Check your AWS_ACCESS_KEY_ID');
    } else if (error.code === 'SignatureDoesNotMatch') {
      console.log('💡 Check your AWS_SECRET_ACCESS_KEY');
    } else if (error.code === 'InvalidBucketName') {
      console.log('💡 Check your AWS_S3_BUCKET_NAME');
    }
  }
}

testS3Connection().catch(console.error);