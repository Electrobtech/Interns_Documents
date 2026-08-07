const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { authenticate, requirePermission } = require('@lead/shared');
const { withTenantScope } = require('../middleware/tenant');
const { query } = require('../database');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../../uploads/assets');
    await fs.mkdir(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 300 * 1024 * 1024 }, // 300MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp|mp4|mov|avi|pdf|doc|docx|mp3|wav|zip/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  }
});

// Get all assets
router.get('/', authenticate, requirePermission('campaigns:read'), withTenantScope, async (req, res) => {
  try {
    const { type, tags, search, limit = 50, offset = 0 } = req.query;
    
    console.log('Fetching assets for organization:', req.organizationId, 'with filters:', { type, tags, search });
    
    let query_str = 'SELECT * FROM mh_assets WHERE organization_id = $1';
    const params = [req.organizationId];
    let paramCount = 1;
    
    if (type) {
      query_str += ` AND file_type = $${++paramCount}`;
      params.push(type);
    }
    
    if (tags) {
      query_str += ` AND tags && $${++paramCount}`;
      params.push(tags.split(','));
    }
    
    if (search) {
      query_str += ` AND name ILIKE $${++paramCount}`;
      params.push(`%${search}%`);
    }
    
    query_str += ` ORDER BY created_at DESC LIMIT $${++paramCount} OFFSET $${++paramCount}`;
    params.push(parseInt(limit), parseInt(offset));
    
    const result = await query(query_str, params);
    console.log('Found assets:', result.rows.length);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching assets:', error);
    res.status(500).json({ error: 'Failed to fetch assets' });
  }
});

// Upload new asset
router.post('/', authenticate, requirePermission('campaigns:write'), withTenantScope, upload.single('file'), async (req, res) => {
  try {
    console.log('Asset upload request received');
    if (!req.file) {
      console.error('No file in request');
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const { name, type, tags, metadata } = req.body;
    console.log('Upload details:', { name, type, tags, fileName: req.file.originalname, fileSize: req.file.size });
    
    // Use relative path instead of absolute path for better compatibility
    const relativePath = `uploads/assets/${req.file.filename}`;
    
    const asset = await query(
      `INSERT INTO mh_assets (organization_id, name, file_type, file_url, file_size, tags, metadata, uploaded_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [
        req.organizationId,
        name || req.file.originalname,
        type || getFileType(req.file.mimetype),
        relativePath,
        req.file.size,
        tags ? tags.split(',') : [],
        metadata ? JSON.parse(metadata) : {},
        req.user?.userId || null
      ]
    );
    
    console.log('Asset saved successfully:', asset.rows[0]);
    res.status(201).json(asset.rows[0]);
  } catch (error) {
    console.error('Error uploading asset:', error);
    res.status(500).json({ error: 'Failed to upload asset' });
  }
});

// Get asset by ID
router.get('/:id', authenticate, requirePermission('campaigns:read'), withTenantScope, async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM mh_assets WHERE id = $1 AND organization_id = $2',
      [req.params.id, req.organizationId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Asset not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching asset:', error);
    res.status(500).json({ error: 'Failed to fetch asset' });
  }
});

// Update asset
router.put('/:id', authenticate, requirePermission('campaigns:write'), withTenantScope, async (req, res) => {
  try {
    const { name, tags, metadata } = req.body;
    
    const result = await query(
      `UPDATE mh_assets 
       SET name = $1, tags = $2, metadata = $3, updated_at = now()
       WHERE id = $4 AND organization_id = $5
       RETURNING *`,
      [name, tags || [], metadata || {}, req.params.id, req.organizationId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Asset not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating asset:', error);
    res.status(500).json({ error: 'Failed to update asset' });
  }
});

// Delete asset
router.delete('/:id', authenticate, requirePermission('campaigns:write'), withTenantScope, async (req, res) => {
  try {
    const result = await query(
      'DELETE FROM mh_assets WHERE id = $1 AND organization_id = $2 RETURNING file_path',
      [req.params.id, req.organizationId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Asset not found' });
    }
    
    // Delete file from disk
    try {
      await fs.unlink(result.rows[0].file_path);
    } catch (fileError) {
      console.warn('Failed to delete file:', fileError);
    }
    
    res.json({ message: 'Asset deleted successfully' });
  } catch (error) {
    console.error('Error deleting asset:', error);
    res.status(500).json({ error: 'Failed to delete asset' });
  }
});

// Serve asset files
router.get('/:id/file', authenticate, requirePermission('campaigns:read'), withTenantScope, async (req, res) => {
  try {
    const result = await query(
      'SELECT file_path, mime_type, name FROM mh_assets WHERE id = $1 AND organization_id = $2',
      [req.params.id, req.organizationId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Asset not found' });
    }
    
    const { file_path, mime_type, name } = result.rows[0];
    
    // Handle both relative and absolute paths
    let absolutePath;
    if (path.isAbsolute(file_path)) {
      absolutePath = file_path;
    } else {
      absolutePath = path.join(__dirname, '../../../', file_path);
    }
    
    // Check if file exists
    try {
      await fs.access(absolutePath);
    } catch {
      return res.status(404).json({ error: 'File not found on disk' });
    }
    
    res.setHeader('Content-Type', mime_type);
    res.setHeader('Content-Disposition', `inline; filename="${name}"`);
    res.sendFile(path.resolve(absolutePath));
  } catch (error) {
    console.error('Error serving asset:', error);
    res.status(500).json({ error: 'Failed to serve asset' });
  }
});

// Get asset stats
router.get('/stats/overview', authenticate, requirePermission('campaigns:read'), withTenantScope, async (req, res) => {
  try {
    const result = await query(
      `SELECT 
         type,
         COUNT(*) as count,
         SUM(file_size) as total_size
       FROM mh_assets 
       WHERE organization_id = $1 
       GROUP BY type`,
      [req.organizationId]
    );
    
    const stats = {
      total: result.rows.reduce((sum, row) => sum + parseInt(row.count), 0),
      by_type: result.rows.reduce((acc, row) => {
        acc[row.type] = { count: parseInt(row.count), size: parseInt(row.total_size) };
        return acc;
      }, {}),
      total_size: result.rows.reduce((sum, row) => sum + parseInt(row.total_size), 0)
    };
    
    res.json(stats);
  } catch (error) {
    console.error('Error fetching asset stats:', error);
    res.status(500).json({ error: 'Failed to fetch asset stats' });
  }
});

function getFileType(mimetype) {
  if (mimetype.startsWith('image/')) return 'image';
  if (mimetype.startsWith('video/')) return 'video';
  if (mimetype.startsWith('audio/')) return 'audio';
  if (mimetype.includes('pdf') || mimetype.includes('document')) return 'document';
  return 'document';
}

module.exports = router;
