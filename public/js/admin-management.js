document.addEventListener('DOMContentLoaded', function() {
    const currentAdminId = window.currentAdminId;

    async function loadAdmins() {
        try {
            const response = await fetch('/admin/admins');
            const admins = await response.json();
            renderAdmins(admins);
        } catch (error) {
            console.error('Failed to load admins:', error);
        }
    }

    function renderAdmins(admins) {
        const tbody = document.querySelector('#adminsTable tbody');
        tbody.innerHTML = '';

        admins.forEach(admin => {
            const row = document.createElement('tr');
            
            // Email
            const emailCell = document.createElement('td');
            emailCell.textContent = admin.email;
            row.appendChild(emailCell);
            
            // Status
            const statusCell = document.createElement('td');
            const statusBadge = document.createElement('span');
            
            if (admin.needsPasswordSetup) {
                statusBadge.className = 'badge bg-warning text-dark';
                statusBadge.innerHTML = '<i class="bi bi-clock me-1"></i>Setup Pending';
            } else if (admin.isLocked) {
                statusBadge.className = 'badge bg-danger';
                statusBadge.innerHTML = '<i class="bi bi-lock me-1"></i>Locked';
            } else if (!admin.isActive) {
                statusBadge.className = 'badge bg-secondary';
                statusBadge.innerHTML = '<i class="bi bi-pause me-1"></i>Inactive';
            } else {
                statusBadge.className = 'badge bg-success';
                statusBadge.innerHTML = '<i class="bi bi-check-circle me-1"></i>Active';
            }
            
            statusCell.appendChild(statusBadge);
            row.appendChild(statusCell);
            
            // Last Login
            const lastLoginCell = document.createElement('td');
            if (admin.lastLogin) {
                lastLoginCell.textContent = new Date(admin.lastLogin).toLocaleString();
            } else {
                lastLoginCell.innerHTML = '<span class="text-muted">Never</span>';
            }
            row.appendChild(lastLoginCell);
            
            // Created
            const createdCell = document.createElement('td');
            createdCell.textContent = new Date(admin.createdAt).toLocaleString();
            row.appendChild(createdCell);
            
            // Actions
            const actionsCell = document.createElement('td');
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
                
                // Re-send invite button (only if setup is pending)
                if (admin.needsPasswordSetup) {
                    const resendBtn = document.createElement('button');
                    resendBtn.className = 'btn btn-outline-warning';
                    resendBtn.innerHTML = '<i class="bi bi-envelope"></i> Re-send Invite';
                    resendBtn.title = 'Re-send invitation email';
                    resendBtn.addEventListener('click', () => resendInvite(admin._id));
                    btnGroup.appendChild(resendBtn);
                } else {
                    // Reset password button (only if setup is complete)
                    const resetBtn = document.createElement('button');
                    resetBtn.className = 'btn btn-outline-warning';
                    resetBtn.innerHTML = '<i class="bi bi-key"></i> Reset';
                    resetBtn.title = 'Send password reset link';
                    resetBtn.addEventListener('click', () => resetPassword(admin._id));
                    btnGroup.appendChild(resetBtn);
                }
                
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
            
            row.appendChild(actionsCell);
            tbody.appendChild(row);
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
                
                // Show success message with more detail
                const alert = document.createElement('div');
                alert.className = 'alert alert-success alert-dismissible fade show position-fixed';
                alert.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 350px;';
                alert.innerHTML = `
                    <div class="d-flex align-items-start">
                        <i class="bi bi-check-circle-fill me-2 mt-1"></i>
                        <div>
                            <strong>Invitation Sent Successfully!</strong>
                            <p class="mb-0 small">A secure password setup link has been sent to ${email}. They have 24 hours to complete their account setup.</p>
                        </div>
                        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
                    </div>
                `;
                document.body.appendChild(alert);
                
                // Auto-remove after 8 seconds
                setTimeout(() => {
                    if (alert.parentNode) {
                        alert.parentNode.removeChild(alert);
                    }
                }, 8000);
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
        if (!confirm('Are you sure you want to send a password reset link to this admin? They will need to create a new password using the secure link.')) return;
        
        try {
            const response = await fetch('/admin/admins/' + adminId + '/reset-password', {
                method: 'POST'
            });
            
            if (response.ok) {
                const alert = document.createElement('div');
                alert.className = 'alert alert-success alert-dismissible fade show position-fixed';
                alert.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 350px;';
                alert.innerHTML = `
                    <div class="d-flex align-items-start">
                        <i class="bi bi-check-circle-fill me-2 mt-1"></i>
                        <div>
                            <strong>Password Reset Link Sent!</strong>
                            <p class="mb-0 small">A secure password reset link has been sent to the admin's email. The link expires in 24 hours.</p>
                        </div>
                        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
                    </div>
                `;
                document.body.appendChild(alert);
                
                // Auto-remove after 6 seconds
                setTimeout(() => {
                    if (alert.parentNode) {
                        alert.parentNode.removeChild(alert);
                    }
                }, 6000);
                
                loadAdmins();
            } else {
                const data = await response.json();
                alert('Failed to send password reset link: ' + (data.error || 'Unknown error'));
            }
        } catch (error) {
            alert('Failed to send password reset link');
        }
    };

    // Re-send invite
    window.resendInvite = async function(adminId) {
        if (!confirm('Are you sure you want to re-send the invitation email to this admin?')) return;
        
        try {
            const response = await fetch('/admin/admins/resend-invite/' + adminId, {
                method: 'POST'
            });
            
            if (response.ok) {
                const alert = document.createElement('div');
                alert.className = 'alert alert-success alert-dismissible fade show position-fixed';
                alert.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 350px;';
                alert.innerHTML = `
                    <div class="d-flex align-items-start">
                        <i class="bi bi-check-circle-fill me-2 mt-1"></i>
                        <div>
                            <strong>Invitation Re-sent!</strong>
                            <p class="mb-0 small">A secure password setup link has been re-sent to the admin's email. The link expires in 24 hours.</p>
                        </div>
                        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
                    </div>
                `;
                document.body.appendChild(alert);
                
                // Auto-remove after 6 seconds
                setTimeout(() => {
                    if (alert.parentNode) {
                        alert.parentNode.removeChild(alert);
                    }
                }, 6000);
                
                loadAdmins();
            } else {
                const data = await response.json();
                alert('Failed to re-send invitation: ' + (data.error || 'Unknown error'));
            }
        } catch (error) {
            alert('Failed to re-send invitation');
        }
    };

    // Unlock Account
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