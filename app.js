
require('dotenv').config();
const AWS = require('aws-sdk');
const { createBrotliCompress, constants } = require('zlib');
const { PassThrough, Transform } = require('stream');
const { Pool } = require('pg');
const copyTo = require('pg-copy-streams').to;

// AWS S3 Configuration
const s3 = new AWS.S3();
const BUCKET_NAME = 'large-table-etl-demo';

// PostgreSQL Configuration
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

// Transform Stream: Add "x-" to Every Column Value (Except Header)
class DataTransformer extends Transform {
  constructor() {
    super();
    this.buffer = '';
    this.isFirstRow = true;
  }

  _transform(chunk, encoding, callback) {
    this.buffer += chunk.toString();
    const rows = this.buffer.split('\n');
    this.buffer = rows.pop(); // Keep last incomplete row in buffer

    const transformedRows = rows.map(row => {
      if (this.isFirstRow) {
        this.isFirstRow = false;
        return row; // Keep header row unchanged
      }

      const cols = row.split(',');
      return cols.map(value => (value.trim() ? `x-${value}` : value)).join(',');
    });

    this.push(transformedRows.join('\n') + '\n');
    callback();
  }

  _flush(callback) {
    if (this.buffer) {
      this.push(this.buffer + '\n');
    }
    callback();
  }
}

async function exportToS3() {
  const client = await pool.connect();
  try {
    console.log('Starting PostgreSQL COPY stream...');

    // Generate S3 File Key
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const s3Key = `exports/large_table_${timestamp}.csv.gz`;

    console.log(`Uploading to S3: s3://${BUCKET_NAME}/${s3Key}`);

    // Streaming Setup
    const passThrough = new PassThrough();
    
    const brotli = createBrotliCompress({
      params: {
        [constants.BROTLI_PARAM_QUALITY]: 6, // moderate cpu uses
      },
    });

    const queryStream = client.query(
      copyTo(`COPY ${process.env.TABLE_NAME} TO STDOUT WITH CSV HEADER`)
    );
    const transformStream = new DataTransformer();

    // Start S3 Upload
    const upload = s3.upload({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: s3Key,
      Body: passThrough,
      ContentType: 'application/gzip',
      ContentEncoding: 'gzip'
    });

    // Pipe: PostgreSQL => Transform => Gzip => S3
    queryStream.pipe(transformStream).pipe(brotli).pipe(passThrough);

    // Await Upload Completion
    await upload.promise();
    console.log(`Successfully uploaded to S3: s3://${BUCKET_NAME}/${s3Key}`);

  } catch (err) {
    console.error('Error:', err);
  } finally {
    client.release(); // Release DB connection
  }
}

exportToS3();
