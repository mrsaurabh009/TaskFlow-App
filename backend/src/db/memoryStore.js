/**
 * In-Memory Task Storage (Development Fallback)
 * Used when MongoDB is not configured for local development
 */

let tasks = [];
let nextId = 1;

/**
 * In-Memory Task Model Mock
 */
export class InMemoryTask {
  static async find(filter = {}) {
    let results = [...tasks];
    
    // Apply filters
    if (filter.completed !== undefined) {
      results = results.filter(task => task.completed === filter.completed);
    }
    
    if (filter.priority) {
      results = results.filter(task => task.priority === filter.priority);
    }
    
    if (filter.category) {
      results = results.filter(task => task.category === filter.category);
    }
    
    if (filter.$text && filter.$text.$search) {
      const searchTerm = filter.$text.$search.toLowerCase();
      results = results.filter(task => 
        task.text.toLowerCase().includes(searchTerm) ||
        (task.category && task.category.toLowerCase().includes(searchTerm))
      );
    }
    
    // Sort by creation date (newest first)
    results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    return results;
  }
  
  static async findById(id) {
    return tasks.find(task => task._id === id || task.id === id);
  }
  
  static async findOne(filter) {
    return tasks.find(task => {
      for (const [key, value] of Object.entries(filter)) {
        if (task[key] !== value) return false;
      }
      return true;
    });
  }
  
  static async create(taskData) {
    const newTask = {
      _id: String(nextId++),
      id: String(nextId - 1),
      text: taskData.text,
      completed: taskData.completed || false,
      priority: taskData.priority || 'medium',
      category: taskData.category || 'general',
      dueDate: taskData.dueDate || null,
      tags: taskData.tags || [],
      metadata: taskData.metadata || {},
      createdAt: new Date(),
      updatedAt: new Date(),
      lastModified: new Date()
    };
    
    tasks.unshift(newTask);
    return newTask;
  }
  
  static async findByIdAndUpdate(id, updateData, options = {}) {
    const taskIndex = tasks.findIndex(task => task._id === id || task.id === id);
    
    if (taskIndex === -1) {
      if (options.new) return null;
      throw new Error('Task not found');
    }
    
    const updatedTask = {
      ...tasks[taskIndex],
      ...updateData,
      updatedAt: new Date(),
      lastModified: new Date()
    };
    
    tasks[taskIndex] = updatedTask;
    return updatedTask;
  }
  
  static async findByIdAndDelete(id) {
    const taskIndex = tasks.findIndex(task => task._id === id || task.id === id);
    
    if (taskIndex === -1) {
      return null;
    }
    
    const deletedTask = tasks[taskIndex];
    tasks.splice(taskIndex, 1);
    return deletedTask;
  }
  
  static async countDocuments(filter = {}) {
    const results = await this.find(filter);
    return results.length;
  }
  
  static async aggregate(pipeline) {
    // Simple aggregation for stats
    const stats = {
      total: tasks.length,
      completed: tasks.filter(t => t.completed).length,
      active: tasks.filter(t => !t.completed).length,
      byPriority: {
        low: tasks.filter(t => t.priority === 'low').length,
        medium: tasks.filter(t => t.priority === 'medium').length,
        high: tasks.filter(t => t.priority === 'high').length,
        urgent: tasks.filter(t => t.priority === 'urgent').length
      },
      byCategory: {}
    };
    
    // Count by category
    tasks.forEach(task => {
      const category = task.category || 'uncategorized';
      stats.byCategory[category] = (stats.byCategory[category] || 0) + 1;
    });
    
    return [stats];
  }
}

/**
 * Initialize with sample data for development
 */
export const initializeSampleData = () => {
  if (tasks.length === 0) {
    const sampleTasks = [
      {
        text: 'Complete TaskFlow project deployment',
        priority: 'high',
        category: 'work',
        tags: ['project', 'deployment']
      },
      {
        text: 'Review MongoDB integration',
        priority: 'medium',
        category: 'development',
        tags: ['database', 'review']
      },
      {
        text: 'Test frontend-backend integration',
        priority: 'high',
        category: 'testing',
        tags: ['integration', 'testing']
      },
      {
        text: 'Update documentation',
        priority: 'low',
        category: 'documentation',
        tags: ['docs', 'readme']
      },
      {
        text: 'Deploy to production',
        priority: 'urgent',
        category: 'deployment',
        tags: ['production', 'deployment']
      }
    ];
    
    sampleTasks.forEach(taskData => {
      InMemoryTask.create(taskData);
    });
    
    console.log(`📋 Initialized ${sampleTasks.length} sample tasks for development`);
  }
};

/**
 * Clear all tasks (for testing)
 */
export const clearTasks = () => {
  tasks = [];
  nextId = 1;
};

/**
 * Get current task count
 */
export const getTaskCount = () => tasks.length;

export default InMemoryTask;
