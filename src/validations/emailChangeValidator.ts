export interface EmailChangeRequest {
    newEmail: string;
    currentPassword: string;
}

export interface EmailChangeVerification {
    otp: string;
}

export const validateEmailChangeRequest = (data: EmailChangeRequest): string[] => {
    const { newEmail, currentPassword } = data;
    const errors: string[] = [];

    // Validate new email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!newEmail || !emailRegex.test(newEmail)) {
        errors.push('A valid new email address is required.');
    }

    // Validate current password
    if (!currentPassword || currentPassword.trim().length === 0) {
        errors.push('Current password is required.');
    }

    return errors;
};

export const validateEmailChangeVerification = (data: EmailChangeVerification): string[] => {
    const { otp } = data;
    const errors: string[] = [];

    // Validate OTP format (6 digits)
    const otpRegex = /^\d{6}$/;
    if (!otp || !otpRegex.test(otp)) {
        errors.push('OTP must be a 6-digit number.');
    }

    return errors;
};
