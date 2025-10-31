import mongoose from 'mongoose';

export interface IRegistration extends mongoose.Document {
  name: string;
  email: string;
  phone: string;
  track: 'hsc' | 'alevels';
  years: {
    hsc?: string;
    ssc?: string;
    a?: string;
    o?: string;
  };
  mode: 'mocks' | 'full';
  mocks?: string[];
  full?: string[];
  intent?: 'trial' | 'full';
  totalPrice?: number;
  createdAt: Date;
}

const RegistrationSchema = new mongoose.Schema<IRegistration>({
  name: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String, required: true },
  track: { type: String, enum: ['hsc', 'alevels'], required: true },
  years: {
    hsc: { type: String },
    ssc: { type: String },
    a: { type: String },
    o: { type: String },
  },
  mode: { type: String, enum: ['mocks', 'full'], required: true },
  mocks: [{ type: String }],
  full: [{ type: String }],
  intent: { type: String, enum: ['trial', 'full'] },
  totalPrice: { type: Number },
  createdAt: { type: Date, default: Date.now }
});

RegistrationSchema.index({ createdAt: -1 });
RegistrationSchema.index({ email: 1, createdAt: -1 });

export default mongoose.models.Registration || mongoose.model<IRegistration>('Registration', RegistrationSchema);
