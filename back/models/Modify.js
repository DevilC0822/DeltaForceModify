import mongoose from 'mongoose';

const modifySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    comment: '枪械名称'
  },
  version: {
    type: String,
    trim: true,
    comment: '版本排行'
  },
  price: {
    type: String,
    trim: true,
    comment: '改装价格'
  },
  description: {
    type: String,
    trim: true,
    comment: '改装说明'
  },
  code: {
    type: String,
    required: true,
    trim: true,
    comment: '枪械代码'
  },
  range: {
    type: String,
    trim: true,
    comment: '有效射程'
  },
  remark: {
    type: String,
    trim: true,
    comment: '备注'
  },
  updateTime: {
    type: String,
    trim: true,
    comment: '更新时间'
  },
  source: {
    type: String,
    required: true,
    default: '刀仔',
    comment: '来源'
  },
  type: {
    type: String,
    required: true,
    enum: ['烽火地带', '全面战场'],
    comment: '类型'
  },
  likeCount: {
    type: Number,
    default: 0,
    comment: '点赞数'
  },
}, {
  timestamps: true,
  versionKey: false
});

// 创建复合索引提升查询性能
modifySchema.index({ name: 1, type: 1, description: 1 }); // 唯一键索引
modifySchema.index({ name: 1 });
modifySchema.index({ type: 1 });
modifySchema.index({ code: 1 });
modifySchema.index({ likeCount: -1 }); // 点赞数索引（降序）
modifySchema.index({ likeCount: -1, type: 1 }); // 复合索引：点赞数 + 类型

const Modify = mongoose.model('Modify', modifySchema, 'modify');

export default Modify; 