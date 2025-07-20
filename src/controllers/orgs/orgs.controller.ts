import pool from "../../lib/db.js";
import { Request, Response } from 'express';
import { validateNewOrg, validateUpdateOrg, validateSetAdmin } from '../../validations/orgValidator.js';

export const getAllOrgs = async (req: Request, res: Response) => {
    console.log('Fetching all organizations');
    console.log('Request body:', req.body);
    try {
        const { rows } = await pool.query(`
            SELECT 
                o.*, 
                u.id AS admin_id, 
                u.name AS admin_name
            FROM organizations o
            LEFT JOIN users u ON o.org_admin_id = u.id
            ORDER BY o.created_at DESC
        `);

        const orgs = rows.map(org => ({
            ...org,
            admin: org.admin_id ? { id: org.admin_id, name: org.admin_name } : null
        }));
        res.json(orgs);
    } catch (err) {
        console.error('Error fetching organizations:', err);
        res.status(500).json({ message: 'Failed to fetch organizations' });
    }
};

export const getOrgById = async (req: Request, res: Response) => {
    const { id } = req.params;
    console.log("get org by id")
    try {
        const query = `
            SELECT 
                o.id,
                o.name,
                o.credits_pool,
                p.name AS plan_name,
                u.name AS admin_name,
                u.email AS admin_email
            FROM organizations o
            LEFT JOIN plans p ON o.plan_id = p.id
            LEFT JOIN users u ON o.org_admin_id = u.id
            WHERE o.id = $1;
        `;
        const { rows, rowCount } = await pool.query(query, [id]);

        if (rowCount === 0) {
            return res.status(404).json({ message: 'Organization not found' });
        }

        res.json(rows[0]);

    } catch (err) {
        console.error(`Error fetching organization ${id}:`, err);
        res.status(500).json({ message: 'Failed to fetch organization details' });
    }
};


export const createNewOrg = async (req: Request, res: Response) => {
    const validationErrors = validateNewOrg(req.body);
    if (validationErrors.length > 0) {
        return res.status(400).json({ message: 'Invalid input', errors: validationErrors });
    }

    const { name, plan_id } = req.body;

    try {

        const { rows } = await pool.query(
            'INSERT INTO organizations (name, plan_id) VALUES ($1, $2) RETURNING *',
            [name, plan_id]
        );
        res.status(201).json(rows[0]);
    } catch (err) {
        console.error('Error creating organization:', err);
        res.status(500).json({ message: 'Failed to create organization' });
    }
};

export const updateOrg = async (req: Request, res: Response) => {
    const validationErrors = validateUpdateOrg(req.body);
    if (validationErrors.length > 0) {
        return res.status(400).json({ message: 'Invalid input', errors: validationErrors });
    }

    const { id } = req.params;
    const { name, plan_id } = req.body;
    const fields = [];
    const values = [];
    let i = 1;

    if (name) {
        fields.push(`name = $${i++}`);
        values.push(name);
    }
    if (plan_id) {
        fields.push(`plan_id = $${i++}`);
        values.push(plan_id);
    }

    values.push(id);
    const query = `UPDATE organizations SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`;

    try {
        const { rows, rowCount } = await pool.query(query, values);
        if (rowCount === 0) {
            return res.status(404).json({ message: 'Organization not found' });
        }
        res.json(rows[0]);
    } catch (err) {
        console.error(`Error updating organization ${id}:`, err);
        res.status(500).json({ message: 'Failed to update organization' });
    }
};

export const deleteOrg = async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
        const { rowCount } = await pool.query('DELETE FROM organizations WHERE id = $1', [id]);
        if (rowCount === 0) {
            return res.status(404).json({ message: 'Organization not found' });
        }
        res.status(200).json({ message: 'Organization deleted successfully' });
    } catch (err) {
        console.error(`Error deleting organization ${id}:`, err);
        res.status(500).json({ message: 'Failed to delete organization' });
    }
};

export const setAdmin = async (req: Request, res: Response) => {
    const validationErrors = validateSetAdmin(req.body);
    if (validationErrors.length > 0) {
        return res.status(400).json({ message: 'Invalid input', errors: validationErrors });
    }

    const { orgId } = req.params;
    const { user_id: newAdminId } = req.body;

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const orgResult = await client.query('SELECT org_admin_id FROM organizations WHERE id = $1 FOR UPDATE', [orgId]);
        if (orgResult.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Organization not found.' });
        }
        const previousAdminId = orgResult.rows[0].org_admin_id;

        const userResult = await client.query('SELECT organization_id FROM users WHERE id = $1', [newAdminId]);
        if (userResult.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: `User with id ${newAdminId} not found.` });
        }
        if (String(userResult.rows[0].organization_id) !== String(orgId)) {
            await client.query('ROLLBACK');
            return res.status(403).json({ message: 'User must be a member of the organization to be made an admin.' });
        }

        if (previousAdminId) {
            await client.query(`UPDATE users SET role = 'ORG_USER' WHERE id = $1`, [previousAdminId]);
        }

        await client.query(`UPDATE users SET role = 'ORG_ADMIN' WHERE id = $1`, [newAdminId]);

        await client.query('UPDATE organizations SET org_admin_id = $1 WHERE id = $2', [newAdminId, orgId]);

        await client.query('COMMIT');

        res.status(200).json({ message: 'Organization admin updated successfully.' });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error(`Error setting admin for organization ${orgId}:`, err);
        res.status(500).json({ message: 'Failed to assign organization admin due to a server error.' });
    } finally {
        client.release();
    }
};

// export const getOrgPlan = async (req: Request, res: Response) => {
//     const { id } = req.params; // The ID of the organization to check

//     try {
//         const query = `
//             SELECT 
//                 p.id, 
//                 p.capacity, 
//                 p.plan_credits, 
//                 p.price, 
//                 p.created_at
//             FROM plans p
//             JOIN organizations o ON p.id = o.plan_id
//             WHERE o.id = $1;
//         `;

//         const { rows, rowCount } = await pool.query(query, [id]);

//         if (rowCount === 0) {
//             return res.status(404).json({ message: 'Plan not found for this organization. The organization may not exist or may not have an assigned plan.' });
//         }

//         res.json(rows[0]);

//     } catch (err) {
//         console.error(`Error fetching plan for organization ${id}:`, err);
//         res.status(500).json({ message: 'Failed to fetch organization plan' });
//     }
// };

export const getCurrentOrgPlan = async (req: Request, res: Response) => {
    const orgId = (req as any).user.organization_id;

    if (!orgId) {
        return res.status(403).json({ message: 'Forbidden: User is not associated with an organization.' });
    }

    try {
        const query = `
            SELECT 
                p.id, p.capacity, p.plan_credits, p.price, p.created_at
            FROM plans p
            JOIN organizations o ON p.id = o.plan_id
            WHERE o.id = $1;
        `;

        const { rows, rowCount } = await pool.query(query, [orgId]);

        if (rowCount === 0) {
            return res.status(404).json({ message: 'Plan information not found for your organization.' });
        }

        res.json(rows[0]);

    } catch (err) {
        console.error(`Error fetching plan for current org admin (orgId: ${orgId}):`, err);
        res.status(500).json({ message: 'Failed to fetch your organization plan' });
    }
};



export const cancelOrganizationPlan = async (req: Request, res: Response) => {
    const { orgId } = req.params;

    if (!orgId) {
        return res.status(400).json({ message: 'Organization ID is required.' });
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const query = `
            UPDATE organizations
            SET 
                plan_id = NULL,
                credits_pool = 0
            WHERE id = $1
            RETURNING id, name, plan_id, credits_pool;
        `;

        const { rows, rowCount } = await client.query(query, [orgId]);

        if (rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Organization not found.' });
        }

        await client.query('COMMIT');

        res.status(200).json({
            message: 'Organization plan has been cancelled successfully.',
            organization: rows[0]
        });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error(`Error cancelling plan for organization ${orgId}:`, err);
        res.status(500).json({ message: 'Failed to cancel organization plan due to a server error.' });
    } finally {
        client.release();
    }
};
