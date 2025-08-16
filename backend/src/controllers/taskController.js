/**
 * Task Controller - MongoDB Atlas Integration
 * Refactored to use Mongoose ODM with comprehensive error handling
 */

import Task from '../models/Task.js';
import { InMemoryTask } from '../db/memoryStore.js';
import { logger } from '../utils/logger.js';
import { APIError } from '../utils/errors.js';
import mongoose from 'mongoose';

// Check if MongoDB is available
const isMongoAvailable = () => {
  return mongoose.connection.readyState === 1;
};

// Get the appropriate model (MongoDB or in-memory)
const getTaskModel = () => {
  return isMongoAvailable() ? Task : InMemoryTask;
};

/**
 * Helper function to handle database errors
 */
const handleDBError = (res, error) => {
  logger.error('Database operation failed:', error);
  
  // Mongoose validation errors
  if (error.name === 'ValidationError') {
    const errors = Object.values(error.errors).map(err => err.message);
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors
    });
  }
  
  // MongoDB duplicate key error
  if (error.code === 11000) {
    return res.status(409).json({
      success: false,
      error: 'Duplicate entry',
      details: 'A task with similar content already exists'
    });
  }
  
  // MongoDB cast error (invalid ObjectId)
  if (error.name === 'CastError') {
    return res.status(400).json({
      success: false,
      error: 'Invalid ID format',
      details: 'The provided ID is not a valid MongoDB ObjectId'
    });
  }
  
  // Generic database error
  return res.status(500).json({
    success: false,
    error: 'Database operation failed',
    details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
  });
};

/**
 * Get all tasks with filtering, sorting, and pagination
 */
export const getAllTasks = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      completed,
      priority,
      category,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      includeOverdue = false
    } = req.query;

    // Build filter object
    const filter = {};
    
    if (completed !== undefined) {
      filter.completed = completed === 'true';
    }
    
    if (priority) {
      filter.priority = priority.toLowerCase();
    }
    
    if (category) {
      filter.category = new RegExp(category, 'i');
    }
    
    // Text search across multiple fields
    if (search) {
      filter.$text = { $search: search };
    }
    
    // Add overdue filter if requested
    if (includeOverdue === 'true') {
      filter.dueDate = { $lt: new Date() };
      filter.completed = false;
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;
    
    // If sorting by text search score, add it
    if (search) {
      sort.score = { $meta: 'textScore' };
    }

    // Execute query with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [tasks, totalCount] = await Promise.all([
      Task.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Task.countDocuments(filter)
    ]);

    // Calculate pagination metadata
    const totalPages = Math.ceil(totalCount / parseInt(limit));
    const hasNextPage = parseInt(page) < totalPages;
    const hasPrevPage = parseInt(page) > 1;

    res.status(200).json({
      success: true,
      message: `Retrieved ${tasks.length} tasks`,
      data: tasks,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalItems: totalCount,
        itemsPerPage: parseInt(limit),
        hasNextPage,
        hasPrevPage
      }
    });

  } catch (error) {
    handleDBError(res, error);
  }
};

/**
 * Get task by ID
 */
export const getTaskById = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid task ID format'
      });
    }

    const task = await Task.findById(id).lean();

    if (!task) {
      return res.status(404).json({
        success: false,
        error: 'Task not found',
        details: `No task found with ID: ${id}`
      });
    }

    res.status(200).json({
      success: true,
      message: 'Task retrieved successfully',
      data: task
    });

  } catch (error) {
    handleDBError(res, error);
  }
};

/**
 * Create new task
 */
export const createTask = async (req, res, next) => {
  try {
    const taskData = req.validatedData || req.body;
    
    // Create and save new task
    const task = new Task(taskData);
    const savedTask = await task.save();

    logger.info(`New task created: ${savedTask.text} (ID: ${savedTask._id})`);

    res.status(201).json({
      success: true,
      message: 'Task created successfully',
      data: savedTask
    });

  } catch (error) {
    handleDBError(res, error);
  }
};

/**
 * Update task (full update)
 */
export const updateTask = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = req.validatedData || req.body;
    
    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid task ID format'
      });
    }

    // Update with validation and return new document
    const updatedTask = await Task.findByIdAndUpdate(
      id,
      { 
        ...updateData,
        lastModified: new Date()
      },
      { 
        new: true, 
        runValidators: true,
        lean: true
      }
    );

    if (!updatedTask) {
      return res.status(404).json({
        success: false,
        error: 'Task not found',
        details: `No task found with ID: ${id}`
      });
    }

    logger.info(`Task updated: ${updatedTask.text} (ID: ${updatedTask._id})`);

    res.status(200).json({
      success: true,
      message: 'Task updated successfully',
      data: updatedTask
    });

  } catch (error) {
    handleDBError(res, error);
  }
};

/**
 * Delete task
 */
export const deleteTask = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid task ID format'
      });
    }

    const deletedTask = await Task.findByIdAndDelete(id);

    if (!deletedTask) {
      return res.status(404).json({
        success: false,
        error: 'Task not found',
        details: `No task found with ID: ${id}`
      });
    }

    logger.info(`Task deleted: ${deletedTask.text} (ID: ${deletedTask._id})`);

    res.status(204).end(); // No content response for successful deletion

  } catch (error) {
    handleDBError(res, error);
  }
};

/**
 * Get task statistics
 */
export const getTaskStatistics = async (req, res, next) => {
  try {
    const stats = await Task.getStatistics();
    
    // Additional statistics
    const [priorityStats, categoryStats, recentTasks] = await Promise.all([
      // Priority distribution
      Task.aggregate([
        {
          $group: {
            _id: '$priority',
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]),
      
      // Category distribution
      Task.aggregate([
        {
          $group: {
            _id: '$category',
            count: { $sum: 1 }
          }
        },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]),
      
      // Recent tasks (last 7 days)
      Task.countDocuments({
        createdAt: {
          $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        }
      })
    ]);

    res.status(200).json({
      success: true,
      message: 'Statistics retrieved successfully',
      data: {
        ...stats,
        priorityDistribution: priorityStats,
        categoryDistribution: categoryStats,
        recentTasksCount: recentTasks
      }
    });

  } catch (error) {
    handleDBError(res, error);
  }
};

/**
 * Search tasks with text search
 */
export const searchTasks = async (req, res, next) => {
  try {
    const { q, limit = 10, page = 1 } = req.query;
    
    if (!q || q.trim().length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Search query must be at least 2 characters long'
      });
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const results = await Task.find(
      { $text: { $search: q } },
      { score: { $meta: 'textScore' } }
    )
    .sort({ score: { $meta: 'textScore' } })
    .skip(skip)
    .limit(parseInt(limit))
    .lean();

    res.status(200).json({
      success: true,
      message: `Found ${results.length} tasks matching '${q}'`,
      data: results
    });

  } catch (error) {
    handleDBError(res, error);
  }
};

/**
 * Get overdue tasks
 */
export const getOverdueTasks = async (req, res, next) => {
  try {
    const overdueTasks = await Task.findOverdue();
    
    res.status(200).json({
      success: true,
      message: `Found ${overdueTasks.length} overdue tasks`,
      data: overdueTasks
    });

  } catch (error) {
    handleDBError(res, error);
  }
};

/**
 * Bulk operations for tasks
 */
export const bulkUpdateTasks = async (req, res, next) => {
  try {
    const { taskIds, updateData } = req.body;
    
    if (!taskIds || !Array.isArray(taskIds) || taskIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'taskIds array is required'
      });
    }
    
    // Validate all IDs
    const invalidIds = taskIds.filter(id => !mongoose.Types.ObjectId.isValid(id));
    if (invalidIds.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid task IDs',
        details: `Invalid IDs: ${invalidIds.join(', ')}`
      });
    }

    const result = await Task.updateMany(
      { _id: { $in: taskIds } },
      { 
        ...updateData,
        lastModified: new Date()
      },
      { runValidators: true }
    );

    logger.info(`Bulk update: ${result.modifiedCount} tasks updated`);

    res.status(200).json({
      success: true,
      message: `Successfully updated ${result.modifiedCount} tasks`,
      data: {
        matchedCount: result.matchedCount,
        modifiedCount: result.modifiedCount
      }
    });

  } catch (error) {
    handleDBError(res, error);
  }
};
