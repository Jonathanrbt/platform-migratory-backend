import express from 'express';
import multer from 'multer';
import * as documentController from '../controllers/documentController';
import { authMiddleware } from '../middleware/authMiddleware';
import { requireEditableStatus } from '../middleware/clientStatusMiddleware';
import { AppError } from '../utils/AppError';

const router = express.Router();
// Multer setup for memory storage (buffer)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 4 * 1024 * 1024, // 4MB limit
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(new AppError('Only .pdf files are allowed', 400) as any);
        }
    }
});

router.post('/', authMiddleware, requireEditableStatus, upload.single('file'), documentController.uploadDocument);
router.put('/:documentType', authMiddleware, requireEditableStatus, upload.single('file'), documentController.updateDocument);
router.delete('/:documentType', authMiddleware, requireEditableStatus, documentController.deleteDocument);
router.get('/', authMiddleware, documentController.getDocumentStatus);

export default router;
