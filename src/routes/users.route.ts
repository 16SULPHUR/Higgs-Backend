import express from 'express';
import { addUserToOrg, getAllUsers, getAllUsersForMemberBook, removeUserFromOrg } from '../controllers/users/users.controller.js';
import { authorizeAdmin } from '../middleware/authorizeAdmin.js';

const adminUsersRoutes = express.Router();
const usersRoutes = express.Router();


usersRoutes.get('/member-book', getAllUsersForMemberBook);

adminUsersRoutes.get('/', getAllUsers);
adminUsersRoutes.patch('/:id', authorizeAdmin(['SUPER_ADMIN']), addUserToOrg);
adminUsersRoutes.delete('/remove/:id', removeUserFromOrg);


export {adminUsersRoutes, usersRoutes};