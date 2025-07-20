import express from 'express';
import { createTicketForUser, deleteTicket, getTicketById, listAllTickets, updateTicketStatus } from '../controllers/supportTickets/adminTickets.controller.js';

const supportTicketsRouter = express.Router();

supportTicketsRouter.get('/', listAllTickets);
supportTicketsRouter.post('/', createTicketForUser);
supportTicketsRouter.get('/:id', getTicketById);
supportTicketsRouter.patch('/:id/status', updateTicketStatus);
supportTicketsRouter.delete('/:id', deleteTicket);

export default supportTicketsRouter;