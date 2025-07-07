// src/services/ticketValidator.ts

import { ROLES } from "../lib/constants.js";

interface TicketData {
    subject?: string;
    description?: string;
    reportedByUserId?: string; // Expect a UUID string
}

/**
 * Validates data for creating a new support ticket.
 *
 * @param data The request body.
 * @param userRole The role of the authenticated user trying to create the ticket.
 * @returns An array of error messages, empty if validation passes.
 */
export const validateNewTicket = (data: TicketData, userRole: string): string[] => {
    const { subject, description, reportedByUserId } = data;
    const errors: string[] = [];

    // Rule: Subject and description are always required.
    if (!subject || typeof subject !== 'string' || subject.trim().length === 0) {
        errors.push('subject is required and must be a non-empty string.');
    }

    if (!description || typeof description !== 'string' || description.trim().length === 0) {
        errors.push('description is required and must be a non-empty string.');
    }

    // Business Rule: Only an admin can specify a 'reportedByUserId'.
    // A regular user can only create a ticket for themselves.
    if (reportedByUserId && userRole !== ROLES.ADMIN) { // Use your actual ADMIN role name from ROLES
        errors.push('You do not have permission to create a ticket on behalf of another user.');
    }
    
    // Type Check: If reportedByUserId is provided, it should be a valid format.
    if (reportedByUserId && (typeof reportedByUserId !== 'string' || reportedByUserId.trim().length === 0)) {
        errors.push('If provided, reportedByUserId must be a valid user ID string.');
    }

    return errors;
};