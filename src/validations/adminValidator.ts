import { ADMIN_ROLES } from "../lib/constants.js";

interface NewAdminData {
    name?: string;
    email?: string;
    password?: string;
    role?: ADMIN_ROLES;
    location_id?: string;
}

export const validateNewAdmin = (data: NewAdminData): string[] => {
    const { name, email, password, role, location_id } = data;
    const errors: string[] = [];

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
        errors.push('name is required and must be a non-empty string.');
    }

    // A simple regex to check for a valid email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
        errors.push('A valid email is required.');
    }

    if (!password || password.length < 8) {
        errors.push('A password with at least 8 characters is required.');
    }

    const validRoles = ['SUPER_ADMIN', 'LOCATION_ADMIN', 'SUPPORT_ADMIN'];
    if (!role || !validRoles.includes(role)) {
        errors.push(`role is required and must be one of: ${validRoles.join(', ')}.`);
    }

    // Conditional validation for LOCATION_ADMIN
    if (role === 'LOCATION_ADMIN') {
        if (!location_id) {
            errors.push('location_id is required when the role is LOCATION_ADMIN.');
        }
    } else {
        // For other roles, location_id should not be provided to avoid confusion
        if (location_id) {
            errors.push('location_id should only be provided for the LOCATION_ADMIN role.');
        }
    }

    return errors;
};