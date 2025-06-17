import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Post, { IPost } from './models/Post';
import cors from 'cors';

// เพิ่มการนำเข้าสำหรับ Cloudinary และ Multer
import { v2 as cloudinary } from 'cloudinary';
import multer from 'multer';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || '';

// ----------------------------------------------------
// ตั้งค่า Cloudinary
// ----------------------------------------------------
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ----------------------------------------------------
// ตั้งค่า Multer สำหรับการอัปโหลดไฟล์ (เก็บในหน่วยความจำชั่วคราว)
// ----------------------------------------------------
const storage = multer.memoryStorage(); // เก็บไฟล์ใน memory ก่อนส่งไป Cloudinary
const upload = multer({ storage: storage });

// Middleware
app.use(express.json());
app.use(cors({
  origin: [
    'http://localhost:5173', // สำหรับ Local Development
    'https://spc-travel-journal-frontend-7le5tey4h-spacers-projects-ce95e77e.vercel.app', 
  ], // ตรวจสอบพอร์ต Frontend ของคุณ
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// ----------------------------------------------------
// เชื่อมต่อ MongoDB
// ----------------------------------------------------
if (!MONGODB_URI) {
  console.error('MONGODB_URI is not defined in .env file.');
  process.exit(1);
}

mongoose.connect(MONGODB_URI)
  .then(() => console.log('MongoDB connected successfully'))
  .catch(err => console.error('MongoDB connection error:', err));

// ----------------------------------------------------
// API Routes สำหรับ Post (ปรับปรุง POST route เพื่อรองรับการอัปโหลดไฟล์)
// ----------------------------------------------------

// 1. GET /api/posts - ดึงโพสต์ทั้งหมด (รองรับการค้นหา)
app.get('/api/posts', async (req: Request, res: Response) => {
  try {
    const { search } = req.query; // ดึงค่า search จาก query parameter

    let query: any = {}; // Object สำหรับเงื่อนไขการค้นหาใน MongoDB

    if (search) {
      // ถ้ามีคำค้นหา (search term)
      const searchTerm = (search as string).trim(); // ลบช่องว่างหัวท้าย
      const searchRegex = new RegExp(searchTerm, 'i'); // สร้าง Regular Expression (i = case-insensitive)

      // สร้างเงื่อนไขการค้นหาแบบ OR ในหลายๆ field
      query.$or = [
        { title: { $regex: searchRegex } },
        { content: { $regex: searchRegex } },
        { location: { $regex: searchRegex } },
        { tags: { $regex: searchRegex } }, // ค้นหาใน array ของ tags ด้วย
      ];
    }

    // ดึงโพสต์ทั้งหมดตามเงื่อนไข query และเรียงจากใหม่ไปเก่า
    const posts = await Post.find(query).sort({ createdAt: -1 });
    res.status(200).json(posts);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// 2. GET /api/posts/:id - ดึงโพสต์ตาม ID (ไม่เปลี่ยนแปลง)
app.get('/api/posts/:id', async (req: Request, res: Response) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }
    res.status(200).json(post);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// 3. POST /api/posts - สร้างโพสต์ใหม่ (ปรับปรุงให้รองรับไฟล์อัปโหลด)
app.post('/api/posts', upload.single('image'), async (req: Request, res: Response) => {
  // 'image' คือชื่อ field ของ input type="file" ใน Frontend
  const { title, content, location, tags } = req.body;
  let imageUrl: string | undefined;

  if (!title || !content) {
    return res.status(400).json({ message: 'Title and content are required' });
  }

  try {
    if (req.file) { // ตรวจสอบว่ามีไฟล์รูปภาพถูกอัปโหลดมาหรือไม่
      // อัปโหลดรูปภาพไป Cloudinary
      const result = await cloudinary.uploader.upload(`data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`, {
            folder: 'travel-journal-app', // ชื่อโฟลเดอร์ใน Cloudinary
          });
      imageUrl = result.secure_url; // ได้ URL ของรูปภาพจาก Cloudinary
    }

    const newPost = new Post({
      title,
      content,
      imageUrl, // ใช้ imageUrl ที่ได้จากการอัปโหลด หรือ undefined ถ้าไม่มี
      location,
      tags: tags ? (Array.isArray(tags) ? tags : [tags]) : [],
    });

    const savedPost = await newPost.save();
    res.status(201).json(savedPost);
  } catch (error: any) {
    console.error('Error creating post or uploading image:', error);
    res.status(400).json({ message: `Failed to create post: ${error.message}` });
  }
});


// 4. PUT /api/posts/:id - อัปเดตโพสต์ (ปรับปรุงให้รองรับไฟล์อัปโหลด)
app.put('/api/posts/:id', upload.single('image'), async (req: Request, res: Response) => {
  const { title, content, location, tags } = req.body;
  let imageUrl: string | undefined; // อาจจะมีการอัปเดตรูปภาพใหม่

  try {
    const existingPost = await Post.findById(req.params.id);
    if (!existingPost) {
      return res.status(404).json({ message: 'Post not found' });
    }

    if (req.file) {
      // อัปโหลดรูปภาพใหม่ไป Cloudinary
      const result = await cloudinary.uploader.upload(`data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`, {
            folder: 'travel-journal-app',
          });
      imageUrl = result.secure_url;

      // (Optional) ลบรูปภาพเก่าจาก Cloudinary ถ้าต้องการ
      // if (existingPost.imageUrl) {
      //   const publicId = existingPost.imageUrl.split('/').pop()?.split('.')[0];
      //   if (publicId) {
      //     await cloudinary.uploader.destroy(`travel-journal-app/${publicId}`);
      //   }
      // }
    } else {
      // ถ้าไม่มีไฟล์อัปโหลดใหม่ ให้ใช้ URL เดิมที่ส่งมาใน body หรือ URL เดิมจากฐานข้อมูล
      imageUrl = req.body.imageUrl || existingPost.imageUrl;
    }

    const updatedPost = await Post.findByIdAndUpdate(
      req.params.id,
      { title, content, imageUrl, location, tags, updatedAt: new Date() },
      { new: true }
    );

    res.status(200).json(updatedPost);
  } catch (error: any) {
    console.error('Error updating post or uploading image:', error);
    res.status(400).json({ message: `Failed to update post: ${error.message}` });
  }
});

// 5. DELETE /api/posts/:id - ลบโพสต์ (ไม่เปลี่ยนแปลง)
app.delete('/api/posts/:id', async (req: Request, res: Response) => {
  try {
    const deletedPost = await Post.findByIdAndDelete(req.params.id);
    if (!deletedPost) {
      return res.status(404).json({ message: 'Post not found' });
    }
    // (Optional) ลบรูปภาพที่เกี่ยวข้องจาก Cloudinary เมื่อโพสต์ถูกลบ
    // if (deletedPost.imageUrl) {
    //   const publicId = deletedPost.imageUrl.split('/').pop()?.split('.')[0];
    //   if (publicId) {
    //     await cloudinary.uploader.destroy(`travel-journal-app/${publicId}`);
    //   }
    // }
    res.status(200).json({ message: 'Post deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// 6. GET /api/tags - ดึง Tags ที่ไม่ซ้ำกันทั้งหมด (สำหรับ Auto-complete)
app.get('/api/tags', async (req: Request, res: Response) => {
  try {
    // ใช้ MongoDB aggregation framework เพื่อดึง tags ที่ไม่ซ้ำกันทั้งหมดจากทุกโพสต์
    // และจัดรูปแบบให้เป็น array ของ string
    const tags = await Post.aggregate([
      { $unwind: '$tags' }, // แยกแต่ละ tag ออกมาเป็น document แยกกัน
      { $group: { _id: '$tags' } }, // จัดกลุ่มตาม tag เพื่อให้ได้ tag ที่ไม่ซ้ำกัน
      { $project: { _id: 0, tag: '$_id' } }, // เลือกเฉพาะ field 'tag'
      { $sort: { tag: 1 } } // เรียงตามตัวอักษร
    ]);

    // แปลงผลลัพธ์ให้อยู่ในรูปแบบ Array ของ string (['tag1', 'tag2', ...])
    const uniqueTags = tags.map(item => item.tag);
    res.status(200).json(uniqueTags);
  } catch (error: any) {
    console.error('Error fetching unique tags:', error);
    res.status(500).json({ message: error.message });
  }
});

// ----------------------------------------------------
// เริ่มต้น Server
// ----------------------------------------------------
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Access it via http://localhost:${PORT}`);
});