let currentUser = null;

// ============================================================================
// 1. REFRESH = RESET LOGIC (Hard Logout on Page Reload)
// ============================================================================
document.addEventListener('DOMContentLoaded', () => {
    // Wipe any leftover memory so the browser completely forgets the user
    localStorage.removeItem('smartcampus_user');
    
    // Force the UI back to the home page (Login screen)
    showLoginForm(false);
});

// ============================================================================
// 2. GLOBAL BACK BUTTON LOGIC
// ============================================================================
function goBack() {
    if (window.history.length > 1) {
        window.history.back();
    } else {
        showLoginForm(false);
    }
}

window.addEventListener('popstate', (event) => {
    const state = event.state;
    if (state && state.page === 'reset') showResetForm(false);
    else if (state && state.page === 'dashboard' && currentUser) showDashboard(false);
    else showLoginForm(false); 
});

// ============================================================================
// 3. UI NAVIGATION
// ============================================================================
function showResetForm(pushHistory = true) {
    document.querySelectorAll('.card, .dashboard').forEach(el => el.classList.add('hidden'));
    document.getElementById('reset-section').classList.remove('hidden');
    document.getElementById('reset-msg').innerText = ''; 
    if (pushHistory) history.pushState({ page: 'reset' }, '', '#reset');
}

function showLoginForm(pushHistory = true) {
    document.querySelectorAll('.card, .dashboard').forEach(el => el.classList.add('hidden'));
    document.getElementById('login-section').classList.remove('hidden');
    document.getElementById('error-msg').innerText = ''; 
    if (pushHistory) history.pushState({ page: 'login' }, '', '#login');
}

function showDashboard(pushHistory = true) {
    document.querySelectorAll('.card, .dashboard').forEach(el => el.classList.add('hidden'));
    
    if (currentUser.role === 'student') renderStudentDashboard();
    if (currentUser.role === 'teacher') renderTeacherDashboard();
    if (currentUser.role === 'admin') renderAdminDashboard();
    
    if (pushHistory) history.pushState({ page: 'dashboard' }, '', '#dashboard');
}

// ============================================================================
// 4. SECURE PASSWORD RESET LOGIC
// ============================================================================
async function resetPassword() {
    const role = document.getElementById('reset-role').value;
    const username = document.getElementById('reset-username').value;
    const recoveryPin = document.getElementById('reset-pin').value;
    const newPassword = document.getElementById('reset-new-password').value;
    const msgEl = document.getElementById('reset-msg');

    if (!username || !recoveryPin || !newPassword) {
        msgEl.style.color = "red"; 
        msgEl.innerText = "Please fill in all fields."; 
        return;
    }

    try {
        const response = await fetch('/api/reset-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ role, username, recoveryPin, newPassword })
        });
        const data = await response.json();
        
        if (response.ok && data.success) {
            msgEl.style.color = "green"; 
            msgEl.innerText = data.message;
            document.getElementById('reset-username').value = '';
            document.getElementById('reset-pin').value = '';
            document.getElementById('reset-new-password').value = '';
        } else {
            msgEl.style.color = "red"; 
            msgEl.innerText = data.message; 
        }
    } catch (error) {
        msgEl.style.color = "red"; 
        msgEl.innerText = "Server error processing request.";
    }
}

// ============================================================================
// 5. AUTHENTICATION (Login & Logout)
// ============================================================================
async function login() {
    const role = document.getElementById('role').value;
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const errorMsg = document.getElementById('error-msg');
    
    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ role, username, password })
        });
        const data = await response.json();

        if (response.ok && data.success) {
            currentUser = data.user;
            errorMsg.innerText = "";
            showDashboard();
        } else {
            errorMsg.innerText = data.message || "Invalid credentials.";
        }
    } catch (error) { 
        errorMsg.innerText = "Server error."; 
    }
}

function logout() {
    currentUser = null;
    localStorage.removeItem('smartcampus_user');
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
    showLoginForm(); 
}

// ============================================================================
// 6. STUDENT FUNCTIONS
// ============================================================================
async function renderStudentDashboard() {
    document.getElementById('student-dashboard').classList.remove('hidden');
    const response = await fetch('/api/students');
    const students = await response.json();
    const myData = students.find(s => s._id === currentUser._id) || currentUser;

    document.getElementById('student-name').innerText = myData.name;
    document.getElementById('student-attendance').innerText = myData.attendance;
    document.getElementById('student-fees').innerText = myData.fees;
    document.getElementById('student-marks').innerHTML = `
        <li><span>Math</span> <strong>${myData.marks.math}</strong></li>
        <li><span>Science</span> <strong>${myData.marks.science}</strong></li>
    `;
    loadEvents('student-events-list');
    
    // Load materials explicitly into the student's UI container
    loadMaterials('student-files-list'); 
}

// ============================================================================
// 7. TEACHER FUNCTIONS
// ============================================================================
async function renderTeacherDashboard() {
    document.getElementById('teacher-dashboard').classList.remove('hidden');
    const tbody = document.getElementById('teacher-students-list');
    tbody.innerHTML = "<tr><td colspan='5'>Loading students...</td></tr>";
    
    try {
        const response = await fetch('/api/students');
        const students = await response.json();
        tbody.innerHTML = students.map(s => `
            <tr>
                <td><strong>${s.name}</strong></td>
                <td><input type="number" id="math-${s._id}" value="${s.marks.math}"></td>
                <td><input type="number" id="sci-${s._id}" value="${s.marks.science}"></td>
                <td><input type="number" id="att-${s._id}" value="${s.attendance}"></td>
                <td><button onclick="updateStudent('${s._id}')" class="btn-success" style="padding: 8px 12px; font-size: 13px;"><i class="fa-solid fa-check"></i> Save</button></td>
            </tr>
        `).join('');
    } catch (error) { 
        tbody.innerHTML = "<tr><td colspan='5'>Error loading students.</td></tr>"; 
    }

    // Load materials explicitly into the teacher's UI container
    loadMaterials('teacher-files-list');
}

async function updateStudent(studentId) {
    const math = document.getElementById(`math-${studentId}`).value;
    const science = document.getElementById(`sci-${studentId}`).value;
    const attendance = document.getElementById(`att-${studentId}`).value;
    const msgEl = document.getElementById('teacher-msg');
    
    try {
        const response = await fetch(`/api/students/${studentId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ marks: { math: Number(math), science: Number(science) }, attendance: Number(attendance) })
        });
        if (response.ok) {
            msgEl.style.color = "green"; 
            msgEl.innerText = "Grades saved!";
            setTimeout(() => msgEl.innerText = "", 3000); 
        }
    } catch (error) { 
        msgEl.style.color = "red"; 
        msgEl.innerText = "Error saving grades."; 
    }
}

// ============================================================================
// 8. ADMIN FUNCTIONS
// ============================================================================
function renderAdminDashboard() {
    document.getElementById('admin-dashboard').classList.remove('hidden');
    loadEvents('admin-events-list');
    loadManageUsers(); 
}

async function createNewStudent() {
    const name = document.getElementById('new-student-name').value;
    const username = document.getElementById('new-student-username').value;
    const password = document.getElementById('new-student-password').value;
    const recoveryPin = document.getElementById('new-student-pin').value;
    const msgEl = document.getElementById('admin-msg');
    
    if (!name || !username || !password || !recoveryPin) return msgEl.innerText = "Fill all fields.";

    const response = await fetch('/api/students', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, username, password, recoveryPin })
    });
    const data = await response.json();
    msgEl.style.color = data.success ? "green" : "red"; 
    msgEl.innerText = data.message;
    
    if (data.success) {
        document.getElementById('new-student-name').value = ''; 
        document.getElementById('new-student-username').value = '';
        document.getElementById('new-student-password').value = ''; 
        document.getElementById('new-student-pin').value = '';
        loadManageUsers(); 
    }
}

async function createNewTeacher() {
    const name = document.getElementById('new-teacher-name').value;
    const username = document.getElementById('new-teacher-username').value;
    const password = document.getElementById('new-teacher-password').value;
    const recoveryPin = document.getElementById('new-teacher-pin').value;
    const msgEl = document.getElementById('admin-teacher-msg');
    
    if (!name || !username || !password || !recoveryPin) return msgEl.innerText = "Fill all fields.";

    const response = await fetch('/api/teachers', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, username, password, recoveryPin })
    });
    const data = await response.json();
    msgEl.style.color = data.success ? "green" : "red"; 
    msgEl.innerText = data.message;
    
    if (data.success) {
        document.getElementById('new-teacher-name').value = ''; 
        document.getElementById('new-teacher-username').value = '';
        document.getElementById('new-teacher-password').value = ''; 
        document.getElementById('new-teacher-pin').value = '';
        loadManageUsers(); 
    }
}

async function loadManageUsers() {
    const list = document.getElementById('admin-users-list');
    list.innerHTML = "<tr><td colspan='4'>Loading...</td></tr>";
    
    try {
        const studentRes = await fetch('/api/students');
        const teacherRes = await fetch('/api/teachers');
        const allUsers = [...await teacherRes.json(), ...await studentRes.json()];

        if (allUsers.length === 0) list.innerHTML = "<tr><td colspan='4'>No users found.</td></tr>";
        else {
            list.innerHTML = allUsers.map(user => `
                <tr>
                    <td><strong>${user.name}</strong></td><td>${user.username}</td>
                    <td style="text-transform: capitalize;">${user.role}</td>
                    <td><button onclick="deleteUser('${user._id}')" style="background-color: #e74c3c; color: white; padding: 6px 12px; font-size: 13px; width: auto; border: none; cursor: pointer; border-radius: 4px;"><i class="fa-solid fa-trash"></i> Delete</button></td>
                </tr>
            `).join('');
        }
    } catch (error) { 
        console.error("Error loading users"); 
    }
}

async function deleteUser(userId) {
    if (!confirm("Are you sure you want to permanently delete this user?")) return;
    const msgEl = document.getElementById('admin-delete-msg');
    
    try {
        const response = await fetch(`/api/users/${userId}`, { method: 'DELETE' });
        const data = await response.json();
        
        if (response.ok && data.success) {
            msgEl.style.color = "green"; 
            msgEl.innerText = "User deleted successfully.";
            loadManageUsers(); 
            setTimeout(() => msgEl.innerText = "", 3000);
        } else {
            msgEl.style.color = "red"; 
            msgEl.innerText = "Failed to delete user.";
        }
    } catch (error) { 
        msgEl.style.color = "red"; 
        msgEl.innerText = "Server error deleting user."; 
    }
}

// ============================================================================
// 9. EVENTS & NOTICEBOARD
// ============================================================================
async function createNewEvent() {
    const title = document.getElementById('new-event-title').value;
    const date = document.getElementById('new-event-date').value;
    const msgEl = document.getElementById('event-msg');
    
    if (!title || !date) return msgEl.innerText = "Fill event details.";

    const response = await fetch('/api/events', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, date })
    });
    
    if (response.ok) {
        document.getElementById('new-event-title').value = ''; 
        document.getElementById('new-event-date').value = '';
        msgEl.style.color = "green"; 
        msgEl.innerText = "Event announced!";
        loadEvents('admin-events-list');
    }
}

async function loadEvents(elementId) {
    const response = await fetch('/api/events');
    const events = await response.json();
    const list = document.getElementById(elementId);
    
    if (events.length === 0) list.innerHTML = "<li>No upcoming events.</li>";
    else {
        list.innerHTML = events.map(e => `
            <li>
                <span style="color: var(--primary); font-weight: 600;">${e.title}</span>
                <span style="font-size: 13px; color: var(--text-muted);"><i class="fa-regular fa-clock"></i> ${e.date}</span>
            </li>
        `).join('');
    }
}

// ============================================================================
// 10. CLOUD LMS MODULE: PERMANENT UPLOADS & DOWNLOADS
// ============================================================================
async function uploadMaterial() {
    const titleInput = document.getElementById('upload-title').value;
    const fileInput = document.getElementById('upload-file').files[0];
    const msgEl = document.getElementById('upload-msg');

    if (!titleInput || !fileInput) {
        msgEl.style.color = "red"; 
        msgEl.innerText = "Please provide a title and select a file."; 
        return;
    }

    const formData = new FormData();
    formData.append('title', titleInput);
    formData.append('studyMaterial', fileInput);
    formData.append('uploaderName', currentUser.name);

    msgEl.style.color = "var(--primary)"; 
    msgEl.innerText = "Uploading to Cloud Database...";

    try {
        const response = await fetch('/api/upload', { method: 'POST', body: formData });
        const data = await response.json();
        
        if (response.ok && data.success) {
            msgEl.style.color = "green"; 
            msgEl.innerText = "File uploaded securely to cloud database!";
            document.getElementById('upload-title').value = ''; 
            document.getElementById('upload-file').value = '';
            
            // Instantly refresh the teacher's list after a successful upload
            loadMaterials('teacher-files-list');
        } else {
            msgEl.style.color = "red"; 
            msgEl.innerText = "Failed to upload file.";
        }
    } catch (error) { 
        msgEl.style.color = "red"; 
        msgEl.innerText = "Server error during upload."; 
    }
}

async function loadMaterials(elementId) {
    try {
        const response = await fetch('/api/files');
        const files = await response.json();
        
        // Target the specific HTML container passed into the function
        const list = document.getElementById(elementId);
        if (!list) return; // Safety guard
        
        if (files.length === 0) {
            list.innerHTML = "<li>No study materials uploaded yet.</li>";
        } else {
            list.innerHTML = files.map(f => {
                
                // SECURITY CHECK: Only create a Delete button if the user is a Teacher or Admin
                let deleteButtonHTML = '';
                if (currentUser && (currentUser.role === 'teacher' || currentUser.role === 'admin')) {
                    deleteButtonHTML = `
                        <button onclick="deleteMaterial('${f._id}', '${elementId}')" style="background-color: #dc3545; color: white; border: none; padding: 8px 12px; border-radius: 6px; cursor: pointer; font-size: 13px;">
                            <i class="fa-solid fa-trash"></i> Delete
                        </button>
                    `;
                }

                // Render the list item with Cloud Download and (conditionally) Delete buttons
                return `
                    <li style="display: flex; justify-content: space-between; align-items: center; padding: 10px; border-bottom: 1px solid #eee;">
                        <div>
                            <span style="color: var(--primary); font-weight: 600; display: block;">${f.title}</span>
                            <span style="font-size: 12px; color: var(--text-muted);">Uploaded by ${f.uploadedBy} on ${f.uploadDate}</span>
                        </div>
                        <div style="display: flex; gap: 10px;">
                            <a href="/api/download/${f._id}" download="${f.filename}" class="btn-success" style="padding: 8px 15px; text-decoration: none; border-radius: 6px; font-size: 13px; display: flex; align-items: center; gap: 5px;">
                                <i class="fa-solid fa-download"></i> Download
                            </a>
                            ${deleteButtonHTML}
                        </div>
                    </li>
                `;
            }).join('');
        }
    } catch (error) { 
        console.error("Error loading files"); 
    }
}

// NEW FUNCTION: Handles the actual deletion process
async function deleteMaterial(fileId, elementId) {
    if (!confirm("WARNING: Are you sure you want to permanently delete this study material from the cloud?")) return;

    try {
        const response = await fetch(`/api/files/${fileId}`, { method: 'DELETE' });
        const data = await response.json();
        
        if (response.ok && data.success) {
            // Instantly refresh the specific list (student or teacher) without reloading the page
            loadMaterials(elementId);
        } else {
            alert("Failed to delete file.");
        }
    } catch (error) {
        alert("Server error trying to delete file.");
    }
}