


interface PlanData {
    name?: string;
    plan_credits?: number;
    price?: number;
}


export const validateNewPlan = (data: PlanData): string[] => {
    const { name, plan_credits, price } = data;
    const errors: string[] = [];

    
    if (name == null) errors.push('name is a required field.');
    if (plan_credits == null) errors.push('plan_credits is a required field.');
    if (price == null) errors.push('price is a required field.');

    
    if (errors.length > 0) return errors;

    
    if (typeof name !== 'string') {
        errors.push('name must be a string.');
    }

    if (typeof plan_credits !== 'number' || !Number.isInteger(plan_credits) || plan_credits <= 0) {
        errors.push('plan_credits must be a positive integer.');
    }

    
    if (typeof price !== 'number' || price <= 0) {
        errors.push('price must be a positive number.');
    }

    return errors;
};


export const validateUpdatePlan = (data: PlanData): string[] => {
    console.log(data)
    const { name, plan_credits, price } = data;
    const errors: string[] = [];

    
    if (name == null && plan_credits == null && price == null) {
        errors.push('At least one field (name, plan_credits, price) must be provided for an update.');
        return errors;
    }

    
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