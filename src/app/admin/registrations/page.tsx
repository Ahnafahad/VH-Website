'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Users,
  CheckCircle,
  XCircle,
  Clock,
  Edit2,
  Save,
  X,
  UserPlus,
  Shield,
  RefreshCw,
  Search,
  Filter
} from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';

type Registration = {
  _id: string;
  name: string;
  email: string;
  phone: string;
  educationType: 'hsc' | 'alevels';
  years: any;
  programMode: 'mocks' | 'full';
  selectedMocks?: string[];
  selectedFullCourses?: string[];
  mockIntent?: 'trial' | 'full';
  pricing?: { subtotal: number; discount: number; finalPrice: number };
  referral?: { name: string; institution: string; batch: string };
  status: 'pending' | 'contacted' | 'enrolled' | 'cancelled';
  createdAt: string;
};

type Student = {
  studentId: string;
  name: string;
  email: string;
  role: string;
  permissions: string[];
  active: boolean;
  class?: string;
  batch?: string;
};

// Animation variants
const fadeInUp = {
  hidden: { opacity: 0, y: 40 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] }
  }
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] }
  }
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2
    }
  }
};

export default function AdminRegistrationsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<'registrations' | 'students'>('registrations');
  const [loading, setLoading] = useState(true);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [counts, setCounts] = useState({ pending: 0, contacted: 0, enrolled: 0, cancelled: 0 });
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Edit states
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<any>({});

  // Grant access modal
  const [showGrantAccessModal, setShowGrantAccessModal] = useState(false);
  const [grantAccessData, setGrantAccessData] = useState<any>({});

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  useEffect(() => {
    if (session) {
      loadData();
    }
  }, [session]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load registrations
      const regRes = await fetch('/api/registrations');
      if (!regRes.ok) throw new Error('Failed to load registrations');
      const regData = await regRes.json();
      setRegistrations(regData.registrations || []);
      setCounts(regData.counts || { pending: 0, contacted: 0, enrolled: 0, cancelled: 0 });

      // Load students from access control
      const studentsRes = await fetch('/api/admin/students');
      if (studentsRes.ok) {
        const studentsData = await studentsRes.json();
        setStudents(studentsData.students || []);
      }

      setError(null);
    } catch (e: any) {
      setError(e.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const updateRegistrationStatus = async (id: string, status: string) => {
    try {
      const res = await fetch(`/api/registrations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });

      if (!res.ok) throw new Error('Failed to update status');

      await loadData();
      alert('Status updated successfully!');
    } catch (e: any) {
      alert('Error: ' + e.message);
    }
  };

  const startEditing = (id: string, data: any) => {
    setEditingId(id);
    setEditData({ ...data });
  };

  const saveEdit = async () => {
    if (!editingId) return;

    try {
      const res = await fetch(`/api/registrations/${editingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editData)
      });

      if (!res.ok) throw new Error('Failed to save changes');

      setEditingId(null);
      setEditData({});
      await loadData();
      alert('Changes saved successfully!');
    } catch (e: any) {
      alert('Error: ' + e.message);
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditData({});
  };

  const openGrantAccessModal = (registration: Registration) => {
    setGrantAccessData({
      registrationId: registration._id,
      name: registration.name,
      email: registration.email,
      studentId: '',
      class: '',
      batch: '',
      permissions: ['read']
    });
    setShowGrantAccessModal(true);
  };

  const grantAccess = async () => {
    try {
      const res = await fetch('/api/admin/grant-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(grantAccessData)
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to grant access');
      }

      setShowGrantAccessModal(false);
      setGrantAccessData({});
      await loadData();
      alert('Access granted successfully! Access control file has been updated.');
    } catch (e: any) {
      alert('Error: ' + e.message);
    }
  };

  const updateStudent = async (studentId: string, updates: any) => {
    try {
      const res = await fetch('/api/admin/students', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId, ...updates })
      });

      if (!res.ok) throw new Error('Failed to update student');

      await loadData();
      alert('Student updated successfully!');
    } catch (e: any) {
      alert('Error: ' + e.message);
    }
  };

  const filteredRegistrations = registrations.filter(reg => {
    const matchesStatus = statusFilter === 'all' || reg.status === statusFilter;
    const matchesSearch = reg.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          reg.email.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const filteredStudents = students.filter(student =>
    student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-vh-beige/5 flex items-center justify-center">
        <motion.div
          className="text-center"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="w-16 h-16 border-4 border-vh-red-600 border-t-transparent rounded-full mx-auto mb-4"
          />
          <h2 className="text-2xl font-bold text-gray-900">Loading admin panel...</h2>
        </motion.div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-vh-beige/5 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
        >
          <Card variant="elevated" padding="xl" className="max-w-md">
            <div className="text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
              >
                <XCircle className="w-16 h-16 text-error-600 mx-auto mb-4" />
              </motion.div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Error</h2>
              <p className="text-error-600 mb-6">{error}</p>
              <Button
                variant="solid"
                colorScheme="primary"
                size="lg"
                onClick={loadData}
                className="w-full"
              >
                <RefreshCw className="w-5 h-5 mr-2" />
                Retry
              </Button>
            </div>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-vh-beige/5 relative overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0">
        <motion.div
          className="absolute top-20 right-20 w-72 h-72 bg-vh-red/5 rounded-full blur-3xl"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
        <motion.div
          className="absolute bottom-20 left-20 w-96 h-96 bg-vh-beige/10 rounded-full blur-3xl"
          animate={{
            scale: [1, 1.3, 1],
            opacity: [0.2, 0.4, 0.2],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 1
          }}
        />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">

        {/* Header */}
        <motion.div
          className="mb-8"
          variants={fadeInUp}
          initial="hidden"
          animate="visible"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-4xl font-black text-gray-900 mb-2">Admin Panel</h1>
              <p className="text-gray-600">Manage registrations and student access</p>
            </div>
            <Button
              variant="outline"
              size="md"
              onClick={loadData}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>

          {/* Stats Cards */}
          <motion.div
            className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6"
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
          >
            <motion.div variants={scaleIn}>
              <Card variant="outlined" padding="lg" className="bg-gradient-to-br from-warning-50 to-white border-2 border-warning-200 hover:shadow-lg transition-all duration-300">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-warning-600 text-sm font-semibold">Pending</p>
                    <p className="text-3xl font-black text-warning-700">{counts.pending}</p>
                  </div>
                  <Clock className="w-10 h-10 text-warning-500" />
                </div>
              </Card>
            </motion.div>
            <motion.div variants={scaleIn}>
              <Card variant="outlined" padding="lg" className="bg-gradient-to-br from-blue-50 to-white border-2 border-blue-200 hover:shadow-lg transition-all duration-300">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-blue-600 text-sm font-semibold">Contacted</p>
                    <p className="text-3xl font-black text-blue-700">{counts.contacted}</p>
                  </div>
                  <Users className="w-10 h-10 text-blue-500" />
                </div>
              </Card>
            </motion.div>
            <motion.div variants={scaleIn}>
              <Card variant="outlined" padding="lg" className="bg-gradient-to-br from-success-50 to-white border-2 border-success-200 hover:shadow-lg transition-all duration-300">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-success-600 text-sm font-semibold">Enrolled</p>
                    <p className="text-3xl font-black text-success-700">{counts.enrolled}</p>
                  </div>
                  <CheckCircle className="w-10 h-10 text-success-500" />
                </div>
              </Card>
            </motion.div>
            <motion.div variants={scaleIn}>
              <Card variant="outlined" padding="lg" className="bg-gradient-to-br from-purple-50 to-white border-2 border-purple-200 hover:shadow-lg transition-all duration-300">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-purple-600 text-sm font-semibold">Active Students</p>
                    <p className="text-3xl font-black text-purple-700">{students.length}</p>
                  </div>
                  <Shield className="w-10 h-10 text-purple-500" />
                </div>
              </Card>
            </motion.div>
          </motion.div>
        </motion.div>

        {/* Tabs */}
        <motion.div
          variants={scaleIn}
          initial="hidden"
          animate="visible"
          transition={{ delay: 0.3 }}
        >
          <Card variant="elevated" padding="none" className="overflow-hidden">
            <div className="border-b border-gray-200">
              <div className="flex">
                <button
                  onClick={() => setActiveTab('registrations')}
                  className={`flex-1 px-6 py-4 font-bold text-lg transition-all duration-300 ${
                    activeTab === 'registrations'
                      ? 'bg-gradient-to-r from-vh-red-600 to-vh-red-800 text-white shadow-lg'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <Users className="w-5 h-5 inline-block mr-2" />
                  Registrations ({registrations.length})
                </button>
                <button
                  onClick={() => setActiveTab('students')}
                  className={`flex-1 px-6 py-4 font-bold text-lg transition-all duration-300 ${
                    activeTab === 'students'
                      ? 'bg-gradient-to-r from-vh-red-600 to-vh-red-800 text-white shadow-lg'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <Shield className="w-5 h-5 inline-block mr-2" />
                  Active Students ({students.length})
                </button>
              </div>
            </div>

          {/* Filters */}
          <div className="p-6 bg-gray-50 border-b border-gray-200">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by name or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border-2 border-gray-200 rounded-lg focus:border-vh-red focus:ring-2 focus:ring-vh-red/20 outline-none transition-all"
                />
              </div>
              {activeTab === 'registrations' && (
                <div className="relative">
                  <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="pl-10 pr-8 py-2 border-2 border-gray-200 rounded-lg focus:border-vh-red focus:ring-2 focus:ring-vh-red/20 outline-none transition-all bg-white"
                  >
                    <option value="all">All Status</option>
                    <option value="pending">Pending</option>
                    <option value="contacted">Contacted</option>
                    <option value="enrolled">Enrolled</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
            {activeTab === 'registrations' ? (
              <motion.div
                className="space-y-4"
                variants={staggerContainer}
                initial="hidden"
                animate="visible"
              >
                {filteredRegistrations.length === 0 ? (
                  <motion.div variants={scaleIn} className="text-center py-12 text-gray-500">
                    <Users className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                    <p>No registrations found</p>
                  </motion.div>
                ) : (
                  filteredRegistrations.map((reg) => (
                    <motion.div key={reg._id} variants={scaleIn}>
                      <RegistrationCard
                        registration={reg}
                        editingId={editingId}
                        editData={editData}
                        onStartEdit={startEditing}
                        onSaveEdit={saveEdit}
                        onCancelEdit={cancelEdit}
                        onUpdateStatus={updateRegistrationStatus}
                        onGrantAccess={openGrantAccessModal}
                        setEditData={setEditData}
                      />
                    </motion.div>
                  ))
                )}
              </motion.div>
            ) : (
              // Students Tab
              <motion.div
                className="space-y-4"
                variants={staggerContainer}
                initial="hidden"
                animate="visible"
              >
                {filteredStudents.length === 0 ? (
                  <motion.div variants={scaleIn} className="text-center py-12 text-gray-500">
                    <Shield className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                    <p>No active students found</p>
                  </motion.div>
                ) : (
                  filteredStudents.map((student) => (
                    <motion.div key={student.studentId} variants={scaleIn}>
                      <StudentCard
                        student={student}
                        onUpdate={updateStudent}
                      />
                    </motion.div>
                  ))
                )}
              </motion.div>
            )}
          </div>
          </Card>
        </motion.div>
      </div>

      {/* Grant Access Modal */}
      {showGrantAccessModal && (
        <GrantAccessModal
          data={grantAccessData}
          onClose={() => setShowGrantAccessModal(false)}
          onGrant={grantAccess}
          setData={setGrantAccessData}
        />
      )}
    </div>
  );
}

// Component for registration card
function RegistrationCard({ registration, editingId, editData, onStartEdit, onSaveEdit, onCancelEdit, onUpdateStatus, onGrantAccess, setEditData }: any) {
  const reg = registration;
  const isEditing = editingId === reg._id;

  if (isEditing) {
    return (
      <Card variant="elevated" padding="lg" className="bg-gradient-to-br from-white to-gray-50">
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-gray-900">Edit Registration</h3>
            <div className="flex gap-2">
              <Button
                variant="solid"
                colorScheme="success"
                size="md"
                onClick={onSaveEdit}
              >
                <Save className="w-4 h-4 mr-2" />
                Save
              </Button>
              <Button
                variant="outline"
                size="md"
                onClick={onCancelEdit}
              >
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Name</label>
              <input
                type="text"
                value={editData.name || ''}
                onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-vh-red focus:ring-2 focus:ring-vh-red/20 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={editData.email || ''}
                onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-vh-red focus:ring-2 focus:ring-vh-red/20 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Phone</label>
              <input
                type="tel"
                value={editData.phone || ''}
                onChange={(e) => setEditData({ ...editData, phone: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-vh-red focus:ring-2 focus:ring-vh-red/20 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Status</label>
              <select
                value={editData.status || ''}
                onChange={(e) => setEditData({ ...editData, status: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-vh-red focus:ring-2 focus:ring-vh-red/20 outline-none bg-white"
              >
                <option value="pending">Pending</option>
                <option value="contacted">Contacted</option>
                <option value="enrolled">Enrolled</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card variant="elevated" padding="lg" className="hover:shadow-xl transition-all duration-300 group">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <h3 className="text-xl font-bold text-gray-900">{reg.name}</h3>
            <Badge
              variant="solid"
              colorScheme={
                reg.status === 'pending' ? 'warning' :
                reg.status === 'contacted' ? 'primary' :
                reg.status === 'enrolled' ? 'success' :
                'gray'
              }
              size="sm"
            >
              {reg.status.toUpperCase()}
            </Badge>
          </div>
          <p className="text-gray-600">{reg.email} • {reg.phone}</p>
          <p className="text-sm text-gray-500 mt-1">
            Registered: {new Date(reg.createdAt).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onStartEdit(reg._id, reg)}
            className="text-blue-600 hover:text-blue-800 hover:bg-blue-50"
          >
            <Edit2 className="w-5 h-5" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <p className="text-sm font-semibold text-gray-500 mb-2">Educational Background</p>
          <p className="text-gray-900">
            <strong>{reg.educationType === 'hsc' ? 'HSC Track' : 'A Levels Track'}</strong>
          </p>
          {reg.educationType === 'hsc' ? (
            <p className="text-sm text-gray-600 mt-1">
              SSC: {reg.years?.sscYear}, HSC: {reg.years?.hscYear}
            </p>
          ) : (
            <p className="text-sm text-gray-600 mt-1">
              O Level: {reg.years?.oLevelYear}, A Level: {reg.years?.aLevelYear}
            </p>
          )}
        </div>

        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <p className="text-sm font-semibold text-gray-500 mb-2">Program Type</p>
          <p className="text-gray-900">
            <strong>{reg.programMode === 'mocks' ? 'Mock Test Programs' : 'Full Courses'}</strong>
          </p>
          {reg.programMode === 'mocks' && (
            <p className="text-sm text-gray-600 mt-1">
              Intent: {reg.mockIntent === 'trial' ? 'Trial First' : 'Full Registration'}
            </p>
          )}
        </div>
      </div>

      {/* Program Details */}
      {reg.programMode === 'mocks' && reg.selectedMocks && reg.selectedMocks.length > 0 && (
        <div className="bg-blue-50 rounded-lg p-4 border border-blue-200 mb-4">
          <p className="text-sm font-semibold text-blue-900 mb-2">Selected Mock Programs:</p>
          <ul className="list-disc list-inside space-y-1 text-sm text-blue-800">
            {reg.selectedMocks.map((mock: string, idx: number) => (
              <li key={idx}>{mock.replace(/-/g, ' ').toUpperCase()}</li>
            ))}
          </ul>
          {reg.pricing && (
            <div className="mt-3 pt-3 border-t border-blue-300">
              <div className="flex justify-between text-sm">
                <span className="text-blue-700">Subtotal:</span>
                <span className="font-bold text-blue-900">Tk {reg.pricing.subtotal.toLocaleString()}</span>
              </div>
              {reg.pricing.discount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-blue-700">Discount:</span>
                  <span className="font-bold text-green-600">- Tk {reg.pricing.discount.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between text-base mt-1 pt-1 border-t border-blue-300">
                <span className="font-bold text-blue-900">Total:</span>
                <span className="font-black text-blue-900">Tk {reg.pricing.finalPrice.toLocaleString()}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Referral Information */}
      {reg.referral && (
        <div className="bg-purple-50 rounded-lg p-4 border border-purple-200 mb-4">
          <p className="text-sm font-semibold text-purple-900 mb-2">Referred By:</p>
          <div className="text-sm text-purple-800 space-y-1">
            <p><strong>Name:</strong> {reg.referral.name}</p>
            <p><strong>Institution:</strong> {reg.referral.institution}</p>
            <p><strong>Batch:</strong> {reg.referral.batch}</p>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-2 pt-4 border-t border-gray-200">
        <Button
          variant="solid"
          colorScheme="primary"
          size="sm"
          onClick={() => onUpdateStatus(reg._id, 'contacted')}
          disabled={reg.status === 'contacted'}
        >
          <Users className="w-4 h-4 mr-2" />
          Mark Contacted
        </Button>
        <Button
          variant="solid"
          colorScheme="success"
          size="sm"
          onClick={() => onUpdateStatus(reg._id, 'enrolled')}
          disabled={reg.status === 'enrolled'}
        >
          <CheckCircle className="w-4 h-4 mr-2" />
          Mark Enrolled
        </Button>
        <Button
          variant="solid"
          colorScheme="warning"
          size="sm"
          onClick={() => onGrantAccess(reg)}
        >
          <UserPlus className="w-4 h-4 mr-2" />
          Grant System Access
        </Button>
        <Button
          variant="solid"
          colorScheme="error"
          size="sm"
          onClick={() => onUpdateStatus(reg._id, 'cancelled')}
          disabled={reg.status === 'cancelled'}
        >
          <XCircle className="w-4 h-4 mr-2" />
          Cancel
        </Button>
      </div>
    </Card>
  );
}

// Component for student card
function StudentCard({ student, onUpdate }: any) {
  return (
    <Card variant="elevated" padding="lg" className="bg-gradient-to-br from-white to-purple-50 border-purple-200 hover:shadow-xl transition-all duration-300">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <h3 className="text-xl font-bold text-gray-900">{student.name}</h3>
            <Badge
              variant="solid"
              colorScheme={student.active ? 'success' : 'error'}
              size="sm"
            >
              {student.active ? 'ACTIVE' : 'INACTIVE'}
            </Badge>
          </div>
          <p className="text-gray-600">{student.email}</p>
          <p className="text-sm text-gray-500 mt-1">
            Student ID: {student.studentId} • Role: {student.role}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <div className="bg-white rounded-lg p-3 border border-gray-200">
          <p className="text-xs font-semibold text-gray-500 mb-1">Class</p>
          <input
            type="text"
            defaultValue={student.class || ''}
            onBlur={(e) => {
              if (e.target.value !== student.class) {
                onUpdate(student.studentId, { class: e.target.value });
              }
            }}
            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:border-vh-red focus:ring-1 focus:ring-vh-red/20 outline-none"
            placeholder="e.g., DU-FBS"
          />
        </div>

        <div className="bg-white rounded-lg p-3 border border-gray-200">
          <p className="text-xs font-semibold text-gray-500 mb-1">Batch</p>
          <input
            type="text"
            defaultValue={student.batch || ''}
            onBlur={(e) => {
              if (e.target.value !== student.batch) {
                onUpdate(student.studentId, { batch: e.target.value });
              }
            }}
            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:border-vh-red focus:ring-1 focus:ring-vh-red/20 outline-none"
            placeholder="e.g., 2025"
          />
        </div>

        <div className="bg-white rounded-lg p-3 border border-gray-200">
          <p className="text-xs font-semibold text-gray-500 mb-1">Status</p>
          <select
            defaultValue={student.active ? 'active' : 'inactive'}
            onChange={(e) => {
              onUpdate(student.studentId, { active: e.target.value === 'active' });
            }}
            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:border-vh-red focus:ring-1 focus:ring-vh-red/20 outline-none bg-white"
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-lg p-3 border border-gray-200">
        <p className="text-xs font-semibold text-gray-500 mb-2">Permissions</p>
        <div className="flex flex-wrap gap-2">
          {['read', 'write', 'admin', 'manage_users'].map((perm) => (
            <label key={perm} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={student.permissions.includes(perm)}
                onChange={(e) => {
                  const newPerms = e.target.checked
                    ? [...student.permissions, perm]
                    : student.permissions.filter((p: string) => p !== perm);
                  onUpdate(student.studentId, { permissions: newPerms });
                }}
                className="w-4 h-4 text-vh-red border-gray-300 rounded focus:ring-vh-red"
              />
              <span className="text-sm text-gray-700">{perm}</span>
            </label>
          ))}
        </div>
      </div>
    </Card>
  );
}

// Component for grant access modal
function GrantAccessModal({ data, onClose, onGrant, setData }: any) {
  return (
    <motion.div
      className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-900">Grant System Access</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="hover:bg-gray-100"
            >
              <X className="w-6 h-6" />
            </Button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-4">
            <p className="text-sm text-purple-900">
              <strong>Note:</strong> This will add the user to the access-control.json file and regenerate the access control system. They will be able to log in and access the platform.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Name *</label>
              <input
                type="text"
                value={data.name || ''}
                onChange={(e) => setData({ ...data, name: e.target.value })}
                className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-vh-red focus:ring-2 focus:ring-vh-red/20 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Email *</label>
              <input
                type="email"
                value={data.email || ''}
                onChange={(e) => setData({ ...data, email: e.target.value })}
                className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-vh-red focus:ring-2 focus:ring-vh-red/20 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Student ID * (6 digits)</label>
              <input
                type="text"
                value={data.studentId || ''}
                onChange={(e) => setData({ ...data, studentId: e.target.value })}
                placeholder="e.g., 757516"
                maxLength={6}
                className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-vh-red focus:ring-2 focus:ring-vh-red/20 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Class *</label>
              <input
                type="text"
                value={data.class || ''}
                onChange={(e) => setData({ ...data, class: e.target.value })}
                placeholder="e.g., DU-FBS, BUP-IBA"
                className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-vh-red focus:ring-2 focus:ring-vh-red/20 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Batch *</label>
              <input
                type="text"
                value={data.batch || ''}
                onChange={(e) => setData({ ...data, batch: e.target.value })}
                placeholder="e.g., 2025, 2026"
                className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-vh-red focus:ring-2 focus:ring-vh-red/20 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Permissions</label>
            <div className="flex flex-wrap gap-3">
              {['read', 'write', 'admin', 'manage_users'].map((perm) => (
                <label key={perm} className="flex items-center gap-2 cursor-pointer bg-gray-50 px-4 py-2 rounded-lg border-2 border-gray-200 hover:border-vh-red/50 transition-colors">
                  <input
                    type="checkbox"
                    checked={data.permissions?.includes(perm) || false}
                    onChange={(e) => {
                      const newPerms = e.target.checked
                        ? [...(data.permissions || []), perm]
                        : (data.permissions || []).filter((p: string) => p !== perm);
                      setData({ ...data, permissions: newPerms });
                    }}
                    className="w-4 h-4 text-vh-red border-gray-300 rounded focus:ring-vh-red"
                  />
                  <span className="text-sm font-medium text-gray-700">{perm}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
          <Button
            variant="outline"
            size="lg"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            variant="solid"
            colorScheme="primary"
            size="lg"
            onClick={onGrant}
            disabled={!data.name || !data.email || !data.studentId || !data.class || !data.batch}
          >
            Grant Access
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}
