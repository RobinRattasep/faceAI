const uploadBtn = document.getElementById('upload-btn');
const fileInput = document.getElementById('file-input');
const preview = document.getElementById('preview');
const submitBtn = document.getElementById('submit-btn');
const feedbackText = document.getElementById('feedback-text');
const loadingText = document.getElementById('loading');

// Show the file input when the Upload button is clicked
uploadBtn.addEventListener('click', () => fileInput.click());

// Display preview of uploaded image
fileInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            preview.src = e.target.result;
            preview.classList.remove('hidden');
            submitBtn.classList.remove('hidden');
        };
        reader.readAsDataURL(file);
    }
});

// Submit the image for analysis
submitBtn.addEventListener('click', async () => {
    submitBtn.classList.add('hidden');
    loadingText.classList.remove('hidden');

    try {
        const file = fileInput.files[0];
        const formData = new FormData();
        formData.append('image', file);

        // Upload the image to the server
        const uploadResponse = await fetch('http://localhost:3000/upload-image', {
            method: 'POST',
            body: formData,
        });
        const uploadData = await uploadResponse.json();

        // Send the image URL to analyze it
        const analysisResponse = await fetch('http://localhost:3000/analyze-selfie', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ imageUrl: uploadData.imageUrl }),
        });

        const analysisData = await analysisResponse.json();
        feedbackText.textContent = analysisData.feedback;

    } catch (error) {
        console.error('Error during analysis:', error);
        feedbackText.textContent = 'An error occurred during the analysis.';
    } finally {
        loadingText.classList.add('hidden');
    }
});
