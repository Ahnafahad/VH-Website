import mongoose from 'mongoose';

export interface IRegistration extends mongoose.Document {
  name: string;
  email: string;
  phone: string;
  educationType: 'hsc' | 'alevels';
  years: {
    hscYear?: string;
    sscYear?: string;
    aLevelYear?: string;
    oLevelYear?: string;
  };
  programMode: 'mocks' | 'full';
  selectedMocks?: string[];
  mockIntent?: 'trial' | 'full';
  pricing?: {
    subtotal: number;
    discount: number;
    finalPrice: number;
  };
  selectedFullCourses?: string[];
  referral?: {
    name: string;
    institution: string;
    batch: string;
  };
  status: 'pending' | 'contacted' | 'enrolled' | 'cancelled';
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const RegistrationSchema = new mongoose.Schema<IRegistration>({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    index: true
  },
  phone: {
    type: String,
    required: true,
    trim: true
  },
  educationType: {
    type: String,
    required: true,
    enum: ['hsc', 'alevels']
  },
  years: {
    hscYear: String,
    sscYear: String,
    aLevelYear: String,
    oLevelYear: String
  },
  programMode: {
    type: String,
    required: true,
    enum: ['mocks', 'full']
  },
  selectedMocks: [{
    type: String,
    enum: ['du-iba', 'bup-iba', 'du-fbs', 'bup-fbs', 'fbs-detailed']
  }],
  mockIntent: {
    type: String,
    enum: ['trial', 'full']
  },
  pricing: {
    subtotal: Number,
    discount: Number,
    finalPrice: Number
  },
  selectedFullCourses: [{
    type: String,
    enum: ['du-iba-full', 'bup-iba-fbs-full']
  }],
  referral: {
    name: {
      type: String,
      trim: true
    },
    institution: {
      type: String,
      enum: ['BUP FBS', 'BUP IBA', 'IBA DU', 'DU FBS', 'Beyond the Horizon Alumni', 'Beyond the Horizon Current Student']
    },
    batch: {
      type: String,
      trim: true
    }
  },
  status: {
    type: String,
    required: true,
    enum: ['pending', 'contacted', 'enrolled', 'cancelled'],
    default: 'pending',
    index: true
  },
  notes: {
    type: String,
    trim: true
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

// Create compound indexes for better query performance
RegistrationSchema.index({ createdAt: -1, status: 1 });
RegistrationSchema.index({ email: 1, createdAt: -1 });
RegistrationSchema.index({ programMode: 1, status: 1 });

// Update the updatedAt timestamp before saving
RegistrationSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

export default mongoose.models.Registration || mongoose.model<IRegistration>('Registration', RegistrationSchema);
