import express from 'express';
import { addUserToOrg, createNewUserByAdmin, getAllUsers, getAllUsersForMemberBook, getInvitableUsers, removeUserFromOrg, getPublicMemberNames } from '../controllers/users/users.controller.js'; 
import { deleteUserByAdmin, getAllUsersForAdmin, getUserByIdForAdmin, updateUserByAdmin } from '../controllers/adminControllers/users.controller.js';

const adminUsersRoutes = express.Router();
const usersRoutes = express.Router();


usersRoutes.get('/member-book', getAllUsersForMemberBook);
// Public route for SSG: only id + name
export const publicUsersRoutes = express.Router();
publicUsersRoutes.get('/member-names', getPublicMemberNames);
usersRoutes.get('/invitable', getInvitableUsers);

adminUsersRoutes.get('/summary', getAllUsers);
adminUsersRoutes.patch('add-to-org/:id', addUserToOrg);
adminUsersRoutes.delete('/remove-from-org/:id', removeUserFromOrg);

adminUsersRoutes.post('/', createNewUserByAdmin);
adminUsersRoutes.get('/', getAllUsersForAdmin);
adminUsersRoutes.get('/:id', getUserByIdForAdmin);
adminUsersRoutes.patch('/:id', updateUserByAdmin);
adminUsersRoutes.delete('/:id', deleteUserByAdmin);

// Approval workflow removed


export {adminUsersRoutes, usersRoutes};