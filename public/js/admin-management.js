document.addEventListener('DOMContentLoaded', function() {
    const currentAdminId = window.currentAdminId; // Will be set by the EJS template
    let admins = [];

    async function loadAdmins() {
        try {
            const response = await fetch('/admin/admins');
            if (response.ok) {
                admins = await response.json();
                renderAdmins();
            }
        } catch (error) {
            console.error('Error loading admins:', error);
        }
    }

    function renderAdmins() {
        const tbody = document.querySelector('#adminsTable tbody');
        
        // Clear existing content
        tbody.innerHTML = '';
        
        if (admins.length === 0) {
            const row = tbody.insertRow();
            const cell = row.insertCell();
            cell.colSpan = 5;
            cell.className = 'text-center py-4';
            cell.textContent = 'No admins found';
            return;
        }

        admins.forEach(admin => {
            const row = tbody.insertRow();
            
            // Email cell with "You" badge
            const emailCell = row.insertCell();
            emailCell.textContent = admin.email; // Safe text content
            
            if (admin._id === currentAdminId) {
                const badge = document.createElement('span');
                badge.className = 'badge bg-primary ms-2';
                badge.textContent = 'You';
                emailCell.appendChild(badge);
            }
            
            // Status cell with badges
            const statusCell = row.insertCell();
            
            const activeBadge = document.createElement('span');
            activeBadge.className = admin.isActive ? 'badge bg-success' : 'badge bg-danger';
            activeBadge.textContent = admin.isActive ? 'Active' : 'Inactive';
            statusCell.appendChild(activeBadge);
            
            if (admin.isLocked) {
                const lockedBadge = document.createElement('span');
                lockedBadge.className = 'badge bg-warning ms-1';
                lockedBadge.textContent = 'Locked';
                statusCell.appendChild(lockedBadge);
            }
            
            // Last Login cell
            const loginCell = row.insertCell();
            loginCell.textContent = admin.lastLogin ? new Date(admin.lastLogin).toLocaleString() : 'Never';
            
            // Created cell
            const createdCell = row.insertCell();
            createdCell.textContent = new Date(admin.createdAt).toLocaleDateString();
            
            // Actions cell
            const actionsCell = row.insertCell();
            actionsCell.className = 'text-end';
            
            if (admin._id === currentAdminId) {
                // Change password button for current user
                const changePasswordBtn = document.createElement('button');
                changePasswordBtn.className = 'btn btn-sm btn-outline-primary';
                changePasswordBtn.innerHTML = '<i class="bi bi-key"></i> Change Password';
                changePasswordBtn.addEventListener('click', () => showChangePassword());
                actionsCell.appendChild(changePasswordBtn);
            } else {
                // Button group for other admins
                const btnGroup = document.createElement('div');
                btnGroup.className = 'btn-group btn-group-sm';
                
                // Reset password button
                const resetBtn = document.createElement('button');
                resetBtn.className = 'btn btn-outline-warning';
                resetBtn.innerHTML = '<i class="bi bi-key"></i> Reset';
                resetBtn.addEventListener('click', () => resetPassword(admin._id));
                btnGroup.appendChild(resetBtn);
                
                // Unlock button (only if locked)
                if (admin.isLocked) {
                    const unlockBtn = document.createElement('button');
                    unlockBtn.className = 'btn btn-outline-info';
                    unlockBtn.innerHTML = '<i class="bi bi-unlock"></i> Unlock';
                    unlockBtn.addEventListener('click', () => unlockAccount(admin._id));
                    btnGroup.appendChild(unlockBtn);
                }
                
                // Remove button
                const removeBtn = document.createElement('button');
                removeBtn.className = 'btn btn-outline-danger';
                removeBtn.innerHTML = '<i class="bi bi-trash"></i> Remove';
                removeBtn.addEventListener('click', () => removeAdmin(admin._id));
                btnGroup.appendChild(removeBtn);
                
                actionsCell.appendChild(btnGroup);
            }
        });
    }

    // Invite Admin
    document.getElementById('inviteForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('inviteEmail').value;
        const button = document.getElementById('inviteButton');
        const text = document.getElementById('inviteText');
        const spinner = document.getElementById('inviteSpinner');
        const error = document.getElementById('inviteError');
        
        error.classList.add('d-none');
        button.disabled = true;
        text.textContent = 'Sending...';
        spinner.classList.remove('d-none');
        
        try {
            const response = await fetch('/admin/admins/invite', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });
            
            if (response.ok) {
                bootstrap.Modal.getInstance(document.getElementById('inviteModal')).hide();
                document.getElementById('inviteEmail').value = '';
                loadAdmins();
                alert('Invitation sent successfully!');
            } else {
                const data = await response.json();
                error.textContent = data.error || 'Failed to send invitation';
                error.classList.remove('d-none');
            }
        } catch (err) {
            error.textContent = 'Network error. Please try again.';
            error.classList.remove('d-none');
        } finally {
            button.disabled = false;
            text.textContent = 'Send Invitation';
            spinner.classList.add('d-none');
        }
    });

    // Change Password
    window.showChangePassword = function() {
        const modal = new bootstrap.Modal(document.getElementById('changePasswordModal'));
        modal.show();
    };

    document.getElementById('changePasswordForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const currentPassword = document.getElementById('currentPassword').value;
        const newPassword = document.getElementById('newPassword').value;
        const error = document.getElementById('passwordError');
        
        error.classList.add('d-none');
        
        try {
            const response = await fetch('/auth/change-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ currentPassword, newPassword })
            });
            
            if (response.ok) {
                bootstrap.Modal.getInstance(document.getElementById('changePasswordModal')).hide();
                document.getElementById('changePasswordForm').reset();
                alert('Password changed successfully!');
            } else {
                const data = await response.json();
                error.textContent = data.error || 'Failed to change password';
                error.classList.remove('d-none');
            }
        } catch (err) {
            error.textContent = 'Network error. Please try again.';
            error.classList.remove('d-none');
        }
    });

    // Admin Actions
    window.resetPassword = async function(adminId) {
        if (!confirm('Are you sure you want to reset this admin\'s password?')) return;
        
        try {
            const response = await fetch('/admin/admins/' + adminId + '/reset-password', {
                method: 'POST'
            });
            
            if (response.ok) {
                const data = await response.json();
                if (data.temporaryPassword) {
                    alert('Password reset. Temporary password: ' + data.temporaryPassword + '\n\nPlease share this securely with the admin.');
                } else {
                    alert('Password reset successfully and sent via email.');
                }
            }
        } catch (error) {
            alert('Failed to reset password');
        }
    };

    window.unlockAccount = async function(adminId) {
        if (!confirm('Are you sure you want to unlock this account?')) return;
        
        try {
            const response = await fetch('/admin/admins/' + adminId + '/unlock', {
                method: 'POST'
            });
            
            if (response.ok) {
                alert('Account unlocked successfully');
                loadAdmins();
            }
        } catch (error) {
            alert('Failed to unlock account');
        }
    };

    window.removeAdmin = async function(adminId) {
        if (!confirm('Are you sure you want to remove this admin? They will be deactivated.')) return;
        
        try {
            const response = await fetch('/admin/admins/' + adminId, {
                method: 'DELETE'
            });
            
            if (response.ok) {
                alert('Admin removed successfully');
                loadAdmins();
            }
        } catch (error) {
            alert('Failed to remove admin');
        }
    };

    // Load admins on page load
    loadAdmins();
}); 