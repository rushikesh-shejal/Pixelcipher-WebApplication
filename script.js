// --- Core Application Logic ---

let currentUser = null;
let userRole = null;
let adminUsername = null;
let lastEncryptedData = null;

// UI element references
const loginFrame = document.getElementById('login-frame');
const registerFrame = document.getElementById('register-frame');
const dashboardFrame = document.getElementById('dashboard-frame');
const accountFrame = document.getElementById('account-frame');
const adminDashboardFrame = document.getElementById('admin-dashboard-frame');
const userListView = document.getElementById('user-list-view');
const userStatsView = document.getElementById('user-stats-view');
const encodeFrame = document.getElementById('encode-frame');
const decodeFrame = document.getElementById('decode-frame');
const messageBox = document.getElementById('message-box');
const messageTitle = document.getElementById('message-title');
const messageBody = document.getElementById('message-body');
const downloadBtn = document.getElementById('download-encoded-btn');
const steganoCanvas = document.getElementById('stegano-canvas');
const passwordStrengthReg = document.getElementById('password-strength-reg');
const passwordStrengthChange = document.getElementById('password-strength-change');

// Theme-related elements
const themeToggle = document.getElementById('theme-toggle');
const htmlElement = document.documentElement;

function showMessageBox(title, body) {
    messageTitle.textContent = title;
    messageBody.textContent = body;
    messageBox.classList.remove('hidden');
    messageBox.classList.add('flex');
}

function closeMessageBox() {
    messageBox.classList.remove('flex');
    messageBox.classList.add('hidden');
}

function showFrame(frameId) {
    const frames = [loginFrame, registerFrame, dashboardFrame, accountFrame, adminDashboardFrame, encodeFrame, decodeFrame];
    frames.forEach(frame => {
        if (frame && frame.id === frameId) {
            frame.classList.remove('hidden');
        } else if (frame) {
            frame.classList.add('hidden');
        }
    });
    if (frameId !== 'encode-frame') {
        downloadBtn.disabled = true;
    }
}

function showLoginFrame() {
    showFrame('login-frame');
}
function showRegisterFrame() {
    showFrame('register-frame');
}
function showAccountFrame() {
    showFrame('account-frame');
}

function showDashboardFrame() {
    if (currentUser) {
        const userStats = JSON.parse(localStorage.getItem('user_stats')) || {};
        document.getElementById('welcome-message').textContent = `Welcome, ${currentUser}!`;
        
        if (!userStats[currentUser]) {
            userStats[currentUser] = { encoded: 0, decoded: 0 };
            localStorage.setItem('user_stats', JSON.stringify(userStats));
        }

        document.getElementById('encoded-count').textContent = userStats[currentUser].encoded;
        document.getElementById('decoded-count').textContent = userStats[currentUser].decoded;
        
        showFrame('dashboard-frame');
    } else {
        showLoginFrame();
    }
}

function showAdminDashboard() {
    if (currentUser && userRole === 'admin') {
        showFrame('admin-dashboard-frame');
        showAdminUserList();
    } else {
        showMessageBox("Access Denied", "You do not have permission to view the admin dashboard.");
        showLoginFrame();
    }
}

function showAdminUserList() {
    userListView.classList.remove('hidden');
    userStatsView.classList.add('hidden');
    const userList = document.getElementById('user-list');
    userList.innerHTML = '';
    const usersData = JSON.parse(localStorage.getItem('user_data')) || {};
    
    for (const username in usersData) {
        if (username !== adminUsername) {
            const userItem = document.createElement('li');
            userItem.className = 'flex justify-between items-center py-2 px-4 border-b last:border-b-0';
            userItem.innerHTML = `
                <span>${username}</span>
                <div>
                    <button onclick="showUserStatsInAdminDashboard('${username}')" class="text-blue-500 hover:text-blue-700 text-sm font-medium mr-2">View Dashboard</button>
                    <button onclick="deleteUserByAdmin('${username}')" class="text-red-500 hover:text-red-700 text-sm font-medium">Delete</button>
                </div>
            `;
            userList.appendChild(userItem);
        }
    }
}

function showUserStatsInAdminDashboard(username) {
    userListView.classList.add('hidden');
    userStatsView.classList.remove('hidden');
    const userStats = JSON.parse(localStorage.getItem('user_stats')) || {};
    const stats = userStats[username] || { encoded: 0, decoded: 0 };
    
    document.getElementById('current-user-stats-name').textContent = username;
    document.getElementById('admin-encoded-count').textContent = stats.encoded;
    document.getElementById('admin-decoded-count').textContent = stats.decoded;
}

function deleteUserByAdmin(username) {
    if (confirm(`Are you sure you want to delete the account for "${username}"? This action cannot be undone.`)) {
        const users = JSON.parse(localStorage.getItem('users')) || {};
        const userData = JSON.parse(localStorage.getItem('user_data')) || {};
        const userStats = JSON.parse(localStorage.getItem('user_stats')) || {};

        delete users[username];
        delete userData[username];
        delete userStats[username];

        localStorage.setItem('users', JSON.stringify(users));
        localStorage.setItem('user_data', JSON.stringify(userData));
        localStorage.setItem('user_stats', JSON.stringify(userStats));

        showMessageBox("Account Deleted", `The account for "${username}" has been deleted.`);
        showAdminUserList();
    }
}

function showEncodeFrame() {
    showFrame('encode-frame');
}

function showDecodeFrame() {
    showFrame('decode-frame');
}

// --- User Authentication ---

async function hashPassword(password) {
    const encoder = new TextEncoder();
    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    const keyMaterial = await window.crypto.subtle.importKey(
        'raw',
        encoder.encode(password),
        { name: 'PBKDF2' },
        false,
        ['deriveBits']
    );
    const derivedBits = await window.crypto.subtle.deriveBits(
        {
            name: 'PBKDF2',
            salt: salt,
            iterations: 100000,
            hash: 'SHA-256',
        },
        keyMaterial,
        256
    );
    const combined = new Uint8Array(salt.length + derivedBits.byteLength);
    combined.set(salt, 0);
    combined.set(new Uint8Array(derivedBits), salt.length);
    return btoa(String.fromCharCode(...combined));
}

const EMAILJS_SERVICE_ID = '--------';
const EMAILJS_LOGIN_TEMPLATE = '--------';
const EMAILJS_REGISTRATION_TEMPLATE = '-----------';

async function login() {
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    const errorLabel = document.getElementById('login-error');

    if (!username || !password) {
        errorLabel.textContent = "Please enter both username and password.";
        return;
    }
    
    const userData = JSON.parse(localStorage.getItem('user_data')) || {};
    const user = userData[username];
    
    // Admin login with hardcoded credentials for demo
    if (user && user.isAdmin && password === user.password) {
        currentUser = username;
        userRole = 'admin';
        adminUsername = username;
        showAdminDashboard();
        showMessageBox("Admin Login", "Welcome, Admin!");
        return;
    }

    const storedUserData = JSON.parse(localStorage.getItem('user_data')) || {};
    const storedUser = storedUserData[username];

    if (storedUser && storedUser.password === password) {
        currentUser = username;
        userRole = 'user';
        const userEmail = storedUser.email;

        showMessageBox("Success", `Welcome back, ${username}!`);
        document.getElementById('login-username').value = '';
        document.getElementById('login-password').value = '';
        showDashboardFrame();
        
        if (userEmail) {
            try {
                const ipResponse = await fetch('https://api.ipify.org?format=json');
                const ipData = await ipResponse.json();
                const ipAddress = ipData.ip;

                const loginDate = new Date().toLocaleString();

                const userAgent = navigator.userAgent;
                let deviceType = "Unknown Device";
                if (/iPad|iPhone|iPod/.test(userAgent)) {
                    deviceType = "iOS Device";
                } else if (/Android/.test(userAgent)) {
                    deviceType = "Android Device";
                } else if (/Mac/.test(userAgent)) {
                    deviceType = "Mac";
                } else if (/Windows/.test(userAgent)) {
                    deviceType = "Windows PC";
                } else if (/Linux/.test(userAgent)) {
                    deviceType = "Linux PC";
                } else if (/CrOS/.test(userAgent)) {
                    deviceType = "ChromeOS";
                }

                const templateParams = {
                    to_name: username,
                    to_email: userEmail,
                    ip_address: ipAddress,
                    login_date: loginDate,
                    device_info: deviceType,
                };
                
                emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_LOGIN_TEMPLATE, templateParams);

            } catch (error) {
                console.error('Failed to get IP address or send email:', error);
            }
        }
    } else {
        errorLabel.textContent = "Invalid username or password.";
    }
}

function checkPasswordStrength(password, indicatorId) {
    let strength = 0;
    if (password.length >= 8) strength += 1;
    if (password.match(/[a-z]/)) strength += 1;
    if (password.match(/[A-Z]/)) strength += 1;
    if (password.match(/[0-9]/)) strength += 1;
    if (password.match(/[^a-zA-Z0-9]/)) strength += 1;
    
    let strengthText = "";
    let color = "red";
    if (strength <= 1) { strengthText = "Very Weak"; color = "#ef4444"; }
    else if (strength === 2) { strengthText = "Weak"; color = "#f97316"; }
    else if (strength === 3) { strengthText = "Moderate"; color = "#eab308"; }
    else if (strength === 4) { strengthText = "Strong"; color = "#22c55e"; }
    else if (strength >= 5) { strengthText = "Very Strong"; color = "#3b82f6"; }

    const indicator = document.getElementById(indicatorId);
    indicator.textContent = strengthText;
    indicator.style.color = color;
    return strength >= 3; // Minimum strength requirement
}

document.getElementById('reg-password').addEventListener('input', (e) => {
    checkPasswordStrength(e.target.value, 'password-strength-reg');
});

document.getElementById('new-password').addEventListener('input', (e) => {
    checkPasswordStrength(e.target.value, 'password-strength-change');
});

async function register() {
    const username = document.getElementById('reg-username').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;
    const confirm = document.getElementById('reg-confirm').value;
    const errorLabel = document.getElementById('register-error');

    if (!username || !email || !password || !confirm) {
        errorLabel.textContent = "Please fill in all fields.";
        return;
    }
    if (password !== confirm) {
        errorLabel.textContent = "Passwords do not match.";
        return;
    }
    if (!checkPasswordStrength(password, 'password-strength-reg')) {
        errorLabel.textContent = "Password is too weak. Please use a stronger one.";
        return;
    }

    const storedUsers = JSON.parse(localStorage.getItem('users')) || {};
    const storedUserData = JSON.parse(localStorage.getItem('user_data')) || {};
    
    if (storedUsers[username] || Object.values(storedUserData).some(u => u.email === email)) {
        errorLabel.textContent = "Username or email already exists.";
        return;
    }

    storedUsers[username] = password;
    storedUserData[username] = { email: email, password: password, isAdmin: false };
    
    localStorage.setItem('users', JSON.stringify(storedUsers));
    localStorage.setItem('user_data', JSON.stringify(storedUserData));
    
    showMessageBox("Success", "Registration successful! You can now log in.");
    document.getElementById('reg-username').value = '';
    document.getElementById('reg-email').value = '';
    document.getElementById('reg-password').value = '';
    document.getElementById('reg-confirm').value = '';
    showLoginFrame();
    
    const templateParams = {
        to_name: username,
        to_email: email,
        message: `Welcome to PixelCipher! Your account has been successfully created.`,
    };
    emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_REGISTRATION_TEMPLATE, templateParams);
}

function changePassword() {
    const currentPassword = document.getElementById('current-password').value;
    const newPassword = document.getElementById('new-password').value;
    const confirmNewPassword = document.getElementById('confirm-new-password').value;
    const errorLabel = document.getElementById('password-change-error');
    const userData = JSON.parse(localStorage.getItem('user_data')) || {};

    if (!currentPassword || !newPassword || !confirmNewPassword) {
        errorLabel.textContent = "Please fill in all fields.";
        return;
    }
    if (userData[currentUser].password !== currentPassword) {
        errorLabel.textContent = "Current password is incorrect.";
        return;
    }
    if (newPassword !== confirmNewPassword) {
        errorLabel.textContent = "New passwords do not match.";
        return;
    }
    if (!checkPasswordStrength(newPassword, 'password-strength-change')) {
        errorLabel.textContent = "New password is too weak. Please use a stronger one.";
        return;
    }

    userData[currentUser].password = newPassword;
    localStorage.setItem('user_data', JSON.stringify(userData));

    const users = JSON.parse(localStorage.getItem('users')) || {};
    users[currentUser] = newPassword;
    localStorage.setItem('users', JSON.stringify(users));

    showMessageBox("Password Changed", "Your password has been successfully updated.");
    document.getElementById('current-password').value = '';
    document.getElementById('new-password').value = '';
    document.getElementById('confirm-new-password').value = '';
    errorLabel.textContent = '';
}

function logout() {
    currentUser = null;
    userRole = null;
    showMessageBox("Logged Out", "You have been successfully logged out.");
    showLoginFrame();
}

function confirmDelete() {
    if (confirm("Are you sure you want to delete your account? This action cannot be undone.")) {
        deleteAccount();
    }
}

function deleteAccount() {
    if (currentUser) {
        const users = JSON.parse(localStorage.getItem('users')) || {};
        const userData = JSON.parse(localStorage.getItem('user_data')) || {};
        const userStats = JSON.parse(localStorage.getItem('user_stats')) || {};

        delete users[currentUser];
        delete userData[currentUser];
        delete userStats[currentUser];

        localStorage.setItem('users', JSON.stringify(users));
        localStorage.setItem('user_data', JSON.stringify(userData));
        localStorage.setItem('user_stats', JSON.stringify(userStats));

        currentUser = null;
        showMessageBox("Account Deleted", "Your account has been successfully deleted.");
        showLoginFrame();
    }
}

// --- Steganography and Encryption Logic ---

document.getElementById('encode-image-input').addEventListener('change', function(e) {
    const file = e.target.files[0];
    const preview = document.getElementById('image-preview');
    const fileSizeDisplay = document.getElementById('file-size');
    const capacityDisplay = document.getElementById('message-capacity');
    const textInput = document.getElementById('encode-text-input');
    
    if (file) {
        const reader = new FileReader();
        reader.onload = function(event) {
            preview.innerHTML = `<img id="preview-img" src="${event.target.result}" alt="Selected Image" class="w-full h-full object-contain rounded-md">`;
            
            const img = new Image();
            img.onload = function() {
                const width = img.width;
                const height = img.height;
                const maxCapacityBytes = Math.floor((width * height * 3) / 8); 
                capacityDisplay.textContent = `${(maxCapacityBytes / 1024).toFixed(2)} KB`;
                
                textInput.dataset.capacity = maxCapacityBytes;
                updateMessageSize();
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
        
        fileSizeDisplay.textContent = `${(file.size / 1024).toFixed(2)} KB`;
    } else {
        preview.innerHTML = "<p class='text-center'>No image selected</p>";
        fileSizeDisplay.textContent = "0 KB";
        capacityDisplay.textContent = "0 KB";
        textInput.dataset.capacity = 0;
        updateMessageSize();
    }
    downloadBtn.disabled = true;
});

document.getElementById('encode-text-input').addEventListener('input', updateMessageSize);

function updateMessageSize() {
    const textInput = document.getElementById('encode-text-input');
    const messageSizeDisplay = document.getElementById('message-size');
    const capacityWarning = document.getElementById('capacity-warning');
    const textBytes = new Blob([textInput.value]).size;
    const maxCapacity = parseInt(textInput.dataset.capacity) || 0;
    
    messageSizeDisplay.textContent = `Current Message Size: ${textBytes} B`;
    
    if (textBytes > maxCapacity) {
        capacityWarning.classList.remove('hidden');
    } else {
        capacityWarning.classList.add('hidden');
    }
}

document.getElementById('decode-image-input').addEventListener('change', function(e) {
    const file = e.target.files[0];
    const preview = document.getElementById('decode-image-preview');
    if (file) {
        const reader = new FileReader();
        reader.onload = function(event) {
            preview.innerHTML = `<img src="${event.target.result}" alt="Selected Image" class="w-full h-full object-contain rounded-md">`;
            const fileReader = new FileReader();
            fileReader.onload = function(data) {
                try {
                    const img = new Image();
                    img.onload = function() {
                        console.log("Image loaded for decoding. Ready to analyze pixels (simulated).");
                    };
                    img.src = data.target.result;
                } catch (error) {
                    console.error("Could not process image for simulated data check:", error);
                }
            };
            fileReader.readAsDataURL(file);
        };
        reader.readAsDataURL(file);
    } else {
        preview.innerHTML = "<p class='text-center'>No image selected</p>";
    }
});

async function getWebCryptoKey(passphrase) {
    const encoder = new TextEncoder();
    const data = encoder.encode(passphrase);
    const keyMaterial = await window.crypto.subtle.digest('SHA-256', data);
    return window.crypto.subtle.importKey(
        'raw',
        keyMaterial,
        { name: 'AES-GCM' },
        false,
        ['encrypt', 'decrypt']
    );
}

async function encryptText(text, passphrase) {
    try {
        const key = await getWebCryptoKey(passphrase);
        const encoder = new TextEncoder();
        const encodedText = encoder.encode(text);
        const iv = window.crypto.getRandomValues(new Uint8Array(12));
        const encrypted = await window.crypto.subtle.encrypt(
            { name: 'AES-GCM', iv: iv },
       