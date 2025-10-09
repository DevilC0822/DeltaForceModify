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
  currentWeaponName: '', // 当前正在处理的枪械名称
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
    currentWeaponName: '',
    errors: [],
    progress: 0
  };
}

// 更新导入进度
function updateProgress(step, processed = null, weaponName = '') {
  importStatus.currentStep = step;
  importStatus.currentWeaponName = weaponName;
  if (processed !== null) {
    importStatus.processedRecords = processed;
    importStatus.progress = importStatus.totalRecords > 0
      ? Math.round((processed / importStatus.totalRecords) * 100)
      : 0;
  }
  // 打印进度日志，方便调试
  console.log(`进度更新: ${importStatus.progress}% - ${step} ${weaponName ? `(${weaponName})` : ''}`);
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

const fhddStartIndex = 7; // 烽火地带 开始行（表头在第7行）
const qmzcStartIndex = 8; // 全面战场 开始行（表头在第8行）

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

// 获取最后上传时间接口
router.get('/last-import-time', async (req, res) => {
  try {
    // 检查数据库连接状态
    if (mongoose.connection.readyState !== 1) {
      return error(res, '数据库连接失败，服务暂时不可用', 503);
    }

    // 获取最后一次成功导入的记录
    const lastImportRecord = await ImportRecord.findOne({
      type: 'daozai_import',
      status: 'success'
    }).sort({ lastImportTime: -1 });

    const result = {
      hasImport: !!lastImportRecord,
      lastImportTime: lastImportRecord ? lastImportRecord.lastImportTime : null,
      fileName: lastImportRecord ? lastImportRecord.fileName : null,
      recordCount: lastImportRecord ? lastImportRecord.recordCount : 0
    };

    console.log('获取最后上传时间成功:', result);
    success(res, result, '获取最后上传时间成功');

  } catch (err) {
    console.error('获取最后上传时间失败:', err);
    error(res, '获取最后上传时间失败: ' + err.message, 500);
  }
});

// 后台导入处理函数
async function processImportInBackground(filePath, originalFileName) {
  console.log('=== 开始处理上传的 Excel 文件 ===');
  console.log('原始文件名:', originalFileName);
  console.log('保存路径:', filePath);

  try {
    updateProgress('正在读取 Excel 文件...');

    // 使用 ExcelJS 读取文件
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);

    const result = {
      fileName: originalFileName,
      data: [],
    };

    updateProgress('正在解析工作表...');
    console.log(`\n发现 ${workbook.worksheets.length} 个工作表:`);

    // 遍历所有工作表
    workbook.worksheets.forEach((worksheet, sheetIndex) => {
      console.log(`\n--- 工作表 ${sheetIndex + 1}: ${worksheet.name} ---`);

      // 遍历所有行
      worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        // 只处理第7行及以后的数据
        if (rowNumber < fhddStartIndex) {
          return;
        }

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
          // 跳过表头行
          if (rowNumber === fhddStartIndex || rowNumber === qmzcStartIndex) {
            return;
          }

          // 检查是否为烽火地带数据（前7列有数据）
          const fhddData = rowData.slice(0, 7).filter(item => Boolean(item));

          // 检查是否为全面战场数据（第9-11列有数据，注意数组索引从0开始，所以是8-10）
          const qmzcData = rowData.slice(8, 11);
          const qmzcNonEmptyData = qmzcData.filter(item => Boolean(item));

          // 处理烽火地带数据（前7列）
          if (fhddData.length > 0) {
            result.data.push({
              name: rowData[0] || '', // 枪械名称
              version: rowData[1] || '', // 版本排行
              price: rowData[2] || '', // 改装价格
              description: rowData[3] || '', // 满改/半改/丐版
              code: rowData[4] || '', // 枪械代码
              range: rowData[5] || '', // 有效射程
              remark: '', // 备注字段暂时为空
              updateTime: rowData[6] || '', // 更新时间
              source: '刀仔',
              type: '烽火地带',
              likeCount: 0,
            });
          }

          // 处理全面战场数据（第9-11列）
          if (qmzcNonEmptyData.length > 0) {
            // 获取第9-11列的具体值
            const name = (rowData[8] || '').toString().trim();
            const version = (rowData[9] || '').toString().trim();
            const code = (rowData[10] || '').toString().trim();

            // 过滤无效数据：
            // 1. 三列数据完全相同
            // 2. 存在空值（空字符串或只包含空白字符）
            const isAllSame = name === version && version === code && name !== '';
            const hasEmpty = !name || !version || !code;

            if (!isAllSame && !hasEmpty) {
              result.data.push({
                name: name, // 枪械名称
                version: version, // 改装样式
                price: '', // 全面战场没有价格字段
                description: '', // 全面战场没有描述字段
                code: code, // 改枪码
                range: '', // 全面战场没有射程字段
                remark: '', // 备注字段
                updateTime: '', // 全面战场没有更新时间字段
                source: '刀仔',
                type: '全面战场',
                likeCount: 0,
              });
            } else {
              console.log(`跳过无效的全面战场数据: 名称="${name}", 样式="${version}", 代码="${code}" (原因: ${isAllSame ? '三列相同' : '存在空值'})`);
            }
          }
        }
      });
    });

    // 更新总记录数
    importStatus.totalRecords = result.data.length;
    updateProgress(`解析完成，共 ${result.data.length} 条数据，开始清空数据库...`, 0);

    // 数据库操作：保存到 MongoDB
    let savedCount = 0;
    let errorCount = 0;
    let skippedCount = 0;
    let deletedCount = 0;

    if (mongoose.connection.readyState === 1 && result.data.length > 0) {
      // 先删除数据库中所有枪械数据
      try {
        updateProgress('正在清空数据库中的所有枪械数据...', 0);
        const deleteResult = await Modify.deleteMany({});
        deletedCount = deleteResult.deletedCount;
        console.log(`\n=== 已删除数据库中的 ${deletedCount} 条旧数据 ===`);
        updateProgress(`已删除 ${deletedCount} 条旧数据，开始导入新数据...`, 0);
      } catch (deleteError) {
        console.error('❌ 清空数据库失败:', deleteError);
        errorCount++;
        importStatus.errors.push({
          item: null,
          error: '清空数据库失败: ' + deleteError.message
        });
      }

      console.log(`\n=== 开始保存 ${result.data.length} 条数据到数据库 ===`);

      for (let i = 0; i < result.data.length; i++) {
        const item = result.data[i];

        // 更新进度，包含当前武器名称
        updateProgress(`正在保存第 ${i + 1}/${result.data.length} 条记录...`, i + 1, item.name);

        try {
          // 直接创建新记录（因为已经清空了数据库）
          const newItem = new Modify(item);
          await newItem.save();
          savedCount++;
          console.log(`✅ 新增记录: ${item.name} (${item.type})`);
        } catch (dbError) {
          errorCount++;
          const errorInfo = {
            item: item,
            error: dbError.message
          };
          console.error(`❌ 保存失败 ${item.name}:`, dbError.message);
          importStatus.errors.push(errorInfo);
          importStatus.errorCount = errorCount;
        }
      }

      importStatus.savedCount = savedCount;
      importStatus.skippedCount = skippedCount;

      updateProgress('数据库操作完成', result.data.length);
      console.log(`\n=== 数据库操作完成 ===`);
      console.log(`删除旧数据: ${deletedCount} 条`);
      console.log(`新增: ${savedCount} 条`);
      console.log(`失败: ${errorCount} 条`);

      // 保存导入记录
      try {
        const importRecord = new ImportRecord({
          type: 'daozai_import',
          lastImportTime: new Date(),
          fileName: originalFileName,
          recordCount: result.data.length,
          status: 'success',
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
      fs.unlinkSync(filePath);
      console.log('临时文件已清理');
    } catch (unlinkError) {
      console.warn('清理临时文件失败:', unlinkError.message);
    }

    // 标记导入完成
    importStatus.isImporting = false;
    updateProgress('导入完成！', result.data.length);

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
          fileName: originalFileName,
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
    try {
      fs.unlinkSync(filePath);
    } catch (unlinkError) {
      console.warn('清理临时文件失败:', unlinkError.message);
    }
  }
}

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

    // 处理文件名乱码问题 - 尝试不同的编码方式
    let originalFileName = req.file.originalname;

    // 尝试从 latin1 转换为 utf8
    try {
      originalFileName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
    } catch (e) {
      // 如果转换失败，使用原始文件名
      console.log('文件名编码转换失败，使用原始文件名');
    }

    console.log('originalFileName', originalFileName);
    console.log('包含刀仔?', originalFileName.includes('刀仔'));

    // 放宽验证条件：文件名包含"刀仔"或文件是xlsx/xls格式即可
    const isValidFile = originalFileName.includes('刀仔') ||
      originalFileName.includes('三角洲') ||
      /\.(xlsx|xls)$/i.test(originalFileName);

    if (!isValidFile) {
      return error(res, '请上传包含"刀仔"或"三角洲"字样的Excel文件，或从 https://docs.qq.com/sheet/DSWV2QWFZUENXZnRE?tab=BB08J2 下载文档', 400);
    }

    // 检查数据库连接状态
    if (mongoose.connection.readyState === 1) {
      // 检查导入时间限制（开发环境不限制，生产环境限制24小时）
      const isDev = process.env.NODE_ENV !== 'production';

      if (!isDev) {
        // 生产环境：检查最后导入时间
        const lastImportRecord = await ImportRecord.findOne({
          type: 'daozai_import'
        }).sort({ lastImportTime: -1 });

        if (lastImportRecord) {
          const now = new Date();
          const lastImportTime = new Date(lastImportRecord.lastImportTime);
          const timeDiff = now - lastImportTime;
          const twentyFourHours = 24 * 60 * 60 * 1000; // 24小时的毫秒数

          if (timeDiff < twentyFourHours) {
            const remainingHours = Math.ceil((twentyFourHours - timeDiff) / (60 * 60 * 1000));
            return error(res, `距离上次导入时间不足24小时，请等待 ${remainingHours} 小时后再试`, 429);
          }
        }
      } else {
        console.log('开发环境：跳过导入时间限制检查');
      }
    }

    // 初始化导入状态
    resetImportStatus();
    importStatus.isImporting = true;
    importStatus.startTime = Date.now();
    importStatus.fileName = originalFileName;
    updateProgress('开始处理文件...');

    console.log('=== 开始异步导入任务 ===');
    console.log('原始文件名:', originalFileName);
    console.log('保存路径:', req.file.path);
    console.log('文件大小:', (req.file.size / 1024).toFixed(2), 'KB');

    // 立即返回响应
    success(res, {
      message: '导入任务已开始',
      fileName: originalFileName,
      fileSize: req.file.size
    }, '开始导入Excel文件，请使用 /import-progress 接口查询导入进度');

    // 在后台执行导入（不等待完成）
    processImportInBackground(req.file.path, originalFileName).catch(err => {
      console.error('后台导入任务失败:', err);
    });

  } catch (err) {
    console.error('处理导入请求失败:', err);

    // 更新导入状态为失败
    importStatus.isImporting = false;
    importStatus.currentStep = '导入失败: ' + err.message;
    importStatus.errors.push({
      error: err.message,
      stack: err.stack
    });

    // 如果文件存在，尝试删除临时文件
    if (req.file && req.file.path) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (unlinkError) {
        console.warn('清理临时文件失败:', unlinkError.message);
      }
    }

    error(res, '处理导入请求失败: ' + err.message, 500);
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