interface TicketData {
    user_id?: string;
    subject?: string;
    description?: string;
    status?: 'OPEN' | 'IN_PROGRESS' | 'CLOSED';
}

export const validateNewTicketByAdmin = (data: TicketData): string[] => {
    const errors: string[] = [];
    const { user_id, subject, description } = data;

    if (!user_id || typeof user_id !== 'string' || user_id.trim().length === 0) {
        errors.push('A valid user_id is required.');
    }
    if (!subject || typeof subject !== 'string' || subject.trim().length < 5) {
        errors.push('Subject is required and must be at least 5 characters long.');
    }
    if (!description || typeof description !== 'string' || description.trim().length < 10) {
        errors.push('Description is required and must be at least 10 characters long.');
    }
    return errors;
};

export const validateUpdateTicketByAdmin = (data: TicketData): string[] => {
    const errors: string[] = [];
    const { status } = data;

    if (!status) {
        errors.push('Status field is required for an update.');
        return errors;
    }
    if (!['OPEN', 'IN_PROGRESS', 'CLOSED'].includes(status)) {
        errors.push("Status must be one of 'OPEN', 'IN_PROGRESS', or 'CLOSED'.");
    }
    return errors;
};