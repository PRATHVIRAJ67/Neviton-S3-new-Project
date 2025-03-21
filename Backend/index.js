const express = require("express");
const cors = require("cors");
const fs = require("fs");
const { S3Client } = require("@aws-sdk/client-s3");
const { Upload } = require("@aws-sdk/lib-storage");
const multer = require("multer");
const dotenv = require("dotenv");

dotenv.config();

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({ origin: "*", credentials: true }));

const upload = multer({ storage: multer.memoryStorage() });

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

app.post("/api/upload-to-s3", upload.single("file"), async (req, res) => {
  const { file } = req;
  const { filename } = req.body;

  if (!file || !filename) {
    return res.status(400).json({ error: "File and filename are required" });
  }

  const params = {
    Bucket: process.env.S3_BUCKET_NAME,
    Key: filename,
    Body: file.buffer,
    ContentType: file.mimetype,
    ContentDisposition: "inline",
  };

  try {
    const upload = new Upload({
      client: s3Client,
      params,
      leavePartsOnError: false, // Clean up any parts if the upload fails
    });

    await upload.done();
    res.json({ message: "File uploaded successfully" });
  } catch (error) {
    console.error(`Error uploading file to S3: ${error.message}`);
    res.status(500).json({ error: `Failed to upload file to S3: ${error.message}` });
  }
});

app.post("/api/get-local-file", (req, res) => {
  const { path: filePath } = req.body;
  if (!filePath) {
    return res.status(400).json({ error: "File path is required" });
  }
  try {
    const fileStream = fs.createReadStream(filePath.replace(/"/g, ''));
    res.setHeader("Content-Disposition", `attachment; filename="${filePath.split('/').pop()}"`);
    fileStream.pipe(res);
  } catch (error) {
    console.error(`Error reading local file: ${error.message}`);
    res.status(500).json({ error: `Error reading local file: ${error.message}` });
  }
});

app.post("/api/ping", (req, res) => {
  res.send("Server is running");
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});