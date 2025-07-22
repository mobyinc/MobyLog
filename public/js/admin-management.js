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
        
        if (admins.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4">No admins found</td></tr>';
            return;
        }

        tbody.innerHTML = admins.map(admin => 
            '<tr>' +
                '<td>' +
                    admin.email +
                    (admin._id === currentAdminId ? '<span class="badge bg-primary ms-2">You</span>' : '') +
                '</td>' +
                '<td>' +
                    (admin.isActive 
                        ? '<span class="badge bg-success">Active</span>' 
                        : '<span class="badge bg-danger">Inactive</span>') +
                    (admin.isLocked 
                        ? '<span class="badge bg-warning ms-1">Locked</span>' 
                        : '') +
                '</td>' +
                '<td>' + (admin.lastLogin ? new Date(admin.lastLogin).toLocaleString() : 'Never') + '</td>' +
                '<td>' + new Date(admin.createdAt).toLocaleDateString() + '</td>' +
                '<td class="text-end">' +
                    (admin._id === currentAdminId 
                        ? '<button class="btn btn-sm btn-outline-primary" onclick="showChangePassword()"><i class="bi bi-key"></i> Change Password</button>'
                        : '<div class="btn-group btn-group-sm">' +
                            '<button class="btn btn-outline-warning" onclick="resetPassword(\'' + admin._id + '\')">' +
                                '<i class="bi bi-key"></i> Reset' +
                            '</button>' +
                            (admin.isLocked 
                                ? '<button class="btn btn-outline-info" onclick="unlockAccount(\'' + admin._id + '\')">' +
                                    '<i class="bi bi-unlock"></i> Unlock' +
                                '</button>'
                                : '') +
                            '<button class="btn btn-outline-danger" onclick="removeAdmin(\'' + admin._id + '\')">' +
                                '<i class="bi bi-trash"></i> Remove' +
                            '</button>' +
                        '</div>') +
                '</td>' +
            '</tr>'
        ).join('');
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