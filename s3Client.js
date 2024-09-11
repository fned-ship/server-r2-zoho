const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const dotenv =require('dotenv');
// Initialize Cloudflare R2 Client

dotenv.config();


const s3Client = new S3Client({
    region: process.env.R2_REGION,
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
});

const putObject = async (bucket, key, body) => {
  try {
    const command = new PutObjectCommand({ Bucket: bucket, Key: key, Body: body });
    await s3Client.send(command);
  } catch (error) {
    console.error('Error uploading object:', error);
  }
};

const getObject = async (bucket, key) => {
  try {
    const command = new GetObjectCommand({ Bucket: bucket, Key: key });
    const response = await s3Client.send(command);
    return response; // .Body
  } catch (error) {
    console.error('Error retrieving object:', error);
  }
};

const deleteObject = async (bucket, key) => {
  try {
    const command = new DeleteObjectCommand({ Bucket: bucket, Key: key });
    await s3Client.send(command);
  } catch (error) {
    console.error('Error deleting object:', error);
  }
};

module.exports = { s3Client, putObject, getObject, deleteObject };
