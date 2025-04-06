# **ETL Script for Exporting PostgreSQL Data to AWS S3**

## **Overview**
This Node.js script exports data from a PostgreSQL database and streams it directly to an AWS S3 bucket in CSV format. It is optimized for handling large tables (up to 12GB per table) efficiently, without excessive memory usage or overloading the production database.

## **Features**
- Uses PostgreSQL `COPY TO STDOUT` for efficient data extraction.
- Transforms data on the fly by adding a prefix (`x-`) to each column value.
- Streams data directly to S3 without saving intermediate files on disk.
- Implements optimizations to reduce memory consumption and database load.

## **Optimizations Implemented**
### **1. Streaming Data Instead of Buffering**
- Uses **Node.js streams** to process data in chunks.
- Avoids loading the entire dataset into memory.
- Uses `PassThrough` to ensure smooth flow between PostgreSQL and S3.

### **2. Reducing Load on Production Database**
- Uses **`COPY (SELECT * FROM large_table ORDER BY id LIMIT 1000000) TO STDOUT`** instead of dumping the whole table at once.
- Helps **reduce CPU & I/O spikes** by processing data in manageable chunks.
- **Encouraged to run on a Read Replica** instead of the primary database.

### **3. Efficient Transformation with Streams**
- Uses a **Transform stream** to modify each row on the fly.
- Ensures **only transformed data reaches S3** without holding large chunks in memory.

### **4. Optimized S3 Upload**
- Direct streaming to S3 without creating local files.
- **Leverages AWS SDK's automatic multipart upload** (if file size > 5MB).
- Uses **time-based dynamic S3 key naming** for better organization.

## **Potential Problems and How We Fixed Them**

### **1. High Memory Usage in Node.js**
**Problem:** If we loaded the entire dataset into memory before uploading to S3, it could lead to excessive RAM usage and potential crashes.
**Fix:** Used **streaming with `PassThrough`** to process data in small chunks and send it directly to S3, ensuring minimal memory footprint.

### **2. Overloading the Production Database**
**Problem:** Running a `COPY` command on a large table could consume too much CPU and disk I/O, slowing down other queries.
**Fix:** Limited the query with **`LIMIT 1000000`** and **ordered results by `id`**, reducing the workload per request. Also recommended running against a **Read Replica** instead of the primary database.

### **3. First Few Rows Not Transformed**
**Problem:** The script incorrectly assumed the first chunk of data contained only headers, leaving some rows untransformed.
**Fix:** Implemented logic to correctly detect and transform all data rows while keeping headers intact.

### **4. Inefficient S3 Uploads**
**Problem:** Uploading large files without optimization could result in slow performance.
**Fix:** Relied on **AWS SDK’s built-in multipart upload** to automatically split large files into smaller parts for faster transfers.

## **Requirements**
### **1. PostgreSQL Database**
Ensure you have a PostgreSQL database accessible. If running against production, consider using a Read Replica.

### **2. AWS Credentials**
Configure AWS credentials using environment variables or AWS IAM roles:
```sh
export AWS_ACCESS_KEY_ID=your_access_key
export AWS_SECRET_ACCESS_KEY=your_secret_key
export AWS_REGION=your_region
```

### **3. Node.js and Dependencies**
Install dependencies:
```sh
npm install dotenv pg pg-copy-streams aws-sdk
```

### **4. Formulate .env file from .env.example**
Formulate .env file from .env.example file with valid details

## **How to Run**
```sh
node app.js
```

## **Best Practices & Recommendations**
✅ Use **a Read Replica** to avoid impacting the production database.
✅ Monitor **database load (`pg_stat_activity`)** when running the script.
✅ Run **in a controlled environment first** before deploying to production.
✅ Use **a t3.medium or t3.large EC2 instance** to ensure sufficient performance.

---
