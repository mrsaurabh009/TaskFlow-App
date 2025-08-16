/**
 * Task Model - Mongoose Schema for MongoDB Atlas
 * Implements comprehensive validation, indexing, and middleware hooks
 */

import mongoose from 'mongoose';

/**
 * Task Schema Definition with validation rules
 */
const taskSchema = new mongoose.Schema({
  text: {
    type: String,
    required: [true, 'Task text is required'],
    trim: true,
    minlength: [3, 'Task text must be at least 3 characters'],
    maxlength: [255, 'Task text cannot exceed 255 characters'],
    validate: {
      validator: function(value) {
        // Additional validation: No HTML tags allowed
        const htmlRegex = /<[^>]*>/g;
        return !htmlRegex.test(value);
      },
      message: 'Task text cannot contain HTML tags'
    }
  },
  
  completed: {
    type: Boolean,
    default: false,
    index: true // Index for filtering queries
  },
  
  priority: {
    type: String,
    enum: {
      values: ['low', 'medium', 'high'],
      message: 'Priority must be either low, medium, or high'
    },
    default: 'medium',
    lowercase: true
  },
  
  category: {
    type: String,
    trim: true,
    maxlength: [50, 'Category cannot exceed 50 characters'],
    default: 'general'
  },
  
  dueDate: {
    type: Date,
    validate: {
      validator: function(value) {
        // Due date cannot be in the past (optional field)
        if (!value) return true;
        return value >= new Date().setHours(0, 0, 0, 0);
      },
      message: 'Due date cannot be in the past'
    }
  },
  
  tags: [{
    type: String,
    trim: true,
    lowercase: true,
    maxlength: [20, 'Tag cannot exceed 20 characters']
  }],
  
  createdAt: {
    type: Date,
    default: Date.now,
    immutable: true, // Prevents modification after creation
    index: true // Index for sorting
  },
  
  lastModified: {
    type: Date,
    default: Date.now
  },
  
  // Future-proofing for user relationship
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    // Not required for now, but ready for user authentication
    index: true
  },
  
  // Additional metadata
  metadata: {
    estimatedTime: {
      type: Number, // in minutes
      min: [1, 'Estimated time must be at least 1 minute'],
      max: [1440, 'Estimated time cannot exceed 24 hours (1440 minutes)']
    },
    actualTime: {
      type: Number, // in minutes
      min: [1, 'Actual time must be at least 1 minute']
    },
    difficulty: {
      type: String,
      enum: ['easy', 'medium', 'hard'],
      default: 'medium'
    }
  }
}, {
  // Schema options
  timestamps: {
    createdAt: false, // We're using our custom createdAt
    updatedAt: 'lastModified' // Use lastModified instead of updatedAt
  },
  toJSON: {
    transform: function(doc, ret) {
      // Clean up the returned object
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      return ret;
    }
  },
  toObject: {
    transform: function(doc, ret) {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      return ret;
    }
  }
});

/**
 * Indexes for optimized queries
 */
// Text search index for full-text search
taskSchema.index({ text: 'text', category: 'text', tags: 'text' });

// Compound indexes for common query patterns
taskSchema.index({ completed: 1, createdAt: -1 }); // Filter by completion status and sort by date
taskSchema.index({ priority: 1, dueDate: 1 }); // Filter by priority and due date
taskSchema.index({ category: 1, completed: 1 }); // Filter by category and completion
taskSchema.index({ userId: 1, completed: 1, createdAt: -1 }); // User-specific queries (future-ready)

// Sparse index for due dates (only index documents that have a due date)
taskSchema.index({ dueDate: 1 }, { sparse: true });

/**
 * Virtual properties
 */
// Calculate if task is overdue
taskSchema.virtual('isOverdue').get(function() {
  if (!this.dueDate || this.completed) return false;
  return new Date() > this.dueDate;
});

// Calculate days until due
taskSchema.virtual('daysUntilDue').get(function() {
  if (!this.dueDate || this.completed) return null;
  const today = new Date().setHours(0, 0, 0, 0);
  const due = new Date(this.dueDate).setHours(0, 0, 0, 0);
  return Math.ceil((due - today) / (1000 * 60 * 60 * 24));
});

/**
 * Pre-save middleware hooks
 */
taskSchema.pre('save', function(next) {
  // Update lastModified timestamp on every save
  this.lastModified = new Date();
  
  // Sanitize text input
  if (this.text) {
    this.text = this.text.replace(/\s+/g, ' ').trim();
  }
  
  // Validate tags array
  if (this.tags && this.tags.length > 10) {
    return next(new Error('Cannot have more than 10 tags per task'));
  }
  
  // Remove empty tags
  if (this.tags) {
    this.tags = this.tags.filter(tag => tag && tag.trim());
  }
  
  next();
});

/**
 * Pre-update middleware hooks
 */
taskSchema.pre(['findOneAndUpdate', 'updateOne', 'updateMany'], function(next) {
  // Update lastModified timestamp on updates
  this.set({ lastModified: new Date() });
  next();
});

/**
 * Post-save middleware hooks
 */
taskSchema.post('save', function(doc) {
  console.log(`Task saved: ${doc.text} (ID: ${doc._id})`);
});

/**
 * Post-remove middleware hooks
 */
taskSchema.post(['findOneAndDelete', 'deleteOne'], function(doc) {
  if (doc) {
    console.log(`Task deleted: ${doc.text} (ID: ${doc._id})`);
  }
});

/**
 * Static methods for the Task model
 */
// Find tasks by priority
taskSchema.statics.findByPriority = function(priority) {
  return this.find({ priority: priority.toLowerCase() }).sort({ createdAt: -1 });
};

// Find overdue tasks
taskSchema.statics.findOverdue = function() {
  return this.find({
    dueDate: { $lt: new Date() },
    completed: false
  }).sort({ dueDate: 1 });
};

// Get task statistics
taskSchema.statics.getStatistics = async function() {
  const stats = await this.aggregate([
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        completed: { $sum: { $cond: ['$completed', 1, 0] } },
        active: { $sum: { $cond: ['$completed', 0, 1] } },
        overdue: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $lt: ['$dueDate', new Date()] },
                  { $eq: ['$completed', false] }
                ]
              },
              1,
              0
            ]
          }
        }
      }
    },
    {
      $project: {
        _id: 0,
        total: 1,
        completed: 1,
        active: 1,
        overdue: 1,
        completionRate: {
          $cond: [
            { $eq: ['$total', 0] },
            0,
            { $multiply: [{ $divide: ['$completed', '$total'] }, 100] }
          ]
        }
      }
    }
  ]);
  
  return stats[0] || {
    total: 0,
    completed: 0,
    active: 0,
    overdue: 0,
    completionRate: 0
  };
};

/**
 * Instance methods for the Task model
 */
// Mark task as complete
taskSchema.methods.markComplete = function() {
  this.completed = true;
  this.lastModified = new Date();
  if (this.metadata) {
    // Set actual time if not already set
    if (!this.metadata.actualTime && this.metadata.estimatedTime) {
      this.metadata.actualTime = this.metadata.estimatedTime;
    }
  }
  return this.save();
};

// Mark task as incomplete
taskSchema.methods.markIncomplete = function() {
  this.completed = false;
  this.lastModified = new Date();
  return this.save();
};

// Add a tag to the task
taskSchema.methods.addTag = function(tag) {
  if (!this.tags.includes(tag.toLowerCase())) {
    this.tags.push(tag.toLowerCase());
    this.lastModified = new Date();
  }
  return this;
};

// Remove a tag from the task
taskSchema.methods.removeTag = function(tag) {
  this.tags = this.tags.filter(t => t !== tag.toLowerCase());
  this.lastModified = new Date();
  return this;
};

// Create the Task model
const Task = mongoose.model('Task', taskSchema);

export default Task;
