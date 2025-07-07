// src/services/orgValidator.ts

interface OrgData {
    name?: string;
    plan_id?: string | number;
}

interface AdminData {
    user_id?: string | number;
}

/**
 * Checks if a value is a valid identifier (non-empty string or positive number).
 * @param id The value to check.
 * @returns True if the ID is valid, otherwise false.
 */
const isValidId = (id: any): boolean => {
    const isString = typeof id === 'string' && id.trim().length > 0;
    const isNumber = typeof id === 'number' && id > 0;
    return isString || isNumber;
};

/**
 * Validates the data for creating a new organization.
 * @param data The request body.
 * @returns An array of error messages, empty if validation passes.
 */
export const validateNewOrg = (data: OrgData): string[] => {
    const { name, plan_id } = data;
    const errors: string[] = [];

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
        errors.push('name is required and must be a non-empty string.');
    }

    if (!isValidId(plan_id)) {
        errors.push('plan_id is required and must be a valid identifier.');
    }

    return errors;
};

/**
 * Validates the data for updating an organization.
 * @param data The request body.
 * @returns An array of error messages, empty if validation passes.
 */
export const validateUpdateOrg = (data: OrgData): string[] => {
    const { name, plan_id } = data;
    const errors: string[] = [];

    if (name == null && plan_id == null) {
        errors.push('At least one field (name or plan_id) must be provided for an update.');
        return errors;
    }

    if (name != null && (typeof name !== 'string' || name.trim().length === 0)) {
        errors.push('If provided, name must be a non-empty string.');
    }

    if (plan_id != null && !isValidId(plan_id)) {
        errors.push('If provided, plan_id must be a valid identifier.');
    }

    return errors;
};

/**
 * Validates the data for setting an organization admin.
 * @param data The request body.
 * @returns An array of error messages, empty if validation passes.
 */
export const validateSetAdmin = (data: AdminData): string[] => {
    const { user_id } = data;
    const errors: string[] = [];

    if (!isValidId(user_id)) {
        errors.push('user_id is required and must be a valid identifier.');
    }

    return errors;
};