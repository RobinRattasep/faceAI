const express = require('express');
const axios = require('axios');
const cors = require('cors');
const multer = require('multer');
const { BlobServiceClient } = require('@azure/storage-blob'); // Azure Blob Storage SDK
const path = require('path');
const fs = require('fs');

// Azure Configuration
// Correct Azure Configuration
const AZURE_STORAGE_CONNECTION_STRING = 'aa'; // Full connection string
const containerName = 'aaa'; // Ensure it's lowercase and follows naming conventions
const AZURE_API_KEY = 'aaa'; // Your actual Azure Computer Vision API key
const AZURE_API_ENDPOINT = 'aaa'; // Make sure the region is correct


const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ dest: 'uploads/' }); // Directory for temporary file storage

// Serve static files from the "public" directory
app.use(express.static(path.join(__dirname, 'public')));

// Function to upload an image to Azure Blob Storage
async function uploadToAzure(file) {
    try {
        if (!AZURE_STORAGE_CONNECTION_STRING) {
            throw new Error('Azure Storage connection string is missing.');
        }

        const blobServiceClient = BlobServiceClient.fromConnectionString(AZURE_STORAGE_CONNECTION_STRING);
        const containerClient = blobServiceClient.getContainerClient(containerName);

        const blobName = file.originalname;
        const blockBlobClient = containerClient.getBlockBlobClient(blobName);

        console.log('Uploading file to Azure:', blobName);
        await blockBlobClient.uploadFile(file.path);
        console.log('File uploaded successfully:', blobName);

        // Return the public URL to the blob
        const publicUrl = `https://${blobServiceClient.accountName}.blob.core.windows.net/${containerName}/${blobName}`;
        return publicUrl;

    } catch (error) {
        console.error('Error uploading to Azure Blob:', error);
        throw error;
    }
}


// Endpoint to handle image uploads
app.post('/upload-image', upload.single('image'), async (req, res) => {
    try {
        const file = req.file;

        if (!file) {
            throw new Error('No file received');
        }

        console.log('Received file for upload:', file);
        const imageUrl = await uploadToAzure(file);
        fs.unlinkSync(file.path); // Remove temporary file

        res.json({ imageUrl });
    } catch (error) {
        console.error('Error uploading image to Azure:', error);
        res.status(500).json({ error: 'Error uploading image to Azure' });
    }
});

// Endpoint to analyze the selfie
app.post('/analyze-selfie', async (req, res) => {
    const imageUrl = req.body.imageUrl;

    if (!imageUrl || !imageUrl.startsWith('http')) {
        return res.status(400).json({ error: 'Invalid or missing image URL' });
    }

    try {
        const response = await axios.post(
            AZURE_API_ENDPOINT,
            { url: imageUrl },
            {
                headers: {
                    'Ocp-Apim-Subscription-Key': AZURE_API_KEY,
                    'Content-Type': 'application/json',
                },
                params: {
                    visualFeatures: 'Description,Tags,Objects', // Features we want to analyze
                },
            }
        );

        const imageData = response.data;

        if (!imageData || Object.keys(imageData).length === 0) {
            return res.status(404).json({ error: 'No data found for the image' });
        }

        const feedback = generateFeedback(imageData.description, imageData.tags);
        const objects = imageData.objects.map(obj => obj.object).join(', ');

        res.json({ feedback, objects });
    } catch (error) {
        console.error('Error from Azure Computer Vision API:', error.response ? error.response.data : error.message);
        res.status(500).json({ error: 'Error analyzing the image' });
    }
});

// Generate feedback based on image description and tags
function generateFeedback(description, tags) {
    let feedback = '';
    feedback += description.captions.length > 0 ? `Description: ${description.captions[0].text}. ` : 'No description available. ';
    feedback += `Tags: ${tags.map(tag => tag.name).join(', ')}.`;

    return feedback;
}

// Start the server
const port = 3000;
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
