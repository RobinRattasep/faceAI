const express = require('express');
const axios = require('axios');
const cors = require('cors');
const multer = require('multer');
const { BlobServiceClient } = require('@azure/storage-blob');
const path = require('path');
const fs = require('fs');

// Azure Blob Storage Configuration

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ dest: 'uploads/' }); // Directory for temporary file storage

// Serve static files from the "public" directory
app.use(express.static(path.join(__dirname, 'public')));

// Function to upload an image to Azure Blob Storage
async function uploadToAzure(file) {
    try {
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
            return res.status(400).json({ error: 'No file received' });
        }

        const imageUrl = await uploadToAzure(file);
        fs.unlinkSync(file.path); // Remove temporary file
        res.json({ imageUrl });
    } catch (error) {
        console.error('Error uploading image to Azure:', error);
        res.status(500).json({ error: 'Error uploading image to Azure' });
    }
});

// Endpoint to analyze the selfie using Azure Computer Vision and ChatGPT
app.post('/analyze-selfie', async (req, res) => {
    const imageUrl = req.body.imageUrl;
    if (!imageUrl || !imageUrl.startsWith('http')) {
        return res.status(400).json({ error: 'Invalid or missing image URL' });
    }

    try {
        // Step 1: Use Azure Computer Vision API to analyze the image
        const visionResponse = await axios.post(
            `${AZURE_VISION_API_ENDPOINT}`,
            {
                url: imageUrl,
            },
            {
                headers: {
                    'Ocp-Apim-Subscription-Key': AZURE_VISION_API_KEY,
                    'Content-Type': 'application/json',
                },
                params: {
                    visualFeatures: 'Description,Tags,Objects,Faces', // Get description, tags, objects, faces
                },
            }
        );

        const visionData = visionResponse.data;
        const description = visionData.description.captions[0]?.text;
        const tags = visionData.tags.map(tag => tag.name).join(', ');
        console.log('Vision API results:', description, tags, visionData);
        // Step 2: Send a prompt to ChatGPT to generate feedback based on the Vision API results
        const prompt = `
            Here is an image description: ${description}.
            The tags are: ${tags}.
            You will rate this person based on their facial features. Your response will looks like this: "[FACIAL FEATURE]: 3/10 - [WHATS GOOD AND BAD] - [Some instructions to fix it].".
            Your ratings will be based on the following features: Eyebrows, Eyes, Nose, Lips, Face Shape, Skin, Hair, Overall Appearance.
            Your ratings will be from 1 to 10, with 1 being the worst and 10 being the best.
            Your ratings should be honest and constructive.
            After that, give a general feedback on the overall appearance of the person and some feedback on how they can improve their appearance.
            Your response shouldnt include any AI text, only your analysis.
            Please analyze these features and provide feedback and improvements.
        `;

        const gptResponse = await axios.post(
            'https://api.openai.com/v1/chat/completions',
            {
                model: 'gpt-4-turbo',
                messages: [
                    { role: 'system', content: 'You are an expert image analyst specialized in facial feature evaluation. You if you have something not so pleasant to hear to tell, then you will say what is your mind, you are honest and you arent afraid to tell people what they need to hear. If they have some facial attributes that arent so pretty, then you will say that.' },
                    { role: 'user', content: prompt },
                ],
                max_tokens: 500,
                temperature: 0.7,
            },
            {
                headers: {
                    Authorization: `Bearer ${CHATGPT_API_KEY}`,
                    'Content-Type': 'application/json',
                },
            }
        );

        const feedback = gptResponse.data.choices[0].message.content;
        res.json({ feedback });
    } catch (error) {
        console.error('Error analyzing the selfie:', error.response ? error.response.data : error.message);
        res.status(500).json({ error: 'Error analyzing the selfie' });
    }
});

// Start the server
const port = 3000;
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});