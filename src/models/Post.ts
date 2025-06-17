// ไฟล์: travel-journal-backend/src/models/Post.ts

import { Schema, model, Document, CallbackWithoutResultAndOptionalError } from 'mongoose'; // <<< เพิ่ม CallbackWithoutResultAndOptionalError

export interface IPost extends Document {
  title: string;
  content: string;
  imageUrl?: string;
  location?: string;
  tags?: string[];
  createdAt: Date;
  updatedAt: Date;
}

const PostSchema = new Schema<IPost>({
  title: { type: String, required: true },
  content: { type: String, required: true },
  imageUrl: { type: String },
  location: { type: String },
  tags: [{ type: String }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// แก้ไขตรงนี้: ระบุ Type ให้ next และ this
PostSchema.pre('save', function(next: CallbackWithoutResultAndOptionalError) {
  this.updatedAt = new Date();
  next();
});

const Post = model<IPost>('Post', PostSchema);

export default Post;