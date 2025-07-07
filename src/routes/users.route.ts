import express from 'express';
import { addUserToOrg, getAllUsers, removeUserFromOrg } from '../controllers/users/users.controller.js';
import { authorizeAdmin } from '../middleware/authorizeAdmin.js';

const usersRoutes = express.Router();


usersRoutes.get('/', getAllUsers);
usersRoutes.patch('/:id', authorizeAdmin(['SUPER_ADMIN']), addUserToOrg);
usersRoutes.delete('/remove/:id', removeUserFromOrg);


export default usersRoutes;