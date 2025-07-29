# Delta Force Modify 后台 API 文档

本文档提供 Delta Force Modify 后台服务的完整 API 接口说明。

## 服务信息

- **服务端口**: 6010
- **基础路径**: `/api`
- **支持格式**: JSON
- **数据库**: MongoDB

## 接口概览

| 接口         | 方法 | 路径                          | 描述                                   |
| ------------ | ---- | ----------------------------- | -------------------------------------- |
| 导入数据     | POST | `/api/modify/import-daozai`   | 上传并导入 Excel 文件                  |
| 查询进度     | GET  | `/api/modify/import-progress` | 获取导入进度状态                       |
| 获取列表     | GET  | `/api/modify/list`            | 获取 modify 数据列表（支持筛选和分页） |
| 获取详情     | GET  | `/api/modify/detail/:id`      | 根据ID获取单条数据详情                 |
| 获取枪械名称 | GET  | `/api/modify/weapon-names`    | 获取所有不重复的枪械名称列表           |
| 武器点赞     | POST | `/api/modify/like`            | 为指定武器点赞（防重复点赞）           |

---

## 1. 导入 Excel 数据

### 接口信息
- **URL**: `/api/modify/import-daozai`
- **方法**: `POST`
- **Content-Type**: `multipart/form-data`
- **功能**: 上传并解析 Excel 文件，将数据导入到 MongoDB 数据库

### 请求参数

| 参数名 | 类型 | 必填 | 描述                     |
| ------ | ---- | ---- | ------------------------ |
| excel  | File | ✅    | Excel 文件 (.xlsx, .xls) |

### 文件要求
- **文件格式**: `.xlsx` 或 `.xls`
- **文件大小**: 最大 10MB
- **文件名要求**: 必须包含 "刀仔" 字样
- **来源**: https://docs.qq.com/sheet/DSWV2QWFZUENXZnRE?tab=BB08J2

### 响应格式

#### 成功响应 (200)
```json
{
  "success": true,
  "code": 200,
  "msg": "Excel 文件导入成功",
  "data": {
    "fileName": "刀仔数据2024.xlsx",
    "fileSize": 1024000,
    "data": [
      {
        "name": "AK-74",
        "version": "S级",
        "price": "15000",
        "description": "高伤害突击步枪",
        "code": "【烽火地带】AK74突击步枪",
        "range": "400m",
        "remark": "推荐新手使用",
        "updateTime": "2024-01-01",
        "source": "刀仔",
        "type": "烽火地带",
        "likeCount": 0
      }
    ],
    "database": {
      "connected": true,
      "savedCount": 45,
      "skippedCount": 12,
      "errorCount": 0,
      "results": {
        "success": [...],
        "skipped": [...],
        "errors": []
      }
    },
    "importDuration": 15230
  }
}
```

#### 错误响应

**文件格式错误 (400)**
```json
{
  "success": false,
  "code": 400,
  "msg": "请上传 Excel 文件",
  "data": null
}
```

**文件来源错误 (400)**
```json
{
  "success": false,
  "code": 400,
  "msg": "请从 https://docs.qq.com/sheet/DSWV2QWFZUENXZnRE?tab=BB08J2 下载文档，并上传",
  "data": null
}
```

**正在导入中 (423)**
```json
{
  "success": false,
  "code": 423,
  "msg": "正在有用户在导入，请稍候刷新页面查看最新内容",
  "data": null
}
```

**导入频率限制 (429)**
```json
{
  "success": false,
  "code": 429,
  "msg": "距离上次导入时间不足1小时，请等待 45 分钟后再试",
  "data": null
}
```

**数据库连接错误 (503)**
```json
{
  "success": false,
  "code": 503,
  "msg": "数据库连接失败，服务暂时不可用",
  "data": {
    "database": {
      "state": 0,
      "status": "disconnected",
      "isConnected": false
    }
  }
}
```

### 前端使用示例

```javascript
// 导入 Excel 文件
async function importExcel(file) {
  const formData = new FormData();
  formData.append('excel', file);

  try {
    const response = await fetch('/api/modify/import-daozai', {
      method: 'POST',
      body: formData
    });

    const result = await response.json();

    if (response.ok) {
      console.log('导入成功:', result.data);
      alert(`导入完成！新增/更新: ${result.data.database.savedCount} 条，跳过: ${result.data.database.skippedCount} 条`);
    } else {
      if (response.status === 423) {
        alert('正在有用户在导入，请稍候再试');
      } else {
        alert('导入失败: ' + result.msg);
      }
    }
  } catch (error) {
    console.error('请求失败:', error);
    alert('网络错误，请重试');
  }
}

// 文件选择处理
document.getElementById('fileInput').addEventListener('change', function(e) {
  const file = e.target.files[0];
  if (file) {
    importExcel(file);
  }
});
```

---

## 2. 查询导入进度

### 接口信息
- **URL**: `/api/modify/import-progress`
- **方法**: `GET`
- **功能**: 获取当前导入任务的实时进度状态

### 响应格式

#### 成功响应 (200)

**导入进行中**
```json
{
  "success": true,
  "code": 200,
  "msg": "获取导入进度成功",
  "data": {
    "isImporting": true,
    "startTime": 1703123456789,
    "fileName": "刀仔数据2024.xlsx",
    "totalRecords": 500,
    "processedRecords": 250,
    "savedCount": 200,
    "skippedCount": 30,
    "errorCount": 5,
    "currentStep": "正在保存第 250/500 条记录...",
    "progress": 50,
    "duration": 12500,
    "errors": [
      {
        "item": {...},
        "error": "数据格式错误"
      }
    ]
  }
}
```

**导入完成或未开始**
```json
{
  "success": true,
  "code": 200,
  "msg": "获取导入进度成功",
  "data": {
    "isImporting": false,
    "startTime": null,
    "fileName": "",
    "totalRecords": 0,
    "processedRecords": 0,
    "savedCount": 0,
    "skippedCount": 0,
    "errorCount": 0,
    "currentStep": "",
    "progress": 0,
    "duration": 0,
    "errors": []
  }
}
```

### 响应字段说明

| 字段             | 类型        | 描述               |
| ---------------- | ----------- | ------------------ |
| isImporting      | Boolean     | 是否正在导入       |
| startTime        | Number/null | 导入开始时间戳     |
| fileName         | String      | 当前导入的文件名   |
| totalRecords     | Number      | 总记录数           |
| processedRecords | Number      | 已处理记录数       |
| savedCount       | Number      | 成功保存记录数     |
| skippedCount     | Number      | 跳过记录数         |
| errorCount       | Number      | 错误记录数         |
| currentStep      | String      | 当前执行步骤描述   |
| progress         | Number      | 进度百分比 (0-100) |
| duration         | Number      | 已耗时 (毫秒)      |
| errors           | Array       | 错误信息列表       |

### 前端使用示例

```javascript
// 查询导入进度
async function checkImportProgress() {
  try {
    const response = await fetch('/api/modify/import-progress');
    const result = await response.json();

    if (result.success) {
      const progress = result.data;
      
      // 更新进度条
      updateProgressBar(progress.progress);
      
      // 显示当前步骤
      document.getElementById('currentStep').textContent = progress.currentStep;
      
      // 显示统计信息
      document.getElementById('stats').innerHTML = `
        总数: ${progress.totalRecords} | 
        已处理: ${progress.processedRecords} | 
        成功: ${progress.savedCount} | 
        跳过: ${progress.skippedCount} | 
        错误: ${progress.errorCount}
      `;
      
      // 显示耗时
      const duration = Math.round(progress.duration / 1000);
      document.getElementById('duration').textContent = `耗时: ${duration}秒`;
      
      return progress;
    }
  } catch (error) {
    console.error('查询进度失败:', error);
  }
}

// 实时监控导入进度
async function monitorImportProgress() {
  const progress = await checkImportProgress();
  
  if (progress && progress.isImporting) {
    // 还在导入中，1秒后再次查询
    setTimeout(monitorImportProgress, 1000);
  } else {
    // 导入完成或未开始
    handleImportComplete(progress);
  }
}

// 导入完成处理
function handleImportComplete(progress) {
  if (progress.totalRecords > 0) {
    alert(`导入完成！\n成功: ${progress.savedCount} 条\n跳过: ${progress.skippedCount} 条\n错误: ${progress.errorCount} 条`);
  }
  
  // 重置UI状态
  resetProgressUI();
}

// 更新进度条UI
function updateProgressBar(percent) {
  const progressBar = document.getElementById('progressBar');
  const progressText = document.getElementById('progressText');
  
  progressBar.style.width = percent + '%';
  progressText.textContent = percent + '%';
}
```

---

## 3. 获取 modify 数据列表

### 接口信息
- **URL**: `/api/modify/list`
- **方法**: `GET`
- **功能**: 获取 modify 数据列表，支持按 name、type 筛选和分页
- **排序规则**: 
  1. 按照 `likeCount`（点赞数）从大到小排序
  2. `likeCount` 相同时，`烽火地带` 类型数据排在 `全面战场` 类型数据前面
  3. 最后按 `updatedAt` 和 `createdAt` 降序排序

### 请求参数

| 参数名 | 类型   | 必填 | 默认值 | 描述                          |
| ------ | ------ | ---- | ------ | ----------------------------- |
| name   | String | ❌    | -      | 枪械名称（支持模糊搜索）      |
| type   | String | ❌    | -      | 数据类型（烽火地带/全面战场） |
| page   | Number | ❌    | 1      | 页码（从1开始）               |
| limit  | Number | ❌    | 10     | 每页条数（最大100）           |

### 响应格式

#### 成功响应 (200)
```json
{
  "success": true,
  "code": 200,
  "msg": "获取数据成功",
  "data": {
    "list": [
      {
        "_id": "65a1b2c3d4e5f6789012345",
        "name": "AK-74",
        "version": "S级",
        "price": "15000",
        "description": "高伤害突击步枪",
        "code": "【烽火地带】AK74突击步枪",
        "range": "400m",
        "remark": "推荐新手使用",
        "updateTime": "2024-01-01",
        "source": "刀仔",
        "type": "烽火地带",
        "likeCount": 0,
        "createdAt": "2024-01-01T12:00:00.000Z",
        "updatedAt": "2024-01-01T12:00:00.000Z"
      }
    ],
    "pagination": {
      "current": 1,
      "pageSize": 10,
      "total": 150,
      "totalPages": 15,
      "hasNextPage": true,
      "hasPrevPage": false
    },
    "filters": {
      "name": "AK",
      "type": "烽火地带"
    }
  }
}
```

#### 错误响应

**类型参数无效 (400)**
```json
{
  "success": false,
  "code": 400,
  "msg": "类型参数无效，只支持：烽火地带、全面战场",
  "data": null
}
```

**数据库连接错误 (503)**
```json
{
  "success": false,
  "code": 503,
  "msg": "数据库连接失败，服务暂时不可用",
  "data": null
}
```

### 前端使用示例

```javascript
// 获取数据列表
async function getModifyList(filters = {}) {
  const params = new URLSearchParams();
  
  // 添加筛选条件
  if (filters.name) params.append('name', filters.name);
  if (filters.type) params.append('type', filters.type);
  if (filters.page) params.append('page', filters.page);
  if (filters.limit) params.append('limit', filters.limit);

  try {
    const response = await fetch(`/api/modify/list?${params.toString()}`);
    const result = await response.json();

    if (result.success) {
      console.log('获取数据成功:', result.data);
      
      // 处理数据列表
      const { list, pagination } = result.data;
      
      // 更新列表UI
      updateDataList(list);
      
      // 更新分页UI
      updatePagination(pagination);
      
      return result.data;
    } else {
      alert('获取数据失败: ' + result.msg);
    }
  } catch (error) {
    console.error('请求失败:', error);
    alert('网络错误，请重试');
  }
}

// 搜索数据
function searchData() {
  const nameFilter = document.getElementById('nameInput').value;
  const typeFilter = document.getElementById('typeSelect').value;
  
  getModifyList({
    name: nameFilter,
    type: typeFilter,
    page: 1,
    limit: 20
  });
}

// 分页处理
function changePage(page) {
  const currentFilters = {
    name: document.getElementById('nameInput').value,
    type: document.getElementById('typeSelect').value,
    page: page,
    limit: 20
  };
  
  getModifyList(currentFilters);
}
```

---

## 4. 获取单条数据详情

### 接口信息
- **URL**: `/api/modify/detail/:id`
- **方法**: `GET`
- **功能**: 根据数据ID获取单条 modify 数据的详细信息

### 请求参数

| 参数名 | 类型   | 必填 | 描述                            |
| ------ | ------ | ---- | ------------------------------- |
| id     | String | ✅    | MongoDB ObjectId（URL路径参数） |

### 响应格式

#### 成功响应 (200)
```json
{
  "success": true,
  "code": 200,
  "msg": "获取详情成功",
  "data": {
    "_id": "65a1b2c3d4e5f6789012345",
    "name": "AK-74",
    "version": "S级",
    "price": "15000",
    "description": "高伤害突击步枪",
    "code": "【烽火地带】AK74突击步枪",
    "range": "400m",
    "remark": "推荐新手使用",
    "updateTime": "2024-01-01",
    "source": "刀仔",
    "type": "烽火地带",
    "likeCount": 0,
    "createdAt": "2024-01-01T12:00:00.000Z",
    "updatedAt": "2024-01-01T12:00:00.000Z"
  }
}
```

#### 错误响应

**ID格式无效 (400)**
```json
{
  "success": false,
  "code": 400,
  "msg": "无效的ID格式",
  "data": null
}
```

**数据不存在 (404)**
```json
{
  "success": false,
  "code": 404,
  "msg": "未找到指定的记录",
  "data": null
}
```

**数据库连接错误 (503)**
```json
{
  "success": false,
  "code": 503,
  "msg": "数据库连接失败，服务暂时不可用",
  "data": null
}
```

### 前端使用示例

```javascript
// 获取单条数据详情
async function getModifyDetail(id) {
  try {
    const response = await fetch(`/api/modify/detail/${id}`);
    const result = await response.json();

    if (result.success) {
      console.log('获取详情成功:', result.data);
      
      // 显示详情数据
      showDetailModal(result.data);
      
      return result.data;
    } else {
      if (response.status === 404) {
        alert('数据不存在');
      } else if (response.status === 400) {
        alert('数据ID格式错误');
      } else {
        alert('获取详情失败: ' + result.msg);
      }
    }
  } catch (error) {
    console.error('请求失败:', error);
    alert('网络错误，请重试');
  }
}

// 显示详情弹窗
function showDetailModal(data) {
  const modal = document.getElementById('detailModal');
  
  // 填充数据
  document.getElementById('detailName').textContent = data.name;
  document.getElementById('detailType').textContent = data.type;
  document.getElementById('detailVersion').textContent = data.version || '-';
  document.getElementById('detailPrice').textContent = data.price || '-';
  document.getElementById('detailDescription').textContent = data.description || '-';
  document.getElementById('detailCode').textContent = data.code;
  document.getElementById('detailRange').textContent = data.range || '-';
  document.getElementById('detailRemark').textContent = data.remark || '-';
  document.getElementById('detailUpdateTime').textContent = data.updateTime || '-';
  
  // 显示弹窗
  modal.style.display = 'block';
}

// 列表中点击查看详情
document.addEventListener('click', function(e) {
  if (e.target.classList.contains('view-detail-btn')) {
    const itemId = e.target.getAttribute('data-id');
    getModifyDetail(itemId);
  }
});
```

---

## 5. 获取枪械名称列表

### 接口信息
- **URL**: `/api/modify/weapon-names`
- **方法**: `GET`
- **功能**: 获取所有不重复的枪械名称列表，按字母顺序排序

### 请求参数
无需参数

### 响应格式

#### 成功响应 (200)
```json
{
  "success": true,
  "code": 200,
  "msg": "获取枪械名称成功",
  "data": [
    "AK-74",
    "AK-15",
    "AR-15",
    "M4A1",
    "SCAR-H",
    "UMP45"
  ]
}
```

#### 错误响应

**数据库连接错误 (503)**
```json
{
  "success": false,
  "code": 503,
  "msg": "数据库连接失败，服务暂时不可用",
  "data": null
}
```

### 前端使用示例

```javascript
// 获取所有枪械名称
async function getWeaponNames() {
  try {
    const response = await fetch('/api/modify/weapon-names');
    const result = await response.json();

    if (result.success) {
      console.log('获取枪械名称成功:', result.data);
      
      // 填充下拉选择框
      const selectElement = document.getElementById('weaponSelect');
      selectElement.innerHTML = '<option value="">全部武器</option>';
      
      result.data.forEach(name => {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        selectElement.appendChild(option);
      });
      
      return result.data;
    } else {
      alert('获取枪械名称失败: ' + result.msg);
    }
  } catch (error) {
    console.error('请求失败:', error);
    alert('网络错误，请重试');
  }
}

// 页面加载时获取枪械名称
document.addEventListener('DOMContentLoaded', function() {
  getWeaponNames();
});
```

---

## 6. 数据库字段说明

### modify 集合字段结构

| 字段名      | 类型   | 必填 | 描述     | 示例                       |
| ----------- | ------ | ---- | -------- | -------------------------- |
| name        | String | ✅    | 枪械名称 | "AK-74"                    |
| version     | String | ❌    | 版本排行 | "S级"                      |
| price       | String | ❌    | 改装价格 | "15000"                    |
| description | String | ❌    | 改装说明 | "高伤害突击步枪"           |
| code        | String | ✅    | 枪械代码 | "【烽火地带】AK74突击步枪" |
| range       | String | ❌    | 有效射程 | "400m"                     |
| remark      | String | ❌    | 备注     | "推荐新手使用"             |
| updateTime  | String | ❌    | 更新时间 | "2024-01-01"               |
| source      | String | ✅    | 来源     | "刀仔"                     |
| type        | String | ✅    | 类型     | "烽火地带" / "全面战场"    |
| likeCount   | Number | ❌    | 点赞数   | 0                          |
| createdAt   | Date   | 自动 | 创建时间 | "2024-01-01T12:00:00.000Z" |
| updatedAt   | Date   | 自动 | 更新时间 | "2024-01-01T12:00:00.000Z" |

### 唯一键规则
- **唯一键组合**: `name + type + description`
- **更新策略**: 基于 `updateTime` 字段判断是否需要更新
- **更新字段**: `version`, `price`, `code`, `range`, `remark`, `updateTime`

### import_records 集合字段结构

| 字段名               | 类型   | 必填 | 描述         | 示例                                 |
| -------------------- | ------ | ---- | ------------ | ------------------------------------ |
| type                 | String | ✅    | 导入类型     | "daozai_import"                      |
| lastImportTime       | Date   | ✅    | 最后导入时间 | "2024-01-01T12:00:00.000Z"           |
| fileName             | String | ✅    | 导入的文件名 | "刀仔数据2024.xlsx"                  |
| recordCount          | Number | ❌    | 导入记录数量 | 500                                  |
| status               | String | ❌    | 导入状态     | "success" / "failed" / "in_progress" |
| summary.savedCount   | Number | ❌    | 成功保存数量 | 450                                  |
| summary.skippedCount | Number | ❌    | 跳过数量     | 30                                   |
| summary.errorCount   | Number | ❌    | 错误数量     | 20                                   |
| createdAt            | Date   | 自动 | 创建时间     | "2024-01-01T12:00:00.000Z"           |
| updatedAt            | Date   | 自动 | 更新时间     | "2024-01-01T12:00:00.000Z"           |

### 导入频率控制
- **时间间隔**: 两次导入之间必须间隔至少1小时
- **检查机制**: 每次导入前自动检查最后导入时间
- **记录保存**: 成功和失败的导入都会记录到 import_records 表

---

## 7. 状态码说明

| 状态码 | 描述         | 场景                         |
| ------ | ------------ | ---------------------------- |
| 200    | 成功         | 正常响应                     |
| 400    | 请求错误     | 文件格式错误、缺少参数等     |
| 423    | 资源被锁定   | 正在有其他用户导入数据       |
| 429    | 请求过于频繁 | 距离上次导入时间不足1小时    |
| 500    | 服务器错误   | 文件处理失败、数据库操作异常 |
| 503    | 服务不可用   | 数据库连接失败               |

---

## 8. 注意事项

1. **并发控制**: 同一时间只能有一个导入任务执行
2. **导入频率限制**: 两次导入之间必须间隔至少1小时
3. **文件大小**: 限制 10MB 以内的 Excel 文件
4. **文件命名**: 必须包含 "刀仔" 字样
5. **数据来源**: 必须从指定的腾讯文档下载
6. **实时监控**: 建议使用轮询方式获取导入进度
7. **错误处理**: 需要处理各种网络和业务异常情况
8. **用户体验**: 导入期间应禁用相关操作按钮

---

## 9. 开发环境配置

### 环境变量 (.env.local)
```bash
# MongoDB 连接字符串
MONGODB_URI=mongodb://localhost:27017/deltaforce_modify

# 服务器端口 (可选，默认 6010)
PORT=6010
```

### 启动服务
```bash
# 开发模式
npm run dev

# 生产模式
npm start
```

## 6. 武器点赞

### 接口信息
- **URL**: `/api/modify/like`
- **方法**: `POST`
- **功能**: 为指定武器点赞，增加点赞数
- **防重复**: 基于IP地址防重复，同一IP对同一武器只能点赞一次

### 请求参数

#### 请求体 (JSON)
| 参数名   | 类型   | 必填 | 描述             |
| -------- | ------ | ---- | ---------------- |
| weaponId | String | ✅    | 武器的MongoDB ID |

### 请求示例
```json
{
  "weaponId": "65a1b2c3d4e5f6789012345"
}
```

### 响应格式

#### 成功响应 (200)
```json
{
  "success": true,
  "code": 200,
  "msg": "点赞成功",
  "data": {
    "weaponId": "65a1b2c3d4e5f6789012345",
    "weaponName": "AK-74",
    "weaponType": "烽火地带",
    "likeCount": 15,
    "message": "点赞成功！感谢您的支持 👍"
  }
}
```

#### 错误响应

**参数缺失 (400)**
```json
{
  "success": false,
  "code": 400,
  "msg": "缺少必要参数：weaponId",
  "data": null
}
```

**武器ID格式无效 (400)**
```json
{
  "success": false,
  "code": 400,
  "msg": "武器ID格式无效",
  "data": null
}
```

**武器不存在 (404)**
```json
{
  "success": false,
  "code": 404,
  "msg": "武器不存在",
  "data": null
}
```

**重复点赞 (409)**
```json
{
  "success": false,
  "code": 409,
  "msg": "您已经为这个武器点过赞了",
  "data": null
}
```

**数据库连接错误 (503)**
```json
{
  "success": false,
  "code": 503,
  "msg": "数据库连接失败，服务暂时不可用",
  "data": null
}
```

### 前端使用示例

```javascript
// 武器点赞
async function likeWeapon(weaponId) {
  try {
    const response = await fetch('/api/modify/like', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ weaponId })
    });

    const result = await response.json();

    if (response.ok) {
      console.log('点赞成功:', result.data.message);
      console.log('新点赞数:', result.data.likeCount);
      // 更新UI显示新的点赞数
      updateLikeCount(weaponId, result.data.likeCount);
    } else {
      console.error('点赞失败:', result.msg);
      
      if (response.status === 409) {
        alert('您已经为这个武器点过赞了！');
      } else {
        alert('点赞失败，请稍后重试');
      }
    }
  } catch (error) {
    console.error('请求失败:', error);
    alert('网络错误，请稍后重试');
  }
}

// 使用示例
likeWeapon('65a1b2c3d4e5f6789012345');
```

### 防重复机制

- **基于IP地址**: 系统记录每个IP地址对每个武器的点赞记录
- **数据库约束**: 使用MongoDB唯一索引确保同一IP对同一武器只能有一条点赞记录
- **事务处理**: 使用数据库事务确保点赞记录和点赞数更新的原子性
- **错误处理**: 重复点赞时返回409状态码，前端可据此提示用户

---

### 依赖版本
- Node.js: >= 14.0.0
- MongoDB: >= 4.0.0
- Express: ^4.18.2
- Mongoose: ^8.0.0
- ExcelJS: ^4.4.0
