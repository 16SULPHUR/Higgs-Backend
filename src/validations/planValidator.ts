// src/services/planValidator.ts

interface PlanData {
    name?: string;
    plan_credits?: number;
    price?: number;
}

/**
 * Validates the data for creating a new plan.
 * @param data - The request body.
 * @returns An array of error messages. Returns an empty array if validation passes.
 */
export const validateNewPlan = (data: PlanData): string[] => {
    const { name, plan_credits, price } = data;
    const errors: string[] = [];

    // Rule: All fields are required
    if (name == null) errors.push('name is a required field.');
    if (plan_credits == null) errors.push('plan_credits is a required field.');
    if (price == null) errors.push('price is a required field.');

    // If fields are missing, no need to check their types
    if (errors.length > 0) return errors;

    // Rule: name and plan_credits must be positive integers
    if (typeof name !== 'string') {
        errors.push('name must be a string.');
    }

    if (typeof plan_credits !== 'number' || !Number.isInteger(plan_credits) || plan_credits <= 0) {
        errors.push('plan_credits must be a positive integer.');
    }

    // Rule: price must be a positive number
    if (typeof price !== 'number' || price <= 0) {
        errors.push('price must be a positive number.');
    }

    return errors;
};

/**
 * Validates the data for updating an existing plan.
 * @param data - The request body.
 * @returns An array of error messages. Returns an empty array if validation passes.
 */
export const validateUpdatePlan = (data: PlanData): string[] => {
    console.log(data)
    const { name, plan_credits, price } = data;
    const errors: string[] = [];

    // Rule: At least one field must be provided
    if (name == null && plan_credits == null && price == null) {
        errors.push('At least one field (name, plan_credits, price) must be provided for an update.');
        return errors;
    }

    // Rule: If fields exist, they must be valid
    if (name != null) {
        if (typeof name !== 'string') {
            errors.push('name must be a string.');
        }
    }

    if (plan_credits != null) {
        if (typeof plan_credits !== 'number' || !Number.isInteger(plan_credits) || plan_credits <= 0) {
            errors.push('plan_credits must be a positive integer.');
        }
    }

    if (price != null) {
        if (typeof price !== 'number' || price <= 0) {
            errors.push('price must be a positive number.');
        }
    }

    return errors;
};