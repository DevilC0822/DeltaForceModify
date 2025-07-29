import express from 'express';
import ModifyRouter from './modify/index.js';

const router = express.Router();

// 挂载子路由
router.use('/modify', ModifyRouter);

// 可以在这里添加其他 API 路由，比如：
// router.use('/users', require('./users'));
// router.use('/auth', require('./auth'));

export default router; 