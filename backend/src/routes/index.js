import { Router } from 'express';
import authRoutes from '../modules/auth/auth.routes.js';
import usersRoutes from '../modules/users/users.routes.js';
import businessesRoutes from '../modules/businesses/businesses.routes.js';
import categoriesRoutes from '../modules/categories/categories.routes.js';
import productsRoutes from '../modules/products/products.routes.js';

const router = Router();

router.get('/health', (req, res) => res.json({ status: 'ok' }));
router.use('/auth', authRoutes);
router.use('/users', usersRoutes);
router.use('/businesses', businessesRoutes);
router.use('/categories', categoriesRoutes);
router.use('/products', productsRoutes);

export default router;
