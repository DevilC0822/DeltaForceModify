import mongoose from 'mongoose';

const importRecordSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    default: 'daozai_import',
    comment: '导入类型'
  },
  lastImportTime: {
    type: Date,
    required: true,
    default: Date.now,
    comment: '最后导入时间'
  },
  fileName: {
    type: String,
    required: true,
    comment: '导入的文件名'
  },
  recordCount: {
    type: Number,
    default: 0,
    comment: '导入记录数量'
  },
  status: {
    type: String,
    enum: ['success', 'failed', 'in_progress'],
    default: 'success',
    comment: '导入状态'
  },
  summary: {
    savedCount: {
      type: Number,
      default: 0,
      comment: '成功保存数量'
    },
    skippedCount: {
      type: Number,
      default: 0,
      comment: '跳过数量'
    },
    errorCount: {
      type: Number,
      default: 0,
      comment: '错误数量'
    }
  }
}, {
  timestamps: true,
  versionKey: false
});

// 创建索引
importRecordSchema.index({ type: 1 });
importRecordSchema.index({ lastImportTime: -1 });

const ImportRecord = mongoose.model('ImportRecord', importRecordSchema, 'import_records');

export default ImportRecord; 