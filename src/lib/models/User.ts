import mongoose from 'mongoose';

export interface IUser extends mongoose.Document {
  // Basic information
  email: string;
  name: string;

  // Role
  role: 'super_admin' | 'admin' | 'student';

  // For admins (optional)
  adminId?: string;

  // For students (optional)
  studentId?: string;
  roleNumbers?: string[]; // Array of role numbers (6-digit IBA, 7-digit FBS)
  class?: string;
  batch?: string;

  // Access Types - Broad categories that auto-grant specific mock access
  accessTypes: {
    IBA: boolean;  // Auto grants: DU IBA Mocks, BUP IBA Mocks
    FBS: boolean;  // Auto grants: DU FBS Mocks, BUP FBS Mocks
  };

  // Individual Mock Access - Fine-grained control (for future use)
  mockAccess: {
    duIba: boolean;
    bupIba: boolean;
    duFbs: boolean;
    bupFbs: boolean;
    fbsDetailed: boolean;
  };

  // Permissions
  permissions: string[];

  // Status
  active: boolean;

  // Metadata
  addedDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new mongoose.Schema<IUser>({
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  role: {
    type: String,
    required: true,
    enum: ['super_admin', 'admin', 'student'],
    default: 'student'
  },
  adminId: {
    type: String,
    sparse: true,
    unique: true,
    trim: true
  },
  studentId: {
    type: String,
    sparse: true,
    unique: true,
    trim: true,
    validate: {
      validator: function(v: string) {
        return !v || /^[0-9]{6}$/.test(v);
      },
      message: 'Student ID must be exactly 6 digits'
    }
  },
  roleNumbers: {
    type: [String],
    default: [],
    validate: {
      validator: function(v: string[]) {
        return !v || v.every(num => /^[0-9]{6,7}$/.test(num));
      },
      message: 'Role numbers must be 6 or 7 digits'
    }
  },
  class: {
    type: String,
    trim: true
  },
  batch: {
    type: String,
    trim: true
  },
  accessTypes: {
    IBA: {
      type: Boolean,
      default: false
    },
    FBS: {
      type: Boolean,
      default: false
    }
  },
  mockAccess: {
    duIba: {
      type: Boolean,
      default: false
    },
    bupIba: {
      type: Boolean,
      default: false
    },
    duFbs: {
      type: Boolean,
      default: false
    },
    bupFbs: {
      type: Boolean,
      default: false
    },
    fbsDetailed: {
      type: Boolean,
      default: false
    }
  },
  permissions: {
    type: [String],
    default: ['read']
  },
  active: {
    type: Boolean,
    default: true,
    index: true
  },
  addedDate: {
    type: Date,
    default: Date.now
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: -1
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Indexes for better performance
UserSchema.index({ email: 1, active: 1 });
UserSchema.index({ studentId: 1 }, { sparse: true });
UserSchema.index({ adminId: 1 }, { sparse: true });
UserSchema.index({ role: 1, active: 1 });

// Update the updatedAt timestamp before saving
UserSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Virtual to check if user has computed mock access
// This combines accessTypes rules with individual mockAccess overrides
UserSchema.virtual('computedMockAccess').get(function() {
  const computed = {
    duIba: this.mockAccess.duIba || this.accessTypes.IBA,
    bupIba: this.mockAccess.bupIba || this.accessTypes.IBA,
    duFbs: this.mockAccess.duFbs || this.accessTypes.FBS,
    bupFbs: this.mockAccess.bupFbs || this.accessTypes.FBS,
    fbsDetailed: this.mockAccess.fbsDetailed
  };
  return computed;
});

// Method to check if user has access to a specific mock
UserSchema.methods.hasMockAccess = function(mockName: string): boolean {
  const normalizedMockName = mockName.toLowerCase().replace(/[- ]/g, '');
  const computed = this.computedMockAccess;

  switch (normalizedMockName) {
    case 'duiba':
      return computed.duIba;
    case 'bupiba':
      return computed.bupIba;
    case 'dufbs':
      return computed.duFbs;
    case 'bupfbs':
      return computed.bupFbs;
    case 'fbsdetailed':
      return computed.fbsDetailed;
    default:
      return false;
  }
};

// Export the model
export default mongoose.models.User || mongoose.model<IUser>('User', UserSchema);
