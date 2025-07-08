


import { ROLES } from "../lib/constants.js";

interface TicketData {
    subject?: string;
    description?: string;
    reportedByUserId?: string; 
    
}


export const validateNewTicket = (data: TicketData, userRole: string): string[] => {
    const { subject, description, reportedByUserId } = data;
    const errors: string[] = [];

    
    if (!subject || typeof subject !== 'string' || subject.trim().length === 0) {
        errors.push('subject is required and must be a non-empty string.');
    }

    if (!description || typeof description !== 'string' || description.trim().length === 0) {
        errors.push('description is required and must be a non-empty string.');
    }

    
    if (reportedByUserId && userRole !== ROLES.ADMIN) { 
        
        errors.push('You do not have permission to create a ticket on behalf of another user.');
    }
    
    
    if (reportedByUserId && (typeof reportedByUserId !== 'string' || reportedByUserId.trim().length === 0)) {
        errors.push('If provided, reportedByUserId must be a valid user ID string.');
    }

    return errors;
};