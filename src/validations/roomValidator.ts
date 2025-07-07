// src/services/roomValidator.ts

interface RoomData {
    name?: string;
    type_of_room?: string;
    location_id?: string;
    capacity?: number;
    credits_per_booking?: number;
    availability?: boolean;
}

/**
 * Checks if a value is a valid identifier (e.g., a non-empty string for a UUID).
 * @param id The value to check.
 * @returns True if the ID is valid, otherwise false.
 */
const isValidId = (id: any): boolean => {
    return typeof id === 'string' && id.trim().length > 0;
};

/**
 * Validates the data for creating a new meeting room.
 * @param data The request body.
 * @returns An array of error messages. Returns an empty array if validation passes.
 */
export const validateNewRoom = (data: RoomData): string[] => {
    const { name, type_of_room, location_id, capacity, credits_per_booking, availability } = data;
    const errors: string[] = [];

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
        errors.push('name is required and must be a non-empty string.');
    }

    if (!type_of_room || typeof type_of_room !== 'string' || type_of_room.trim().length === 0) {
        errors.push('type_of_room is required and must be a non-empty string.');
    }

    if (!isValidId(location_id)) {
        errors.push('location_id is required and must be a valid identifier.');
    }

    if (typeof capacity !== 'number' || !Number.isInteger(capacity) || capacity <= 0) {
        errors.push('capacity is required and must be a positive integer.');
    }

    if (typeof credits_per_booking !== 'number' || !Number.isInteger(credits_per_booking) || credits_per_booking < 0) {
        errors.push('credits_per_booking is required and must be a non-negative integer.');
    }

    if (availability !== undefined && typeof availability !== 'boolean') {
        errors.push('If provided, availability must be a boolean (true or false).');
    }

    return errors;
};

/**
 * Validates the data for updating a meeting room.
 * @param data The request body.
 * @returns An array of error messages. Returns an empty array if validation passes.
 */
export const validateUpdateRoom = (data: RoomData): string[] => {
    const { name, type_of_room, location_id, capacity, credits_per_booking, availability } = data;
    const errors: string[] = [];
    const fields = [name, type_of_room, location_id, capacity, credits_per_booking, availability];

    if (fields.every(field => field === undefined)) {
        errors.push('At least one field must be provided for an update.');
        return errors;
    }

    if (name !== undefined && (typeof name !== 'string' || name.trim().length === 0)) {
        errors.push('If provided, name must be a non-empty string.');
    }

    if (type_of_room !== undefined && (typeof type_of_room !== 'string' || type_of_room.trim().length === 0)) {
        errors.push('If provided, type_of_room must be a non-empty string.');
    }
    
    if (location_id !== undefined && !isValidId(location_id)) {
        errors.push('If provided, location_id must be a valid identifier.');
    }

    if (capacity !== undefined && (typeof capacity !== 'number' || !Number.isInteger(capacity) || capacity <= 0)) {
        errors.push('If provided, capacity must be a positive integer.');
    }
    
    if (credits_per_booking !== undefined && (typeof credits_per_booking !== 'number' || !Number.isInteger(credits_per_booking) || credits_per_booking < 0)) {
        errors.push('If provided, credits_per_booking must be a non-negative integer.');
    }

    if (availability !== undefined && typeof availability !== 'boolean') {
        errors.push('If provided, availability must be a boolean (true or false).');
    }

    return errors;
};