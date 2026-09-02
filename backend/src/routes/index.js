import { Router } from 'express';
import authRoutes from '../modules/auth/auth.routes.js';
import usersRoutes from '../modules/users/users.routes.js';
import businessesRoutes from '../modules/businesses/businesses.routes.js';
import categoriesRoutes from '../modules/categories/categories.routes.js';
import productsRoutes from '../modules/products/products.routes.js';
import inventoryRoutes from '../modules/inventory/inventory.routes.js';
import suppliersRoutes from '../modules/suppliers/suppliers.routes.js';
import purchasesRoutes from '../modules/purchases/purchases.routes.js';

const router = Router();

router.get('/health', (req, res) => res.json({ status: 'ok' }));
router.use('/auth', authRoutes);
router.use('/users', usersRoutes);
router.use('/businesses', businessesRoutes);
router.use('/categories', categoriesRoutes);
router.use('/products', productsRoutes);
router.use('/inventory', inventoryRoutes);
router.use('/suppliers', suppliersRoutes);
router.use('/purchases', purchasesRoutes);

export default router;
