import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import axios from 'axios';
import { Box, Button, CircularProgress, Typography, Stack } from '@mui/material';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

axios.defaults.timeout = 60000;

const UploadToS3 = () => {
  const [excelFile, setExcelFile] = useState(null);
  const [zipFile, setZipFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [totalRows, setTotalRows] = useState(0);

  const handleExcelFileChange = (e) => {
    setExcelFile(e.target.files[0]);
  };

  const handleZipFileChange = (e) => {
    setZipFile(e.target.files[0]);
  };

  const sanitizeFilename = (name) => {
    return (name || '')
      .replace(/[^a-zA-Z0-9.\-_]/g, '')
      .split(/[\/\\]/)
      .pop();
  };

  const getFileExtensionFromPath = (path) => {
    if (!path) return '';
    const parts = path.split('.');
    return parts.length > 1 ? parts.pop().toLowerCase() : '';
  };

  const handleUpload = async () => {
    if (!excelFile || !zipFile) {
      toast.error('Please select both Excel and ZIP files');
      return;
    }

    setUploading(true);
    setProgress(0);
    toast.info('Upload in progress...');

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
        
        setTotalRows(worksheet.length);
        let successCount = 0;
        let errorCount = 0;

        for (let i = 0; i < worksheet.length; i++) {
          const row = worksheet[i];
          try {
            const { Name, File_Link } = row;
            if (!Name || !File_Link) {
              toast.warning(`Row ${i+1}: Missing required fields. Skipping.`);
              errorCount++;
              continue;
            }

            const normalizedPath = File_Link.replace(/^["']|["']$/g, '');
            
            toast.info(`Processing: ${normalizedPath}`, { autoClose: 2000 });
            
            const response = await axios.post('http://localhost:5000/api/get-local-file', 
              { path: normalizedPath }, 
              { responseType: 'blob' }
            );
            
            const fileBlob = response.data;
            const extension = getFileExtensionFromPath(normalizedPath) || 'zip';
            const filename = `${sanitizeFilename(Name) || `file_${i}`}.${extension}`;

            const formData = new FormData();
            formData.append('file', fileBlob, filename);
            formData.append('filename', filename);

            await axios.post('http://localhost:5000/api/upload-to-s3', formData, {
              headers: {
                'Content-Type': 'multipart/form-data',
              },
            });

            successCount++;
            toast.success(`Uploaded ${filename} successfully!`);
          } catch (error) {
            console.error(`Error processing row ${i+1}: ${error.message}`);
            toast.error(`Error processing row ${i+1}: ${error.message}`);
            errorCount++;
          }
          
          setProgress(Math.round(((i + 1) / worksheet.length) * 100));
        }

       
        const zipFormData = new FormData();
        zipFormData.append('file', zipFile);
        zipFormData.append('filename', sanitizeFilename(zipFile.name));

        await axios.post('http://localhost:5000/api/upload-to-s3', zipFormData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });

        const excelFormData = new FormData();
        excelFormData.append('file', excelFile);
        excelFormData.append('filename', sanitizeFilename(excelFile.name));

        await axios.post('http://localhost:5000/api/upload-to-s3', excelFormData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });

        toast.success(`Uploaded ZIP and Excel files successfully!`);
        toast.info(`Upload completed. Success: ${successCount}, Errors: ${errorCount}`);
      } catch (error) {
        console.error(`Error processing Excel file: ${error.message}`);
        toast.error(`Error processing Excel file: ${error.message}`);
      }
      
      setUploading(false);
    };
    
    reader.readAsArrayBuffer(excelFile);
  };

  return (
    <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" minHeight="100vh" p={4}>
      <Typography variant="h4" gutterBottom>Please Upload Excel and ZIP Files</Typography>
      <input type="file" accept=".xlsx,.xls" onChange={handleExcelFileChange} style={{ marginBottom: '20px' }} disabled={uploading} />
      <input type="file" accept=".zip" onChange={handleZipFileChange} style={{ marginBottom: '20px' }} disabled={uploading} />
      
      <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
        <Button 
          variant="contained" 
          color="primary" 
          onClick={handleUpload} 
          disabled={uploading || !excelFile || !zipFile}
        >
          {uploading ? 'Uploading...' : 'Submit'}
        </Button>
      </Stack>
      
      {uploading && (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mt: 2 }}>
          <CircularProgress variant="determinate" value={progress} />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            {progress}% Complete ({Math.round((progress * totalRows) / 100)} of {totalRows} files)
          </Typography>
        </Box>
      )}
      
      <ToastContainer position="bottom-right" />
    </Box>
  );
};

export default UploadToS3;