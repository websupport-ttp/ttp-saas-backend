// Create S3 bucket
require('dotenv').config();
const { S3Client, CreateBucketCommand, HeadBucketCommand, PutBucketVersioningCommand } = require('@aws-sdk/client-s3');

async function createS3Bucket() {
  console.log('🪣 Creating S3 Bucket...\n');
  
  const bucketName = process.env.AWS_S3_BUCKET_NAME;
  const region = process.env.AWS_REGION;
  
  if (!bucketName || !region) {
    console.log('❌ Missing AWS_S3_BUCKET_NAME or AWS_REGION in environment variables');
    return;
  }

  console.log(`📋 Bucket Details:`);
  console.log(`- Name: ${bucketName}`);
  console.log(`- Region: ${region}\n`);

  try {
    // Initialize S3 client
    const s3Client = new S3Client({
      region: region,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
      }
    });

    // Check if bucket already exists
    console.log('🔍 Checking if bucket already exists...');
    try {
      const headBucketCommand = new HeadBucketCommand({ Bucket: bucketName });
      await s3Client.send(headBucketCommand);
      console.log('✅ Bucket already exists and is accessible!');
      return;
    } catch (error) {
      if (error.name !== 'NoSuchBucket') {
        throw error;
      }
      console.log('📦 Bucket does not exist, creating...');
    }

    // Create bucket
    const createBucketParams = {
      Bucket: bucketName
    };

    // For regions other than us-east-1, we need to specify the location constraint
    if (region !== 'us-east-1') {
      createBucketParams.CreateBucketConfiguration = {
        LocationConstraint: region
      };
    }

    const createCommand = new CreateBucketCommand(createBucketParams);
    await s3Client.send(createCommand);
    
    console.log('✅ Bucket created successfully!');

    // Enable versioning (optional but recommended)
    console.log('🔧 Enabling bucket versioning...');
    try {
      const versioningCommand = new PutBucketVersioningCommand({
        Bucket: bucketName,
        VersioningConfiguration: {
          Status: 'Enabled'
        }
      });
      await s3Client.send(versioningCommand);
      console.log('✅ Bucket versioning enabled');
    } catch (versioningError) {
      console.log('⚠️ Could not enable versioning:', versioningError.message);
    }

    // Verify bucket creation
    console.log('\n🔍 Verifying bucket creation...');
    const headBucketCommand = new HeadBucketCommand({ Bucket: bucketName });
    await s3Client.send(headBucketCommand);
    console.log('✅ Bucket verification successful!');

    console.log('\n🎉 S3 bucket setup completed successfully!');
    console.log(`✅ Bucket "${bucketName}" is ready for use`);

  } catch (error) {
    console.log('\n❌ Failed to create S3 bucket:');
    console.log(`Error: ${error.message}`);
    
    if (error.code === 'BucketAlreadyExists') {
      console.log('💡 Bucket name is already taken globally. Try a different name.');
    } else if (error.code === 'BucketAlreadyOwnedByYou') {
      console.log('✅ Bucket already exists and is owned by you');
    } else if (error.code === 'InvalidAccessKeyId') {
      console.log('💡 Check your AWS_ACCESS_KEY_ID');
    } else if (error.code === 'SignatureDoesNotMatch') {
      console.log('💡 Check your AWS_SECRET_ACCESS_KEY');
    } else if (error.code === 'AccessDenied') {
      console.log('💡 Your AWS credentials do not have permission to create buckets');
    }
  }
}

createS3Bucket().catch(console.error);