const { GoogleGenerativeAI } = require('@google/generative-ai');
const Book = require('../models/Book');
const mongoose = require('mongoose');

class AIBookSearchService {
  constructor() {
    this.genAI = null;
    this.model = null;
    this.initializeAI();
  }

  initializeAI() {
    try {
      const apiKey = process.env.GOOGLE_AI_API_KEY;
      if (!apiKey) {
        console.warn('Google AI API key not found. AI search will fall back to text-based search.');
        return;
      }
      
      this.genAI = new GoogleGenerativeAI(apiKey);
      this.model = this.genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      console.log('AI Book Search Service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize AI service:', error);
    }
  }

  async generateSearchKeywords(query) {
    if (!this.model) {
      return this.fallbackKeywordExtraction(query);
    }

    try {
      const prompt = `
        Analyze this book search query and extract relevant search keywords and metadata:
        Query: "${query}"
        
        Extract and return ONLY a JSON object with these fields:
        {
          "keywords": ["array", "of", "relevant", "search", "terms"],
          "genre": "detected genre if any",
          "themes": ["array", "of", "themes"],
          "searchTerms": ["title", "author", "isbn", "related", "terms"],
          "categories": ["fiction", "non-fiction", "academic", "etc"],
          "ageGroup": "children/young-adult/adult if detectable",
          "synonyms": ["alternative", "terms", "for", "the", "query"]
        }
        
        Important: For programming/coding queries, include comprehensive synonyms:
        - "coding" should include: ["programming", "development", "software", "computer science"]
        - "basics" should include: ["introduction", "fundamentals", "beginner", "basic", "primer"]
        - "learn" should include: ["tutorial", "guide", "course", "study"]
        
        Focus on book-related terms, synonyms, and related concepts.
        Return only valid JSON, no explanations.
      `;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      try {
        // Clean the AI response by removing markdown code blocks if present
        let cleanedText = text.trim();
        
        // Remove markdown code blocks (```json ... ```)
        if (cleanedText.startsWith('```')) {
          // Find the first newline after ```
          const firstNewline = cleanedText.indexOf('\n');
          if (firstNewline !== -1) {
            cleanedText = cleanedText.substring(firstNewline + 1);
          }
          
          // Remove the ending ```
          const lastTripleBacktick = cleanedText.lastIndexOf('```');
          if (lastTripleBacktick !== -1) {
            cleanedText = cleanedText.substring(0, lastTripleBacktick);
          }
        }
        
        cleanedText = cleanedText.trim();
        
        const aiKeywords = JSON.parse(cleanedText);
        return aiKeywords;
      } catch (parseError) {
        console.error('AI response parsing failed:', parseError);
        console.error('Raw AI response:', text);
        return this.fallbackKeywordExtraction(query);
      }
    } catch (error) {
      console.error('AI keyword generation failed:', error);
      return this.fallbackKeywordExtraction(query);
    }
  }

  fallbackKeywordExtraction(query) {
    const words = query.toLowerCase()
      .split(/[\s,.-]+/)
      .filter(word => word.length > 2)
      .map(word => word.trim());
    
    // Enhanced programming/coding related synonyms
    const programmingTerms = {
      'coding': ['programming', 'development', 'software', 'computer science', 'code'],
      'programming': ['coding', 'development', 'software', 'computer science'],
      'basics': ['introduction', 'fundamentals', 'beginner', 'basic', 'primer', 'intro'],
      'basic': ['introduction', 'fundamentals', 'beginner', 'basics', 'primer', 'intro'],
      'learn': ['tutorial', 'guide', 'course', 'study', 'learning', 'education'],
      'learning': ['tutorial', 'guide', 'course', 'study', 'learn', 'education'],
      'development': ['programming', 'coding', 'software', 'developer'],
      'computer': ['computing', 'technology', 'tech', 'digital'],
      'science': ['scientific', 'academic', 'study']
    };
    
    let expandedTerms = [...words];
    
    // Add synonyms for each word
    words.forEach(word => {
      if (programmingTerms[word]) {
        expandedTerms.push(...programmingTerms[word]);
      }
    });
    
    // Remove duplicates
    expandedTerms = [...new Set(expandedTerms)];

    return {
      keywords: expandedTerms,
      searchTerms: expandedTerms,
      synonyms: expandedTerms.filter(term => !words.includes(term)),
      themes: words.filter(word => ['programming', 'coding', 'science', 'math', 'history'].includes(word)),
      categories: this.detectCategory(query),
      genre: this.detectGenre(query),
      ageGroup: ''
    };
  }

  detectCategory(query) {
    const categories = {
      'programming': ['programming', 'coding', 'software', 'computer', 'javascript', 'python', 'web development'],
      'science': ['science', 'physics', 'chemistry', 'biology', 'scientific'],
      'mathematics': ['math', 'mathematics', 'algebra', 'geometry', 'calculus'],
      'literature': ['literature', 'novel', 'poetry', 'story', 'fiction'],
      'history': ['history', 'historical', 'past', 'ancient', 'modern'],
      'technology': ['technology', 'tech', 'digital', 'electronic', 'internet']
    };

    for (const [category, keywords] of Object.entries(categories)) {
      if (keywords.some(keyword => query.toLowerCase().includes(keyword))) {
        return category;
      }
    }
    return 'general';
  }

  detectGenre(query) {
    const genres = {
      'Technical': ['programming', 'coding', 'software', 'computer', 'technology'],
      'Educational': ['learn', 'study', 'education', 'tutorial', 'guide'],
      'Science': ['science', 'physics', 'chemistry', 'biology'],
      'Fiction': ['story', 'novel', 'fiction', 'adventure'],
      'Non-Fiction': ['history', 'biography', 'facts', 'real']
    };

    for (const [genre, keywords] of Object.entries(genres)) {
      if (keywords.some(keyword => query.toLowerCase().includes(keyword))) {
        return genre;
      }
    }
    return 'General';
  }

  async intelligentBookSearch(query, schoolId, limit = 10) {
    try {
      // Step 1: Generate AI-enhanced keywords
      const aiKeywords = await this.generateSearchKeywords(query);
      
      // Step 2: Build search aggregation pipeline
      const searchPipeline = this.buildSearchPipeline(query, aiKeywords, schoolId, limit);
      
      // Step 3: Execute search
      const books = await Book.aggregate(searchPipeline);
      
      // Step 4: Enhance results with relevance scoring
      const enhancedBooks = this.enhanceSearchResults(books, query, aiKeywords);
      
      return {
        books: enhancedBooks,
        totalFound: books.length,
        searchMetadata: {
          originalQuery: query,
          aiKeywords: aiKeywords,
          searchStrategy: this.model ? 'ai-enhanced' : 'text-based'
        }
      };
    } catch (error) {
      console.error('Intelligent book search failed:', error);
      throw error;
    }
  }

  buildSearchPipeline(originalQuery, aiKeywords, schoolId, limit) {
    // Combine all search terms including synonyms
    const searchTerms = [
      ...aiKeywords.keywords,
      ...aiKeywords.searchTerms,
      ...aiKeywords.themes,
      ...(aiKeywords.synonyms || []),
      originalQuery
    ].filter(Boolean);

    return [
      // Match books from the school that are active
      {
        $match: {
          school: new mongoose.Types.ObjectId(schoolId),
          isActive: true
        }
      },
      
      // Add search score field with enhanced matching
      {
        $addFields: {
          searchScore: {
            $add: [
              // Title relevance (highest weight) - exact and partial matches
              {
                $multiply: [
                  {
                    $add: [
                      // Exact phrase match in title
                      {
                        $cond: [
                          {
                            $regexMatch: {
                              input: { $toLower: "$title" },
                              regex: originalQuery.toLowerCase(),
                              options: "i"
                            }
                          },
                          15,
                          0
                        ]
                      },
                      // Individual term matches in title
                      {
                        $size: {
                          $filter: {
                            input: searchTerms,
                            cond: {
                              $regexMatch: {
                                input: { $toLower: "$title" },
                                regex: { $toLower: "$$this" },
                                options: "i"
                              }
                            }
                          }
                        }
                      }
                    ]
                  },
                  10
                ]
              },
              
              // Author relevance
              {
                $multiply: [
                  {
                    $size: {
                      $filter: {
                        input: searchTerms,
                        cond: {
                          $regexMatch: {
                            input: { $toLower: "$author" },
                            regex: { $toLower: "$$this" },
                            options: "i"
                          }
                        }
                      }
                    }
                  },
                  8
                ]
              },
              
              // Description relevance
              {
                $multiply: [
                  {
                    $size: {
                      $filter: {
                        input: searchTerms,
                        cond: {
                          $regexMatch: {
                            input: { $toLower: "$description" },
                            regex: { $toLower: "$$this" },
                            options: "i"
                          }
                        }
                      }
                    }
                  },
                  5
                ]
              },
              
              // Category/Genre relevance
              {
                $multiply: [
                  {
                    $size: {
                      $filter: {
                        input: searchTerms,
                        cond: {
                          $or: [
                            {
                              $regexMatch: {
                                input: { $toLower: "$category" },
                                regex: { $toLower: "$$this" },
                                options: "i"
                              }
                            },
                            {
                              $regexMatch: {
                                input: { $toLower: "$genre" },
                                regex: { $toLower: "$$this" },
                                options: "i"
                              }
                            }
                          ]
                        }
                      }
                    }
                  },
                  6
                ]
              },
              
              // MetaTags and Keywords relevance
              {
                $multiply: [
                  {
                    $size: {
                      $filter: {
                        input: { $concatArrays: [{ $ifNull: ["$metaTags", []] }, { $ifNull: ["$keywords", []] }] },
                        cond: {
                          $in: [{ $toLower: "$$this" }, searchTerms.map(term => term.toLowerCase())]
                        }
                      }
                    }
                  },
                  7
                ]
              },
              
              // Subjects relevance
              {
                $multiply: [
                  {
                    $size: {
                      $filter: {
                        input: { $ifNull: ["$subjects", []] },
                        cond: {
                          $in: [{ $toLower: "$$this" }, searchTerms.map(term => term.toLowerCase())]
                        }
                      }
                    }
                  },
                  5
                ]
              },
              
              // ISBN exact match (very high score)
              {
                $cond: [
                  {
                    $regexMatch: {
                      input: { $ifNull: ["$isbn", ""] },
                      regex: originalQuery.replace(/[^0-9X-]/g, ''),
                      options: "i"
                    }
                  },
                  50,
                  0
                ]
              }
            ]
          },
          
          // Add availability boost
          availabilityBoost: {
            $cond: ["$isAvailable", 2, 0]
          }
        }
      },
      
      // Filter books with some relevance
      {
        $match: {
          searchScore: { $gt: 0 }
        }
      },
      
      // Final score calculation
      {
        $addFields: {
          finalScore: { $add: ["$searchScore", "$availabilityBoost"] }
        }
      },
      
      // Sort by relevance
      {
        $sort: {
          finalScore: -1,
          isAvailable: -1,
          title: 1
        }
      },
      
      // Limit results
      {
        $limit: limit
      },
      
      // Project final fields
      {
        $project: {
          title: 1,
          author: 1,
          category: 1,
          genre: 1,
          isbn: 1,
          publisher: 1,
          publicationYear: 1,
          description: 1,
          coverImage: 1,
          locationTag: 1,
          metaTags: 1,
          keywords: 1,
          subjects: 1,
          ageGroup: 1,
          language: 1,
          isAvailable: 1,
          locationFields: 1,
          searchScore: 1,
          finalScore: 1,
          relevancePercentage: {
            $multiply: [
              { $divide: ["$finalScore", { $max: "$finalScore" }] },
              100
            ]
          }
        }
      }
    ];
  }

  enhanceSearchResults(books, originalQuery, aiKeywords) {
    return books.map((book, index) => ({
      ...book,
      searchRank: index + 1,
      matchedKeywords: this.findMatchedKeywords(book, [...aiKeywords.keywords, ...aiKeywords.searchTerms]),
      matchHighlights: this.generateMatchHighlights(book, originalQuery)
    }));
  }

  findMatchedKeywords(book, keywords) {
    const bookText = [
      book.title,
      book.author,
      book.description,
      book.category,
      book.genre,
      ...(book.metaTags || []),
      ...(book.keywords || []),
      ...(book.subjects || [])
    ].join(' ').toLowerCase();

    return keywords.filter(keyword => 
      bookText.includes(keyword.toLowerCase())
    );
  }

  generateMatchHighlights(book, query) {
    const highlights = {};
    const queryLower = query.toLowerCase();
    
    ['title', 'author', 'description'].forEach(field => {
      if (book[field] && book[field].toLowerCase().includes(queryLower)) {
        highlights[field] = book[field];
      }
    });
    
    return highlights;
  }
}

module.exports = new AIBookSearchService();
