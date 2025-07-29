/**
 * 统一响应格式包装函数
 * @param {boolean} success - 操作是否成功
 * @param {number} code - 状态码
 * @param {string} msg - 响应消息
 * @param {*} data - 响应数据
 * @returns {object} 标准格式响应对象
 */
function createResponse(success, code, msg, data = null) {
  return {
    success,
    code,
    msg,
    data
  };
}

/**
 * 数据库连接检查中间件
 * 在每个API请求前检查数据库连接状态
 * 对于某些接口（如文件处理），允许在数据库未连接时继续执行
 */
async function checkDatabaseConnection(req, res, next) {
  try {
    const { getConnectionStatus } = await import('../db/index.js');
    const dbStatus = getConnectionStatus();

    // 对于数据导入接口，即使数据库未连接也允许继续处理
    // 文件解析功能不依赖数据库，可以继续执行
    const allowedEndpointsWithoutDB = [
      '/import-daozai'
    ];

    const isAllowedEndpoint = allowedEndpointsWithoutDB.some(endpoint =>
      req.path.includes(endpoint)
    );

    if (!dbStatus.isConnected && !isAllowedEndpoint) {
      return res.status(503).json(errorResponse(
        '数据库连接失败，服务暂时不可用',
        503,
        {
          database: dbStatus,
          message: '请检查数据库连接配置'
        }
      ));
    }

    // 在请求对象中添加数据库状态信息，供后续处理使用
    req.dbStatus = dbStatus;

    // 继续处理请求
    next();
  } catch (error) {
    return res.status(500).json(errorResponse(
      '数据库状态检查失败',
      500,
      error.message
    ));
  }
}

/**
 * 成功响应
 * @param {*} data - 响应数据
 * @param {string} msg - 响应消息
 * @param {number} code - 状态码，默认200
 * @returns {object} 成功响应对象
 */
function successResponse(data, msg = '操作成功', code = 200) {
  return createResponse(true, code, msg, data);
}

/**
 * 错误响应
 * @param {string} msg - 错误消息
 * @param {number} code - 错误码，默认500
 * @param {*} data - 错误数据
 * @returns {object} 错误响应对象
 */
function errorResponse(msg = '操作失败', code = 500, data = null) {
  return createResponse(false, code, msg, data);
}

/**
 * 成功响应简化函数
 * @param {Response} res - Express响应对象
 * @param {*} data - 响应数据
 * @param {string} msg - 响应消息
 * @param {number} code - 状态码，默认200
 */
function success(res, data, msg = '操作成功', code = 200) {
  res.status(code).json(successResponse(data, msg, code));
}

/**
 * 错误响应简化函数
 * @param {Response} res - Express响应对象
 * @param {string} msg - 错误消息
 * @param {number} code - 错误码，默认500
 * @param {*} data - 错误数据
 */
function error(res, msg = '操作失败', code = 500, data = null) {
  res.status(code).json(errorResponse(msg, code, data));
}

/**
 * 将时间字符串转换为数字（分钟）
 * 支持格式：
 * - "1-2分钟" -> 1.5
 * - "5-10分钟" -> 7.5
 * - "30分钟" -> 30
 * - "1小时" -> 60
 * - "1.5小时" -> 90
 * @param {string|number} timeStr - 时间字符串或数字
 * @returns {number} 转换后的分钟数
 */
function parseTimeToMinutes(timeStr) {
  if (typeof timeStr === 'number') {
    return timeStr;
  }

  if (typeof timeStr !== 'string') {
    return 0;
  }

  // 移除多余的空格
  const cleaned = timeStr.trim();

  // 处理小时格式
  const hourMatch = cleaned.match(/(\d+(?:\.\d+)?)\s*小时/);
  if (hourMatch) {
    return Math.round(parseFloat(hourMatch[1]) * 60);
  }

  // 移除"分钟"、"小时"等中文字符，保留数字和连字符
  const numbersCleaned = cleaned.replace(/[分钟小时]/g, '');

  // 处理范围时间（如"1-2"，"5-10"）
  const rangeMatch = numbersCleaned.match(/(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)/);
  if (rangeMatch) {
    const min = parseFloat(rangeMatch[1]);
    const max = parseFloat(rangeMatch[2]);
    return parseFloat(((min + max) / 2).toFixed(1)); // 保留1位小数
  }

  // 处理单个数字
  const numberMatch = numbersCleaned.match(/(\d+(?:\.\d+)?)/);
  if (numberMatch) {
    return Math.round(parseFloat(numberMatch[1]));
  }

  return 0;
}

/**
 * 检查数据对象是否包含错误字段
 * @param {object} dataObj - 要检查的数据对象
 * @returns {boolean} 是否包含错误字段
 */
function hasError(dataObj) {
  return dataObj && (dataObj.error || dataObj.hasOwnProperty('error'));
}

export {
  createResponse,
  successResponse,
  errorResponse,
  success,
  error,
  checkDatabaseConnection,
  parseTimeToMinutes,
  hasError
}; 