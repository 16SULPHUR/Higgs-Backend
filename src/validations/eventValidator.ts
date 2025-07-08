


interface EventData {
    title?: string;
    description?: string;
    date?: string; // Expecting ISO 8601 format string from the client
    image_url?: string;
}


const isValidUrl = (url: string): boolean => {
    try {
        new URL(url);
        return url.startsWith('http://') || url.startsWith('https://');
    } catch (e) {
        return false;
    }
};


export const validateNewEvent = (data: EventData): string[] => {
    const { title, description, date, image_url } = data;
    const errors: string[] = [];

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
        errors.push('title is required and must be a non-empty string.');
    }

    if (!description || typeof description !== 'string' || description.trim().length === 0) {
        errors.push('description is required and must be a non-empty string.');
    }

    if (!date || new Date(date).toString() === 'Invalid Date') {
        errors.push('date is required and must be a valid ISO date string (e.g., "2025-12-31T18:00:00Z").');
    }

    if (image_url && !isValidUrl(image_url)) {
        errors.push('If provided, image_url must be a valid URL (starting with http:// or https://).');
    }

    return errors;
};


export const validateUpdateEvent = (data: EventData): string[] => {
    const { title, description, date, image_url } = data;
    const errors: string[] = [];
    const fields = [title, description, date, image_url];

    if (fields.every(field => field === undefined)) {
        errors.push('At least one field (title, description, date, image_url) must be provided for an update.');
        return errors;
    }

    if (title !== undefined && (typeof title !== 'string' || title.trim().length === 0)) {
        errors.push('If provided, title must be a non-empty string.');
    }

    if (description !== undefined && (typeof description !== 'string' || description.trim().length === 0)) {
        errors.push('If provided, description must be a non-empty string.');
    }

    if (date !== undefined && new Date(date).toString() === 'Invalid Date') {
        errors.push('If provided, date must be a valid ISO date string.');
    }

    if (image_url !== undefined && !isValidUrl(image_url)) {
        errors.push('If provided, image_url must be a valid URL.');
    }

    return errors;
};