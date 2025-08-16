/**
 * Simplified Task Controller 
 * Works with both MongoDB and in-memory storage for development
 */

import { InMemoryTask } from '../db/memoryStore.js';
import { logger } from '../utils/logger.js';
import mongoose from 'mongoose';

// Check if MongoDB is available
const isMongoAvailable = () => {
  return mongoose.connection.readyState === 1;
};

// Get the appropriate model (MongoDB or in-memory)
const getTaskModel = () => {
  if (isMongoAvailable()) {
    // Dynamically import Task model when MongoDB is available
    return import('../models/Task.js').then(module => module.default);
  }
  return Promise.resolve(InMemoryTask);
};

/**
 * Helper function to handle errors
 */
const handleError = (res, error) => {
  logger.error('Operation failed:', error);
  
  return res.status(500).json({
    success: false,
    error: 'Operation failed',
    details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
  });
};

/**
 * Get all tasks with basic filtering
 */
export const getAllTasks = async (req, res) => {
  try {
    const {
      completed,
      priority,
      search,
      limit = 50,
      page = 1
    } = req.query;

    const TaskModel = await getTaskModel();
    
    // Build filter object
    const filter = {};
    
    if (completed !== undefined) {
      filter.completed = completed === 'true';
    }
    
    if (priority) {
      filter.priority = priority.toLowerCase();
    }
    
    // Text search
    if (search) {
      if (isMongoAvailable()) {
        filter.$text = { $search: search };
      } else {
        // For in-memory search, we'll filter after getting results
      }
    }

    // Get tasks
    let tasks = await TaskModel.find(filter);
    
    // Apply search filter for in-memory storage
    if (search && !isMongoAvailable()) {
      const searchTerm = search.toLowerCase();
      tasks = tasks.filter(task => 
        task.text.toLowerCase().includes(searchTerm) ||
        (task.category && task.category.toLowerCase().includes(searchTerm))
      );
    }

    // Apply pagination for in-memory storage
    if (!isMongoAvailable()) {
      const skip = (parseInt(page) - 1) * parseInt(limit);
      tasks = tasks.slice(skip, skip + parseInt(limit));
    }

    const totalCount = tasks.length;

    res.status(200).json({
      success: true,
      message: `Retrieved ${tasks.length} tasks`,
      data: tasks,
      storage: isMongoAvailable() ? 'mongodb' : 'memory',
      pagination: {
        currentPage: parseInt(page),
        itemsPerPage: parseInt(limit),
        totalItems: totalCount
      }
    });

  } catch (error) {
    handleError(res, error);
  }
};

/**
 * Get task by ID
 */
export const getTaskById = async (req, res) => {
  try {
    const { id } = req.params;
    const TaskModel = await getTaskModel();
    
    const task = await TaskModel.findById(id);

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
      data: task,
      storage: isMongoAvailable() ? 'mongodb' : 'memory'
    });

  } catch (error) {
    handleError(res, error);
  }
};

/**
 * Create new task
 */
export const createTask = async (req, res) => {
  try {
    const taskData = req.body;
    const TaskModel = await getTaskModel();
    
    // Validate required fields
    if (!taskData.text || taskData.text.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Task text is required',
        details: 'Please provide task text'
      });
    }

    // Create task
    const savedTask = await TaskModel.create({
      text: taskData.text.trim(),
      completed: taskData.completed || false,
      priority: taskData.priority || 'medium',
      category: taskData.category || 'general',
      tags: taskData.tags || [],
      dueDate: taskData.dueDate || null
    });

    logger.info(`New task created: ${savedTask.text} (ID: ${savedTask._id || savedTask.id})`);

    res.status(201).json({
      success: true,
      message: 'Task created successfully',
      data: savedTask,
      storage: isMongoAvailable() ? 'mongodb' : 'memory'
    });

  } catch (error) {
    handleError(res, error);
  }
};

/**
 * Update task
 */
export const updateTask = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    const TaskModel = await getTaskModel();
    
    // Update task
    const updatedTask = await TaskModel.findByIdAndUpdate(
      id,
      { 
        ...updateData,
        updatedAt: new Date()
      },
      { new: true }
    );

    if (!updatedTask) {
      return res.status(404).json({
        success: false,
        error: 'Task not found',
        details: `No task found with ID: ${id}`
      });
    }

    logger.info(`Task updated: ${updatedTask.text} (ID: ${updatedTask._id || updatedTask.id})`);

    res.status(200).json({
      success: true,
      message: 'Task updated successfully',
      data: updatedTask,
      storage: isMongoAvailable() ? 'mongodb' : 'memory'
    });

  } catch (error) {
    handleError(res, error);
  }
};

/**
 * Delete task
 */
export const deleteTask = async (req, res) => {
  try {
    const { id } = req.params;
    const TaskModel = await getTaskModel();
    
    const deletedTask = await TaskModel.findByIdAndDelete(id);

    if (!deletedTask) {
      return res.status(404).json({
        success: false,
        error: 'Task not found',
        details: `No task found with ID: ${id}`
      });
    }

    logger.info(`Task deleted: ${deletedTask.text} (ID: ${deletedTask._id || deletedTask.id})`);

    res.status(200).json({
      success: true,
      message: 'Task deleted successfully',
      storage: isMongoAvailable() ? 'mongodb' : 'memory'
    });

  } catch (error) {
    handleError(res, error);
  }
};

/**
 * Get task statistics
 */
export const getTaskStatistics = async (req, res) => {
  try {
    const TaskModel = await getTaskModel();
    
    if (isMongoAvailable()) {
      // Use MongoDB aggregation if available
      const stats = await TaskModel.aggregate([
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            completed: { 
              $sum: { $cond: [{ $eq: ['$completed', true] }, 1, 0] } 
            },
            active: { 
              $sum: { $cond: [{ $eq: ['$completed', false] }, 1, 0] } 
            }
          }
        }
      ]);
      
      const result = stats[0] || { total: 0, completed: 0, active: 0 };
      
      res.status(200).json({
        success: true,
        message: 'Statistics retrieved successfully',
        data: result,
        storage: 'mongodb'
      });
    } else {
      // Use in-memory calculation
      const stats = await TaskModel.aggregate();
      
      res.status(200).json({
        success: true,
        message: 'Statistics retrieved successfully',
        data: stats[0],
        storage: 'memory'
      });
    }

  } catch (error) {
    handleError(res, error);
  }
};

/**
 * Search tasks
 */
export const searchTasks = async (req, res) => {
  try {
    const { q, limit = 10 } = req.query;
    
    if (!q || q.trim().length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Search query must be at least 2 characters long'
      });
    }

    // Use the getAllTasks function with search parameter
    req.query.search = q;
    req.query.limit = limit;
    
    await getAllTasks(req, res);

  } catch (error) {
    handleError(res, error);
  }
};
