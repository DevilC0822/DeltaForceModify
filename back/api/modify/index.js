import express from 'express';
import multer from 'multer';
import { success, error } from '../../utils/index.js';
import ExcelJS from 'exceljs';
import fs from 'fs';
import path from 'path';
import { mongoose } from '../../db/index.js';
import Modify from '../../models/Modify.js';
import ImportRecord from '../../models/ImportRecord.js';
import LikeRecord from '../../models/LikeRecord.js';

const router = express.Router();

// 导入状态管理
let importStatus = {
  isImporting: false,
  startTime: null,
  fileName: '',
  totalRecords: 0,
  processedRecords: 0,
  savedCount: 0,
  skippedCount: 0,
  errorCount: 0,
  currentStep: '',
  errors: [],
  progress: 0 // 进度百分比
};

// 重置导入状态
function resetImportStatus() {
  importStatus = {
    isImporting: false,
    startTime: null,
    fileName: '',
    totalRecords: 0,
    processedRecords: 0,
    savedCount: 0,
    skippedCount: 0,
    errorCount: 0,
    currentStep: '',
    errors: [],
    progress: 0
  };
}

// 更新导入进度
function updateProgress(step, processed = null) {
  importStatus.currentStep = step;
  if (processed !== null) {
    importStatus.processedRecords = processed;
    importStatus.progress = importStatus.totalRecords > 0
      ? Math.round((processed / importStatus.totalRecords) * 100)
      : 0;
  }
}

// 配置 multer 用于文件上传
const storage = multer.diskStorage({
  destination: (req, file, callback) => {
    const uploadDir = './uploads';
    // 确保上传目录存在
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    callback(null, uploadDir);
  },
  filename: (req, file, callback) => {
    // 处理文件名乱码问题
    const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    const ext = path.extname(originalName);
    const filename = `excel_${Date.now()}${ext}`;
    callback(null, filename);
  }
});

const fhddStartIndex = 3; // 烽火地带 开始行
let qmzcStartIndex = -1; // 全面战场 开始行

// 文件过滤器，只允许 Excel 文件
const fileFilter = (req, file, callback) => {
  const allowedMimes = [
    'application/vnd.ms-excel', // .xls
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    'application/octet-stream' // 一些浏览器可能发送这个 MIME 类型
  ];

  const allowedExtensions = ['.xls', '.xlsx'];
  const fileExtension = path.extname(file.originalname).toLowerCase();

  if (allowedMimes.includes(file.mimetype) || allowedExtensions.includes(fileExtension)) {
    callback(null, true);
  } else {
    callback(new Error('只允许上传 Excel 文件 (.xls, .xlsx)'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 限制文件大小为 10MB
  }
});

// 查询导入进度接口
router.get('/import-progress', (req, res) => {
  success(res, {
    ...importStatus,
    // 计算导入耗时
    duration: importStatus.startTime ? Date.now() - importStatus.startTime : 0
  }, '获取导入进度成功');
});

// 获取 modify 详情接口
router.get('/list', async (req, res) => {
  try {
    // 检查数据库连接状态
    if (mongoose.connection.readyState !== 1) {
      return error(res, '数据库连接失败，服务暂时不可用', 503);
    }

    const { name, type, page = 1, limit = 10 } = req.query;

    // 构建查询条件
    const query = {};

    if (name) {
      // 支持模糊搜索
      query.name = { $regex: name, $options: 'i' };
    }

    if (type) {
      // 精确匹配类型
      if (!['烽火地带', '全面战场'].includes(type)) {
        return error(res, '类型参数无效，只支持：烽火地带、全面战场', 400);
      }
      query.type = type;
    }

    // 分页参数处理
    const pageNum = Math.max(1, parseInt(page));
    const pageSize = Math.min(100, Math.max(1, parseInt(limit))); // 限制最大100条
    const skip = (pageNum - 1) * pageSize;

    console.log('查询条件:', query);
    console.log('分页参数:', { page: pageNum, limit: pageSize, skip });

    // 执行查询 - 使用聚合管道来实现自定义排序
    const [list, total] = await Promise.all([
      Modify.aggregate([
        { $match: query },
        {
          $addFields: {
            // 为type添加排序权重：烽火地带=1, 全面战场=2
            typeSort: {
              $cond: { if: { $eq: ["$type", "烽火地带"] }, then: 1, else: 2 }
            }
          }
        },
        {
          $sort: {
            likeCount: -1, // 点赞数从大到小排列
            typeSort: 1,   // likeCount相同时，烽火地带(1)排在全面战场(2)前面
            updatedAt: -1,
            createdAt: -1
          }
        },
        { $skip: skip },
        { $limit: pageSize },
        {
          $project: {
            typeSort: 0  // 移除临时字段
          }
        }
      ]),
      Modify.countDocuments(query)
    ]);

    // 计算分页信息
    const totalPages = Math.ceil(total / pageSize);
    const hasNextPage = pageNum < totalPages;
    const hasPrevPage = pageNum > 1;

    const result = {
      list,
      pagination: {
        current: pageNum,
        pageSize,
        total,
        totalPages,
        hasNextPage,
        hasPrevPage
      },
      filters: {
        name: name || '',
        type: type || ''
      }
    };

    console.log(`查询完成: 找到 ${list.length}/${total} 条记录`);
    success(res, result, '获取数据成功');

  } catch (err) {
    console.error('查询 modify 数据失败:', err);
    error(res, '查询数据失败: ' + err.message, 500);
  }
});

// 根据ID获取单条详情
router.get('/detail/:id', async (req, res) => {
  try {
    // 检查数据库连接状态
    if (mongoose.connection.readyState !== 1) {
      return error(res, '数据库连接失败，服务暂时不可用', 503);
    }

    const { id } = req.params;

    // 验证ID格式
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return error(res, '无效的ID格式', 400);
    }

    const item = await Modify.findById(id).lean();

    if (!item) {
      return error(res, '未找到指定的记录', 404);
    }

    console.log(`获取详情成功: ${item.name} (${item.type})`);
    success(res, item, '获取详情成功');

  } catch (err) {
    console.error('获取详情失败:', err);
    error(res, '获取详情失败: ' + err.message, 500);
  }
});

// 获取所有枪械名称接口
router.get('/weapon-names', async (req, res) => {
  try {
    // 检查数据库连接状态
    if (mongoose.connection.readyState !== 1) {
      return error(res, '数据库连接失败，服务暂时不可用', 503);
    }

    // 获取所有不重复的枪械名称
    const weaponNames = await Modify.distinct('name');

    // 按字母顺序排序
    const sortedNames = weaponNames.filter(name => name && name.trim()).sort();

    console.log(`获取枪械名称成功: 共 ${sortedNames.length} 个不重复名称`);
    success(res, sortedNames, '获取枪械名称成功');

  } catch (err) {
    console.error('获取枪械名称失败:', err);
    error(res, '获取枪械名称失败: ' + err.message, 500);
  }
});

// 接收 excel 文件 
router.post('/import-daozai', upload.single('excel'), async (req, res) => {
  try {
    // 检查是否有正在进行的导入任务
    if (importStatus.isImporting) {
      return error(res, '正在有用户在导入，请稍候刷新页面查看最新内容', 423);
    }

    if (!req.file) {
      return error(res, '请上传 Excel 文件', 400);
    }

    // 处理文件名乱码问题
    const originalFileName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
    if (!originalFileName.includes('刀仔')) {
      return error(res, '请从 https://docs.qq.com/sheet/DSWV2QWFZUENXZnRE?tab=BB08J2 下载文档，并上传', 400);
    }

    // 检查数据库连接状态
    if (mongoose.connection.readyState === 1) {
      // 检查最后导入时间
      const lastImportRecord = await ImportRecord.findOne({
        type: 'daozai_import'
      }).sort({ lastImportTime: -1 });

      if (lastImportRecord) {
        const now = new Date();
        const lastImportTime = new Date(lastImportRecord.lastImportTime);
        const timeDiff = now - lastImportTime;
        const oneHour = 60 * 60 * 1000; // 1小时的毫秒数

        if (timeDiff < oneHour) {
          const remainingMinutes = Math.ceil((oneHour - timeDiff) / (60 * 1000));
          return error(res, `距离上次导入时间不足1小时，请等待 ${remainingMinutes} 分钟后再试`, 429);
        }
      }
    }

    // 初始化导入状态
    resetImportStatus();
    importStatus.isImporting = true;
    importStatus.startTime = Date.now();
    importStatus.fileName = originalFileName;
    updateProgress('开始处理文件...');

    console.log('=== 开始处理上传的 Excel 文件 ===');
    console.log('原始文件名:', originalFileName);
    console.log('保存路径:', req.file.path);
    console.log('文件大小:', (req.file.size / 1024).toFixed(2), 'KB');

    updateProgress('正在读取 Excel 文件...');

    // 使用 ExcelJS 读取文件
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(req.file.path);

    const result = {
      fileName: originalFileName,
      fileSize: req.file.size,
      data: [],
    };

    updateProgress('正在解析工作表...');
    console.log(`\n发现 ${workbook.worksheets.length} 个工作表:`);

    // 遍历所有工作表
    workbook.worksheets.forEach((worksheet, sheetIndex) => {
      console.log(`\n--- 工作表 ${sheetIndex + 1}: ${worksheet.name} ---`);

      // 遍历所有行
      worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        const rowData = [];
        let hasData = false;

        // 遍历所有列
        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          let cellValue = '';

          // 处理不同类型的单元格值
          if (cell.value !== null && cell.value !== undefined) {
            if (typeof cell.value === 'object' && cell.value.richText) {
              // 富文本格式
              cellValue = cell.value.richText.map(part => part.text).join('');
            } else if (typeof cell.value === 'object' && cell.value.formula) {
              // 公式格式
              cellValue = cell.value.result || cell.value.formula;
            } else if (cell.value instanceof Date) {
              // 日期格式
              cellValue = cell.value.toISOString().split('T')[0];
            } else {
              cellValue = cell.value.toString();
            }

            if (cellValue.trim()) {
              hasData = true;
            }
          }

          rowData.push(cellValue);
        });

        if (hasData) {
          if (rowData[0].includes('刀仔') || rowNumber === fhddStartIndex || rowNumber === qmzcStartIndex) {
            return;
          }
          if ([... new Set(rowData.filter(item => Boolean(item)))].length === 1) {
            qmzcStartIndex = rowNumber + 1;
            return;
          }
          result.data.push({
            name: rowData[rowData[4].includes('烽火地带') ? 0 : 2],
            version: rowData[4].includes('烽火地带') ? rowData[1] : '',
            price: rowData[4].includes('烽火地带') ? rowData[2] : '',
            description: rowData[3],
            code: rowData[4],
            range: rowData[4].includes('烽火地带') ? rowData[5] : '',
            remark: rowData[4].includes('烽火地带') ? rowData[6] : '',
            updateTime: rowData[4].includes('烽火地带') ? rowData[7] : '',
            source: '刀仔',
            type: rowData[4].includes('烽火地带') ? '烽火地带' : '全面战场',
            likeCount: 0,
          });
        }
      });
    });

    // 更新总记录数
    importStatus.totalRecords = result.data.length;
    updateProgress(`解析完成，共 ${result.data.length} 条数据，开始保存到数据库...`, 0);

    // 数据库操作：保存到 MongoDB
    let savedCount = 0;
    let errorCount = 0;
    let skippedCount = 0;
    const dbResults = {
      success: [],
      errors: [],
      skipped: []
    };

    if (mongoose.connection.readyState === 1 && result.data.length > 0) {
      console.log(`\n=== 开始保存 ${result.data.length} 条数据到数据库 ===`);

      for (let i = 0; i < result.data.length; i++) {
        const item = result.data[i];

        // 更新进度
        updateProgress(`正在保存第 ${i + 1}/${result.data.length} 条记录...`, i);

        try {
          // 使用 name-type-description 作为唯一键检查是否已存在相同的记录
          const existingItem = await Modify.findOne({
            name: item.name,
            type: item.type,
            description: item.description
          });

          if (existingItem) {
            // 记录已存在，检查 updateTime 是否相同
            if (existingItem.updateTime === item.updateTime) {
              // updateTime 相同，跳过此记录
              skippedCount++;
              dbResults.skipped.push({
                action: 'skipped',
                reason: 'updateTime unchanged',
                data: {
                  name: item.name,
                  type: item.type,
                  description: item.description,
                  updateTime: item.updateTime
                }
              });
              console.log(`⏭️  跳过记录: ${item.name} (${item.type}) - updateTime 未变更`);
            } else {
              // updateTime 不同，更新指定字段
              const updatedItem = await Modify.findByIdAndUpdate(
                existingItem._id,
                {
                  version: item.version,
                  price: item.price,
                  code: item.code,
                  range: item.range,
                  remark: item.remark,
                  updateTime: item.updateTime
                },
                { new: true }
              );
              savedCount++;
              dbResults.success.push({
                action: 'updated',
                data: updatedItem,
                updatedFields: ['version', 'price', 'code', 'range', 'remark', 'updateTime']
              });
              console.log(`✅ 更新记录: ${item.name} (${item.type}) - updateTime: ${existingItem.updateTime} → ${item.updateTime}`);
            }
          } else {
            // 记录不存在，创建新记录
            const newItem = new Modify(item);
            const savedItem = await newItem.save();
            savedCount++;
            dbResults.success.push({
              action: 'created',
              data: savedItem
            });
            console.log(`✅ 新增记录: ${item.name} (${item.type})`);
          }

          // 更新导入状态中的计数
          importStatus.savedCount = savedCount;
          importStatus.skippedCount = skippedCount;
          importStatus.errorCount = errorCount;

        } catch (dbError) {
          errorCount++;
          const errorInfo = {
            item: item,
            error: dbError.message
          };
          console.error(`❌ 保存失败 ${item.name}:`, dbError.message);
          dbResults.errors.push(errorInfo);
          importStatus.errors.push(errorInfo);
          importStatus.errorCount = errorCount;
        }
      }

      updateProgress('数据库操作完成', result.data.length);
      console.log(`\n=== 数据库操作完成 ===`);
      console.log(`新增/更新: ${savedCount} 条`);
      console.log(`跳过: ${skippedCount} 条`);
      console.log(`失败: ${errorCount} 条`);

      // 保存导入记录
      try {
        const importRecord = new ImportRecord({
          type: 'daozai_import',
          lastImportTime: new Date(),
          fileName: originalFileName,
          recordCount: result.data.length,
          status: errorCount > 0 ? 'success' : 'success', // 即使有错误也标记为成功，因为部分数据导入成功
          summary: {
            savedCount,
            skippedCount,
            errorCount
          }
        });
        await importRecord.save();
        console.log('✅ 导入记录已保存');
      } catch (recordError) {
        console.warn('⚠️  保存导入记录失败:', recordError.message);
      }

    } else if (mongoose.connection.readyState !== 1) {
      console.warn('⚠️  数据库未连接，跳过数据保存');
      updateProgress('数据库未连接，跳过数据保存');
    }

    // 删除临时文件
    try {
      fs.unlinkSync(req.file.path);
      console.log('临时文件已清理');
    } catch (unlinkError) {
      console.warn('清理临时文件失败:', unlinkError.message);
    }

    // 标记导入完成
    importStatus.isImporting = false;
    updateProgress('导入完成！', result.data.length);

    // 返回结果，包含数据库操作信息
    const response = {
      ...result,
      database: {
        connected: mongoose.connection.readyState === 1,
        savedCount,
        skippedCount,
        errorCount,
        results: dbResults
      },
      importDuration: Date.now() - importStatus.startTime
    };

    success(res, response, 'Excel 文件导入成功');

  } catch (err) {
    console.error('Excel 文件处理失败:', err);

    // 更新导入状态为失败
    importStatus.isImporting = false;
    importStatus.currentStep = '导入失败: ' + err.message;
    importStatus.errors.push({
      error: err.message,
      stack: err.stack
    });

    // 保存失败的导入记录
    if (mongoose.connection.readyState === 1) {
      try {
        const importRecord = new ImportRecord({
          type: 'daozai_import',
          lastImportTime: new Date(),
          fileName: req.file ? Buffer.from(req.file.originalname, 'latin1').toString('utf8') : '未知文件',
          recordCount: 0,
          status: 'failed',
          summary: {
            savedCount: 0,
            skippedCount: 0,
            errorCount: 1
          }
        });
        await importRecord.save();
        console.log('💾 失败导入记录已保存');
      } catch (recordError) {
        console.warn('⚠️  保存失败导入记录失败:', recordError.message);
      }
    }

    // 如果文件存在，尝试删除临时文件
    if (req.file && req.file.path) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (unlinkError) {
        console.warn('清理临时文件失败:', unlinkError.message);
      }
    }

    error(res, 'Excel 文件处理失败: ' + err.message, 500);
  }
});

// 获取客户端真实IP地址的辅助函数
function getClientIP(req) {
  return req.headers['x-forwarded-for'] ||
    req.headers['x-real-ip'] ||
    req.connection.remoteAddress ||
    req.socket.remoteAddress ||
    (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
    req.ip ||
    '127.0.0.1';
}

// 武器点赞接口
router.post('/like', async (req, res) => {
  try {
    // 检查数据库连接状态
    if (mongoose.connection.readyState !== 1) {
      return error(res, '数据库连接失败，服务暂时不可用', 503);
    }

    const { weaponId } = req.body;

    // 参数验证
    if (!weaponId) {
      return error(res, '缺少必要参数：weaponId', 400);
    }

    // 验证weaponId格式
    if (!mongoose.Types.ObjectId.isValid(weaponId)) {
      return error(res, '武器ID格式无效', 400);
    }

    // 获取客户端IP地址和User-Agent
    const ipAddress = getClientIP(req);
    const userAgent = req.headers['user-agent'] || '';

    console.log('点赞请求:', { weaponId, ipAddress, userAgent: userAgent.substring(0, 50) + '...' });

    // 检查武器是否存在  
    const weapon = await Modify.findById(weaponId);
    if (!weapon) {
      return error(res, '武器不存在', 404);
    }

    // 检查是否已经点赞过
    const existingLike = await LikeRecord.findOne({
      weaponId: weaponId,
      ipAddress: ipAddress
    });

    if (existingLike) {
      return error(res, '您已经为这个武器点过赞了', 409);
    }

    // 先创建点赞记录（利用唯一索引防重复）
    await LikeRecord.create({
      weaponId: weaponId,
      ipAddress: ipAddress,
      userAgent: userAgent
    });

    // 增加武器的点赞数
    const updatedWeapon = await Modify.findByIdAndUpdate(
      weaponId,
      { $inc: { likeCount: 1 } },
      {
        new: true,
        select: 'name type likeCount'
      }
    );

    console.log('点赞成功:', { weaponId, newLikeCount: updatedWeapon.likeCount });

    success(res, {
      weaponId: weaponId,
      weaponName: updatedWeapon.name,
      weaponType: updatedWeapon.type,
      likeCount: updatedWeapon.likeCount,
      message: '点赞成功！感谢您的支持 👍'
    }, '点赞成功');

  } catch (err) {
    console.error('点赞处理失败:', err);

    // 处理特定的MongoDB错误
    if (err.code === 11000) {
      // 唯一索引冲突，说明已经点赞过
      return error(res, '您已经为这个武器点过赞了', 409);
    }

    error(res, '点赞处理失败: ' + err.message, 500);
  }
});

export default router; 