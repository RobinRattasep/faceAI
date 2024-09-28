const uploadBtn = document.getElementById('upload-btn');
const fileInput = document.getElementById('file-input');
const preview = document.getElementById('preview');
const submitBtn = document.getElementById('submit-btn');
const loadingText = document.getElementById('loading');
const paywall = document.querySelector('.paywall');
const feedbackText = document.getElementById('feedback-text');
const ratingSpan = document.getElementById('rating');
const selfieBtn = document.getElementById('take-selfie-btn');

// Show the file input when the Upload button is clicked
uploadBtn.addEventListener('click', () => fileInput.click());

// Take a selfie (opens camera)
selfieBtn.addEventListener('click', () => {
    navigator.mediaDevices.getUserMedia({ video: true })
        .then(stream => {
            const video = document.createElement('video');
            document.body.append(video);
            video.srcObject = stream;
            video.play();

            setTimeout(() => {
                stream.getTracks().forEach(track => track.stop());
                document.body.removeChild(video);
                fileInput.click(); // Simulate file input trigger
            }, 5000);
        })
        .catch(err => console.error("Camera access denied:", err));
});

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

// Submit the selfie for analysis
submitBtn.addEventListener('click', async () => {
    submitBtn.classList.add('hidden');
    loadingText.classList.remove('hidden');

    const file = fileInput.files[0];
    const formData = new FormData();
    formData.append('image', file); // Attach image file

    try {
        const response = await fetch('http://localhost:3000/upload-image', {
            method: 'POST',
            body: formData,
        });

        const data = await response.json();

        if (data.error) {
            console.error('Error from server:', data.error);
            loadingText.textContent = "An error occurred during the upload.";
            return;
        }

        // Image uploaded successfully, now analyze
        const imageUrl = data.imageUrl;
        const analysisResponse = await fetch('http://localhost:3000/analyze-selfie', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imageUrl }),
        });

        const analysisData = await analysisResponse.json();

        // Show feedback and rating
        feedbackText.textContent = analysisData.feedback;
        ratingSpan.textContent = `${analysisData.objects}/10`;

        loadingText.classList.add('hidden');
        paywall.classList.remove('hidden');
    } catch (error) {
        console.error('Error during analysis:', error);
        loadingText.textContent = "An error occurred during the analysis.";
    }
});
