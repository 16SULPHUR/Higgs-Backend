interface LocationAdminData {
    name?: string;
    email?: string;
    phone?: string;
    location_id?: string;
    is_active?: boolean;
}

export const validateNewLocationAdmin = (data: LocationAdminData): string[] => {
    const errors: string[] = [];

    if (!data.name || data.name.trim().length < 2) {
        errors.push('Name must be at least 2 characters long');
    }

    if (!data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
        errors.push('Valid email is required');
    }

    if (!data.location_id || data.location_id.trim().length === 0) {
        errors.push('Location ID is required');
    }

    if (data.phone && data.phone.trim().length > 0) {
        if (!/^\+?[\d\s\-\(\)]+$/.test(data.phone)) {
            errors.push('Phone number format is invalid');
        }
    }

    return errors;
};

export const validateUpdateLocationAdmin = (data: LocationAdminData): string[] => {
    const errors: string[] = [];

    if (data.name !== undefined && (data.name.trim().length < 2)) {
        errors.push('Name must be at least 2 characters long');
    }

    if (data.email !== undefined && (!data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email))) {
        errors.push('Valid email is required');
    }

    if (data.location_id !== undefined && (!data.location_id || data.location_id.trim().length === 0)) {
        errors.push('Location ID is required');
    }

    if (data.phone !== undefined && data.phone && data.phone.trim().length > 0) {
        if (!/^\+?[\d\s\-\(\)]+$/.test(data.phone)) {
            errors.push('Phone number format is invalid');
        }
    }

    return errors;
};
