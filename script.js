// --- IMPORTANT: ADD YOUR SUPABASE DETAILS HERE ---
const SUPABASE_URL = 'https://your-project-id.supabase.co';
const SUPABASE_ANON_KEY = 'your-public-anon-key-here';
// ------------------------------------------------

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- DOM Elements ---
const userStatusDiv = document.getElementById('userStatus');
const authFormDiv = document.getElementById('auth-form');
const uploadSectionDiv = document.getElementById('uploadSection');
const signUpBtn = document.getElementById('signUpBtn');
const signOutBtn = document.getElementById('signOutBtn');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');

const uploadForm = document.getElementById('uploadForm');
const fileInput = document.getElementById('document');
const statusDiv = document.getElementById('status-message');
const resultDiv = document.getElementById('result');
const submitBtn = document.getElementById('submitBtn');

// --- Auth Functions ---
signUpBtn.addEventListener('click', async () => {
    const email = emailInput.value;
    const password = passwordInput.value;
    
    // First, try to sign in
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    if (signInError) {
        // If sign in fails, try to sign up the user
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({ email, password });
        if (signUpError) {
            userStatusDiv.textContent = `Error: ${signUpError.message}`;
            return;
        }
        if (signUpData.user) {
            userStatusDiv.textContent = 'Signed up! Check your email to verify.';
        }
    }
});

signOutBtn.addEventListener('click', async () => {
    await supabase.auth.signOut();
});

// --- UI Management ---
const manageUI = (user) => {
    if (user) {
        userStatusDiv.textContent = `Signed in as: ${user.email}`;
        authFormDiv.style.display = 'none';
        signOutBtn.style.display = 'block';
        uploadSectionDiv.style.display = 'block';
    } else {
        userStatusDiv.textContent = 'You are not signed in.';
        authFormDiv.style.display = 'block';
        signOutBtn.style.display = 'none';
        uploadSectionDiv.style.display = 'none';
    }
};

// Listen for authentication state changes
supabase.auth.onAuthStateChange((event, session) => {
    manageUI(session?.user ?? null);
});

// --- Upload Logic ---
uploadForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        statusDiv.innerHTML = '<p class="error-message">You must be signed in to notarize a document.</p>';
        return;
    }

    const file = fileInput.files[0];
    if (!file) {
        statusDiv.innerHTML = '<p class="error-message">Please select a file to notarize.</p>';
        return;
    }

    const formData = new FormData();
    formData.append('document', file);
    
    submitBtn.disabled = true;
    submitBtn.textContent = 'Processing...';
    statusDiv.innerHTML = '<p>Uploading and notarizing, please wait...</p>';
    resultDiv.innerHTML = '';

    try {
        const response = await fetch('http://localhost:3000/notarize', {
            method: 'POST',
            headers: {
                // IMPORTANT: Add the Authorization header with the token
                'Authorization': `Bearer ${session.access_token}`
            },
            body: formData,
        });

        const result = await response.json();

        if (result.success) {
            statusDiv.innerHTML = '<p class="success-message">✅ Document Notarized Successfully!</p>';
            resultDiv.innerHTML = `
                <div class="document-item">
                    <h3>Notarization Details</h3>
                    <div class="document-meta">
                        <span class="document-label">Name:</span> 
                        <span>${result.document.name}</span>
                        <span class="document-label">Hash (SHA-256):</span> 
                        <span style.font-family: monospace;">${result.document.hash}</span>
                        <span class="document-label">Document URL:</span> 
                        <span><a href="${result.document.url}" target="_blank">View Document</a></span>
                        <span class="document-label">Timestamp:</span> 
                        <span>${new Date(result.document.timestamp).toLocaleString()}</span>
                    </div>
                </div>`;
            uploadForm.reset();
        } else {
            throw new Error(result.error || 'An unknown error occurred.');
        }
    } catch (error) {
        statusDiv.innerHTML = `<p class="error-message">❌ Error: ${error.message}</p>`;
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = '🔐 Notarize Document';
    }
});
