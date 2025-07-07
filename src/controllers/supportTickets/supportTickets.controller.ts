import { Request, Response } from 'express';
import pool from '../../lib/db.js';
import { ROLES } from '../../lib/constants.js';
import { validateNewTicket } from '../../validations/ticketValidator.js';

export const createTicket = async (req: Request, res: Response) => {
    const validationErrors = validateNewTicket(req.body, req.user.role);
    if (validationErrors.length > 0) {
        return res.status(400).json({ message: 'Invalid input', errors: validationErrors });
    }

    const { id: authenticatedUserId, role: userRole } = req.user;
    const { subject, description } = req.body;

    const createdByUserId = authenticatedUserId;
    
  
    const reportedByUserId = (userRole === ROLES.ADMIN && req.body.reportedByUserId)
        ? req.body.reportedByUserId
        : createdByUserId;

    try {
        if (userRole === ROLES.ADMIN && req.body.reportedByUserId) {
            const userCheck = await pool.query('SELECT id FROM users WHERE id = $1', [reportedByUserId]);
            if (userCheck.rowCount === 0) {
                return res.status(404).json({ message: `The specified user to report for (id: ${reportedByUserId}) was not found.` });
            }
        }

        const query = `
            INSERT INTO support_tickets (reported_by_user_id, created_by_user_id, subject, description) 
            VALUES ($1, $2, $3, $4) 
            RETURNING *;
        `;
        
        const { rows } = await pool.query(query, [reportedByUserId, createdByUserId, subject, description]);

        res.status(201).json(rows[0]);

    } catch (err) {
        console.error('Error Creating Support Ticket:', err);
      
        res.status(500).json({ message: 'Failed to create support ticket' });
    }
};

export const getAllTickets = async (req: Request, res: Response) => {
    
    console.log(req.body)

    try {

        const query = `
            SELECT *
            FROM supportTickets
            ORDER BY created_at DESC;
        `;

        const { rows } = await pool.query(query);

        res.json(rows);

    } catch (err) {
        console.error(`Error fetching tickets:`, err);
        res.status(500).json({ message: 'Failed to fetch tickets.' });
    }

}

export const getTicket = async (req: Request, res: Response) => {
    
    console.log(req.body)
    const ticketId = req.params.id

    try {

        const query = `
            SELECT *
            FROM supportTickets
            WHERE id = $1;
        `;

        const { rows } = await pool.query(query, [ticketId]);

        res.json(rows);

    } catch (err) {
        console.error(`Error fetching tickets:`, err);
        res.status(500).json({ message: 'Failed to fetch tickets.' });
    }

}

export const getUserTickets = async (req: Request, res: Response) => {
    const { id: authenticatedUserId} = req.user;
    console.log(req.body)

    try {

        const query = `
            SELECT *
            FROM supportTickets
            WHERE reported_by = $1;
        `;

        const { rows } = await pool.query(query, [authenticatedUserId]);

        res.json(rows);

    } catch (err) {
        console.error(`Error fetching tickets:`, err);
        res.status(500).json({ message: 'Failed to fetch tickets.' });
    }

}