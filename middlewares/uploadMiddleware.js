import multer from "multer";
import fs from "fs";
import path from "path";

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(process.cwd(), 'uploads');

        // Check if uploads/ exists; create it if not
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true }); // Ensures all parent dirs too
        }

        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

export const uploadMiddleware = multer({
    storage,
    fileFilter: (req, file, cb) => {
        if (file.fieldname === 'pollImage' || file.fieldname.startsWith('questionImage_') || file.fieldname.startsWith('optionImage_')) {
            if (file.mimetype.startsWith('image/')) {
                cb(null, true);
            } else {
                cb(new Error('Only image files are allowed'), false);
            }
        } else if (file.fieldname === 'pollstersCsv') {
            if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
                cb(null, true);
            } else {
                cb(new Error('Only CSV files are allowed'), false);
            }
        } else {
            cb(new Error(`Unexpected field: ${file.fieldname}`), false);
        }
    },
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB
    }
});
