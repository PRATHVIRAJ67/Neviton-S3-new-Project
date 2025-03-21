import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import axios from 'axios';
import { Box, Button, CircularProgress, Typography, Stack } from '@mui/material';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

axios.defaults.timeout = 30000;

const UploadToS3 = () => {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const sanitizeFilename = (name) => name.replace(/[^a-zA-Z0-9.\-]/g, '').split(/[\/\\]/).pop();

  const getFileExtensionFromPath = (path) => {
    const parts = path.split('.');
    return parts.length > 1 ? parts.pop().toLowerCase() : '';
  };

  const handleUpload = async () => {
    if (!file) {
      toast.error('Please select a file first');
      return;
    }

    setUploading(true);
    toast.info('Upload in progress...');

    const reader = new FileReader();
    reader.onload = async (e) => {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

      for (const row of worksheet) {
        try {
          const { Name, File_Link } = row;
          if (!Name || !File_Link) {
            toast.warning('Missing required fields. Skipping.');
            continue;
          }

          const response = await axios.post('http://localhost:5000/api/get-local-file', { path: File_Link }, { responseType: 'blob' });
          const fileBlob = response.data;
          const extension = getFileExtensionFromPath(File_Link);
          const filename = `${sanitizeFilename(Name)}.${extension}`;

          const formData = new FormData();
          formData.append('file', fileBlob, filename);
          formData.append('filename', filename);

          await axios.post('http://localhost:5000/api/upload-to-s3', formData, {
            headers: {
              'Content-Type': 'multipart/form-data',
            },
          });

          toast.success(`Uploaded ${filename} successfully!`);
        } catch (error) {
          console.error(`Error processing row: ${error.message}`);
          toast.error(`Error processing row: ${error.message}`);
        }
      }

      setUploading(false);
    };
    reader.readAsArrayBuffer(file);
  };

  return (
    <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" minHeight="100vh" p={4}>
      <Typography variant="h4" gutterBottom>Please Upload Excel File</Typography>
      <input type="file" accept=".xlsx,.xls" onChange={handleFileChange} style={{ marginBottom: '20px' }} disabled={uploading} />
      
      <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
        <Button 
          variant="contained" 
          color="primary" 
          onClick={handleUpload} 
          disabled={uploading || !file}
        >
          {uploading ? 'Uploading...' : 'Submit'}
        </Button>
      </Stack>
      
      {uploading && <CircularProgress />}
      
      <ToastContainer position="bottom-right" />
    </Box>
  );
};

export default UploadToS3;