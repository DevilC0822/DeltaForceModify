import express from 'express';
import cors from 'cors';
import { connectDB, getConnectionStatus } from './db/index.js';
import apiRoutes from './api/index.js';
import { checkDatabaseConnection } from './utils/index.js';

const app = express();
const port = process.env.PORT || 6010;

// CORS 配置
const corsOptions = {
  origin: [
    'http://localhost:5173',    // Vite 开发服务器
    'http://localhost:6009',    // 其他可能的前端端口
    'https://cook.mihouo.com', // 生产环境
  ],
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

// 中间件
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 提供静态文件服务
app.use(express.static('.'));

// 设置 JSON 序列化选项，避免中文字符被转义
app.set('json escape', false);

// 基本路由
app.get('/', (req, res) => {
  const dbStatus = getConnectionStatus();
  res.json({
    message: 'Express v5 服务器正在运行',
    database: dbStatus
  });
});

// API 路由（应用数据库连接检查中间件）
app.use('/api', checkDatabaseConnection, apiRoutes);

// 启动服务器
async function startServer() {
  try {
    // 连接数据库
    await connectDB();

    // 启动服务器
    app.listen(port, () => {
      console.log(`服务器运行在端口 ${port}`);
    });
  } catch (error) {
    console.error('启动服务器失败:', error);
    process.exit(1);
  }
}

// 启动服务器
startServer();

export default app; 
