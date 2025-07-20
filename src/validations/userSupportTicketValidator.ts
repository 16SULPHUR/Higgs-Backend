interface UserTicketData {
    subject?: string;
    description?: string;
}

export const validateNewTicketByUser = (data: UserTicketData): string[] => {
    const errors: string[] = [];
    const { subject, description } = data;

    if (!subject || typeof subject !== 'string' || subject.trim().length < 5) {
        errors.push('Subject is required and must be at least 5 characters long.');
    }
    if (!description || typeof description !== 'string' || description.trim().length < 10) {
        errors.push('Description is required and must be at least 10 characters long.');
    }
    return errors;
};