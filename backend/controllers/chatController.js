import axios from 'axios';
import Chat from '../models/Chat.js';
import { MESSAGE_TYPES } from '../constants/messageTypes.js';

const LANGGRAPH_URL = process.env.LANGGRAPH_API_URL || 'http://localhost:8000';

export const getUserChats = async (req, res, next) => {
  try {
    const chats = await Chat.find({ userId: req.user.id })
      .sort({ updatedAt: -1 })
      .select('title createdAt updatedAt');
    
    res.json({ success: true, chats });
  } catch (error) {
    next(error);
  }
};

export const getChatById = async (req, res, next) => {
  try {
    const chat = await Chat.findOne({
      _id: req.params.id,
      userId: req.user.id,
    });
    
    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }
    
    res.json({ success: true, chat });
  } catch (error) {
    next(error);
  }
};

export const createChat = async (req, res, next) => {
  try {
    const { title } = req.body;
    
    const chat = new Chat({
      userId: req.user.id,
      title: title || 'New Chat',
      messages: [],
    });
    
    await chat.save();
    
    res.status(201).json({ success: true, chat });
  } catch (error) {
    next(error);
  }
};

export const streamMessage = async (req, res, next) => {
  try {
    const { message } = req.body;
    const chatId = req.params.id;
    
    const chat = await Chat.findOne({
      _id: chatId,
      userId: req.user.id,
    });
    
    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }
    
    const userMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: message,
      createdAt: new Date(),
    };
    
    chat.messages.push(userMessage);
    
    if (chat.messages.length === 1 && chat.title === 'New Chat') {
      const newTitle = message.length > 50 ? message.substring(0, 50) + '...' : message;
      chat.title = newTitle;
    }
    
    await chat.save();
    console.log('✓ User message saved to chat:', chatId);
    
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable proxy buffering
    res.flushHeaders();  // Flush headers immediately to establish connection
    
    let fullResponse = '';
    let toolCalls = [];
    let artifacts = [];
    let weatherData = null;
    let documentRefs = [];
    let currentDocumentContent = '';
    let currentDocumentMetadata = null;

    try {
      const langGraphResponse = await axios.post(
        `${LANGGRAPH_URL}/chat/stream`,
        {
          message,
          session_id: chatId,
          user_id: req.user.id,
        },
        {
          responseType: 'stream',
        }
      );
      
      console.log('✓ Connected to LangGraph stream');
      
      langGraphResponse.data.on('data', (chunk) => {
        const chunkStr = chunk.toString();
        
        res.write(chunkStr);
        res.flush && res.flush();
        
        const lines = chunkStr.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.substring(6));
              console.log('SSE data received:', data);
              if (data.token) {
                fullResponse += data.token;
              } else if (data.type === 'text_chunk' || data.content) {
                fullResponse += data.content || '';
              } else if (data.type === 'tool_call' || data.tool) {
                toolCalls.push(data.tool || data);
                console.log('Tool call received:', data.tool || data.name);
                
                if (data.tool === 'get_weather' && data.result) {
                  weatherData = data.result;
                  console.log('Weather data captured for DB:', weatherData.cityName);
                }
                
                if (data.tool === 'create_document') {
                  if (data.action === 'start') {
                    currentDocumentContent = '';
                    currentDocumentMetadata = {
                      title: data.title || 'Document',
                      type: data.type || 'text',
                    };
                    console.log('Document stream started:', currentDocumentMetadata);
                  } else if (data.action === 'stream' && data.chunk) {
                    // Accumulate document content as it streams
                    currentDocumentContent += data.chunk;
                  } else if (data.action === 'complete' && data.result) {
                    console.log('Document completion event received:', {
                      title: data.result.title,
                      kind: data.result.kind,
                      accumulatedContentLength: currentDocumentContent.length
                    });
                    
                    const docArtifact = {
                      type: data.result.kind || data.result.doc_type || 'text',
                      title: data.result.title || 'Document',
                      content: currentDocumentContent,  // Use accumulated content
                      kind: data.result.kind || data.result.doc_type,
                      createdAt: new Date(),
                    };
                    artifacts.push(docArtifact);
                    
                    // Store minimal reference for the message
                    documentRefs.push({
                      title: docArtifact.title,
                      type: docArtifact.type,
                      kind: docArtifact.kind,
                      createdAt: docArtifact.createdAt,
                      content: docArtifact.content,  // Now has the full accumulated content
                    });
                    
                    console.log('✓ Document artifact captured:', data.result.title, '- Content length:', currentDocumentContent.length, '- Refs count:', documentRefs.length);
                    
                    // Reset for next document
                    currentDocumentContent = '';
                    currentDocumentMetadata = null;
                  }
                }
              } else if (data.type === 'artifact' || data.artifact) {
                // Artifact event
                artifacts.push(data.artifact || data);
                console.log('Artifact received');
              }
            } catch (e) {
              // Ignore parse errors for non-JSON lines (heartbeats, connection messages)
              if (!line.includes('ping') && !line.includes('heartbeat') && !line.includes('connected') && line.trim() !== '') {
                console.warn('Failed to parse SSE data:', e.message, '| Line:', line.substring(0, 100));
              }
            }
          }
        }
      });
      
      langGraphResponse.data.on('end', async () => {
        console.log('Stream ended. Summary:', {
          responseLength: fullResponse.length,
          hasWeatherData: !!weatherData,
          documentRefsCount: documentRefs.length,
          toolCallsCount: toolCalls.length
        });
        
        // Only save assistant message if we have content
        if (fullResponse.trim().length > 0 || weatherData || documentRefs.length > 0) {
          try {
            // Determine message type based on what data we have
            let messageType = MESSAGE_TYPES.GENERAL;
            if (weatherData && documentRefs.length > 0) {
              messageType = MESSAGE_TYPES.COMBINED;  // Both weather and documents
            } else if (weatherData) {
              messageType = MESSAGE_TYPES.WEATHER;
            } else if (documentRefs.length > 0) {
              messageType = MESSAGE_TYPES.DOCUMENT;
            }
            
            console.log('Message type determined:', messageType, {
              hasWeatherData: !!weatherData,
              documentCount: documentRefs.length,
              contentLength: fullResponse.length
            });
            
            const assistantMessage = {
              id: (Date.now() + 1).toString(),
              role: 'assistant',
              type: messageType,
              content: fullResponse,
              createdAt: new Date(),
              metadata: {
                toolCalls,
                artifacts,
              },
            };
            
            // Add weather data if present
            if (weatherData) {
              assistantMessage.weatherData = {
                cityName: weatherData.cityName,
                country: weatherData.country,
                current: weatherData.current,
                current_units: weatherData.current_units,
                timezone: weatherData.timezone,
                daily: weatherData.daily,
                hourly: weatherData.hourly,
              };
            }
            
            // Add document references if present
            if (documentRefs.length > 0) {
              // Import Document model at the top of file if not already imported
              const Document = (await import('../models/Document.js')).default;
              
              const savedDocuments = [];
              for (const docRef of documentRefs) {
                try {
                  // Create document in Document collection
                  const document = new Document({
                    userId: req.user.id,
                    chatId: chatId,
                    title: docRef.title,
                    type: docRef.type,
                    content: docRef.content,
                  });
                  await document.save();
                  
                  // Store minimal reference in message
                  savedDocuments.push({
                    documentId: document._id,
                    title: document.title,
                    type: document.type,
                    kind: docRef.kind,
                    createdAt: document.createdAt,
                  });
                  
                  console.log('✓ Document saved to collection:', document._id);
                } catch (docError) {
                  console.error('Error saving document:', docError);
                }
              }
              
              assistantMessage.documents = savedDocuments;
              console.log('✓ Saved documents to message:', JSON.stringify(savedDocuments, null, 2));
            }
            
            // Log final message structure before saving
            console.log('Final message structure:', {
              id: assistantMessage.id,
              type: assistantMessage.type,
              hasContent: !!assistantMessage.content,
              hasWeatherData: !!assistantMessage.weatherData,
              documentsCount: assistantMessage.documents?.length || 0,
              documents: assistantMessage.documents
            });
            
            chat.messages.push(assistantMessage);
            await chat.save();
            console.log('✓ Assistant message saved to chat:', chatId, 'Type:', messageType);
            
            // Debug: Log the saved message
            if (messageType === 'document') {
              const savedMsg = chat.messages[chat.messages.length - 1];
              console.log('✓ Saved message with documents:', {
                id: savedMsg.id,
                type: savedMsg.type,
                documentsCount: savedMsg.documents?.length,
                documents: savedMsg.documents
              });
            }
          } catch (saveError) {
            console.error('Error saving assistant message:', saveError);
          }
        } else {
          console.warn('Stream ended with no content, not saving assistant message');
        }
        
        res.end();
      });
      
      langGraphResponse.data.on('error', (error) => {
        console.error('Stream error:', error);
        res.write(`data: ${JSON.stringify({ type: 'error', message: 'Stream error' })}\n\n`);
        res.end();
      });
      
    } catch (error) {
      console.error('Error setting up stream:', error);
      res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
      res.end();
    }
    
  } catch (error) {
    console.error('Error in stream message:', error);
    next(error);
  }
};

// Delete chat
export const deleteChat = async (req, res, next) => {
  try {
    const chat = await Chat.findOne({
      _id: req.params.id,
      userId: req.user.id,
    });
    
    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }
    
    // Delete all documents associated with this chat
    try {
      const Document = (await import('../models/Document.js')).default;
      const deleteResult = await Document.deleteMany({ 
        chatId: req.params.id,
        userId: req.user.id 
      });
      console.log(`✓ Deleted ${deleteResult.deletedCount} documents associated with chat ${req.params.id}`);
    } catch (docError) {
      console.error('Error deleting associated documents:', docError);
      // Continue with chat deletion even if document deletion fails
    }
    
    // Delete the chat
    await Chat.findByIdAndDelete(req.params.id);
    
    res.json({ success: true, message: 'Chat and associated documents deleted' });
  } catch (error) {
    next(error);
  }
};
