import express from 'express';
import { 
    listUserTickets, 
    getTicketById,
    createTicket, 
    deleteTicket 
} from '../controllers/supportTickets/userTickets.controller.js'; 

const userSupportTicketsRouter = express.Router();

userSupportTicketsRouter.get('/', listUserTickets);
userSupportTicketsRouter.post('/', createTicket);
userSupportTicketsRouter.get('/:id', getTicketById);
userSupportTicketsRouter.delete('/:id', deleteTicket);

export default userSupportTicketsRouter;