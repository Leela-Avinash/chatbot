import Document from '../models/Document.js';

// Get documents for a chat
export const getDocuments = async (req, res, next) => {
  try {
    const { chatId } = req.query;
    
    const documents = await Document.find({
      chatId,
      userId: req.user.id,
    }).sort({ createdAt: -1 });
    
    res.json({ success: true, documents });
  } catch (error) {
    next(error);
  }
};

// Create document
export const createDocument = async (req, res, next) => {
  try {
    const { chatId, title, kind, content } = req.body;
    
    const document = new Document({
      chatId,
      userId: req.user.id,
      title,
      kind,
      content,
      versions: [{ content, createdAt: new Date() }],
    });
    
    await document.save();
    
    res.status(201).json({ success: true, document });
  } catch (error) {
    next(error);
  }
};

// Update document
export const updateDocument = async (req, res, next) => {
  try {
    const { content } = req.body;
    
    const document = await Document.findOne({
      _id: req.params.id,
      userId: req.user.id,
    });
    
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }
    
    // Add version
    document.versions.push({ content, createdAt: new Date() });
    document.content = content;
    
    await document.save();
    
    res.json({ success: true, document });
  } catch (error) {
    next(error);
  }
};

// Get single document
export const getDocument = async (req, res, next) => {
  try {
    const document = await Document.findOne({
      _id: req.params.id,
      userId: req.user.id,
    });
    
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }
    
    res.json({ success: true, document });
  } catch (error) {
    next(error);
  }
};

// Delete document
export const deleteDocument = async (req, res, next) => {
  try {
    const document = await Document.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.id,
    });
    
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }
    
    res.json({ success: true, message: 'Document deleted' });
  } catch (error) {
    next(error);
  }
};
