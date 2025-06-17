import { Schema, model, Document } from 'mongoose';

// กำหนด Type ของ Document สำหรับโพสต์
export interface IPost extends Document {
  title: string;
  content: string;
  imageUrl?: string; // URL ของรูปภาพ (อาจจะมีหรือไม่มีก็ได้)
  location?: string; // สถานที่ (เป็นทางเลือก)
  tags?: string[]; // หมวดหมู่/แท็ก (เป็นทางเลือก)
  createdAt: Date;
  updatedAt: Date;
}

// กำหนด Schema สำหรับ Post
const PostSchema = new Schema<IPost>({
  title: { type: String, required: true },
  content: { type: String, required: true },
  imageUrl: { type: String },
  location: { type: String },
  tags: [{ type: String }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// อัปเดต updatedAt ทุกครั้งที่มีการบันทึก
PostSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// สร้างและ export Model
const Post = model<IPost>('Post', PostSchema);

export default Post;