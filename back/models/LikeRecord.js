import mongoose from 'mongoose';

const likeRecordSchema = new mongoose.Schema({
  weaponId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Modify',
    required: true,
    comment: '武器ID'
  },
  ipAddress: {
    type: String,
    required: true,
    trim: true,
    comment: '点赞用户的IP地址'
  },
  userAgent: {
    type: String,
    trim: true,
    comment: '用户浏览器标识（辅助防重复）'
  },
}, {
  timestamps: true,
  versionKey: false
});

// 创建复合唯一索引，确保同一IP对同一武器只能点赞一次
likeRecordSchema.index({ weaponId: 1, ipAddress: 1 }, { unique: true });

// 创建单独索引提升查询性能
likeRecordSchema.index({ weaponId: 1 });
likeRecordSchema.index({ ipAddress: 1 });
likeRecordSchema.index({ createdAt: -1 });

const LikeRecord = mongoose.model('LikeRecord', likeRecordSchema, 'likeRecords');

export default LikeRecord; 