import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config({ path: './.env.local' });

/**
 * MongoDB 连接状态
 */
const connectionStates = {
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnecting',
  4: 'unauthorized',
  5: 'uninitialized'
};

/**
 * 连接到 MongoDB 数据库
 */
async function connectDB() {
  try {
    if (mongoose.connection.readyState === 1) {
      console.log('数据库已连接');
      return;
    }

    const mongoURI = process.env.MONGODB_URI;

    if (!mongoURI) {
      console.warn('⚠️  MONGODB_URI 环境变量未设置，将跳过数据库连接');
      return;
    }

    console.log('正在连接到 MongoDB...');

    await mongoose.connect(mongoURI, {
      serverSelectionTimeoutMS: 5000, // 5 秒超时
      socketTimeoutMS: 45000, // 45 秒超时
      connectTimeoutMS: 10000, // 10 秒连接超时
      maxPoolSize: 10, // 最大连接池大小
      minPoolSize: 5, // 最小连接池大小
    });

    console.log('✅ MongoDB 连接成功');

    // 监听连接事件
    mongoose.connection.on('connected', () => {
      console.log('MongoDB 连接已建立');
    });

    mongoose.connection.on('error', (err) => {
      console.error('MongoDB 连接错误:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.log('MongoDB 连接已断开');
    });

  } catch (error) {
    console.error('❌ MongoDB 连接失败:', error.message);
    console.log('⚠️  服务器将在无数据库连接的情况下启动');
    // 不再退出进程，允许服务器在无数据库连接的情况下启动
  }
}

/**
 * 断开数据库连接
 */
async function disconnectDB() {
  try {
    await mongoose.connection.close();
    console.log('MongoDB 连接已关闭');
  } catch (error) {
    console.error('关闭数据库连接时出错:', error);
  }
}

/**
 * 获取数据库连接状态
 */
function getConnectionStatus() {
  const state = mongoose.connection.readyState;
  return {
    state,
    status: connectionStates[state],
    isConnected: state === 1
  };
}

/**
 * 优雅关闭数据库连接
 */
process.on('SIGINT', async () => {
  await disconnectDB();
  process.exit(0);
});

export {
  connectDB,
  disconnectDB,
  getConnectionStatus,
  mongoose
}; 